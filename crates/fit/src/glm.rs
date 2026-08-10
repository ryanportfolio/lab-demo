//! GLM fitting by iteratively reweighted least squares, log link, offset
//! support. Poisson and NB2 families. nalgebra Cholesky solves the normal
//! equations; a tiny escalating ridge covers near-singular designs.

use crate::metrics::{
    aic, nb2_deviance, nb2_loglik, poisson_deviance, poisson_loglik,
};
use nalgebra::{DMatrix, DVector};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Family {
    Poisson,
    /// NB2 with dispersion alpha: Var = mu (1 + alpha mu)
    NegBinomial { alpha: f64 },
}

#[derive(Debug, Clone)]
pub struct Fit {
    pub beta: DVector<f64>,
    /// Covariance of beta at convergence, the inverse of the final weighted
    /// information X'WX. Zero matrix when the inverse was unavailable.
    pub cov: DMatrix<f64>,
    pub mu: Vec<f64>,
    pub eta: Vec<f64>,
    pub deviance: f64,
    pub loglik: f64,
    pub aic: f64,
    pub n_params: usize,
    pub iterations: usize,
    pub converged: bool,
}

impl Fit {
    /// Standard error of one coefficient.
    pub fn se(&self, i: usize) -> f64 {
        self.cov[(i, i)].max(0.0).sqrt()
    }
}

const MAX_ITER: usize = 50;
const TOL: f64 = 1e-9;
const MU_FLOOR: f64 = 1e-10;

pub fn fit_glm(
    x: &DMatrix<f64>,
    y: &[f64],
    offset: &[f64],
    family: Family,
) -> Result<Fit, String> {
    let n = x.nrows();
    let p = x.ncols();
    if y.len() != n || offset.len() != n {
        return Err("dimension mismatch".into());
    }

    let mut beta = DVector::zeros(p);
    let mut eta: Vec<f64> = vec![0.0; n];
    let mut mu: Vec<f64> = offset.iter().map(|o| o.exp().max(MU_FLOOR)).collect();
    let mut dev = deviance_of(family, y, &mu);

    let mut converged = false;
    let mut iterations = 0;

    for iter in 0..MAX_ITER {
        iterations = iter + 1;

        // working weights and response (log link):
        //   w = mu (Poisson), mu/(1+alpha mu) (NB2); z = eta + (y-mu)/mu
        let mut xtwx = DMatrix::<f64>::zeros(p, p);
        let mut xtwz = DVector::<f64>::zeros(p);
        for i in 0..n {
            let mi = mu[i].max(MU_FLOOR);
            let wi = match family {
                Family::Poisson => mi,
                Family::NegBinomial { alpha } => mi / (1.0 + alpha * mi),
            };
            let zi = eta[i] + (y[i] - mi) / mi;
            let xi = x.row(i);
            for a in 0..p {
                let xa = xi[a];
                if xa == 0.0 {
                    continue;
                }
                let wxa = wi * xa;
                xtwz[a] += wxa * zi;
                for b in a..p {
                    xtwx[(a, b)] += wxa * xi[b];
                }
            }
        }
        // mirror upper triangle
        for a in 0..p {
            for b in (a + 1)..p {
                xtwx[(b, a)] = xtwx[(a, b)];
            }
        }

        // Cholesky with escalating ridge
        let mut ridge = 0.0;
        let solved = loop {
            let mut m = xtwx.clone();
            if ridge > 0.0 {
                for a in 0..p {
                    m[(a, a)] += ridge;
                }
            }
            match m.cholesky() {
                Some(ch) => break Some(ch.solve(&xtwz)),
                None => {
                    ridge = if ridge == 0.0 { 1e-8 } else { ridge * 100.0 };
                    if ridge > 1.0 {
                        break None;
                    }
                }
            }
        };
        let new_beta = solved.ok_or("normal equations singular beyond ridge rescue")?;

        beta = new_beta;
        for i in 0..n {
            let e: f64 = x.row(i).iter().zip(beta.iter()).map(|(a, b)| a * b).sum();
            eta[i] = e;
            mu[i] = (e + offset[i]).exp().max(MU_FLOOR);
        }
        let new_dev = deviance_of(family, y, &mu);
        let rel = (dev - new_dev).abs() / (0.1 + new_dev.abs());
        dev = new_dev;
        if rel < TOL {
            converged = true;
            break;
        }
    }

    let loglik = loglik_of(family, y, &mu);

    // Covariance from the information matrix at the converged weights. The
    // loop's X'WX belongs to the previous beta, so rebuild with final mu.
    let mut info = DMatrix::<f64>::zeros(p, p);
    for i in 0..n {
        let mi = mu[i].max(MU_FLOOR);
        let wi = match family {
            Family::Poisson => mi,
            Family::NegBinomial { alpha } => mi / (1.0 + alpha * mi),
        };
        let xi = x.row(i);
        for a in 0..p {
            let xa = xi[a];
            if xa == 0.0 {
                continue;
            }
            let wxa = wi * xa;
            for b in a..p {
                info[(a, b)] += wxa * xi[b];
            }
        }
    }
    for a in 0..p {
        for b in (a + 1)..p {
            info[(b, a)] = info[(a, b)];
        }
    }
    let cov = info
        .cholesky()
        .map(|ch| ch.inverse())
        .unwrap_or_else(|| DMatrix::zeros(p, p));

    // NB2 spends one extra parameter on alpha
    let n_params = p + matches!(family, Family::NegBinomial { .. }) as usize;
    Ok(Fit {
        aic: aic(loglik, n_params),
        beta,
        cov,
        mu,
        eta,
        deviance: dev,
        loglik,
        n_params,
        iterations,
        converged,
    })
}

