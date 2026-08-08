//! The run executor: takes the agent's proposals, does the actual fitting,
//! computes guardrails, and hands the agent only finished summaries to write
//! prose about. Emits progress events so a caller (CLI or server) can render
//! the run as it happens. All timings are real.

use crate::evidence::{self, Evidence, FitFacts};
use crate::filing;
use crate::guardrails::{self, GuardrailConfig};
use crate::profile;
use plab_agent as agent;
use plab_core::protocol::*;
use plab_core::{PolicyRow, N_ZONES};
use plab_fit::design::{build_design, predict_rate, score_rows, AgeForm, ModelSpec, TerritoryForm};
use plab_fit::glm::{fit_glm, fit_nb2_profile, Family, Fit};
use plab_fit::metrics::gini;

#[derive(Debug, Clone, Copy)]
pub struct RunConfig {
    pub guardrails: GuardrailConfig,
    /// credibility constant for the 2023 filing fit (car years)
    pub filing_k: f64,
    /// credibility constant for EXP-03's modern blend
    pub blend_k: f64,
}

impl Default for RunConfig {
    fn default() -> Self {
        RunConfig {
            guardrails: GuardrailConfig::default(),
            filing_k: 1500.0,
            blend_k: 1500.0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ExperimentRecord {
    pub plan: ExperimentPlan,
    pub fit: Option<FitSummary>,
    pub rails: Option<GuardrailOutcome>,
    pub verdict: Verdict,
    /// final disposition after winner and absorbed adjustments
    pub disposition: Disposition,
    /// the artifacts behind the verdict, kept by the platform for the console.
    /// The agent never receives this.
    pub evidence: Option<Evidence>,
}

#[derive(Debug, Clone)]
pub enum RunEvent {
    Spawned {
        code: String,
        name: String,
        hypothesis: String,
        wave: u8,
    },
    Stage {
        code: String,
        stage: String,
    },
    Landed {
        record: ExperimentRecord,
    },
    Action {
        action: AgentAction,
    },
    Finished,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionKind {
    Read,
    Change,
    Fit,
    Refuse,
    Revert,
    Handoff,
}

impl ActionKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ActionKind::Read => "read",
            ActionKind::Change => "change",
            ActionKind::Fit => "fit",
            ActionKind::Refuse => "refuse",
            ActionKind::Revert => "revert",
            ActionKind::Handoff => "handoff",
        }
    }
}

/// One attributable step of the modeling agent's work, streamed out as it
/// happens so the record is a byproduct of the run, never a later
/// reconstruction.
#[derive(Debug, Clone)]
pub struct AgentAction {
    pub kind: ActionKind,
    pub target: String,
    pub detail: String,
    pub before: Option<String>,
    pub after: Option<String>,
    pub reversible: bool,
    pub refusal_reason: Option<String>,
    pub experiment_code: Option<String>,
}

/// What each archetype changes in the model specification, as
/// (target, before, after) — the preview a reader sees on the change action.
pub fn spec_change(archetype: Archetype) -> (&'static str, &'static str, &'static str) {
    match archetype {
        Archetype::SplineAge => ("Driver age term", "5 coarse bands", "natural cubic spline"),
        Archetype::InteractionAgeVehicle => {
            ("Driver age × vehicle age", "absent", "interaction term")
        }
        Archetype::CredibilityTerritory => (
            "Territory relativities",
            "2023 filed table",
            "credibility blend toward recent experience",
        ),
        Archetype::CappedAccidents => ("Prior accidents", "absent", "count capped at 3"),
        Archetype::NegBinomialFamily => ("Error family", "Poisson", "negative binomial"),
        Archetype::MileageBands => ("Annual mileage", "absent", "banded factor with imputation"),
        Archetype::ComboSplineAccidents => (
            "Age spline + capped accidents",
            "two separate candidates",
            "one combined specification",
        ),
    }
}

/// Refusals and reverts a landed experiment leaves in the action record.
pub fn actions_after_landing(record: &ExperimentRecord) -> Vec<AgentAction> {
    let code = record.plan.code.to_string();
    let mut out = Vec::new();
    if let Some(rails) = &record.rails {
        let mut reasons = Vec::new();
        if !rails.budget_ok {
            reasons.push(format!(
                "factor budget {} of {} exceeded",
                rails.budget_used, rails.budget_limit
            ));
        }
        if !rails.territory_ok {
            reasons.push(format!(
                "territory movement {:.1}% in {} beyond the filed {:.0}% tolerance",
                rails.territory_movement_pct, rails.territory_worst_zone, rails.territory_limit_pct
            ));
        }
        if !rails.folds_ok {
            reasons.push(format!(
                "lift held in only {} of {} folds",
                rails.folds_held, rails.folds_required
            ));
        }
        if !reasons.is_empty() {
            out.push(AgentAction {
                kind: ActionKind::Refuse,
                target: format!("{code} promotion"),
                detail: "A guardrail stops promotion. The agent cannot carry this change forward."
                    .into(),
                before: None,
                after: None,
                reversible: true,
                refusal_reason: Some(reasons.join("; ")),
                experiment_code: Some(code.clone()),
            });
        }
    }
    if record.disposition == Disposition::Scrapped {
        out.push(AgentAction {
            kind: ActionKind::Revert,
            target: format!("{code} specification"),
            detail: "Change not carried. The run branch keeps v12 plus surviving candidates only."
                .into(),
            before: None,
            after: None,
            reversible: true,
            refusal_reason: None,
            experiment_code: Some(code),
        });
    }
    out
}

#[derive(Debug, Clone)]
pub struct BaselineReport {
    pub gini: f64,
    pub deviance: f64,
    pub aic: f64,
    pub factors: u32,
    pub train_rows: usize,
}

#[derive(Debug, Clone)]
pub struct RunOutcome {
    pub baseline: BaselineReport,
    pub records: Vec<ExperimentRecord>,
    pub winner: Option<usize>,
    pub absorbed: Vec<usize>,
    pub train_delta: Option<f64>,
    pub holdout_delta: Option<f64>,
    pub review: Option<ReviewSummary>,
    pub profile: DataProfileFacts,
    pub filed_rel: Vec<f64>,
    pub config: RunConfig,
    /// Why one segment sits above the book on the model in force. Computed
    /// from the v12 fit, so it describes the model a reader is asking about
    /// rather than any experiment.
    pub segment_effects: Option<crate::evidence::Chart>,
}

struct FoldCache {
    /// per fold: validation gini of the baseline model fit on the other folds
    base_val_gini: Vec<f64>,
}

pub fn execute(
    rows: &[PolicyRow],
    config: RunConfig,
    sink: &mut dyn FnMut(RunEvent),
) -> Result<RunOutcome, String> {
    let profile = profile::profile(rows);
    let train: Vec<&PolicyRow> = rows.iter().filter(|r| !r.period.is_holdout()).collect();
    let holdout: Vec<&PolicyRow> = rows.iter().filter(|r| r.period.is_holdout()).collect();
    let filing_rows: Vec<&PolicyRow> = rows
        .iter()
        .filter(|r| matches!(r.period.as_str(), "2023H1" | "2023H2"))
        .collect();
    sink(RunEvent::Action {
        action: AgentAction {
            kind: ActionKind::Read,
            target: "Policy dataset".into(),
            detail: format!(
                "Profiled {} policy rows; Bodily Injury claim counts with earned exposure as the target.",
                fmt_thousands(rows.len())
            ),
            before: None,
            after: None,
            reversible: true,
            refusal_reason: None,
            experiment_code: None,
        },
    });

    // v12's filed territory table, frozen everywhere below
    let filed_rel = filing::filed_relativities(&filing_rows, config.filing_k)?;
    let filed_log: Vec<f64> = filed_rel.iter().map(|r| r.ln()).collect();
    sink(RunEvent::Action {
        action: AgentAction {
            kind: ActionKind::Read,
            target: "v12 filed territory relativities".into(),
            detail: "Recomputed the 2023 filing table from its own procedure. The table stays frozen for every experiment except EXP-03's blend.".into(),
            before: None,
            after: None,
            reversible: true,
            refusal_reason: None,
            experiment_code: None,
        },
    });

    // Baseline v12 on train
    let v12 = ModelSpec::v12();
    let d12 = build_design(&train, &v12, &filed_log);
    let f12 = fit_glm(&d12.x, &d12.y, &d12.offset, Family::Poisson)?;
    let r12 = predict_rate(&d12, &f12);
    let baseline_gini = gini(&r12, &d12.y, &d12.exposure);
    let baseline = BaselineReport {
        gini: baseline_gini,
        deviance: f12.deviance,
        aic: f12.aic,
        factors: 9,
        train_rows: train.len(),
    };
    let mu12: Vec<f64> = f12.mu.clone();
    sink(RunEvent::Action {
        action: AgentAction {
            kind: ActionKind::Fit,
            target: "Baseline v12 on train".into(),
            detail: format!(
                "Refit the model in force on {} train rows. Baseline Gini {:.4}; every experiment is judged against this fit.",
                fmt_thousands(train.len()),
                baseline_gini
            ),
            before: None,
            after: None,
            reversible: true,
            refusal_reason: None,
            experiment_code: None,
        },
    });

    // Why young drivers sit where they do on the model in force. Read from
    // v12's own coefficients, before any experiment touches anything.
    let segment_effects = Some(evidence::segment_effects_chart(
        &train,
        &d12.names,
        &d12.x,
        f12.beta.as_slice(),
        &filed_log,
        |r| r.driver_age <= 24,
        "drivers aged 18 to 24",
    ));

    // Per-fold baseline fits, shared across every variant's CV
    let mut fold_cache = FoldCache {
        base_val_gini: Vec::new(),
    };
    let mut fold_fit_rows: Vec<Vec<&PolicyRow>> = Vec::new();
    let mut fold_val_rows: Vec<Vec<&PolicyRow>> = Vec::new();
    for k in 0..plab_core::N_FOLDS {
        let fit_rows: Vec<&PolicyRow> = train
            .iter()
            .copied()
            .filter(|r| r.fold != Some(k))
            .collect();
        let val_rows: Vec<&PolicyRow> = train
            .iter()
            .copied()
            .filter(|r| r.fold == Some(k))
            .collect();
        let d = build_design(&fit_rows, &v12, &filed_log);
        let f = fit_glm(&d.x, &d.y, &d.offset, Family::Poisson)?;
        let (rates, y, e) = score_rows(&val_rows, &v12, &filed_log, &f);
        fold_cache.base_val_gini.push(gini(&rates, &y, &e));
        fold_fit_rows.push(fit_rows);
        fold_val_rows.push(val_rows);
    }
    sink(RunEvent::Action {
        action: AgentAction {
            kind: ActionKind::Fit,
            target: format!("{}-fold baseline cross-validation", plab_core::N_FOLDS),
            detail: "Fit the baseline once per fold so every experiment's fold deltas compare against the same held-out scores.".into(),
            before: None,
            after: None,
            reversible: true,
            refusal_reason: None,
            experiment_code: None,
        },
    });

    // The playbook's proposals, waves one and two
    let plans = agent::Playbook::base_plans();
    let mut records: Vec<ExperimentRecord> = Vec::new();

    for plan in &plans {
        run_one(
            plan,
            &train,
            &filed_rel,
            &filed_log,
            &baseline,
            &f12,
            &mu12,
            &fold_cache,
            &fold_fit_rows,
            &fold_val_rows,
            &profile,
            &config,
            sink,
            &mut records,
        )?;
    }

    // Wave three: the agent may propose a combination from its candidates
    let candidate_pairs: Vec<(&ExperimentPlan, &FitSummary)> = records
        .iter()
        .filter(|r| r.verdict.disposition == Disposition::Candidate)
        .filter_map(|r| r.fit.as_ref().map(|f| (&r.plan, f)))
        .collect();
    if let Some(combo) =
        agent::Playbook::propose_combo(&candidate_pairs, config.guardrails.budget_limit)
    {
        run_one(
            &combo,
            &train,
            &filed_rel,
            &filed_log,
            &baseline,
            &f12,
            &mu12,
            &fold_cache,
            &fold_fit_rows,
            &fold_val_rows,
            &profile,
            &config,
            sink,
            &mut records,
        )?;
    }

    // Winner: best delta Gini among candidates whose rails all held
    let winner = records
        .iter()
        .enumerate()
        .filter(|(_, r)| r.verdict.disposition == Disposition::Candidate)
        .filter(|(_, r)| {
            r.rails
                .as_ref()
                .map(|g| g.budget_ok && g.territory_ok && g.folds_ok)
                .unwrap_or(false)
        })
        .max_by(|a, b| {
            let da = a.1.fit.as_ref().map(|f| f.delta_gini).unwrap_or(f64::MIN);
            let db = b.1.fit.as_ref().map(|f| f.delta_gini).unwrap_or(f64::MIN);
            da.partial_cmp(&db).unwrap()
        })
        .map(|(i, _)| i);

    let mut absorbed = Vec::new();
    let mut train_delta = None;
    let mut holdout_delta = None;
    let mut review = None;

    if let Some(wi) = winner {
        let is_combo = records[wi].plan.archetype == Archetype::ComboSplineAccidents;
        let mut part_deltas = Vec::new();
        if is_combo {
            for (i, r) in records.iter_mut().enumerate() {
                if matches!(
                    r.plan.archetype,
                    Archetype::SplineAge | Archetype::CappedAccidents
                ) && r.verdict.disposition == Disposition::Candidate
                {
                    r.disposition = Disposition::Absorbed;
                    absorbed.push(i);
                    if let Some(f) = &r.fit {
                        part_deltas.push(f.delta_gini);
                    }
                }
            }
        }

        let w_fit = records[wi].fit.clone().unwrap();
        train_delta = Some(w_fit.delta_gini);

        // Out of time holdout: winner and baseline both trained on train,
        // both scored on 2025H2, compare Gini deltas there
        let w_spec = spec_for(records[wi].plan.archetype);
        let dw = build_design(&train, &w_spec, &filed_log);
        let fw = fit_glm(&dw.x, &dw.y, &dw.offset, w_spec.family)?;
        let (hr_w, hy, he) = score_rows(&holdout, &w_spec, &filed_log, &fw);
        let (hr_b, _, _) = score_rows(&holdout, &v12, &filed_log, &f12);
        let g_hold_w = gini(&hr_w, &hy, &he);
        let g_hold_b = gini(&hr_b, &hy, &he);
        holdout_delta = Some(g_hold_w - g_hold_b);

        // The agent rewrites the winner's verdict knowing the parts, then
        // writes its review summary
        if is_combo && !part_deltas.is_empty() {
            records[wi].verdict =
                agent::verdict_winner(&w_fit, &part_deltas, config.guardrails.budget_limit);
            records[wi].verdict.lineage = records[wi].plan.lineage.clone();
        } else {
            records[wi].verdict.disposition = Disposition::Winner;
        }
        records[wi].disposition = Disposition::Winner;
        sink(RunEvent::Action {
            action: AgentAction {
                kind: ActionKind::Change,
                target: "Run winner".into(),
                detail: format!(
                    "Promoted the best candidate whose guardrails all held, then confirmed the gain on the 2025H2 holdout ({:+.4} Gini).",
                    holdout_delta.unwrap_or(0.0)
                ),
                before: Some("no winner".into()),
                after: Some(records[wi].plan.code.to_string()),
                reversible: true,
                refusal_reason: None,
                experiment_code: Some(records[wi].plan.code.to_string()),
            },
        });

        review = Some(agent::review_summary(
            train_delta.unwrap(),
            holdout_delta.unwrap(),
            profile.acc3_exposure_pct,
        ));
        sink(RunEvent::Action {
            action: AgentAction {
                kind: ActionKind::Handoff,
                target: "Human review".into(),
                detail: "Wrote the review summary and requested human review. The agent cannot approve; creating a model version is the human's action alone.".into(),
                before: None,
                after: None,
                reversible: true,
                refusal_reason: None,
                experiment_code: Some(records[wi].plan.code.to_string()),
            },
        });
    }

    sink(RunEvent::Finished);

    Ok(RunOutcome {
        baseline,
        records,
        winner,
        absorbed,
        train_delta,
        holdout_delta,
        review,
        profile,
        filed_rel,
        config,
        segment_effects,
    })
}

fn spec_for(archetype: Archetype) -> ModelSpec {
    let v12 = ModelSpec::v12();
    match archetype {
        Archetype::SplineAge => ModelSpec {
            age: AgeForm::Spline,
            ..v12
        },
        Archetype::InteractionAgeVehicle => ModelSpec {
            age_vehicle_interaction: true,
            ..v12
        },
        Archetype::CredibilityTerritory => ModelSpec {
            territory: TerritoryForm::OffsetCustom,
            ..v12
        },
        Archetype::CappedAccidents => ModelSpec {
            accidents_capped: true,
            ..v12
        },
        Archetype::NegBinomialFamily => v12, // family swapped at fit time
        Archetype::MileageBands => v12,      // never fit
        Archetype::ComboSplineAccidents => ModelSpec {
            age: AgeForm::Spline,
            accidents_capped: true,
            ..v12
        },
    }
}

fn fitting_stage(archetype: Archetype) -> &'static str {
    match archetype {
        Archetype::SplineAge => "Fitting spline basis",
        Archetype::InteractionAgeVehicle => "Fitting interaction",
        Archetype::CredibilityTerritory => "Blending territories",
        Archetype::CappedAccidents => "Fitting capped count",
        Archetype::NegBinomialFamily => "Refitting family",
        Archetype::MileageBands => "Profiling mileage column",
        Archetype::ComboSplineAccidents => "Fitting combined model",
    }
}

