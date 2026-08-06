//! Model quality metrics. Conventions that must hold everywhere:
//! - deviance is nonnegative; only its CHANGE is ever displayed
//! - comparisons across GLM families use AIC, never deviance
//! - Gini weights by earned exposure, and predicted rates are per car year

/// Poisson deviance: 2 sum[ y ln(y/mu) - (y - mu) ], y=0 term -> 2*mu.
pub fn poisson_deviance(y: &[f64], mu: &[f64]) -> f64 {
    y.iter()
        .zip(mu)
        .map(|(&yi, &mi)| {
            let a = if yi > 0.0 { yi * (yi / mi).ln() } else { 0.0 };
            2.0 * (a - (yi - mi))
        })
        .sum()
}

/// Full Poisson log likelihood including the ln y! constant, so AIC values
/// are comparable across families.
pub fn poisson_loglik(y: &[f64], mu: &[f64]) -> f64 {
    y.iter()
        .zip(mu)
        .map(|(&yi, &mi)| yi * mi.ln() - mi - ln_factorial(yi as u64))
        .sum()
}

/// NB2 deviance: 2 sum[ y ln(y/mu) - (y + 1/a) ln((1 + a y)/(1 + a mu)) ].
pub fn nb2_deviance(y: &[f64], mu: &[f64], alpha: f64) -> f64 {
    y.iter()
        .zip(mu)
        .map(|(&yi, &mi)| {
            let t1 = if yi > 0.0 { yi * (yi / mi).ln() } else { 0.0 };
            let t2 = (yi + 1.0 / alpha) * ((1.0 + alpha * yi) / (1.0 + alpha * mi)).ln();
            2.0 * (t1 - t2)
        })
        .sum()
}

/// Full NB2 log likelihood.
pub fn nb2_loglik(y: &[f64], mu: &[f64], alpha: f64) -> f64 {
    let inv_a = 1.0 / alpha;
    y.iter()
        .zip(mu)
        .map(|(&yi, &mi)| {
            lgamma(yi + inv_a) - lgamma(inv_a) - ln_factorial(yi as u64)
                + yi * (alpha * mi).ln()
                - (yi + inv_a) * (1.0 + alpha * mi).ln()
        })
        .sum()
}

pub fn aic(loglik: f64, n_params: usize) -> f64 {
    -2.0 * loglik + 2.0 * n_params as f64
}

pub fn ln_factorial(n: u64) -> f64 {
    (2..=n).map(|k| (k as f64).ln()).sum()
}

/// Lanczos approximation of ln Gamma, g=7, n=9 coefficients. Accurate to
/// ~1e-13 for positive arguments, plenty for likelihoods here.
pub fn lgamma(x: f64) -> f64 {
    const G: f64 = 7.0;
    const C: [f64; 9] = [
        0.999_999_999_999_809_93,
        676.520_368_121_885_1,
        -1_259.139_216_722_402_8,
        771.323_428_777_653_13,
        -176.615_029_162_140_6,
        12.507_343_278_686_905,
        -0.138_571_095_265_720_12,
        9.984_369_578_019_571_6e-6,
        1.505_632_735_149_311_6e-7,
    ];
    if x < 0.5 {
        // reflection
        let pi = std::f64::consts::PI;
        return (pi / (pi * x).sin()).ln() - lgamma(1.0 - x);
    }
    let x = x - 1.0;
    let mut a = C[0];
    let t = x + G + 0.5;
    for (i, &c) in C.iter().enumerate().skip(1) {
        a += c / (x + i as f64);
    }
    0.5 * (2.0 * std::f64::consts::PI).ln() + (x + 0.5) * t.ln() - t + a.ln()
}

