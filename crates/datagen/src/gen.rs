//! Deterministic synthetic auto book with planted effects, one per experiment
//! archetype. Everything derives from SEED; regeneration is byte-identical.
//!
//! Planted truths:
//! - driver age enters as a smooth U curve (young peak, old rise), while the
//!   baseline model rates it in 5 coarse bands, so a spline finds real lift
//! - prior accidents effect is linear up to 3 then flat, so cap-at-3 is the
//!   correct functional form
//! - zone effects vary around regional means; regions also skew age, accident
//!   propensity, and mileage, so new age or accident factors move zone level
//!   average rates indirectly even with relativities frozen
//! - annual mileage has a real effect but is missing not at random: the
//!   missing probability depends on region and on the (unobserved) mileage
//! - the age by vehicle age interaction is exactly zero in truth
//! - claim counts are gamma-mixed Poisson, so they are overdispersed with
//!   heterogeneity independent of every feature: a negative binomial family
//!   fits better on AIC yet cannot rank drivers any better

use crate::rng::{cumulative, splitmix64, Rng};
use plab_core::*;

pub const SEED: u64 = 0x5EED_01AB;
const FOLD_SALT: u64 = 0xF01D_5A17;

pub const N_ROWS: usize = 100_000;
pub const TARGET_FREQ: f64 = 0.09;

/// All tunable effect sizes in one place. M3 tunes these once, then they
/// freeze with the seed.
pub struct TrueParams {
    pub age_young_scale: f64,
    pub age_young_decay: f64,
    pub age_old_scale: f64,
    pub age_old_mid: f64,
    pub age_old_width: f64,
    pub acc_per_count: f64,
    pub acc_cap: u8,
    pub zone_sd: f64,
    pub region_mean: [f64; 5],
    pub region_age_shift: [f64; 5],
    pub region_acc_mult: [f64; 5],
    pub region_mileage_shift: [f64; 5],
    pub region_missing_logit: [f64; 5],
    pub missing_low_mileage_logit: f64,
    pub vehicle_age_slope: f64,
    pub use_commute: f64,
    pub use_business: f64,
    pub single: f64,
    pub homeowner: f64,
    pub multi_policy: f64,
    pub credit: [f64; 4],
    pub safe_driver: f64,
    pub mileage_per_ln: f64,
    pub overdispersion_shape: f64,
}

impl Default for TrueParams {
    fn default() -> Self {
        TrueParams {
            age_young_scale: 0.85,
            age_young_decay: 9.0,
            age_old_scale: 0.45,
            age_old_mid: 72.0,
            age_old_width: 5.0,
            acc_per_count: 0.22,
            acc_cap: 3,
            zone_sd: 0.09,
            region_mean: [-0.10, -0.05, 0.0, 0.05, 0.10],
            region_age_shift: [-6.0, -2.0, 0.0, 3.0, 7.0],
            region_acc_mult: [1.25, 1.10, 1.0, 0.90, 0.80],
            region_mileage_shift: [-0.10, -0.05, 0.0, 0.05, 0.10],
            region_missing_logit: [-2.55, -1.95, -1.55, -1.05, -0.55],
            missing_low_mileage_logit: 0.9,
            vehicle_age_slope: 0.008,
            use_commute: 0.05,
            use_business: 0.12,
            single: 0.07,
            homeowner: -0.04,
            multi_policy: -0.05,
            credit: [-0.08, 0.0, 0.07, 0.15],
            safe_driver: -0.06,
            mileage_per_ln: 0.10,
            overdispersion_shape: 0.7,
        }
    }
}

impl TrueParams {
    /// True log-rate age effect, a smooth U: exponential decay from 18 plus a
    /// logistic rise past ~70.
    pub fn f_age(&self, age: f64) -> f64 {
        self.age_young_scale * (-(age - 18.0) / self.age_young_decay).exp()
            + self.age_old_scale
                / (1.0 + (-(age - self.age_old_mid) / self.age_old_width).exp())
    }

    pub fn g_acc(&self, acc: u8) -> f64 {
        self.acc_per_count * acc.min(self.acc_cap) as f64
    }
}

pub struct Generated {
    pub rows: Vec<PolicyRow>,
    pub zone_true_effect: Vec<f64>,
    pub beta0: f64,
    pub params: TrueParams,
}

/// Age sampling weights by band, before regional shift.
fn age_weight(age: u8) -> f64 {
    match age {
        18..=24 => 1.0,
        25..=34 => 1.8,
        35..=54 => 2.4,
        55..=69 => 1.8,
        70..=79 => 1.0,
        _ => 0.4,
    }
}

pub fn generate() -> Generated {
    generate_with(TrueParams::default())
}

