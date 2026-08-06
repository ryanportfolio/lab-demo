//! M1 proof bin: filing fit -> frozen relativities -> v12 baseline fit on the
//! training partition, plus quick previews of the two planted single-factor
//! experiments. All numbers printed here are real fits on the synthetic book.

use plab_core::{PolicyRow, N_ZONES};
use plab_fit::design::{
    build_design, predict_rate, AgeForm, ModelSpec, TerritoryForm,
};
use plab_fit::glm::{fit_glm, Family};
use plab_fit::metrics::gini;
use std::fs;

fn main() {
    let csv = fs::read_to_string("data/policies.csv")
        .expect("data/policies.csv missing, run `cargo run -p plab-datagen --bin datagen` first");
    let rows = plab_core::read_csv(&csv).expect("parse csv");
    println!("loaded {} rows", rows.len());

    // Filing fit: territory free, 2023 data only, then freeze rounded
    // relativities as the filed table
    let filing_rows: Vec<&PolicyRow> = rows
        .iter()
        .filter(|r| matches!(r.period.as_str(), "2023H1" | "2023H2"))
        .collect();
    let filing_spec = ModelSpec {
        territory: TerritoryForm::Free,
        ..ModelSpec::v12()
    };
    let df = build_design(&filing_rows, &filing_spec, &[]);
    let ff = fit_glm(&df.x, &df.y, &df.offset, Family::Poisson).expect("filing fit");
    println!(
        "filing fit on {} rows converged in {} iterations",
        filing_rows.len(),
        ff.iterations
    );

    // zone coefficients sit after the base columns; zone 0 is reference
    let base_p = df.names.len() - (N_ZONES - 1);
    let mut rel: Vec<f64> = vec![1.0; N_ZONES];
    for z in 1..N_ZONES {
        rel[z] = ff.beta[base_p + z - 1].exp();
    }
    // normalize to exposure-weighted mean 1, then round to 0.05 like a filing
    let zone_exp: Vec<f64> = (0..N_ZONES)
        .map(|z| {
            rows.iter()
                .filter(|r| r.territory as usize == z)
                .map(|r| r.earned_exposure)
                .sum()
        })
        .collect();
    let total: f64 = zone_exp.iter().sum();
    let mean: f64 = (0..N_ZONES).map(|z| zone_exp[z] * rel[z]).sum::<f64>() / total;
    let filed_rel: Vec<f64> = rel
        .iter()
        .map(|r| ((r / mean) / 0.05).round() * 0.05)
        .collect();
    let log_rel: Vec<f64> = filed_rel.iter().map(|r| r.ln()).collect();
    println!(
        "filed relativities span {:.2} to {:.2}",
        filed_rel.iter().cloned().fold(f64::MAX, f64::min),
        filed_rel.iter().cloned().fold(f64::MIN, f64::max)
    );

    // v12 baseline on the training partition, relativities frozen
    let train: Vec<&PolicyRow> = rows.iter().filter(|r| !r.period.is_holdout()).collect();
    let v12 = ModelSpec::v12();
    let d12 = build_design(&train, &v12, &log_rel);
    let f12 = fit_glm(&d12.x, &d12.y, &d12.offset, Family::Poisson).expect("v12 fit");
    let r12 = predict_rate(&d12, &f12);
    let g12 = gini(&r12, &d12.y, &d12.exposure);
    println!(
        "v12 baseline: gini {:.4}, deviance {:.1}, aic {:.1}, {} iterations",
        g12, f12.deviance, f12.aic, f12.iterations
    );

    // preview the two planted single-factor experiments
    for (label, spec) in [
        (
            "EXP-01 preview (spline on driver_age)",
            ModelSpec {
                age: AgeForm::Spline,
                ..v12.clone()
            },
        ),
        (
            "EXP-04 preview (prior accidents capped)",
            ModelSpec {
                accidents_capped: true,
                ..v12.clone()
            },
        ),
    ] {
        let d = build_design(&train, &spec, &log_rel);
        let f = fit_glm(&d.x, &d.y, &d.offset, Family::Poisson).expect("variant fit");
        let r = predict_rate(&d, &f);
        let g = gini(&r, &d.y, &d.exposure);
        println!(
            "{label}: gini {:.4} (delta {:+.4}), deviance change {:+.2}%",
            g,
            g - g12,
            100.0 * (f.deviance - f12.deviance) / f12.deviance
        );
    }
}