/// Exposure-weighted Gini: sort policies by predicted annual rate descending,
/// walk cumulative exposure share (x) against cumulative actual claim share
/// (y); Gini = 2 AUC - 1. Ties broken by original index so the value is
/// deterministic.
pub fn gini(pred_rate: &[f64], claims: &[f64], exposure: &[f64]) -> f64 {
    let n = pred_rate.len();
    assert!(n == claims.len() && n == exposure.len());
    let mut idx: Vec<usize> = (0..n).collect();
    idx.sort_by(|&a, &b| {
        pred_rate[b]
            .partial_cmp(&pred_rate[a])
            .unwrap()
            .then(a.cmp(&b))
    });
    let total_exp: f64 = exposure.iter().sum();
    let total_claims: f64 = claims.iter().sum();
    assert!(total_exp > 0.0 && total_claims > 0.0);

    // Pool ties: rows with identical predicted rates carry no ordering
    // information, so they advance the curve as one segment. A constant
    // model scores exactly zero this way.
    let mut auc = 0.0;
    let (mut cx, mut cy) = (0.0f64, 0.0f64);
    let mut i = 0;
    while i < idx.len() {
        let mut j = i;
        let (mut seg_exp, mut seg_claims) = (0.0, 0.0);
        while j < idx.len() && pred_rate[idx[j]] == pred_rate[idx[i]] {
            seg_exp += exposure[idx[j]];
            seg_claims += claims[idx[j]];
            j += 1;
        }
        let nx = cx + seg_exp / total_exp;
        let ny = cy + seg_claims / total_claims;
        auc += (nx - cx) * (cy + ny) / 2.0;
        cx = nx;
        cy = ny;
        i = j;
    }
    2.0 * auc - 1.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gini_hand_computed_four_rows() {
        // rates already descending; exposure 1 each; claims [2,1,0,1]
        // cumulative x: .25 .5 .75 1, cumulative y: .5 .75 .75 1
        // trapezoids: .0625 + .15625 + .1875 + .21875 = .625 -> gini = .25
        let g = gini(&[4.0, 3.0, 2.0, 1.0], &[2.0, 1.0, 0.0, 1.0], &[1.0; 4]);
        assert!((g - 0.25).abs() < 1e-12, "gini {g}");
    }

    #[test]
    fn gini_perfect_and_zero() {
        // predictions identical -> one big trapezoid -> gini 0
        let g0 = gini(&[1.0; 4], &[3.0, 0.0, 1.0, 0.0], &[1.0; 4]);
        assert!(g0.abs() < 1e-12);
        // all claims stacked on the single highest prediction with tiny
        // exposure -> gini approaches 1
        let g1 = gini(
            &[9.0, 1.0, 1.0, 1.0],
            &[10.0, 0.0, 0.0, 0.0],
            &[0.001, 1.0, 1.0, 1.0],
        );
        assert!(g1 > 0.99, "gini {g1}");
    }

    #[test]
    fn gini_exposure_weighting_matters() {
        // same claims, but giving the well-predicted row less exposure share
        // changes the curve, so weighting is live
        let a = gini(&[2.0, 1.0], &[1.0, 1.0], &[1.0, 1.0]);
        let b = gini(&[2.0, 1.0], &[1.0, 1.0], &[0.2, 1.8]);
        assert!((a - 0.0).abs() < 1e-12);
        assert!(b > a);
    }

    #[test]
    fn deviance_hand_computed() {
        // y=[0,1,2], mu=[.5,1,1.5]
        // terms: 2*.5=1, 0, 2*(2 ln(4/3) - .5) = .1507275...
        let d = poisson_deviance(&[0.0, 1.0, 2.0], &[0.5, 1.0, 1.5]);
        let expected = 1.0 + 0.0 + 2.0 * (2.0 * (2.0f64 / 1.5).ln() - 0.5);
        assert!((d - expected).abs() < 1e-12);
        assert!((d - 1.150_728_9).abs() < 1e-6, "deviance {d}");
    }

    #[test]
    fn deviance_nonnegative_and_zero_at_saturation() {
        let y = [0.0, 1.0, 3.0, 2.0];
        let mu = [1e-10, 1.0, 3.0, 2.0];
        let d = poisson_deviance(&y, &mu);
        assert!(d >= 0.0 && d < 1e-9);
    }

    #[test]
    fn lgamma_matches_factorials() {
        for n in 1u64..15 {
            let expected = ln_factorial(n - 1);
            let got = lgamma(n as f64);
            assert!((got - expected).abs() < 1e-10, "lgamma({n}) {got} vs {expected}");
        }
        // half-integer identity: Gamma(0.5) = sqrt(pi)
        assert!((lgamma(0.5) - std::f64::consts::PI.sqrt().ln()).abs() < 1e-10);
    }

    #[test]
    fn nb2_approaches_poisson_as_alpha_vanishes() {
        let y = [0.0, 1.0, 2.0, 4.0];
        let mu = [0.4, 1.1, 1.9, 3.2];
        let lp = poisson_loglik(&y, &mu);
        let lnb = nb2_loglik(&y, &mu, 1e-8);
        assert!((lp - lnb).abs() < 1e-4, "poisson {lp} nb {lnb}");
        let dp = poisson_deviance(&y, &mu);
        let dnb = nb2_deviance(&y, &mu, 1e-8);
        assert!((dp - dnb).abs() < 1e-4);
    }
}
