//! Natural cubic spline basis, the standard form from Elements of Statistical
//! Learning 5.4 5.5. Knots are join points of smooth cubic pieces; the fit is
//! linear beyond the boundary knots. With K total knots the basis contributes
//! K-1 columns (excluding the intercept).

/// Age knots: boundary 18 and 90, three interior joins at 25, 45, 70.
pub const AGE_KNOTS: [f64; 5] = [18.0, 25.0, 45.0, 70.0, 90.0];

fn pos3(v: f64) -> f64 {
    if v > 0.0 {
        v * v * v
    } else {
        0.0
    }
}

/// d_k(x) = [(x - k_k)+^3 - (x - k_K)+^3] / (k_K - k_k)
fn d(x: f64, knot: f64, last: f64) -> f64 {
    (pos3(x - knot) - pos3(x - last)) / (last - knot)
}

/// Basis columns for one x: [x, N_1(x), .., N_{K-2}(x)], length K-1.
pub fn natural_basis(x: f64, knots: &[f64]) -> Vec<f64> {
    let k = knots.len();
    assert!(k >= 3, "need at least 3 knots");
    let last = knots[k - 1];
    let second_last = knots[k - 2];
    let mut out = Vec::with_capacity(k - 1);
    out.push(x);
    for i in 0..k - 2 {
        out.push(d(x, knots[i], last) - d(x, second_last, last));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linear_beyond_boundaries() {
        // Natural spline is linear outside the boundary knots: second
        // differences of each basis column vanish out there.
        let knots = AGE_KNOTS;
        for base in [(9.0, 10.0, 11.0), (95.0, 100.0, 105.0)] {
            let (a, b, c) = base;
            let (ba, bb, bc) = (
                natural_basis(a, &knots),
                natural_basis(b, &knots),
                natural_basis(c, &knots),
            );
            for j in 0..ba.len() {
                let second_diff = bc[j] - 2.0 * bb[j] + ba[j];
                assert!(
                    second_diff.abs() < 1e-9,
                    "column {j} not linear beyond boundary: {second_diff}"
                );
            }
        }
    }

    #[test]
    fn continuous_at_knots() {
        let knots = AGE_KNOTS;
        for knot in knots {
            let lo = natural_basis(knot - 1e-7, &knots);
            let hi = natural_basis(knot + 1e-7, &knots);
            for j in 0..lo.len() {
                assert!((lo[j] - hi[j]).abs() < 1e-4, "discontinuity at {knot}");
            }
        }
    }

    #[test]
    fn column_count() {
        assert_eq!(natural_basis(40.0, &AGE_KNOTS).len(), AGE_KNOTS.len() - 1);
    }
}