fn deviance_of(family: Family, y: &[f64], mu: &[f64]) -> f64 {
    match family {
        Family::Poisson => poisson_deviance(y, mu),
        Family::NegBinomial { alpha } => nb2_deviance(y, mu, alpha),
    }
}

fn loglik_of(family: Family, y: &[f64], mu: &[f64]) -> f64 {
    match family {
        Family::Poisson => poisson_loglik(y, mu),
        Family::NegBinomial { alpha } => nb2_loglik(y, mu, alpha),
    }
}

/// Fit NB2 with dispersion estimated by golden-section search on ln alpha,
/// maximizing the profile log likelihood.
pub fn fit_nb2_profile(
    x: &DMatrix<f64>,
    y: &[f64],
    offset: &[f64],
) -> Result<(Fit, f64), String> {
    let profile = |ln_alpha: f64| -> Result<f64, String> {
        let f = fit_glm(x, y, offset, Family::NegBinomial { alpha: ln_alpha.exp() })?;
        Ok(f.loglik)
    };

    let (mut lo, mut hi) = (-8.0f64, 3.0f64);
    let phi = (5.0f64.sqrt() - 1.0) / 2.0;
    let mut c = hi - phi * (hi - lo);
    let mut d = lo + phi * (hi - lo);
    let mut fc = profile(c)?;
    let mut fd = profile(d)?;
    for _ in 0..40 {
        if fc > fd {
            hi = d;
            d = c;
            fd = fc;
            c = hi - phi * (hi - lo);
            fc = profile(c)?;
        } else {
            lo = c;
            c = d;
            fc = fd;
            d = lo + phi * (hi - lo);
            fd = profile(d)?;
        }
        if hi - lo < 1e-4 {
            break;
        }
    }
    let alpha = (0.5 * (lo + hi)).exp();
    let fit = fit_glm(x, y, offset, Family::NegBinomial { alpha })?;
    Ok((fit, alpha))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Intercept-only Poisson with offset ln(exposure) has the closed form
    /// beta0 = ln( sum y / sum exposure ).
    #[test]
    fn intercept_only_matches_closed_form() {
        let y = vec![0.0, 1.0, 0.0, 2.0, 1.0, 0.0, 3.0, 0.0];
        let exposure = [0.5, 1.0, 0.25, 1.0, 0.75, 1.0, 1.0, 0.5];
        let offset: Vec<f64> = exposure.iter().map(|e: &f64| e.ln()).collect();
        let x = DMatrix::from_element(y.len(), 1, 1.0);
        let fit = fit_glm(&x, &y, &offset, Family::Poisson).unwrap();
        let expected = (y.iter().sum::<f64>() / exposure.iter().sum::<f64>()).ln();
        assert!(fit.converged);
        assert!(
            (fit.beta[0] - expected).abs() < 1e-8,
            "beta0 {} vs {expected}",
            fit.beta[0]
        );
        // Intercept-only Poisson closed form: Var(beta0) = 1 / sum(mu)
        let se_expected = (1.0 / fit.mu.iter().sum::<f64>()).sqrt();
        assert!(
            (fit.se(0) - se_expected).abs() < 1e-8,
            "se0 {} vs {se_expected}",
            fit.se(0)
        );
    }

    /// Simulate from a known Poisson GLM and recover the coefficients.
    #[test]
    fn recovers_planted_coefficients() {
        use plab_datagen::rng::Rng;
        let mut rng = Rng::new(11);
        let n = 40_000;
        let (b0, b1, b2) = (-2.0, 0.6, -0.3);
        let mut x = DMatrix::zeros(n, 3);
        let mut y = vec![0.0; n];
        let mut offset = vec![0.0; n];
        for i in 0..n {
            let x1 = rng.normal();
            let x2 = if rng.chance(0.4) { 1.0 } else { 0.0 };
            let exposure = 0.3 + 0.7 * rng.f64();
            x[(i, 0)] = 1.0;
            x[(i, 1)] = x1;
            x[(i, 2)] = x2;
            offset[i] = exposure.ln();
            let mu = (b0 + b1 * x1 + b2 * x2).exp() * exposure;
            y[i] = rng.poisson(mu) as f64;
        }
        let fit = fit_glm(&x, &y, &offset, Family::Poisson).unwrap();
        assert!(fit.converged, "did not converge in {} iters", fit.iterations);
        assert!((fit.beta[0] - b0).abs() < 0.05, "b0 {}", fit.beta[0]);
        assert!((fit.beta[1] - b1).abs() < 0.05, "b1 {}", fit.beta[1]);
        assert!((fit.beta[2] - b2).abs() < 0.05, "b2 {}", fit.beta[2]);
        // The planted truth sits inside ±4 SE, and SEs are sane (positive,
        // small at n = 40k)
        for (i, b) in [b0, b1, b2].iter().enumerate() {
            let se = fit.se(i);
            assert!(se > 0.0 && se < 0.05, "se{i} {se}");
            assert!((fit.beta[i] - b).abs() < 4.0 * se, "b{i} outside 4 SE");
        }
    }

    /// On overdispersed (gamma-mixed) counts, profile NB2 recovers a positive
    /// alpha near the mixing variance and beats Poisson on AIC.
    #[test]
    fn nb2_profile_finds_overdispersion() {
        use plab_datagen::rng::Rng;
        let mut rng = Rng::new(12);
        let n = 30_000;
        let shape = 0.7; // mixing variance = 1/shape = 1.43 = target alpha
        let mut x = DMatrix::zeros(n, 2);
        let mut y = vec![0.0; n];
        let offset = vec![0.0; n];
        for i in 0..n {
            let x1 = rng.normal();
            x[(i, 0)] = 1.0;
            x[(i, 1)] = x1;
            let eps = rng.gamma(shape, 1.0 / shape);
            // healthy mean so overdispersion is visible in-sample
            let mu = (0.3 + 0.5 * x1).exp() * eps;
            y[i] = rng.poisson(mu) as f64;
        }
        let pois = fit_glm(&x, &y, &offset, Family::Poisson).unwrap();
        let (nb, alpha) = fit_nb2_profile(&x, &y, &offset).unwrap();
        assert!(nb.converged);
        assert!(
            (alpha - 1.0 / shape).abs() < 0.25,
            "alpha {alpha} vs {}",
            1.0 / shape
        );
        assert!(
            nb.aic < pois.aic - 50.0,
            "nb aic {} should beat poisson {}",
            nb.aic,
            pois.aic
        );
    }
}
