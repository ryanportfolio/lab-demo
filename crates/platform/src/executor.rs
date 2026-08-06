//! The run executor: takes the agent's proposals, does the actual fitting,
//! computes guardrails, and hands the agent only finished summaries to write
//! prose about. Emits progress events so a caller (CLI or server) can render
//! the run as it happens. All timings are real.

use crate::filing;
use crate::guardrails::{self, GuardrailConfig};
use crate::profile;
use plab_agent as agent;
use plab_core::protocol::*;
use plab_core::{PolicyRow, N_ZONES};
use plab_fit::design::{
    build_design, predict_rate, score_rows, AgeForm, ModelSpec, TerritoryForm,
};
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
    Finished,
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

    // v12's filed territory table, frozen everywhere below
    let filed_rel = filing::filed_relativities(&filing_rows, config.filing_k)?;
    let filed_log: Vec<f64> = filed_rel.iter().map(|r| r.ln()).collect();

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
        let is_combo =
            records[wi].plan.archetype == Archetype::ComboSplineAccidents;
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
            records[wi].verdict = agent::verdict_winner(
                &w_fit,
                &part_deltas,
                config.guardrails.budget_limit,
            );
            records[wi].verdict.lineage = records[wi].plan.lineage.clone();
        } else {
            records[wi].verdict.disposition = Disposition::Winner;
        }
        records[wi].disposition = Disposition::Winner;

        review = Some(agent::review_summary(
            train_delta.unwrap(),
            holdout_delta.unwrap(),
            profile.acc3_exposure_pct,
        ));
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
        let record = ExperimentRecord {
            plan: plan.clone(),
            fit: None,
            rails: None,
            verdict: agent::verdict_skipped(profile),
            disposition: Disposition::Scrapped,
        };
        records.push(record.clone());
        sink(RunEvent::Landed { record });
        return Ok(());
    }

    sink(RunEvent::Stage {
        code: code.clone(),
        stage: fitting_stage(plan.archetype).to_string(),
    });

    let spec = spec_for(plan.archetype);
    let is_nb = plan.archetype == Archetype::NegBinomialFamily;
    let is_blend = plan.archetype == Archetype::CredibilityTerritory;

    // EXP-03's modern credibility blend, computed on the full train rows
    let blend_rel = if is_blend {
        let (mut raw, zone_exp) = filing::raw_relativities(train)?;
        // normalize raw before blending, matching the filing procedure
        let total: f64 = zone_exp.iter().sum();
        let mean: f64 =
            (0..N_ZONES).map(|z| zone_exp[z] * raw[z]).sum::<f64>() / total;
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
            let mean: f64 =
                (0..N_ZONES).map(|z| zone_exp[z] * raw[z]).sum::<f64>() / total;
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

    let verdict = agent::verdict_fitted(plan, &summary, &rails);
    let disposition = verdict.disposition;
    let record = ExperimentRecord {
        plan: plan.clone(),
        fit: Some(summary),
        rails: Some(rails),
        verdict,
        disposition,
    };
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
