//! M3 proof: the whole run end to end on the CLI, printing the live stages,
//! the ledger with real numbers, the guardrail outcomes, and the review the
//! agent would open. Elapsed time is real compute.

use plab_platform::executor::{execute, RunConfig, RunEvent};
use std::path::Path;
use std::time::Instant;

fn main() {
    let rows = plab_platform::load_rows(Path::new("data/policies.csv")).expect("load rows");
    println!("loaded {} rows\n", rows.len());

    let t0 = Instant::now();
    let mut sink = |ev: RunEvent| match ev {
        RunEvent::Spawned { code, name, .. } => {
            println!("[{:6.2}s] {code} spawned · {name}", t0.elapsed().as_secs_f64());
        }
        RunEvent::Stage { code, stage } => {
            println!("[{:6.2}s] {code}   {stage}", t0.elapsed().as_secs_f64());
        }
        RunEvent::Landed { record } => {
            let chips = match &record.fit {
                Some(f) => {
                    let dev = match f.deviance_change_pct {
                        Some(d) => format!("deviance {d:+.2}%"),
                        None => format!(
                            "AIC {:+.0}",
                            f.aic_delta.unwrap_or(f64::NAN)
                        ),
                    };
                    let folds: String = f
                        .folds_pass
                        .iter()
                        .map(|p| if *p { 'o' } else { 'x' })
                        .collect();
                    format!(
                        "dGini {:+.4} · {dev} · budget {} of 2 · folds {folds}",
                        f.delta_gini, f.budget_used
                    )
                }
                None => "fit skipped".to_string(),
            };
            println!(
                "[{:6.2}s] {} LANDED [{}] {chips}\n         verdict: {}\n         gloss: {}",
                t0.elapsed().as_secs_f64(),
                record.plan.code,
                record.verdict.disposition.tag(),
                record.verdict.expert_text,
                record.verdict.gloss_text,
            );
            if let Some(rails) = &record.rails {
                println!(
                    "         rails: budget {}/{} ok={} · territory {:.2}% {} (limit {:.0}%) ok={} · folds {}/{} ok={}",
                    rails.budget_used,
                    rails.budget_limit,
                    rails.budget_ok,
                    rails.territory_movement_pct,
                    format!(
                        "{}, worst {}",
                        if rails.territory_direct { "direct" } else { "indirect" },
                        rails.territory_worst_zone
                    ),
                    rails.territory_limit_pct,
                    rails.territory_ok,
                    rails.folds_held,
                    rails.folds_required,
                    rails.folds_ok,
                );
            }
        }
        RunEvent::Action { action } => {
            println!(
                "[{:6.2}s] agent {} · {} — {}",
                t0.elapsed().as_secs_f64(),
                action.kind.as_str(),
                action.target,
                action.detail
            );
        }
        RunEvent::Finished => {
            println!("[{:6.2}s] run finished", t0.elapsed().as_secs_f64());
        }
    };

    let outcome = execute(&rows, RunConfig::default(), &mut sink).expect("run");

    println!("\n==== baseline ====");
    println!(
        "v12: gini {:.4}, deviance {:.1}, aic {:.1}, {} factors, {} train rows",
        outcome.baseline.gini,
        outcome.baseline.deviance,
        outcome.baseline.aic,
        outcome.baseline.factors,
        outcome.baseline.train_rows
    );
    println!(
        "filed relativities span {:.2} to {:.2}",
        outcome.filed_rel.iter().cloned().fold(f64::MAX, f64::min),
        outcome.filed_rel.iter().cloned().fold(f64::MIN, f64::max)
    );

    println!("\n==== ledger ====");
    for r in &outcome.records {
        println!(
            "{} {:9} {}",
            r.plan.code,
            r.disposition.tag(),
            r.verdict.expert_text
        );
    }

    if let (Some(t), Some(h)) = (outcome.train_delta, outcome.holdout_delta) {
        println!("\n==== review ====");
        println!("train delta {t:+.4}, out of time holdout delta {h:+.4}");
        if let Some(review) = &outcome.review {
            for p in &review.paragraphs {
                println!("- {p}");
            }
            println!("gloss: {}", review.gloss);
        }
    } else {
        println!("\nno winner emerged, no review opened");
    }
}
