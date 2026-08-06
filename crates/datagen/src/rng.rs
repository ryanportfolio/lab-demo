//! Self-contained deterministic RNG: splitmix64 seeding + xoshiro256** stream,
//! with the handful of samplers the generator needs. No external crates, so
//! the dataset is bit-reproducible from the seed alone on any platform.

pub fn splitmix64(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9E3779B97F4A7C15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

pub struct Rng {
    s: [u64; 4],
    spare_normal: Option<f64>,
}

impl Rng {
    pub fn new(seed: u64) -> Self {
        let mut sm = seed;
        Rng {
            s: [
                splitmix64(&mut sm),
                splitmix64(&mut sm),
                splitmix64(&mut sm),
                splitmix64(&mut sm),
            ],
            spare_normal: None,
        }
    }

    /// xoshiro256**
    pub fn next_u64(&mut self) -> u64 {
        let result = self.s[1]
            .wrapping_mul(5)
            .rotate_left(7)
            .wrapping_mul(9);
        let t = self.s[1] << 17;
        self.s[2] ^= self.s[0];
        self.s[3] ^= self.s[1];
        self.s[1] ^= self.s[2];
        self.s[0] ^= self.s[3];
        self.s[2] ^= t;
        self.s[3] = self.s[3].rotate_left(45);
        result
    }

    /// Uniform in [0, 1)
    pub fn f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 * (1.0 / (1u64 << 53) as f64)
    }

    /// Uniform integer in [0, n)
    pub fn below(&mut self, n: usize) -> usize {
        (self.f64() * n as f64) as usize % n
    }

    pub fn chance(&mut self, p: f64) -> bool {
        self.f64() < p
    }

    /// Standard normal, Marsaglia polar method with cached spare.
    pub fn normal(&mut self) -> f64 {
        if let Some(z) = self.spare_normal.take() {
            return z;
        }
        loop {
            let u = 2.0 * self.f64() - 1.0;
            let v = 2.0 * self.f64() - 1.0;
            let s = u * u + v * v;
            if s > 0.0 && s < 1.0 {
                let m = (-2.0 * s.ln() / s).sqrt();
                self.spare_normal = Some(v * m);
                return u * m;
            }
        }
    }

    /// Poisson via Knuth's product method. Fine for the small lambdas here.
    pub fn poisson(&mut self, lambda: f64) -> u32 {
        if lambda <= 0.0 {
            return 0;
        }
        let l = (-lambda).exp();
        let mut k = 0u32;
        let mut p = 1.0;
        loop {
            p *= self.f64();
            if p <= l {
                return k;
            }
            k += 1;
            if k > 500 {
                return k; // unreachable at our lambdas, just a hard stop
            }
        }
    }

    /// Gamma(shape, scale) via Marsaglia and Tsang, with the shape<1 boost.
    pub fn gamma(&mut self, shape: f64, scale: f64) -> f64 {
        if shape < 1.0 {
            let g = self.gamma(shape + 1.0, scale);
            let u = self.f64().max(f64::MIN_POSITIVE);
            return g * u.powf(1.0 / shape);
        }
        let d = shape - 1.0 / 3.0;
        let c = 1.0 / (9.0 * d).sqrt();
        loop {
            let x = self.normal();
            let v = 1.0 + c * x;
            if v <= 0.0 {
                continue;
            }
            let v3 = v * v * v;
            let u = self.f64().max(f64::MIN_POSITIVE);
            if u.ln() < 0.5 * x * x + d - d * v3 + d * v3.ln() {
                return d * v3 * scale;
            }
        }
    }

    pub fn lognormal(&mut self, mu_ln: f64, sigma_ln: f64) -> f64 {
        (mu_ln + sigma_ln * self.normal()).exp()
    }

    /// Sample an index from cumulative weights (last element = total).
    pub fn weighted(&mut self, cumulative: &[f64]) -> usize {
        let total = *cumulative.last().expect("non-empty weights");
        let target = self.f64() * total;
        match cumulative.binary_search_by(|c| c.partial_cmp(&target).unwrap()) {
            Ok(i) => (i + 1).min(cumulative.len() - 1),
            Err(i) => i,
        }
    }
}

pub fn cumulative(weights: &[f64]) -> Vec<f64> {
    let mut acc = 0.0;
    weights
        .iter()
        .map(|w| {
            acc += w;
            acc
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_stream() {
        let mut a = Rng::new(7);
        let mut b = Rng::new(7);
        for _ in 0..1000 {
            assert_eq!(a.next_u64(), b.next_u64());
        }
    }

    #[test]
    fn uniform_bounds() {
        let mut r = Rng::new(1);
        for _ in 0..10_000 {
            let x = r.f64();
            assert!((0.0..1.0).contains(&x));
        }
    }

    #[test]
    fn poisson_mean_close() {
        let mut r = Rng::new(2);
        let n = 200_000;
        let sum: u64 = (0..n).map(|_| r.poisson(0.75) as u64).sum();
        let mean = sum as f64 / n as f64;
        assert!((mean - 0.75).abs() < 0.01, "poisson mean {mean}");
    }

    #[test]
    fn gamma_mean_and_var_close() {
        let mut r = Rng::new(3);
        let (shape, scale) = (0.7, 1.0 / 0.7);
        let n = 200_000;
        let draws: Vec<f64> = (0..n).map(|_| r.gamma(shape, scale)).collect();
        let mean = draws.iter().sum::<f64>() / n as f64;
        let var = draws.iter().map(|x| (x - mean) * (x - mean)).sum::<f64>() / n as f64;
        assert!((mean - 1.0).abs() < 0.02, "gamma mean {mean}");
        // Var = shape*scale^2 = 1/shape = 1.4286
        assert!((var - 1.0 / shape).abs() < 0.08, "gamma var {var}");
    }

    #[test]
    fn weighted_hits_all_and_respects_ratio() {
        let mut r = Rng::new(4);
        let cum = cumulative(&[1.0, 3.0, 6.0]);
        let mut counts = [0usize; 3];
        for _ in 0..60_000 {
            counts[r.weighted(&cum)] += 1;
        }
        assert!(counts.iter().all(|&c| c > 0));
        let ratio = counts[2] as f64 / counts[0] as f64;
        assert!((ratio - 6.0).abs() < 0.6, "ratio {ratio}");
    }
}