#[allow(clippy::too_many_arguments)]
fn run_one(
    plan: &ExperimentPlan,
    train: &[&PolicyRow],
    filed_rel: &[f64],
    filed_log: &[f64],
    baseline: &BaselineReport,
    f12: &Fit,
    mu12: &[f64],
    fold_cache: &FoldCache,
    fold_fit_rows: &[Vec<&PolicyRow>],
    fold_val_rows: &[Vec<&PolicyRow>],
    profile: &DataProfileFacts,
    config: &RunConfig,
    sink: &mut dyn FnMut(RunEvent),
    records: &mut Vec<ExperimentRecord>,
) -> Result<(), String> {
    let code = plan.code.to_string();
    sink(RunEvent::Spawned {
        code: code.clone(),
        name: plan.name.to_string(),
        hypothesis: plan.hypothesis.to_string(),
        wave: plan.wave,
    });
    sink(RunEvent::Stage {
        code: code.clone(),
        stage: format!("Preparing {} rows", fmt_thousands(train.len())),
    });

    // Scrap before fitting: the agent's data-quality call on platform facts
    if agent::refuses_to_fit(plan, profile) {
        sink(RunEvent::Stage {
            code: code.clone(),
            stage: fitting_stage(plan.archetype).to_string(),
        });
        // A refusal still owes the reader its artifact: the profile that
        // caused it
        let record = ExperimentRecord {
            plan: plan.clone(),
            fit: None,
            rails: None,
            verdict: agent::verdict_skipped(profile),
            disposition: Disposition::Scrapped,
            evidence: Some(Evidence {
                facts: None,
                lift: Vec::new(),
                fold_deltas: Vec::new(),
                charts: evidence::missingness_charts(train),
            }),
        };
        sink(RunEvent::Action {
            action: AgentAction {
                kind: ActionKind::Refuse,
                target: format!("{code} fit"),
                detail: "Declined to fit on the platform's data profile. The refusal keeps its artifact: the missingness evidence below.".into(),
                before: None,
                after: None,
                reversible: true,
                refusal_reason: Some(record.verdict.expert_text.clone()),
                experiment_code: Some(code.clone()),
            },
        });
        records.push(record.clone());
        sink(RunEvent::Landed { record });
        return Ok(());
    }

    sink(RunEvent::Stage {
        code: code.clone(),
        stage: fitting_stage(plan.archetype).to_string(),
    });
    {
        let (target, before, after) = spec_change(plan.archetype);
        sink(RunEvent::Action {
            action: AgentAction {
                kind: ActionKind::Change,
                target: target.to_string(),
                detail: format!("{code} changes the specification on the run branch only; v12 itself is untouched."),
                before: Some(before.to_string()),
                after: Some(after.to_string()),
                reversible: true,
                refusal_reason: None,
                experiment_code: Some(code.clone()),
            },
        });
    }

    let spec = spec_for(plan.archetype);
    let is_nb = plan.archetype == Archetype::NegBinomialFamily;
    let is_blend = plan.archetype == Archetype::CredibilityTerritory;

    // EXP-03's modern credibility blend, computed on the full train rows
    let blend_rel = if is_blend {
        let (mut raw, zone_exp) = filing::raw_relativities(train)?;
        // normalize raw before blending, matching the filing procedure
        let total: f64 = zone_exp.iter().sum();
        let mean: f64 = (0..N_ZONES).map(|z| zone_exp[z] * raw[z]).sum::<f64>() / total;
        for r in raw.iter_mut() {
            *r /= mean;
        }
        Some(filing::blend(&raw, &zone_exp, config.blend_k))
    } else {
        None
    };
    let variant_log: Vec<f64> = match &blend_rel {
        Some(b) => b.iter().map(|r| r.ln()).collect(),
        None => filed_log.to_vec(),
    };

    // Full-train fit
    let d = build_design(train, &spec, &variant_log);
    let (fit, alpha) = if is_nb {
        let (f, a) = fit_nb2_profile(&d.x, &d.y, &d.offset)?;
        (f, Some(a))
    } else {
        (fit_glm(&d.x, &d.y, &d.offset, spec.family)?, None)
    };
    let rates = predict_rate(&d, &fit);
    let g = gini(&rates, &d.y, &d.exposure);

    // Fold CV against the cached baseline fits
    let mut fold_deltas = Vec::with_capacity(fold_fit_rows.len());
    for k in 0..fold_fit_rows.len() {
        sink(RunEvent::Stage {
            code: code.clone(),
            stage: format!("Scoring folds {}/{}", k + 1, fold_fit_rows.len()),
        });
        let fit_rows = &fold_fit_rows[k];
        let val_rows = &fold_val_rows[k];
        // EXP-03 recomputes its blend from the fold's training rows only
        let fold_log: Vec<f64> = if is_blend {
            let (mut raw, zone_exp) = filing::raw_relativities(fit_rows)?;
            let total: f64 = zone_exp.iter().sum();
            let mean: f64 = (0..N_ZONES).map(|z| zone_exp[z] * raw[z]).sum::<f64>() / total;
            for r in raw.iter_mut() {
                *r /= mean;
            }
            filing::blend(&raw, &zone_exp, config.blend_k)
                .iter()
                .map(|r| r.ln())
                .collect()
        } else {
            variant_log.clone()
        };
        let dk = build_design(fit_rows, &spec, &fold_log);
        let fk = if let Some(a) = alpha {
            fit_glm(&dk.x, &dk.y, &dk.offset, Family::NegBinomial { alpha: a })?
        } else {
            fit_glm(&dk.x, &dk.y, &dk.offset, spec.family)?
        };
        let (vr, vy, ve) = score_rows(val_rows, &spec, &fold_log, &fk);
        let gk = gini(&vr, &vy, &ve);
        fold_deltas.push(gk - fold_cache.base_val_gini[k]);
    }

    // Guardrails, all platform-side
    let (t_move, t_zone, t_direct) = if let Some(b) = &blend_rel {
        let (m, z) = guardrails::direct_territory_movement(filed_rel, b);
        (m, z, true)
    } else {
        let (m, z) = guardrails::indirect_territory_movement(train, &fit.mu, mu12);
        (m, z, false)
    };
    let rails = guardrails::assemble(
        &config.guardrails,
        plan.new_factors,
        t_move,
        t_zone,
        t_direct,
        &fold_deltas,
    );

    let summary = FitSummary {
        gini: g,
        delta_gini: g - baseline.gini,
        deviance_change_pct: if is_nb {
            None // deviance is not comparable across families
        } else {
            Some(100.0 * (fit.deviance - baseline.deviance) / baseline.deviance)
        },
        aic_delta: Some(fit.aic - baseline.aic),
        fold_deltas: fold_deltas.clone(),
        folds_pass: fold_deltas.iter().map(|d| *d > 0.0).collect(),
        budget_used: plan.new_factors,
    };

    // Evidence: the same artifacts the numbers above came from, shaped for
    // the console. Built here in the platform, never handed to the agent.
    let col = |name: &str| d.names.iter().position(|n| n == name);
    let base_rates: Vec<f64> = mu12
        .iter()
        .zip(&d.exposure)
        .map(|(m, e)| m / e.max(1e-12))
        .collect();
    let mut charts = Vec::new();
    match plan.archetype {
        Archetype::SplineAge | Archetype::ComboSplineAccidents => {
            let spline: Vec<f64> = d
                .names
                .iter()
                .enumerate()
                .filter(|(_, n)| n.starts_with("age_spline_"))
                .map(|(i, _)| fit.beta[i])
                .collect();
            // v12's column order is fixed: intercept, then the four age bands
            let bands: Vec<f64> = (1..5).map(|i| f12.beta[i]).collect();
            charts.push(evidence::age_curve_chart_with_exposure(
                &spline, &bands, train,
            ));
            if let Some(i) = col("prior_acc_capped3") {
                charts.push(evidence::accidents_chart(train, fit.beta[i]));
            }
        }
        Archetype::CappedAccidents => {
            if let Some(i) = col("prior_acc_capped3") {
                charts.push(evidence::accidents_chart(train, fit.beta[i]));
            }
        }
        Archetype::CredibilityTerritory => {
            if let Some(b) = &blend_rel {
                charts.push(evidence::territory_chart(filed_rel, b));
            }
        }
        Archetype::NegBinomialFamily => {
            if let Some(a) = alpha {
                charts.push(evidence::count_dist_chart(
                    &d.y,
                    mu12,
                    &fit.mu,
                    a,
                    fit.aic - baseline.aic,
                ));
            }
        }
        Archetype::InteractionAgeVehicle => {
            if let Some(i) = col("young_x_old_vehicle") {
                charts.push(evidence::interaction_chart(train, mu12, fit.beta[i]));
            }
        }
        Archetype::MileageBands => {}
    }
    let evidence = Evidence {
        facts: Some(FitFacts {
            rows: train.len(),
            params: fit.n_params,
            iterations: fit.iterations,
            converged: fit.converged,
            gini: g,
            baseline_gini: baseline.gini,
            deviance: fit.deviance,
            aic: fit.aic,
            alpha,
        }),
        lift: evidence::lift_buckets(&rates, &base_rates, &d.y, &d.exposure, 10),
        fold_deltas: fold_deltas.clone(),
        charts,
    };

    sink(RunEvent::Action {
        action: AgentAction {
            kind: ActionKind::Fit,
            target: format!("{code} GLM fit and fold CV"),
            detail: format!(
                "Train Gini {:.4} ({:+.4} vs baseline), scored across {} folds.",
                summary.gini,
                summary.delta_gini,
                summary.fold_deltas.len()
            ),
            before: None,
            after: None,
            reversible: true,
            refusal_reason: None,
            experiment_code: Some(code.clone()),
        },
    });

    let verdict = agent::verdict_fitted(plan, &summary, &rails);
    let disposition = verdict.disposition;
    let record = ExperimentRecord {
        plan: plan.clone(),
        fit: Some(summary),
        rails: Some(rails),
        verdict,
        disposition,
        evidence: Some(evidence),
    };
    for action in actions_after_landing(&record) {
        sink(RunEvent::Action { action });
    }
    records.push(record.clone());
    sink(RunEvent::Landed { record });
    Ok(())
}

