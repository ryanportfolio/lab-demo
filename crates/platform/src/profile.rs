//! Dataset profiler: the platform computes data facts; the agent only reads
//! them when deciding whether an experiment is safe to fit.

use plab_core::protocol::DataProfileFacts;
use plab_core::{PolicyRow, REGIONS};

pub fn profile(rows: &[PolicyRow]) -> DataProfileFacts {
    let n = rows.len().max(1);
    let missing = rows.iter().filter(|r| r.annual_mileage.is_none()).count();
    let exposure: f64 = rows.iter().map(|r| r.earned_exposure).sum();
    let acc3_exp: f64 = rows
        .iter()
        .filter(|r| r.prior_accidents >= 3)
        .map(|r| r.earned_exposure)
        .sum();

    let mut region_min = f64::MAX;
    let mut region_max = f64::MIN;
    for reg in REGIONS {
        let (miss, tot) = rows.iter().filter(|r| r.region() == reg).fold(
            (0usize, 0usize),
            |(m, t), r| (m + r.annual_mileage.is_none() as usize, t + 1),
        );
        if tot > 0 {
            let pct = 100.0 * miss as f64 / tot as f64;
            region_min = region_min.min(pct);
            region_max = region_max.max(pct);
        }
    }

    DataProfileFacts {
        rows: rows.len() as u64,
        mileage_missing_pct: 100.0 * missing as f64 / n as f64,
        mileage_missing_region_min_pct: region_min,
        mileage_missing_region_max_pct: region_max,
        acc3_exposure_pct: 100.0 * acc3_exp / exposure.max(1e-12),
    }
}
