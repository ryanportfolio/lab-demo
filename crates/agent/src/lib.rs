//! The modeling agent: a deterministic planner and verdict writer. It
//! proposes experiments from a playbook, reads platform-computed summaries,
//! and writes two-layer prose: a dense expert line and a plain-terms gloss.
//! Gloss phrasings come from the vetted briefing glossary; every sentence
//! that interpolates a computed number stays true for any value the
//! computation can produce.

use plab_core::protocol::*;

pub struct Playbook;

impl Playbook {
    /// Waves one and two: the six base archetypes, in board order.
    pub fn base_plans() -> Vec<ExperimentPlan> {
        vec![
            ExperimentPlan {
                code: "EXP-01",
                name: "Spline on driver_age",
                hypothesis: "The age effect bends at both ends of the curve. Fit a natural cubic spline with three knots in place of the banded factor.",
                archetype: Archetype::SplineAge,
                new_factors: 1,
                factor_names: &["driver_age spline"],
                wave: 1,
                lineage: None,
            },
            ExperimentPlan {
                code: "EXP-02",
                name: "Age by vehicle age interaction",
                hypothesis: "Young drivers in old vehicles may carry compounding risk. Add the interaction at coarse bands.",
                archetype: Archetype::InteractionAgeVehicle,
                new_factors: 1,
                factor_names: &["age x vehicle age"],
                wave: 1,
                lineage: None,
            },
            ExperimentPlan {
                code: "EXP-03",
                name: "Credibility blended territory",
                hypothesis: "Blend raw territory relativities toward the statewide mean by earned exposure.",
                archetype: Archetype::CredibilityTerritory,
                new_factors: 0,
                factor_names: &[],
                wave: 1,
                lineage: None,
            },
            ExperimentPlan {
                code: "EXP-04",
                name: "Prior accidents, capped count",
                hypothesis: "Claim frequency climbs with prior at fault accidents. Add the count capped at three to protect the tail.",
                archetype: Archetype::CappedAccidents,
                new_factors: 1,
                factor_names: &["prior accidents capped"],
                wave: 2,
                lineage: None,
            },
            ExperimentPlan {
                code: "EXP-05",
                name: "Negative binomial family",
                hypothesis: "Overdispersion in the claim counts suggests the Poisson family understates variance.",
                archetype: Archetype::NegBinomialFamily,
                new_factors: 0,
                factor_names: &[],
                wave: 2,
                lineage: None,
            },
            ExperimentPlan {
                code: "EXP-06",
                name: "Annual mileage bands",
                hypothesis: "Mileage should separate low use from commuter risk. Band it and add to the frequency model.",
                archetype: Archetype::MileageBands,
                new_factors: 1,
                factor_names: &["annual mileage bands"],
                wave: 2,
                lineage: None,
            },
        ]
    }

    /// Wave three: propose a combination when two candidates spend disjoint
    /// factor slots inside the budget. Deterministic: picks the two best by
    /// delta Gini.
    pub fn propose_combo(
        candidates: &[(&ExperimentPlan, &FitSummary)],
        budget_limit: u32,
    ) -> Option<ExperimentPlan> {
        let mut sorted: Vec<_> = candidates.to_vec();
        sorted.sort_by(|a, b| b.1.delta_gini.partial_cmp(&a.1.delta_gini).unwrap());
        for i in 0..sorted.len() {
            for j in (i + 1)..sorted.len() {
                let (pa, pb) = (sorted[i].0, sorted[j].0);
                let disjoint = pa
                    .factor_names
                    .iter()
                    .all(|f| !pb.factor_names.contains(f));
                if disjoint && pa.new_factors + pb.new_factors <= budget_limit {
                    if pa.archetype == Archetype::SplineAge
                        && pb.archetype == Archetype::CappedAccidents
                        || pa.archetype == Archetype::CappedAccidents
                            && pb.archetype == Archetype::SplineAge
                    {
                        return Some(ExperimentPlan {
                            code: "EXP-07",
                            name: "Combine spline and prior accidents",
                            hypothesis: "EXP-01 and EXP-04 attack different residuals. Fit both together and check the overlap.",
                            archetype: Archetype::ComboSplineAccidents,
                            new_factors: pa.new_factors + pb.new_factors,
                            factor_names: &["driver_age spline", "prior accidents capped"],
                            wave: 3,
                            lineage: Some(format!(
                                "proposed by the agent from {} + {}",
                                pa.code.min(pb.code),
                                pa.code.max(pb.code)
                            )),
                        });
                    }
                }
            }
        }
        None
    }
}