pub fn fmt_thousands(n: usize) -> String {
    let s = n.to_string();
    let mut out = String::new();
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record_with(rails: Option<GuardrailOutcome>, disposition: Disposition) -> ExperimentRecord {
        let plan = agent::Playbook::base_plans()
            .into_iter()
            .find(|p| p.code == "EXP-03")
            .unwrap();
        ExperimentRecord {
            plan,
            fit: None,
            rails,
            verdict: Verdict {
                disposition,
                expert_text: String::new(),
                gloss_text: String::new(),
                lineage: None,
            },
            disposition,
            evidence: None,
        }
    }

    fn failing_territory_rails() -> GuardrailOutcome {
        GuardrailOutcome {
            budget_used: 0,
            budget_limit: 2,
            budget_ok: true,
            territory_movement_pct: 4.1,
            territory_worst_zone: "Z4".into(),
            territory_direct: true,
            territory_limit_pct: 3.0,
            territory_ok: false,
            folds_required: 4,
            folds_held: 5,
            folds_ok: true,
        }
    }

    #[test]
    fn scrapped_rail_failure_yields_refuse_then_revert() {
        let r = record_with(Some(failing_territory_rails()), Disposition::Scrapped);
        let acts = actions_after_landing(&r);
        assert_eq!(acts.len(), 2);
        assert_eq!(acts[0].kind, ActionKind::Refuse);
        assert!(acts[0]
            .refusal_reason
            .as_deref()
            .unwrap()
            .contains("territory"));
        assert_eq!(acts[1].kind, ActionKind::Revert);
        assert!(acts.iter().all(|a| a.reversible));
    }

    #[test]
    fn clean_candidate_yields_no_actions() {
        let mut rails = failing_territory_rails();
        rails.territory_ok = true;
        let r = record_with(Some(rails), Disposition::Candidate);
        assert!(actions_after_landing(&r).is_empty());
    }

    #[test]
    fn spec_change_covers_every_archetype() {
        for p in agent::Playbook::base_plans() {
            let (target, before, after) = spec_change(p.archetype);
            assert!(!target.is_empty() && !before.is_empty() && !after.is_empty());
        }
        let (target, _, _) = spec_change(Archetype::ComboSplineAccidents);
        assert!(!target.is_empty());
    }
}
