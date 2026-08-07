//! The artifacts behind a verdict. A written verdict is a claim; these are the
//! numbers it was written from, shaped for a chart.
//!
//! Evidence deliberately lives here and not in `plab_core::protocol`. The
//! agent's contract still carries only summaries, so the agent writes prose
//! from scalars while the console shows what the platform kept. Putting curves
//! in the protocol would hand them to the agent.

use plab_core::{PolicyRow, ZONES};
use plab_fit::design::age_band;
use plab_fit::metrics::{lgamma, ln_factorial};
use plab_fit::spline::{natural_basis, AGE_KNOTS};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Style {
    Bar,
    Line,
    Step,
    Dot,
}

impl Style {
    pub fn as_str(self) -> &'static str {
        match self {
            Style::Bar => "bar",
            Style::Line => "line",
            Style::Step => "step",
            Style::Dot => "dot",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Pt {
    pub x: f64,
    pub y: f64,
    /// tick label when the x axis is categorical
    pub label: Option<String>,
}

impl Pt {
    pub fn xy(x: f64, y: f64) -> Self {
        Pt { x, y, label: None }
    }
    pub fn labelled(x: f64, y: f64, label: impl Into<String>) -> Self {
        Pt {
            x,
            y,
            label: Some(label.into()),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Series {
    pub label: String,
    pub style: Style,
    pub points: Vec<Pt>,
}

#[derive(Debug, Clone)]
pub struct Chart {
    /// render hint for the console, one of the archetype chart names
    pub kind: String,
    pub title: String,
    pub x_label: String,
    pub y_label: String,
    pub series: Vec<Series>,
    /// short expert statements under the chart
    pub notes: Vec<String>,
    /// one plain English line, shown by the Plain terms switch
    pub gloss: String,
}

#[derive(Debug, Clone)]
pub struct LiftBucket {
    pub decile: u32,
    pub exposure: f64,
    /// claims per insured car year actually observed in the bucket
    pub actual: f64,
    /// what the candidate model predicted for the same rows
    pub predicted: f64,
    /// actual frequency in the baseline's own bucket of the same rank
    pub baseline_actual: f64,
}

#[derive(Debug, Clone)]
pub struct FitFacts {
    pub rows: usize,
    pub params: usize,
    pub iterations: usize,
    pub converged: bool,
    pub gini: f64,
    pub baseline_gini: f64,
    pub deviance: f64,
    pub aic: f64,
    /// NB2 dispersion when the family was refit, absent for Poisson
    pub alpha: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct Evidence {
    pub facts: Option<FitFacts>,
    pub lift: Vec<LiftBucket>,
    pub fold_deltas: Vec<f64>,
    pub charts: Vec<Chart>,
}

/// Order rows by predicted rate and cut into buckets holding equal earned
/// exposure. Actual frequency is claims over exposure inside the bucket, so a
/// model that separates risk produces a rising staircase.
pub fn lift_buckets(
    rates: &[f64],
    base_rates: &[f64],
    y: &[f64],
    exposure: &[f64],
    buckets: usize,
) -> Vec<LiftBucket> {
    let profile = |r: &[f64]| -> Vec<(f64, f64, f64)> {
        let mut idx: Vec<usize> = (0..r.len()).collect();
        idx.sort_by(|a, b| {
            r[*a]
                .partial_cmp(&r[*b])
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        let total: f64 = exposure.iter().sum();
        let step = total / buckets as f64;
        let mut out = Vec::with_capacity(buckets);
        let (mut e, mut c, mut p) = (0.0, 0.0, 0.0);
        // cumulative exposure decides the cut, bucket exposure resets at it
        let mut cum = 0.0;
        let mut edge = step;
        for (n, i) in idx.iter().enumerate() {
            e += exposure[*i];
            cum += exposure[*i];
            c += y[*i];
            p += r[*i] * exposure[*i];
            let last = n + 1 == idx.len();
            if (cum >= edge && out.len() + 1 < buckets) || last {
                out.push((e, c, p));
                edge += step;
                e = 0.0;
                c = 0.0;
                p = 0.0;
            }
        }
        while out.len() < buckets {
            out.push((0.0, 0.0, 0.0));
        }
        out
    };
    let cand = profile(rates);
    let base = profile(base_rates);
    (0..buckets)
        .map(|i| {
            let (e, c, p) = cand[i];
            let (be, bc, _) = base[i];
            LiftBucket {
                decile: i as u32 + 1,
                exposure: e,
                actual: if e > 0.0 { c / e } else { 0.0 },
                predicted: if e > 0.0 { p / e } else { 0.0 },
                baseline_actual: if be > 0.0 { bc / be } else { 0.0 },
            }
        })
        .collect()
}

/// Exposure by single year of age, the weight behind every point of the age
/// curve. Thin ages are where a curve is easiest to over read.
fn age_exposure(rows: &[&PolicyRow]) -> Vec<Pt> {
    let mut by_age = vec![0.0f64; 91];
    for r in rows {
        let a = (r.driver_age as usize).min(90);
        by_age[a] += r.earned_exposure;
    }
    (18..=90).map(|a| Pt::xy(a as f64, by_age[a])).collect()
}

/// Driver age relativity, spline against the filed bands, both expressed
/// against age 45 so the two forms are on one scale.
pub fn age_curve_chart_with_exposure(
    spline_beta: &[f64],
    band_beta: &[f64],
    rows: &[&PolicyRow],
) -> Chart {
    let mut c = age_curve_chart(spline_beta, band_beta);
    // Exposure rides on its own axis behind the curve, so a reader can see
    // how much book sits under each part of the shape
    c.series.insert(
        0,
        Series {
            label: "Earned exposure".into(),
            style: Style::Bar,
            points: age_exposure(rows),
        },
    );
    c
}

pub fn age_curve_chart(spline_beta: &[f64], band_beta: &[f64]) -> Chart {
    let ref_basis = natural_basis(45.0, &AGE_KNOTS);
    let ref_log: f64 = ref_basis.iter().zip(spline_beta).map(|(b, c)| b * c).sum();
    let mut curve = Vec::new();
    let mut step = Vec::new();
    for age in 18..=90u8 {
        let basis = natural_basis(age as f64, &AGE_KNOTS);
        let lp: f64 = basis.iter().zip(spline_beta).map(|(b, c)| b * c).sum();
        curve.push(Pt::xy(age as f64, (lp - ref_log).exp()));
        // v12 bands: 35 to 54 is the reference, so its coefficient is zero
        let band = age_band(age);
        let coef = match band {
            0 => band_beta[0],
            1 => band_beta[1],
            2 => 0.0,
            3 => band_beta[2],
            _ => band_beta[3],
        };
        step.push(Pt::xy(age as f64, coef.exp()));
    }
    let knots = AGE_KNOTS
        .iter()
        .map(|k| {
            let basis = natural_basis(*k, &AGE_KNOTS);
            let lp: f64 = basis.iter().zip(spline_beta).map(|(b, c)| b * c).sum();
            Pt::labelled(*k, (lp - ref_log).exp(), format!("{}", *k as i32))
        })
        .collect();

    let peak = curve
        .iter()
        .max_by(|a, b| a.y.partial_cmp(&b.y).unwrap_or(std::cmp::Ordering::Equal))
        .map(|p| (p.x, p.y))
        .unwrap_or((18.0, 1.0));
    let old_end = curve.last().map(|p| p.y).unwrap_or(1.0);

    Chart {
        kind: "age_curve".into(),
        title: "Driver age relativity".into(),
        x_label: "Driver age".into(),
        y_label: "Relativity, age 45 = 1.00".into(),
        series: vec![
            Series {
                label: "v12 bands".into(),
                style: Style::Step,
                points: step,
            },
            Series {
                label: "Fitted spline".into(),
                style: Style::Line,
                points: curve,
            },
            Series {
                label: "Knots".into(),
                style: Style::Dot,
                points: knots,
            },
        ],
        notes: vec![
            format!(
                "Fitted peak {:.2} at age {}, and the curve reaches {:.2} at age 90",
                peak.1, peak.0 as i32, old_end
            ),
            "Knots are the join points of the smooth pieces, not breaks in the price"
                .into(),
        ],
        gloss: "The steps are the five age groups the current model prices on, and the smooth line is what the same data says the risk actually does with age. Where the line pulls away from the steps, drivers inside one group are being charged the same for different risk.".into(),
    }
}

/// Observed frequency by prior accident count, with the exposure behind each
/// count, next to the fitted relativity of the capped factor.
pub fn accidents_chart(rows: &[&PolicyRow], capped_coef: f64) -> Chart {
    let max_k = 5usize;
    let mut exp = vec![0.0; max_k + 1];
    let mut clm = vec![0.0; max_k + 1];
    for r in rows {
        let k = (r.prior_accidents as usize).min(max_k);
        exp[k] += r.earned_exposure;
        clm[k] += r.claim_count as f64;
    }
    let total: f64 = exp.iter().sum();
    let observed: Vec<Pt> = (0..=max_k)
        .map(|k| {
            let f = if exp[k] > 0.0 { clm[k] / exp[k] } else { 0.0 };
            Pt::labelled(
                k as f64,
                f,
                if k == max_k {
                    format!("{k}+")
                } else {
                    k.to_string()
                },
            )
        })
        .collect();
    let base = observed[0].y.max(1e-9);
    let fitted: Vec<Pt> = (0..=max_k)
        .map(|k| Pt::xy(k as f64, (capped_coef * k.min(3) as f64).exp() * base))
        .collect();
    let share: Vec<Pt> = (0..=max_k)
        .map(|k| Pt::xy(k as f64, 100.0 * exp[k] / total))
        .collect();
    let thin: f64 = 100.0 * exp[3..].iter().sum::<f64>() / total;

    Chart {
        kind: "accidents".into(),
        title: "Frequency by prior accidents".into(),
        x_label: "Prior accidents".into(),
        y_label: "Claims per car year".into(),
        series: vec![
            Series {
                label: "Observed".into(),
                style: Style::Bar,
                points: observed,
            },
            Series {
                label: "Fitted, capped at 3".into(),
                style: Style::Line,
                points: fitted,
            },
            Series {
                label: "Share of exposure".into(),
                style: Style::Dot,
                points: share,
            },
        ],
        notes: vec![
            format!(
                "Counts of 3 and above carry {thin:.1}% of earned exposure between them"
            ),
            format!(
                "Each accident below the cap multiplies frequency by {:.2}",
                capped_coef.exp()
            ),
        ],
        gloss: "Drivers with more past accidents do claim more often, but almost nobody has three or more, so the model treats three and above as one group instead of pricing thin air.".into(),
    }
}

/// Filed against blended territory relativities, sorted by movement. This is
/// the direct movement reading: the relativities themselves move.
pub fn territory_chart(filed: &[f64], blended: &[f64]) -> Chart {
    let mut idx: Vec<usize> = (0..filed.len()).collect();
    idx.sort_by(|a, b| {
        let ma = (blended[*a] / filed[*a] - 1.0).abs();
        let mb = (blended[*b] / filed[*b] - 1.0).abs();
        mb.partial_cmp(&ma).unwrap_or(std::cmp::Ordering::Equal)
    });
    let mut filed_pts = Vec::new();
    let mut blend_pts = Vec::new();
    for (rank, z) in idx.iter().enumerate() {
        let code = plab_core::zone_code(*z as u8);
        filed_pts.push(Pt::labelled(rank as f64, filed[*z], code.clone()));
        blend_pts.push(Pt::labelled(rank as f64, blended[*z], code));
    }
    let worst = idx[0];
    let worst_move = 100.0 * (blended[worst] / filed[worst] - 1.0);
    let over: usize = idx
        .iter()
        .filter(|z| (blended[**z] / filed[**z] - 1.0).abs() * 100.0 > 5.0)
        .count();

    Chart {
        kind: "territory".into(),
        title: "Filed against blended relativity".into(),
        x_label: "Zones, sorted by movement".into(),
        y_label: "Relativity".into(),
        series: vec![
            Series {
                label: "Filed".into(),
                style: Style::Dot,
                points: filed_pts,
            },
            Series {
                label: "Blended".into(),
                style: Style::Dot,
                points: blend_pts,
            },
        ],
        notes: vec![
            format!(
                "Largest movement {:.1}% on {}",
                worst_move.abs(),
                plab_core::zone_code(worst as u8)
            ),
            format!("{over} of {} zones move past the 5% limit", filed.len()),
        ],
        gloss: "Each pair is one zone: where it sits in the filed table, and where this experiment would move it. These multipliers are on file with the regulator, so moving them is a filing question, not a modelling one.".into(),
    }
}

/// Observed against fitted share of policies at each claim count. Poisson and
/// NB2 use the same means; only the spread of the count distribution differs.
pub fn count_dist_chart(
    y: &[f64],
    mu_poisson: &[f64],
    mu_nb: &[f64],
    alpha: f64,
    aic_delta: f64,
) -> Chart {
    let n = y.len() as f64;
    let mut observed = vec![0.0; 4];
    for v in y {
        let k = (*v as usize).min(3);
        observed[k] += 1.0;
    }
    for o in observed.iter_mut() {
        *o = 100.0 * *o / n;
    }
    let mut pois = vec![0.0; 4];
    let mut nb = vec![0.0; 4];
    for i in 0..y.len() {
        let mp = mu_poisson[i].max(1e-12);
        let mn = mu_nb[i].max(1e-12);
        let mut pk_sum = 0.0;
        let mut nk_sum = 0.0;
        for k in 0..3usize {
            let p = (-mp + k as f64 * mp.ln() - ln_factorial(k as u64)).exp();
            pois[k] += p;
            pk_sum += p;
            let q = nb2_pmf(k as f64, mn, alpha);
            nb[k] += q;
            nk_sum += q;
        }
        pois[3] += 1.0 - pk_sum;
        nb[3] += 1.0 - nk_sum;
    }
    for k in 0..4 {
        pois[k] = 100.0 * pois[k] / n;
        nb[k] = 100.0 * nb[k] / n;
    }
    let label = |k: usize| {
        if k == 3 {
            "3+".to_string()
        } else {
            k.to_string()
        }
    };
    let mk = |v: &[f64]| -> Vec<Pt> {
        (0..4)
            .map(|k| Pt::labelled(k as f64, v[k], label(k)))
            .collect()
    };
    let tail_gap_pois = observed[2] + observed[3] - (pois[2] + pois[3]);

    Chart {
        kind: "count_dist".into(),
        title: "Share of policies by claim count".into(),
        x_label: "Claims in the year".into(),
        y_label: "Share of policies, percent".into(),
        series: vec![
            Series {
                label: "Observed".into(),
                style: Style::Bar,
                points: mk(&observed),
            },
            Series {
                label: "Poisson".into(),
                style: Style::Dot,
                points: mk(&pois),
            },
            Series {
                label: "NB2".into(),
                style: Style::Dot,
                points: mk(&nb),
            },
        ],
        notes: vec![
            format!("Fitted dispersion alpha {alpha:.3}, AIC change {aic_delta:+.0}"),
            format!(
                "Poisson sits {:+.2} points from the observed share at two claims and above",
                -tail_gap_pois
            ),
            "Deviance is not comparable across families, so AIC is the only cross family read"
                .into(),
        ],
        gloss: "Bars are how many policies really had zero, one, two, or more claims, and the dots are what each error model expects. The second model allows for more variety between drivers, so it matches the tail better without changing who it ranks as risky.".into(),
    }
}

fn nb2_pmf(k: f64, mu: f64, alpha: f64) -> f64 {
    let r = 1.0 / alpha;
    let ln_p = lgamma(k + r) - lgamma(r) - ln_factorial(k as u64)
        + r * (r / (r + mu)).ln()
        + k * (mu / (r + mu)).ln();
    ln_p.exp()
}

/// The four interaction cells: observed frequency against what the model
/// without the interaction already expects, with the exposure behind each cell.
pub fn interaction_chart(rows: &[&PolicyRow], mu12: &[f64], coef: f64) -> Chart {
    let cell = |r: &PolicyRow| -> usize {
        let young = r.driver_age <= 24;
        let old_vehicle = r.vehicle_age >= 13;
        (young as usize) * 2 + old_vehicle as usize
    };
    let names = [
        "25+, vehicle 0 to 12",
        "25+, vehicle 13+",
        "18 to 24, vehicle 0 to 12",
        "18 to 24, vehicle 13+",
    ];
    let mut exp = vec![0.0; 4];
    let mut clm = vec![0.0; 4];
    let mut pred = vec![0.0; 4];
    for (i, r) in rows.iter().enumerate() {
        let c = cell(r);
        exp[c] += r.earned_exposure;
        clm[c] += r.claim_count as f64;
        pred[c] += mu12[i];
    }
    let obs: Vec<Pt> = (0..4)
        .map(|c| Pt::labelled(c as f64, clm[c] / exp[c].max(1e-9), names[c]))
        .collect();
    let exp_pts: Vec<Pt> = (0..4)
        .map(|c| Pt::labelled(c as f64, pred[c] / exp[c].max(1e-9), names[c]))
        .collect();
    let total: f64 = exp.iter().sum();
    let share: Vec<Pt> = (0..4)
        .map(|c| Pt::xy(c as f64, 100.0 * exp[c] / total))
        .collect();
    let target = 3usize; // young driver, old vehicle
    let gap = 100.0 * (clm[target] / exp[target].max(1e-9))
        / (pred[target] / exp[target].max(1e-9))
        - 100.0;

    Chart {
        kind: "interaction".into(),
        title: "Interaction cells".into(),
        x_label: "Cell".into(),
        y_label: "Claims per car year".into(),
        series: vec![
            Series {
                label: "Observed".into(),
                style: Style::Bar,
                points: obs,
            },
            Series {
                label: "Expected without interaction".into(),
                style: Style::Dot,
                points: exp_pts,
            },
            Series {
                label: "Share of exposure".into(),
                style: Style::Dot,
                points: share,
            },
        ],
        notes: vec![
            format!(
                "The tested cell holds {:.1}% of exposure and sits {gap:+.1}% off what the model without it expects",
                100.0 * exp[target] / total
            ),
            format!("Fitted interaction multiplier {:.3}", coef.exp()),
        ],
        gloss: "Each bar is what one group of drivers actually claimed, and the dot is what the current model already expects for them. When the two nearly meet, the extra rule being tested has nothing left to explain.".into(),
    }
}

/// Missing mileage share by region, plus frequency for rows that have the
/// column against rows that do not.
pub fn missingness_charts(rows: &[&PolicyRow]) -> Vec<Chart> {
    let regions = plab_core::REGIONS;
    let mut total: Vec<f64> = vec![0.0; regions.len()];
    let mut missing: Vec<f64> = vec![0.0; regions.len()];
    let (mut e_obs, mut c_obs, mut e_mis, mut c_mis) = (0.0, 0.0, 0.0, 0.0);
    for r in rows {
        let ri = regions
            .iter()
            .position(|x| *x == ZONES[r.territory as usize].region)
            .unwrap_or(0);
        total[ri] += 1.0;
        if r.annual_mileage.is_none() {
            missing[ri] += 1.0;
            e_mis += r.earned_exposure;
            c_mis += r.claim_count as f64;
        } else {
            e_obs += r.earned_exposure;
            c_obs += r.claim_count as f64;
        }
    }
    let by_region: Vec<Pt> = (0..regions.len())
        .map(|i| {
            Pt::labelled(
                i as f64,
                100.0 * missing[i] / total[i].max(1.0_f64),
                regions[i],
            )
        })
        .collect();
    let f_obs = c_obs / e_obs.max(1e-9);
    let f_mis = c_mis / e_mis.max(1e-9);
    let freq: Vec<Pt> = vec![
        Pt::labelled(0.0, f_obs, "Mileage present"),
        Pt::labelled(1.0, f_mis, "Mileage missing"),
    ];
    let lo = by_region.iter().map(|p| p.y).fold(f64::MAX, f64::min);
    let hi = by_region.iter().map(|p| p.y).fold(f64::MIN, f64::max);

    vec![
        Chart {
            kind: "missingness".into(),
            title: "Missing mileage by region".into(),
            x_label: "Region".into(),
            y_label: "Policies missing mileage, percent".into(),
            series: vec![Series {
                label: "Missing share by region".into(),
                style: Style::Bar,
                points: by_region,
            }],
            notes: vec![
                format!("Missing share runs from {lo:.0}% to {hi:.0}% across regions"),
                "The regional pattern means a blanket fill would preserve geography by accident".into(),
            ],
            gloss: "The blank mileage boxes are not spread evenly. This view keeps the missing-share percentage on its own axis so it cannot be mistaken for claim frequency.".into(),
        },
        Chart {
            kind: "missing_frequency".into(),
            title: "Frequency by mileage status".into(),
            x_label: "Mileage status".into(),
            y_label: "Claims per car year".into(),
            series: vec![Series {
                label: "Frequency by mileage status".into(),
                style: Style::Bar,
                points: freq,
            }],
            notes: vec![
                format!(
                    "Rows without mileage run at {f_mis:.3} claims per car year against {f_obs:.3} for rows with it"
                ),
                "Different outcomes by missingness status make a simple imputation unsafe".into(),
            ],
            gloss: "Policies with and without mileage are compared on claim frequency alone. Keeping this separate from the regional percentage avoids a mixed-unit chart.".into(),
        },
    ]
}

/// Which rating factor puts a segment above or below the book, measured on
/// the model that is live today.
///
/// Each factor's contribution is the exposure weighted mean of its own log
/// contribution, taken inside the segment and across the book. The parts are
/// differences of logs, so they multiply back to the whole exactly.
pub fn segment_effects_chart(
    rows: &[&PolicyRow],
    names: &[String],
    x: &nalgebra::DMatrix<f64>,
    beta: &[f64],
    zone_log: &[f64],
    in_segment: impl Fn(&PolicyRow) -> bool,
    segment_label: &str,
) -> Chart {
    let group_of = |n: &str| -> Option<&'static str> {
        if n == "intercept" {
            None
        } else if n.starts_with("age_") {
            Some("driver_age")
        } else if n.starts_with("veh_age_") {
            Some("vehicle_age")
        } else if n.starts_with("use_") {
            Some("vehicle_use")
        } else if n == "single" {
            Some("marital_status")
        } else if n == "homeowner" {
            Some("homeowner")
        } else if n == "multi_policy" {
            Some("multi_policy")
        } else if n.starts_with("credit_") {
            Some("credit_tier")
        } else if n == "safe_driver" {
            Some("safe_driver")
        } else if n.starts_with("prior_acc") {
            Some("prior_accidents")
        } else {
            Some("other")
        }
    };
    let mut groups: Vec<&'static str> = Vec::new();
    for n in names {
        if let Some(g) = group_of(n) {
            if !groups.contains(&g) {
                groups.push(g);
            }
        }
    }
    groups.push("territory");

    let mut seg_sum = vec![0.0f64; groups.len()];
    let mut book_sum = vec![0.0f64; groups.len()];
    let (mut seg_exp, mut book_exp) = (0.0f64, 0.0f64);
    for (i, r) in rows.iter().enumerate() {
        let e = r.earned_exposure;
        let seg = in_segment(r);
        book_exp += e;
        if seg {
            seg_exp += e;
        }
        for (j, n) in names.iter().enumerate() {
            let Some(g) = group_of(n) else { continue };
            let gi = groups.iter().position(|x| *x == g).unwrap();
            let v = x[(i, j)] * beta[j];
            book_sum[gi] += v * e;
            if seg {
                seg_sum[gi] += v * e;
            }
        }
        let gi = groups.len() - 1;
        let v = zone_log[r.territory as usize];
        book_sum[gi] += v * e;
        if seg {
            seg_sum[gi] += v * e;
        }
    }

    let mut points = Vec::new();
    let mut total = 0.0;
    for gi in 0..groups.len() {
        let d = seg_sum[gi] / seg_exp.max(1e-12) - book_sum[gi] / book_exp.max(1e-12);
        if d.abs() < 1e-9 {
            continue;
        }
        total += d;
        points.push(Pt::labelled(points.len() as f64, d.exp(), groups[gi]));
    }
    points.sort_by(|a, b| {
        (b.y - 1.0)
            .abs()
            .partial_cmp(&(a.y - 1.0).abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    for (i, p) in points.iter_mut().enumerate() {
        p.x = i as f64;
    }
    let combined = Pt::labelled(points.len() as f64, total.exp(), "all factors");
    points.push(combined);

    let biggest = points
        .iter()
        .take(points.len().saturating_sub(1))
        .max_by(|a, b| {
            (a.y - 1.0)
                .abs()
                .partial_cmp(&(b.y - 1.0).abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .cloned();

    let mut notes = vec![format!(
        "Read against the whole book, {segment_label} sit at {:.2}x on the model in force",
        total.exp()
    )];
    if let Some(b) = biggest {
        notes.push(format!(
            "The largest single contribution is {} at {:.2}x",
            b.label.clone().unwrap_or_default(),
            b.y
        ));
    }
    notes.push(
        "Contributions are exposure weighted on the log scale, so the parts multiply to the whole"
            .into(),
    );

    Chart {
        kind: "segment_effects".into(),
        title: format!("What puts {segment_label} above or below the book"),
        x_label: "Rating factor".into(),
        y_label: "Multiplier against the book average".into(),
        series: vec![Series {
            label: "Relative effect".into(),
            style: Style::Bar,
            points,
        }],
        notes,
        gloss: "Each bar is one thing the model prices on, and how much it pushes this group of drivers above or below the average driver. A bar above one raises their expected claims, below one lowers it, and multiplying the bars together gives the whole gap.".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rows(n: usize) -> Vec<PolicyRow> {
        (0..n)
            .map(|i| PolicyRow {
                policy_id: i as u32,
                driver_age: 20 + (i % 60) as u8,
                vehicle_age: (i % 15) as u8,
                prior_accidents: (i % 5) as u8,
                territory: (i % 30) as u8,
                vehicle_use: plab_core::VehicleUse::Commute,
                marital_status: plab_core::Marital::Married,
                homeowner: i % 2 == 0,
                multi_policy: false,
                credit_tier: plab_core::CreditTier::B,
                safe_driver: false,
                annual_mileage: if i % 4 == 0 { None } else { Some(12000.0) },
                earned_exposure: 0.5 + (i % 3) as f64 * 0.25,
                period: plab_core::Period::Y2024H1,
                claim_count: (i % 7 == 0) as u8,
                fold: Some((i % 5) as u8),
            })
            .collect()
    }

    #[test]
    fn lift_buckets_partition_exposure() {
        let r = rows(500);
        let refs: Vec<&PolicyRow> = r.iter().collect();
        let exposure: Vec<f64> = refs.iter().map(|x| x.earned_exposure).collect();
        let y: Vec<f64> = refs.iter().map(|x| x.claim_count as f64).collect();
        let rates: Vec<f64> = (0..refs.len()).map(|i| 0.05 + i as f64 * 1e-4).collect();
        let base: Vec<f64> = rates.iter().rev().cloned().collect();
        let b = lift_buckets(&rates, &base, &y, &exposure, 10);
        assert_eq!(b.len(), 10);
        let total: f64 = exposure.iter().sum();
        let held: f64 = b.iter().map(|x| x.exposure).sum();
        assert!((held - total).abs() < 1e-9, "buckets must hold every row");
        // equal exposure buckets: none may be empty
        assert!(b.iter().all(|x| x.exposure > 0.0));
        // equal exposure means every bucket lands near one tenth of the book
        let target = total / 10.0;
        assert!(
            b.iter()
                .all(|x| (x.exposure - target).abs() < target * 0.05),
            "buckets: {:?}",
            b.iter().map(|x| x.exposure).collect::<Vec<_>>()
        );
    }

    #[test]
    fn segment_effects_parts_multiply_to_the_whole() {
        use nalgebra::DMatrix;
        let r = rows(600);
        let refs: Vec<&PolicyRow> = r.iter().collect();
        let names: Vec<String> = vec![
            "intercept".into(),
            "age_18_24".into(),
            "veh_age_4_7".into(),
            "credit_A".into(),
        ];
        let mut x = DMatrix::zeros(refs.len(), names.len());
        for (i, row) in refs.iter().enumerate() {
            x[(i, 0)] = 1.0;
            x[(i, 1)] = (row.driver_age <= 24) as u8 as f64;
            x[(i, 2)] = (row.vehicle_age >= 4 && row.vehicle_age <= 7) as u8 as f64;
            x[(i, 3)] = (i % 3 == 0) as u8 as f64;
        }
        let beta = [-2.4, 0.55, 0.08, -0.2];
        let zone_log: Vec<f64> = (0..plab_core::N_ZONES)
            .map(|z| (z as f64 * 0.01) - 0.15)
            .collect();
        let c = segment_effects_chart(
            &refs,
            &names,
            &x,
            &beta,
            &zone_log,
            |row| row.driver_age <= 24,
            "young drivers",
        );
        let pts = &c.series[0].points;
        let whole = pts.last().unwrap().y;
        let parts: f64 = pts[..pts.len() - 1].iter().map(|p| p.y).product();
        assert!(
            (parts - whole).abs() < 1e-9,
            "parts {parts} against whole {whole}"
        );
        assert_eq!(pts.last().unwrap().label.as_deref(), Some("all factors"));
    }

    #[test]
    fn age_curve_is_one_at_the_reference() {
        let spline = vec![0.4, -0.2, 0.1, 0.05];
        let bands = vec![0.5, 0.2, 0.1, 0.3];
        let c = age_curve_chart(&spline, &bands);
        let curve = &c.series[1].points;
        let at45 = curve.iter().find(|p| p.x == 45.0).unwrap();
        assert!((at45.y - 1.0).abs() < 1e-12, "spline normalized at age 45");
        let step = &c.series[0].points;
        let s45 = step.iter().find(|p| p.x == 45.0).unwrap();
        assert!((s45.y - 1.0).abs() < 1e-12, "45 sits in the reference band");
        let s20 = step.iter().find(|p| p.x == 20.0).unwrap();
        assert!((s20.y - 0.5f64.exp()).abs() < 1e-12);
    }

    #[test]
    fn count_shares_sum_to_one_hundred() {
        let y = vec![0.0, 1.0, 0.0, 2.0, 0.0, 0.0, 3.0, 1.0];
        let mu: Vec<f64> = y.iter().map(|_| 0.4).collect();
        let c = count_dist_chart(&y, &mu, &mu, 0.5, -100.0);
        for s in &c.series {
            let sum: f64 = s.points.iter().map(|p| p.y).sum();
            assert!(
                (sum - 100.0).abs() < 1e-6,
                "series {} sums to {sum}",
                s.label
            );
        }
    }

    #[test]
    fn territory_chart_leads_with_the_worst_zone() {
        let filed = vec![1.0, 1.0, 1.0];
        let blended = vec![1.02, 1.20, 0.99];
        let c = territory_chart(&filed, &blended);
        assert_eq!(c.series[0].points[0].label.as_deref(), Some("T-102"));
        assert!(c.notes[0].contains("20.0%"), "notes: {:?}", c.notes);
    }

    #[test]
    fn missingness_reads_both_halves() {
        let r = rows(400);
        let refs: Vec<&PolicyRow> = r.iter().collect();
        let charts = missingness_charts(&refs);
        assert_eq!(charts.len(), 2);
        assert_eq!(charts[0].kind, "missingness");
        assert_eq!(charts[0].series[0].points.len(), 5);
        assert_eq!(charts[0].y_label, "Policies missing mileage, percent");
        assert_eq!(charts[1].kind, "missing_frequency");
        assert_eq!(charts[1].series[0].points.len(), 2);
        assert_eq!(charts[1].y_label, "Claims per car year");
    }

    #[test]
    fn no_em_dashes_in_evidence_copy() {
        let r = rows(200);
        let refs: Vec<&PolicyRow> = r.iter().collect();
        let charts = vec![
            age_curve_chart(&[0.4, -0.2, 0.1, 0.05], &[0.5, 0.2, 0.1, 0.3]),
            accidents_chart(&refs, 0.18),
            territory_chart(&[1.0, 1.1], &[1.05, 1.0]),
            missingness_charts(&refs).remove(0),
        ];
        for c in charts {
            let mut text = format!("{} {} {} {}", c.title, c.x_label, c.y_label, c.gloss);
            for n in &c.notes {
                text.push_str(n);
            }
            for s in &c.series {
                text.push_str(&s.label);
            }
            assert!(!text.contains('\u{2014}'), "em dash in {}", c.kind);
            assert!(!c.title.ends_with('.'), "title ends with a period");
        }
    }
}