/// Scrap-before-fit check for the mileage archetype: the platform profiler
/// supplies the facts, the agent makes the call.
pub fn refuses_to_fit(plan: &ExperimentPlan, profile: &DataProfileFacts) -> bool {
    plan.archetype == Archetype::MileageBands
        && profile.mileage_missing_pct > 15.0
        && profile.mileage_missing_region_max_pct
            > profile.mileage_missing_region_min_pct + 10.0
}

fn count_word(n: u32) -> &'static str {
    match n {
        0 => "zero",
        1 => "one",
        2 => "two",
        3 => "three",
        4 => "four",
        5 => "five",
        _ => "many",
    }
}

/// Verdict for an experiment the agent refused to fit.
pub fn verdict_skipped(profile: &DataProfileFacts) -> Verdict {
    let pct = profile.mileage_missing_pct;
    Verdict {
        disposition: Disposition::Scrapped,
        expert_text: format!(
            "{pct:.0}% of mileage is missing and the gaps correlate with region, needs data work first"
        ),
        gloss_text: format!(
            "Mileage should matter, but {pct:.0}% of drivers are missing it and the gaps cluster by region. Filling them in blind would bake regional bias into prices, so the agent stopped before fitting anything."
        ),
        lineage: None,
    }
}

/// Verdict for a fitted experiment, from platform-computed facts. The
/// binding rail is recorded: territory beats folds beats judgment, matching
/// how the run actually killed it.
pub fn verdict_fitted(
    plan: &ExperimentPlan,
    fit: &FitSummary,
    rails: &GuardrailOutcome,
) -> Verdict {
    // territory rail is the binding reason when it fails
    if !rails.territory_ok {
        let m = rails.territory_movement_pct;
        let limit = rails.territory_limit_pct;
        let (expert, gloss) = if rails.territory_direct {
            (
                format!(
                    "territory relativities move {m:.1}%, outside the {limit:.0}% guardrail"
                ),
                format!(
                    "Zones with thin claim history get their price pulled toward the statewide average, trusting small samples less. Accuracy {}, but some zone prices moved {m:.1}%, {} the {limit:.0}% drift the filing allows.",
                    if fit.delta_gini > 0.0 { "improved" } else { "did not improve" },
                    if m > 2.0 * limit { "far past" } else { "past" },
                ),
            )
        } else {
            (
                format!(
                    "zone level average rates move {m:.1}% with relativities frozen, outside the {limit:.0}% guardrail"
                ),
                format!(
                    "The zone price multipliers stayed pinned, but the new factors spread unevenly across the map, so the average rate inside one zone still drifted {m:.1}%, {} the {limit:.0}% limit the filing allows.",
                    if m > 2.0 * limit { "far past" } else { "past" },
                ),
            )
        };
        return Verdict {
            disposition: Disposition::Scrapped,
            expert_text: expert,
            gloss_text: gloss,
            lineage: plan.lineage.clone(),
        };
    }

    // Family judgment call comes before the folds rail: with no lift to
    // validate, fold dots on a flat change are sign noise around zero, and
    // the binding reason is the judgment, not the jitter
    if plan.archetype == Archetype::NegBinomialFamily {
        let aic = fit.aic_delta.unwrap_or(0.0);
        if fit.delta_gini.abs() < 0.002 {
            let (expert, gloss) = if aic < 0.0 {
                (
                    "AIC prefers it, but lift is flat and the family change adds filing complexity".to_string(),
                    "Claim counts vary more widely than the current kind of model expects. A different kind matches that spread better on paper, AIC is the score that says so, but it ranks drivers no better, and switching would complicate the regulatory filing.".to_string(),
                )
            } else {
                (
                    "AIC does not prefer it and lift is flat, no reason to switch families".to_string(),
                    "A different kind of model was tried for the shape of the claim counts, but it neither scores better on paper nor ranks drivers better, so there is no reason to take on a more complicated filing.".to_string(),
                )
            };
            return Verdict {
                disposition: Disposition::Scrapped,
                expert_text: expert,
                gloss_text: gloss,
                lineage: plan.lineage.clone(),
            };
        }
    }

    if !rails.folds_ok {
        let held = rails.folds_held;
        let gain_word = if fit.delta_gini.abs() < 0.003 {
            "tiny "
        } else {
            ""
        };
        return Verdict {
            disposition: Disposition::Scrapped,
            expert_text: "gain does not survive fold jitter".to_string(),
            gloss_text: format!(
                "The {gain_word}gain appeared on only {} of five slices of the data, so it reads as noise, not signal.",
                count_word(held),
            ),
            lineage: plan.lineage.clone(),
        };
    }

    // candidate: all rails held
    let all_folds = rails.folds_held == rails.folds_required;
    let expert = if all_folds {
        "lift holds across all five folds".to_string()
    } else {
        format!(
            "lift holds on {} of five folds, within the rail",
            count_word(rails.folds_held)
        )
    };
    let gloss = match plan.archetype {
        Archetype::SplineAge => format!(
            "Risk by age is a curve, not stair steps. A smooth curve captures 18 year olds and 80 year olds better than fixed age bands, and the gain held on {} re checks.",
            if all_folds { "all five".to_string() } else { format!("{} of five", count_word(rails.folds_held)) },
        ),
        Archetype::CappedAccidents => format!(
            "Drivers with prior at fault accidents go on to cause more claims. The count is capped at three so one rare outlier cannot distort prices, and the gain held on {}.",
            if all_folds { "every slice".to_string() } else { format!("{} of five slices", count_word(rails.folds_held)) },
        ),
        Archetype::ComboSplineAccidents => format!(
            "The age curve and the accident count fix different kinds of misses, so together they keep {} of their separate gains. It uses both new factor slots.",
            "most", // refined by verdict_winner when overlap is known
        ),
        _ => format!(
            "The change improved how well the model separates high risk drivers from low risk, and the gain held on {} slices of the data.",
            if all_folds { "all five".to_string() } else { count_word(rails.folds_held).to_string() },
        ),
    };
    Verdict {
        disposition: Disposition::Candidate,
        expert_text: expert,
        gloss_text: gloss,
        lineage: plan.lineage.clone(),
    }
}