pub fn generate_with(params: TrueParams) -> Generated {
    let mut rng = Rng::new(SEED);

    // Zone true effects around their regional means
    let zone_true_effect: Vec<f64> = ZONES
        .iter()
        .map(|z| {
            let r = region_index(z.region).unwrap();
            params.region_mean[r] + params.zone_sd * rng.normal()
        })
        .collect();

    let zone_cum = cumulative(&ZONES.iter().map(|z| z.weight).collect::<Vec<_>>());
    let age_cum = cumulative(&(18u8..=90).map(age_weight).collect::<Vec<_>>());

    // First pass: covariates and linear predictor without intercept
    struct Draft {
        row: PolicyRow,
        lp: f64,
        eps: f64,
    }
    let mut drafts: Vec<Draft> = Vec::with_capacity(N_ROWS);

    for i in 0..N_ROWS {
        let policy_id = (i + 1) as u32;
        let territory = rng.weighted(&zone_cum) as u8;
        let region = region_index(ZONES[territory as usize].region).unwrap();

        // age: base pyramid + regional shift + jitter
        let base_age = 18 + rng.weighted(&age_cum) as i32;
        let age = (base_age as f64
            + params.region_age_shift[region]
            + (rng.normal() * 2.0).round())
        .clamp(18.0, 90.0) as u8;

        // accidents: contaminated Poisson mixture, regional multiplier, cap 9
        let mult = params.region_acc_mult[region];
        let acc = if rng.chance(0.10) {
            rng.poisson(1.4 * mult)
        } else {
            rng.poisson(0.16 * mult)
        }
        .min(9) as u8;

        let vehicle_age = {
            let a = rng.f64();
            let b = rng.f64();
            (a.min(b) * 26.0) as u8
        }
        .min(25);

        let vehicle_use = {
            let u = rng.f64();
            if u < 0.55 {
                VehicleUse::Pleasure
            } else if u < 0.90 {
                VehicleUse::Commute
            } else {
                VehicleUse::Business
            }
        };
        let marital_status = if rng.chance(0.35) {
            Marital::Single
        } else {
            Marital::Married
        };
        let homeowner = rng.chance(0.60);
        let multi_policy = rng.chance(0.45);
        let credit_tier = {
            let u = rng.f64();
            if u < 0.25 {
                CreditTier::A
            } else if u < 0.65 {
                CreditTier::B
            } else if u < 0.90 {
                CreditTier::C
            } else {
                CreditTier::D
            }
        };
        let safe_driver = rng.chance(0.50);

        // mileage: lognormal with regional shift; MNAR missingness depends on
        // region AND on the true (possibly hidden) value
        let true_mileage = rng.lognormal(
            (11_000.0f64).ln() + params.region_mileage_shift[region],
            0.45,
        );
        let missing_logit = params.region_missing_logit[region]
            + if true_mileage < 8_000.0 {
                params.missing_low_mileage_logit
            } else {
                0.0
            };
        let p_missing = 1.0 / (1.0 + (-missing_logit).exp());
        let annual_mileage = if rng.chance(p_missing) {
            None
        } else {
            Some((true_mileage * 10.0).round() / 10.0)
        };

        let earned_exposure = if rng.chance(0.80) {
            1.0
        } else {
            0.04 + 0.96 * rng.f64()
        };
        let earned_exposure = (earned_exposure * 10_000.0).round() / 10_000.0;

        let period = PERIODS[rng.below(PERIODS.len())];
        let fold = if period.is_holdout() {
            None
        } else {
            let mut h = (policy_id as u64) ^ FOLD_SALT;
            Some((splitmix64(&mut h) % N_FOLDS as u64) as u8)
        };

        // true linear predictor (log link), intercept added in pass two;
        // NOTE: no age x vehicle_age interaction term, that truth is zero
        let lp = params.f_age(age as f64)
            + params.g_acc(acc)
            + zone_true_effect[territory as usize]
            + params.vehicle_age_slope * (vehicle_age as f64 - 8.0)
            + match vehicle_use {
                VehicleUse::Pleasure => 0.0,
                VehicleUse::Commute => params.use_commute,
                VehicleUse::Business => params.use_business,
            }
            + if marital_status == Marital::Single {
                params.single
            } else {
                0.0
            }
            + if homeowner { params.homeowner } else { 0.0 }
            + if multi_policy { params.multi_policy } else { 0.0 }
            + params.credit[credit_tier as usize]
            + if safe_driver { params.safe_driver } else { 0.0 }
            + params.mileage_per_ln * (true_mileage.ln() - (10_500.0f64).ln());

        let eps = rng.gamma(
            params.overdispersion_shape,
            1.0 / params.overdispersion_shape,
        );

        drafts.push(Draft {
            row: PolicyRow {
                policy_id,
                driver_age: age,
                vehicle_age,
                prior_accidents: acc,
                territory,
                vehicle_use,
                marital_status,
                homeowner,
                multi_policy,
                credit_tier,
                safe_driver,
                annual_mileage,
                earned_exposure,
                period,
                claim_count: 0,
                fold,
            },
            lp,
            eps,
        });
    }

    // Second pass: calibrate the intercept so the exposure-weighted mean
    // annual frequency lands on TARGET_FREQ, then draw claim counts
    let num: f64 = drafts.iter().map(|d| d.lp.exp() * d.row.earned_exposure).sum();
    let den: f64 = drafts.iter().map(|d| d.row.earned_exposure).sum();
    let beta0 = TARGET_FREQ.ln() - (num / den).ln();

    let mut rows = Vec::with_capacity(N_ROWS);
    for mut d in drafts {
        let lambda = (beta0 + d.lp).exp();
        d.row.claim_count = rng
            .poisson(lambda * d.row.earned_exposure * d.eps)
            .min(20) as u8;
        rows.push(d.row);
    }

    Generated {
        rows,
        zone_true_effect,
        beta0,
        params,
    }
}

