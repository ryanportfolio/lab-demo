//! Territory relativities: the filing fit that froze v12's filed table, and
//! the credibility-blended modern estimate EXP-03 tests. Credibility weights
//! by earned exposure, never row counts.

use plab_core::{PolicyRow, N_ZONES};
use plab_fit::design::{build_design, ModelSpec, TerritoryForm};
use plab_fit::glm::{fit_glm, Family};

/// Square-root (limited fluctuation) credibility: Z = sqrt(E / (E + K)).
pub fn credibility_z(exposure: f64, k: f64) -> f64 {
    (exposure / (exposure + k)).sqrt()
}

/// Exposure-weighted normalization so relativities average to 1 across the book.
fn normalize(rel: &mut [f64], zone_exposure: &[f64]) {
    let total: f64 = zone_exposure.iter().sum();
    let mean: f64 = (0..rel.len())
        .map(|z| zone_exposure[z] * rel[z])
        .sum::<f64>()
        / total;
    for r in rel.iter_mut() {
        *r /= mean;
    }
}

/// Free-territory fit on the given rows; returns raw fitted relativities
/// (zone 0 = 1.0 before normalization), the zone exposures of those rows, and
/// the per-zone standard error of ln(relativity) when the fit covariance is
/// available. Zone 0 is the reference level: its relativity is exact by
/// construction, so its se is 0.
pub fn raw_relativities(
    rows: &[&PolicyRow],
) -> Result<(Vec<f64>, Vec<f64>, Option<Vec<f64>>), String> {
    let spec = ModelSpec {
        territory: TerritoryForm::Free,
        ..ModelSpec::v12()
    };
    let d = build_design(rows, &spec, &[]);
    let fit = fit_glm(&d.x, &d.y, &d.offset, Family::Poisson)?;
    let base_p = d.names.len() - (N_ZONES - 1);
    let mut rel = vec![1.0; N_ZONES];
    for z in 1..N_ZONES {
        rel[z] = fit.beta[base_p + z - 1].exp();
    }
    let se_ln = fit.beta_se().map(|se| {
        let mut out = vec![0.0; N_ZONES];
        for z in 1..N_ZONES {
            out[z] = se[base_p + z - 1];
        }
        out
    });
    let mut zone_exposure = vec![0.0; N_ZONES];
    for r in rows {
        zone_exposure[r.territory as usize] += r.earned_exposure;
    }
    Ok((rel, zone_exposure, se_ln))
}

/// se of ln(blended relativity) via the delta method through the linear blend
/// b = Z r + (1 - Z): se_ln_b = Z r se_ln_r / b. Exposure-weighted
/// normalizations divide every zone by a near-constant scalar and drop out of
/// the log derivative; the normalizer's own sampling error is second order
/// and ignored.
pub fn blend_se_ln(raw_norm: &[f64], zone_exposure: &[f64], se_ln_raw: &[f64], k: f64) -> Vec<f64> {
    raw_norm
        .iter()
        .zip(zone_exposure)
        .zip(se_ln_raw)
        .map(|((&r, &e), &s)| {
            let z = credibility_z(e, k);
            let b = z * r + (1.0 - z);
            if b > 0.0 {
                z * r * s / b
            } else {
                0.0
            }
        })
        .collect()
}

/// Credibility-blend raw relativities toward the statewide mean (1.0 after
/// normalization), weighting by earned exposure.
pub fn blend(raw: &[f64], zone_exposure: &[f64], k: f64) -> Vec<f64> {
    let mut out: Vec<f64> = raw
        .iter()
        .zip(zone_exposure)
        .map(|(&r, &e)| {
            let z = credibility_z(e, k);
            z * r + (1.0 - z)
        })
        .collect();
    normalize(&mut out, zone_exposure);
    out
}

/// The filing procedure that produced v12's filed table: fit territory free
/// on the 2023 filing data, credibility-blend toward the mean, normalize,
/// round to 0.05 like a filed manual page.
pub fn filed_relativities(filing_rows: &[&PolicyRow], k: f64) -> Result<Vec<f64>, String> {
    let (mut raw, zone_exposure, _) = raw_relativities(filing_rows)?;
    normalize(&mut raw, &zone_exposure);
    let blended = blend(&raw, &zone_exposure, k);
    Ok(blended.iter().map(|r| (r / 0.05).round() * 0.05).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credibility_grows_with_exposure() {
        assert!(credibility_z(100.0, 1500.0) < credibility_z(10_000.0, 1500.0));
        assert!(credibility_z(0.0, 1500.0) == 0.0);
        assert!(credibility_z(1e12, 1500.0) > 0.999);
    }

    #[test]
    fn blend_pulls_thin_zones_to_mean() {
        // one huge zone at 1.0, one thin zone with a wild raw estimate
        let raw = vec![1.0, 2.0];
        let exposure = vec![50_000.0, 100.0];
        let b = blend(&raw, &exposure, 1500.0);
        // thin zone pulled most of the way back toward 1
        assert!(b[1] < 1.4, "thin zone {}", b[1]);
        // exposure-weighted mean stays 1
        let mean = (b[0] * 50_000.0 + b[1] * 100.0) / 50_100.0;
        assert!((mean - 1.0).abs() < 1e-9);
    }
}