/// Rewrite the winner's verdict once the platform names it: overlap wording
/// derives from the real sum of the parts.
pub fn verdict_winner(
    fit: &FitSummary,
    part_deltas: &[f64],
    budget_limit: u32,
) -> Verdict {
    let sum: f64 = part_deltas.iter().sum();
    let overlap = if fit.delta_gini >= sum - 1e-9 {
        "gains stack in full"
    } else if fit.delta_gini > 0.75 * sum {
        "gains overlap slightly"
    } else {
        "gains overlap substantially"
    };
    let keep = if fit.delta_gini >= sum - 1e-9 {
        "their full separate gains"
    } else if fit.delta_gini > 0.75 * sum {
        "almost their full separate gains"
    } else {
        "part of their separate gains"
    };
    Verdict {
        disposition: Disposition::Winner,
        expert_text: format!(
            "{overlap}, combined lift {:+.3} within the {} factor budget",
            fit.delta_gini,
            count_word(budget_limit),
        ),
        gloss_text: format!(
            "The age curve and the accident count fix different kinds of misses, so combined they keep {keep}. This is the winner, and it uses both new factor slots."
        ),
        lineage: None,
    }
}

/// The agent's review summary. Shrinkage wording adapts to whatever the
/// holdout actually did, so the sentence stays true for any outcome.
pub fn review_summary(
    train_delta: f64,
    holdout_delta: f64,
    acc3_exposure_pct: f64,
) -> ReviewSummary {
    let shrink = if holdout_delta <= 0.0 {
        "the gain did not survive out of time, this review should not be approved without investigation"
    } else if holdout_delta >= train_delta {
        "no shrinkage this time, the gain held in full"
    } else if holdout_delta >= 0.5 * train_delta {
        "shrinkage in the expected range"
    } else {
        "a larger drop than typical, worth understanding before approving"
    };
    ReviewSummary {
        paragraphs: vec![
            format!(
                "EXP-07 combines the driver_age spline with the capped prior accidents count. Train lift is {train_delta:+.3} and the out of time holdout comes in at {holdout_delta:+.3}, {shrink}."
            ),
            format!(
                "The one number to look at before approving: the 3+ prior accidents level carries {acc3_exposure_pct:.1}% of exposure and rides partial credibility, so its relativity is the least settled part of this change."
            ),
        ],
        gloss: format!(
            "Out of time holdout scores the model on the newest half year of data, which it never saw in training. Gains usually shrink there, so {train_delta:+.3} landing at {holdout_delta:+.3} is the number to judge. Partial credibility means the 3+ accidents group is small, {acc3_exposure_pct:.1}% of the book, so its price leans partly on the overall average instead of its own thin history."
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn plan(archetype: Archetype) -> ExperimentPlan {
        ExperimentPlan {
            code: "EXP-XX",
            name: "test",
            hypothesis: "test",
            archetype,
            new_factors: 1,
            factor_names: &["f"],
            wave: 1,
            lineage: None,
        }
    }

    fn rails_ok() -> GuardrailOutcome {
        GuardrailOutcome {
            budget_used: 1,
            budget_limit: 2,
            budget_ok: true,
            territory_movement_pct: 3.0,
            territory_worst_zone: "T-114".into(),
            territory_direct: false,
            territory_limit_pct: 5.0,
            territory_ok: true,
            folds_required: 5,
            folds_held: 5,
            folds_ok: true,
        }
    }

    #[test]
    fn territory_rail_is_binding_over_folds() {
        let mut rails = rails_ok();
        rails.territory_ok = false;
        rails.territory_direct = true;
        rails.territory_movement_pct = 11.4;
        rails.folds_ok = false;
        rails.folds_held = 4;
        let v = verdict_fitted(
            &plan(Archetype::CredibilityTerritory),
            &FitSummary { delta_gini: 0.006, ..Default::default() },
            &rails,
        );
        assert_eq!(v.disposition, Disposition::Scrapped);
        assert!(v.expert_text.contains("11.4%"), "{}", v.expert_text);
        assert!(v.expert_text.contains("territory relativities move"));
        assert!(v.gloss_text.contains("far past"));
    }

    #[test]
    fn fold_jitter_wording_matches_reality() {
        let mut rails = rails_ok();
        rails.folds_ok = false;
        rails.folds_held = 2;
        let v = verdict_fitted(
            &plan(Archetype::InteractionAgeVehicle),
            &FitSummary { delta_gini: 0.002, ..Default::default() },
            &rails,
        );
        assert!(v.expert_text.contains("fold jitter"));
        assert!(v.gloss_text.contains("two of five"));
        assert!(v.gloss_text.contains("tiny"));
    }

    #[test]
    fn family_verdict_tracks_aic_sign() {
        let preferred = verdict_fitted(
            &plan(Archetype::NegBinomialFamily),
            &FitSummary { delta_gini: 0.0004, aic_delta: Some(-12.0), ..Default::default() },
            &rails_ok(),
        );
        assert!(preferred.expert_text.starts_with("AIC prefers it"));
        let not_preferred = verdict_fitted(
            &plan(Archetype::NegBinomialFamily),
            &FitSummary { delta_gini: 0.0004, aic_delta: Some(3.0), ..Default::default() },
            &rails_ok(),
        );
        assert!(not_preferred.expert_text.contains("does not prefer"));
    }

    #[test]
    fn shrinkage_wording_stays_true_for_any_value() {
        for (t, h, needle) in [
            (0.018, 0.014, "expected range"),
            (0.018, 0.019, "held in full"),
            (0.018, 0.005, "larger drop"),
            (0.018, -0.001, "did not survive"),
        ] {
            let s = review_summary(t, h, 1.9);
            assert!(
                s.paragraphs[0].contains(needle),
                "t={t} h={h}: {}",
                s.paragraphs[0]
            );
        }
    }

    #[test]
    fn combo_proposal_needs_disjoint_factors() {
        let p1 = ExperimentPlan { new_factors: 1, factor_names: &["driver_age spline"], ..plan(Archetype::SplineAge) };
        let p4 = ExperimentPlan { new_factors: 1, factor_names: &["prior accidents capped"], ..plan(Archetype::CappedAccidents) };
        let s1 = FitSummary { delta_gini: 0.011, ..Default::default() };
        let s4 = FitSummary { delta_gini: 0.009, ..Default::default() };
        let combo = Playbook::propose_combo(&[(&p1, &s1), (&p4, &s4)], 2).unwrap();
        assert_eq!(combo.code, "EXP-07");
        assert_eq!(combo.new_factors, 2);
        assert!(combo.lineage.as_deref().unwrap().contains("EXP-XX"));
    }

    #[test]
    fn no_em_dashes_or_trailing_periods_in_expert_layer() {
        let v = verdict_fitted(
            &plan(Archetype::SplineAge),
            &FitSummary { delta_gini: 0.011, ..Default::default() },
            &rails_ok(),
        );
        for s in [&v.expert_text, &v.gloss_text] {
            assert!(!s.contains('\u{2014}'), "em dash in {s}");
        }
        assert!(!v.expert_text.ends_with('.'), "expert layer ends with period");
    }
}