pub struct Summary {
    pub rows: usize,
    pub exposure: f64,
    pub claims: u64,
    pub frequency: f64,
    pub missing_mileage_pct: f64,
    pub acc3_exposure_pct: f64,
    pub per_zone: Vec<(String, &'static str, usize, f64, u64)>,
    pub per_region_missing_pct: Vec<(&'static str, f64)>,
}

pub fn summarize(rows: &[PolicyRow]) -> Summary {
    let exposure: f64 = rows.iter().map(|r| r.earned_exposure).sum();
    let claims: u64 = rows.iter().map(|r| r.claim_count as u64).sum();
    let missing = rows.iter().filter(|r| r.annual_mileage.is_none()).count();
    let acc3_exp: f64 = rows
        .iter()
        .filter(|r| r.prior_accidents >= 3)
        .map(|r| r.earned_exposure)
        .sum();

    let mut per_zone = Vec::new();
    for zi in 0..N_ZONES {
        let zrows: Vec<&PolicyRow> = rows.iter().filter(|r| r.territory as usize == zi).collect();
        per_zone.push((
            zone_code(zi as u8),
            ZONES[zi].region,
            zrows.len(),
            zrows.iter().map(|r| r.earned_exposure).sum(),
            zrows.iter().map(|r| r.claim_count as u64).sum(),
        ));
    }

    let per_region_missing_pct = REGIONS
        .iter()
        .map(|reg| {
            let (miss, tot) = rows.iter().filter(|r| r.region() == *reg).fold(
                (0usize, 0usize),
                |(m, t), r| (m + r.annual_mileage.is_none() as usize, t + 1),
            );
            (*reg, 100.0 * miss as f64 / tot.max(1) as f64)
        })
        .collect();

    Summary {
        rows: rows.len(),
        exposure,
        claims,
        frequency: claims as f64 / exposure,
        missing_mileage_pct: 100.0 * missing as f64 / rows.len() as f64,
        acc3_exposure_pct: 100.0 * acc3_exp / exposure,
        per_zone,
        per_region_missing_pct,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    fn dataset_hash(rows: &[PolicyRow]) -> u64 {
        let mut h = DefaultHasher::new();
        for r in rows {
            to_csv_line(r).hash(&mut h);
        }
        h.finish()
    }

    #[test]
    fn regeneration_is_identical() {
        let a = generate();
        let b = generate();
        assert_eq!(dataset_hash(&a.rows), dataset_hash(&b.rows));
        assert_eq!(a.beta0, b.beta0);
        assert_eq!(a.zone_true_effect, b.zone_true_effect);
    }

    #[test]
    fn shape_lands_on_design_targets() {
        let g = generate();
        let s = summarize(&g.rows);
        assert_eq!(s.rows, N_ROWS);
        // overall frequency calibrated to ~0.09
        assert!(
            (s.frequency - TARGET_FREQ).abs() < 0.012,
            "frequency {}",
            s.frequency
        );
        // MNAR mileage near 22%, spread across regions
        assert!(
            (18.0..=26.0).contains(&s.missing_mileage_pct),
            "missing {}",
            s.missing_mileage_pct
        );
        let r1 = s.per_region_missing_pct[0].1;
        let r5 = s.per_region_missing_pct[4].1;
        assert!(r5 > r1 + 10.0, "regional missing spread {r1} vs {r5}");
        // thin zones exist for the credibility story
        let min_zone_rows = s.per_zone.iter().map(|z| z.2).min().unwrap();
        assert!(min_zone_rows > 50 && min_zone_rows < 600, "thin zone {min_zone_rows}");
        // 3+ accident group is a small share of exposure, spec ballpark 1.9%
        assert!(
            (0.8..=3.5).contains(&s.acc3_exposure_pct),
            "acc3 share {}",
            s.acc3_exposure_pct
        );
    }

    #[test]
    fn holdout_and_folds_partition() {
        let g = generate();
        for r in &g.rows {
            match r.period.is_holdout() {
                true => assert!(r.fold.is_none()),
                false => assert!(matches!(r.fold, Some(0..=4))),
            }
        }
        // folds roughly balanced
        let mut counts = [0usize; 5];
        for r in g.rows.iter().filter(|r| r.fold.is_some()) {
            counts[r.fold.unwrap() as usize] += 1;
        }
        let (min, max) = (counts.iter().min().unwrap(), counts.iter().max().unwrap());
        assert!((*max as f64) / (*min as f64) < 1.05, "fold balance {counts:?}");
    }

    #[test]
    fn age_curve_is_a_u() {
        let p = TrueParams::default();
        let f18 = p.f_age(18.0);
        let f50 = p.f_age(50.0);
        let f85 = p.f_age(85.0);
        assert!(f18 > f50 + 0.5);
        assert!(f85 > f50 + 0.25);
    }
}
