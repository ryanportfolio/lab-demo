//! Design matrix construction for the model specs the experiments use, plus
//! fold cross validation. Filed territory relativities enter fits as an
//! offset (frozen by construction); only the filing fit estimates territory
//! freely.

use crate::glm::{fit_glm, Family, Fit};
use crate::metrics::gini;
use crate::spline::{natural_basis, AGE_KNOTS};
use nalgebra::DMatrix;
use plab_core::{PolicyRow, VehicleUse, N_ZONES};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AgeForm {
    /// v12: five coarse bands, 35-54 reference
    Banded,
    /// natural cubic spline, three interior knots
    Spline,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TerritoryForm {
    /// ln(filed relativity) folded into the offset; relativities frozen
    OffsetFiled,
    /// free dummies, zone 0 reference; the filing fit only
    Free,
    /// caller-supplied per-zone log relativities in the offset (EXP-03's
    /// credibility blend)
    OffsetCustom,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ModelSpec {
    pub age: AgeForm,
    pub accidents_capped: bool,
    pub age_vehicle_interaction: bool,
    pub territory: TerritoryForm,
    pub family: Family,
}

impl ModelSpec {
    pub fn v12() -> Self {
        ModelSpec {
            age: AgeForm::Banded,
            accidents_capped: false,
            age_vehicle_interaction: false,
            territory: TerritoryForm::OffsetFiled,
            family: Family::Poisson,
        }
    }
}

pub struct Design {
    pub x: DMatrix<f64>,
    pub y: Vec<f64>,
    /// full offset: ln(exposure) + ln(territory relativity) when frozen
    pub offset: Vec<f64>,
    pub exposure: Vec<f64>,
    pub names: Vec<String>,
}

pub fn age_band(age: u8) -> usize {
    match age {
        18..=24 => 0,
        25..=34 => 1,
        35..=54 => 2, // reference
        55..=69 => 3,
        _ => 4,
    }
}

fn vehicle_age_band(va: u8) -> usize {
    match va {
        0..=3 => 0, // reference
        4..=7 => 1,
        8..=12 => 2,
        _ => 3,
    }
}

/// Column names + count for a spec (before territory dummies).
fn base_columns(spec: &ModelSpec) -> Vec<String> {
    let mut names = vec!["intercept".to_string()];
    match spec.age {
        AgeForm::Banded => {
            for b in ["age_18_24", "age_25_34", "age_55_69", "age_70_plus"] {
                names.push(b.into());
            }
        }
        AgeForm::Spline => {
            for i in 0..AGE_KNOTS.len() - 1 {
                names.push(format!("age_spline_{i}"));
            }
        }
    }
    for b in ["veh_age_4_7", "veh_age_8_12", "veh_age_13_plus"] {
        names.push(b.into());
    }
    names.push("use_commute".into());
    names.push("use_business".into());
    names.push("single".into());
    names.push("homeowner".into());
    names.push("multi_policy".into());
    for c in ["credit_A", "credit_C", "credit_D"] {
        names.push(c.into()); // B reference
    }
    names.push("safe_driver".into());
    if spec.accidents_capped {
        names.push("prior_acc_capped3".into());
    }
    if spec.age_vehicle_interaction {
        names.push("young_x_old_vehicle".into());
    }
    names
}

/// Build the design for a set of rows. `log_rel` supplies per-zone log
/// relativities for the offset forms; ignored (may be empty) for Free.
pub fn build_design(rows: &[&PolicyRow], spec: &ModelSpec, log_rel: &[f64]) -> Design {
    let use_offset_rel = matches!(
        spec.territory,
        TerritoryForm::OffsetFiled | TerritoryForm::OffsetCustom
    );
    if use_offset_rel {
        assert_eq!(log_rel.len(), N_ZONES, "need one log relativity per zone");
    }
    let mut names = base_columns(spec);
    let base_p = names.len();
    let p = if spec.territory == TerritoryForm::Free {
        for z in 1..N_ZONES {
            names.push(format!("zone_{z}"));
        }
        base_p + N_ZONES - 1
    } else {
        base_p
    };

    let n = rows.len();
    let mut x = DMatrix::zeros(n, p);
    let mut y = Vec::with_capacity(n);
    let mut offset = Vec::with_capacity(n);
    let mut exposure = Vec::with_capacity(n);

    for (i, r) in rows.iter().enumerate() {
        let mut c = 0;
        let mut put = |x: &mut DMatrix<f64>, v: f64| {
            x[(i, c)] = v;
            c += 1;
        };
        put(&mut x, 1.0);
        match spec.age {
            AgeForm::Banded => {
                let b = age_band(r.driver_age);
                for band in [0usize, 1, 3, 4] {
                    put(&mut x, (b == band) as u8 as f64);
                }
            }
            AgeForm::Spline => {
                for v in natural_basis(r.driver_age as f64, &AGE_KNOTS) {
                    put(&mut x, v);
                }
            }
        }
        let vb = vehicle_age_band(r.vehicle_age);
        for band in [1usize, 2, 3] {
            put(&mut x, (vb == band) as u8 as f64);
        }
        put(&mut x, (r.vehicle_use == VehicleUse::Commute) as u8 as f64);
        put(&mut x, (r.vehicle_use == VehicleUse::Business) as u8 as f64);
        put(
            &mut x,
            (r.marital_status == plab_core::Marital::Single) as u8 as f64,
        );
        put(&mut x, r.homeowner as u8 as f64);
        put(&mut x, r.multi_policy as u8 as f64);
        let ct = r.credit_tier as usize; // A=0 B=1 C=2 D=3
        put(&mut x, (ct == 0) as u8 as f64);
        put(&mut x, (ct == 2) as u8 as f64);
        put(&mut x, (ct == 3) as u8 as f64);
        put(&mut x, r.safe_driver as u8 as f64);
        if spec.accidents_capped {
            put(&mut x, r.prior_accidents.min(3) as f64);
        }
        if spec.age_vehicle_interaction {
            // Aligned with the band edges (18-24 age band, 13+ vehicle band)
            // so the product column cannot proxy within-band curvature of
            // either main effect; in truth this interaction is exactly zero
            let young = r.driver_age <= 24;
            let old_vehicle = r.vehicle_age >= 13;
            put(&mut x, (young && old_vehicle) as u8 as f64);
        }
        if spec.territory == TerritoryForm::Free {
            let z = r.territory as usize;
            if z > 0 {
                x[(i, base_p + z - 1)] = 1.0;
            }
            c = p;
        }
        debug_assert_eq!(c, p);

        y.push(r.claim_count as f64);
        exposure.push(r.earned_exposure);
        let rel_part = if use_offset_rel {
            log_rel[r.territory as usize]
        } else {
            0.0
        };
        offset.push(r.earned_exposure.ln() + rel_part);
    }

    Design {
        x,
        y,
        offset,
        exposure,
        names,
    }
}

/// Predicted annual rate per car year for each row of a design under a fit:
/// exp(eta + offset) / exposure, which keeps the frozen relativity inside the
/// prediction but strips exposure back out.
pub fn predict_rate(design: &Design, fit: &Fit) -> Vec<f64> {
    (0..design.y.len())
        .map(|i| (fit.eta[i] + design.offset[i]).exp() / design.exposure[i])
        .collect()
}

/// Score a fitted model on fresh rows: rebuild the design for those rows with
/// the same spec and relativities, run the linear predictor with the trained
/// beta, return predicted annual rates.
pub fn score_rows(
    rows: &[&PolicyRow],
    spec: &ModelSpec,
    log_rel: &[f64],
    fit: &Fit,
) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let d = build_design(rows, spec, log_rel);
    let n = d.y.len();
    let mut rates = Vec::with_capacity(n);
    for i in 0..n {
        let eta: f64 = d
            .x
            .row(i)
            .iter()
            .zip(fit.beta.iter())
            .map(|(a, b)| a * b)
            .sum();
        rates.push((eta + d.offset[i]).exp() / d.exposure[i]);
    }
    (rates, d.y, d.exposure)
}

pub struct FoldResult {
    pub fold: u8,
    pub gini_base: f64,
    pub gini_variant: f64,
    pub delta_gini: f64,
}

/// 5-fold CV on the training rows: for each fold, fit base and variant on the
/// other four folds, score the held-out fold, compare Ginis. Both specs see
/// identical splits.
pub fn cv_delta_gini(
    train_rows: &[&PolicyRow],
    base: &ModelSpec,
    variant: &ModelSpec,
    base_log_rel: &[f64],
    variant_log_rel: &[f64],
) -> Result<Vec<FoldResult>, String> {
    let mut out = Vec::with_capacity(plab_core::N_FOLDS as usize);
    for k in 0..plab_core::N_FOLDS {
        let fit_rows: Vec<&PolicyRow> = train_rows
            .iter()
            .copied()
            .filter(|r| r.fold != Some(k))
            .collect();
        let val_rows: Vec<&PolicyRow> = train_rows
            .iter()
            .copied()
            .filter(|r| r.fold == Some(k))
            .collect();

        let db = build_design(&fit_rows, base, base_log_rel);
        let fb = fit_glm(&db.x, &db.y, &db.offset, base.family)?;
        let dv = build_design(&fit_rows, variant, variant_log_rel);
        let fv = fit_glm(&dv.x, &dv.y, &dv.offset, variant.family)?;

        let (rb, yb, eb) = score_rows(&val_rows, base, base_log_rel, &fb);
        let (rv, yv, ev) = score_rows(&val_rows, variant, variant_log_rel, &fv);
        let gb = gini(&rb, &yb, &eb);
        let gv = gini(&rv, &yv, &ev);
        out.push(FoldResult {
            fold: k,
            gini_base: gb,
            gini_variant: gv,
            delta_gini: gv - gb,
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_row(id: u32) -> PolicyRow {
        PolicyRow {
            policy_id: id,
            driver_age: 40,
            vehicle_age: 5,
            prior_accidents: 1,
            territory: 2,
            vehicle_use: VehicleUse::Commute,
            marital_status: plab_core::Marital::Married,
            homeowner: true,
            multi_policy: false,
            credit_tier: plab_core::CreditTier::B,
            safe_driver: true,
            annual_mileage: Some(9000.0),
            earned_exposure: 0.5,
            period: plab_core::Period::Y2024H1,
            claim_count: 0,
            fold: Some(1),
        }
    }

    #[test]
    fn v12_design_has_expected_columns() {
        let rows = [mk_row(1)];
        let refs: Vec<&PolicyRow> = rows.iter().collect();
        let d = build_design(&refs, &ModelSpec::v12(), &vec![0.0; N_ZONES]);
        // intercept + 4 age + 3 veh age + 2 use + single + homeowner +
        // multi + 3 credit + safe = 17
        assert_eq!(d.names.len(), 17);
        assert_eq!(d.x.ncols(), 17);
        // reference row: age 35-54 band, credit B -> those dummies all zero
        let row: Vec<f64> = d.x.row(0).iter().copied().collect();
        assert_eq!(row[0], 1.0);
        assert_eq!(&row[1..5], &[0.0, 0.0, 0.0, 0.0]);
    }

    #[test]
    fn offset_carries_exposure_and_relativity() {
        let rows = [mk_row(1)];
        let refs: Vec<&PolicyRow> = rows.iter().collect();
        let mut log_rel = vec![0.0; N_ZONES];
        log_rel[2] = 0.2;
        let d = build_design(&refs, &ModelSpec::v12(), &log_rel);
        assert!((d.offset[0] - (0.5f64.ln() + 0.2)).abs() < 1e-12);
    }

    #[test]
    fn free_territory_adds_zone_dummies() {
        let rows = [mk_row(1)];
        let refs: Vec<&PolicyRow> = rows.iter().collect();
        let spec = ModelSpec {
            territory: TerritoryForm::Free,
            ..ModelSpec::v12()
        };
        let d = build_design(&refs, &spec, &[]);
        assert_eq!(d.x.ncols(), 17 + N_ZONES - 1);
        // zone 2 dummy set
        assert_eq!(d.x[(0, 17 + 2 - 1)], 1.0);
    }
}
