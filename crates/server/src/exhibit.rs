//! Sign-off exhibits: the decision evidence compiled to static SVG and an
//! exact-value table at the moment of approval, from the run's frozen
//! evidence json. Rendered once, inside the approval transaction, stored as
//! data — the record page only concatenates strings at read time, so the
//! FR-3 rule (no read-time reconstruction) holds: what you see is what was
//! signed, renderer bugs included. Everything here is a pure function of its
//! input and deterministic, so tests can hold the output byte-stable.

use serde_json::{json, Value};

const W: f64 = 760.0;
const H: f64 = 380.0;
const PAD_L: f64 = 78.0;
const PAD_R: f64 = 16.0;
const PAD_T: f64 = 20.0;
const PAD_B: f64 = 52.0;

fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn is_secondary(label: &str) -> bool {
    label == "Earned exposure" || label.starts_with("Share of exposure")
}

fn is_relativity(kind: &str) -> bool {
    matches!(kind, "age_curve" | "segment_effects" | "territory")
}

/// Same tick logic the console uses, ported so the frozen exhibit reads like
/// the screen the reviewer approved from.
fn nice_ticks(lo: f64, hi: f64, count: usize) -> Vec<f64> {
    if !lo.is_finite() || !hi.is_finite() || lo == hi {
        return vec![lo];
    }
    let span = hi - lo;
    let raw = span / count as f64;
    let mag = 10f64.powf(raw.log10().floor());
    let step = [1.0, 2.0, 2.5, 5.0, 10.0]
        .iter()
        .map(|m| m * mag)
        .find(|s| *s >= raw)
        .unwrap_or(mag * 10.0);
    let start = (lo / step).ceil() * step;
    let mut out = Vec::new();
    let mut v = start;
    while v <= hi + step * 1e-6 {
        out.push((v * 1e10).round() / 1e10);
        v += step;
    }
    out
}

fn fmt_val(y: f64) -> String {
    if y == y.trunc() && y.abs() < 1e15 {
        return format!("{}", y as i64);
    }
    let a = y.abs();
    if a >= 100.0 {
        format!("{y:.1}")
    } else if a >= 10.0 {
        format!("{y:.2}")
    } else {
        format!("{y:.3}")
    }
}

struct Pt {
    x: f64,
    y: f64,
    label: Option<String>,
    se: Option<f64>,
}

struct Series {
    label: String,
    style: String,
    points: Vec<Pt>,
}

fn parse_series(chart: &Value) -> Vec<Series> {
    chart["series"]
        .as_array()
        .map(|a| {
            a.iter()
                .map(|s| Series {
                    label: s["label"].as_str().unwrap_or_default().to_string(),
                    style: s["style"].as_str().unwrap_or("line").to_string(),
                    points: s["points"]
                        .as_array()
                        .map(|p| {
                            p.iter()
                                .map(|pt| Pt {
                                    x: pt["x"].as_f64().unwrap_or(0.0),
                                    y: pt["y"].as_f64().unwrap_or(0.0),
                                    label: pt["label"].as_str().map(String::from),
                                    se: pt["se"].as_f64(),
                                })
                                .collect()
                        })
                        .unwrap_or_default(),
                })
                .collect()
        })
        .unwrap_or_default()
}

/// A chart's frozen json → one standalone SVG string. Static on purpose: a
/// filing exhibit has no hover; the value table beside it carries the exact
/// numbers.
pub fn render_chart_svg(chart: &Value) -> String {
    let kind = chart["kind"].as_str().unwrap_or_default();
    let series = parse_series(chart);
    let primary: Vec<&Series> = series.iter().filter(|s| !is_secondary(&s.label)).collect();
    let secondary = series.iter().find(|s| is_secondary(&s.label));
    if primary.is_empty() {
        return String::new();
    }
    let rel = is_relativity(kind);

    let xs: Vec<f64> = {
        let mut v: Vec<f64> = primary.iter().flat_map(|s| s.points.iter().map(|p| p.x)).collect();
        v.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        v.dedup();
        v
    };
    let categorical = primary
        .iter()
        .any(|s| !s.points.is_empty() && s.points.iter().all(|p| p.label.is_some()))
        && xs.len() <= 32
        && xs.iter().all(|x| x.fract() == 0.0);
    let (x_min, x_max) = (
        xs.first().copied().unwrap_or(0.0),
        xs.last().copied().unwrap_or(1.0),
    );

    let mut lo = f64::MAX;
    let mut hi = f64::MIN;
    for s in &primary {
        for p in &s.points {
            let (bl, bh) = match p.se {
                Some(se) => (p.y * (-2.0 * se).exp(), p.y * (2.0 * se).exp()),
                None => (p.y, p.y),
            };
            lo = lo.min(bl);
            hi = hi.max(bh);
        }
    }
    let base = if rel { 1.0 } else { 0.0 };
    lo = lo.min(base);
    hi = hi.max(base);
    let pad = ((hi - lo) * 0.12).max(hi.abs() * 0.012).max(1e-9);
    lo -= pad;
    hi += pad;
    if !rel && lo < 0.0 && primary.iter().all(|s| s.points.iter().all(|p| p.y >= 0.0)) {
        lo = 0.0;
    }

    let plot_w = W - PAD_L - PAD_R;
    let plot_h = H - PAD_T - PAD_B;
    let band = if categorical && !xs.is_empty() {
        plot_w / xs.len() as f64
    } else {
        0.0
    };
    let sx = |x: f64| -> f64 {
        if categorical {
            let i = xs.iter().position(|v| (v - x).abs() < 1e-9).unwrap_or(0);
            PAD_L + band * i as f64 + band / 2.0
        } else {
            PAD_L + plot_w * (x - x_min) / ((x_max - x_min).max(1e-12))
        }
    };
    let sy = |y: f64| -> f64 { PAD_T + plot_h * (1.0 - (y - lo) / ((hi - lo).max(1e-12))) };

    let mut body = String::new();

    // y grid + ticks
    for t in nice_ticks(lo, hi, 4) {
        let y = sy(t);
        body.push_str(&format!(
            r#"<line class="xh-grid" x1="{PAD_L:.1}" x2="{:.1}" y1="{y:.1}" y2="{y:.1}"/><text class="xh-tick" x="{:.1}" y="{:.1}" text-anchor="end">{}</text>"#,
            W - PAD_R,
            PAD_L - 8.0,
            y + 4.0,
            fmt_val(t)
        ));
    }

    // secondary (exposure) bars at 45% height behind everything
    if let Some(sec) = secondary {
        let sec_max = sec.points.iter().map(|p| p.y).fold(1.0f64, f64::max);
        let sec_w = if categorical {
            band * 0.5
        } else {
            (plot_w / sec.points.len().max(1) as f64 - 1.5).max(1.0)
        };
        for p in &sec.points {
            let top = PAD_T + plot_h * (1.0 - (p.y / sec_max) * 0.45);
            body.push_str(&format!(
                r#"<rect class="xh-exposure" x="{:.1}" y="{top:.1}" width="{sec_w:.1}" height="{:.1}"/>"#,
                sx(p.x) - sec_w / 2.0,
                (PAD_T + plot_h - top).max(0.0)
            ));
        }
    }

    // reference line
    body.push_str(&format!(
        r#"<line class="xh-zero" x1="{PAD_L:.1}" x2="{:.1}" y1="{:.1}" y2="{:.1}"/>"#,
        W - PAD_R,
        sy(base),
        sy(base)
    ));

    // ±2 SE bands under the marks: area for line/step, whiskers for dot/bar
    for s in &primary {
        let run: Vec<&Pt> = s.points.iter().filter(|p| p.se.is_some()).collect();
        if run.is_empty() {
            continue;
        }
        let blo = |p: &Pt| p.y * (-2.0 * p.se.unwrap_or(0.0)).exp();
        let bhi = |p: &Pt| p.y * (2.0 * p.se.unwrap_or(0.0)).exp();
        if (s.style == "line" || s.style == "step") && run.len() >= 2 {
            let mut d = String::new();
            for (i, p) in run.iter().enumerate() {
                let cmd = if i == 0 { 'M' } else { 'L' };
                if s.style == "step" && i > 0 {
                    d.push_str(&format!("L{:.1},{:.1} ", sx(p.x), sy(bhi(run[i - 1]))));
                }
                d.push_str(&format!("{cmd}{:.1},{:.1} ", sx(p.x), sy(bhi(p))));
            }
            for (i, p) in run.iter().enumerate().rev() {
                if s.style == "step" && i + 1 < run.len() {
                    d.push_str(&format!("L{:.1},{:.1} ", sx(p.x), sy(blo(run[i + 1]))));
                }
                d.push_str(&format!("L{:.1},{:.1} ", sx(p.x), sy(blo(p))));
            }
            d.push('Z');
            body.push_str(&format!(r#"<path class="xh-band" d="{}"/>"#, d.trim()));
        } else {
            for p in run {
                let x = sx(p.x);
                body.push_str(&format!(
                    r#"<line class="xh-whisker" x1="{x:.1}" x2="{x:.1}" y1="{:.1}" y2="{:.1}"/><line class="xh-whisker" x1="{:.1}" x2="{:.1}" y1="{:.1}" y2="{:.1}"/><line class="xh-whisker" x1="{:.1}" x2="{:.1}" y1="{:.1}" y2="{:.1}"/>"#,
                    sy(blo(p)),
                    sy(bhi(p)),
                    x - 3.0,
                    x + 3.0,
                    sy(blo(p)),
                    sy(blo(p)),
                    x - 3.0,
                    x + 3.0,
                    sy(bhi(p)),
                    sy(bhi(p))
                ));
            }
        }
    }

    // evidence marks
    let bar_series: Vec<&&Series> = primary.iter().filter(|s| s.style == "bar").collect();
    let bar_w = if categorical {
        (band * 0.72) / bar_series.len().max(1) as f64
    } else {
        (plot_w / ((x_max - x_min) + 1.0) - 1.0).max(1.0)
    };
    for s in &primary {
        match s.style.as_str() {
            "bar" => {
                let slot = bar_series
                    .iter()
                    .position(|b| b.label == s.label)
                    .unwrap_or(0);
                for p in &s.points {
                    let off = if categorical {
                        -((bar_series.len() as f64 * bar_w) / 2.0) + slot as f64 * bar_w
                    } else {
                        -bar_w / 2.0
                    };
                    let b = sy(base);
                    let t = sy(p.y);
                    body.push_str(&format!(
                        r#"<rect class="xh-bar xh-s{slot}" x="{:.1}" y="{:.1}" width="{bar_w:.1}" height="{:.1}"/>"#,
                        sx(p.x) + off,
                        t.min(b),
                        (b - t).abs().max(1.0)
                    ));
                }
            }
            "dot" => {
                let slot = primary.iter().position(|q| q.label == s.label).unwrap_or(0);
                for p in &s.points {
                    body.push_str(&format!(
                        r#"<circle class="xh-dot xh-s{slot}" cx="{:.1}" cy="{:.1}" r="3.2"/>"#,
                        sx(p.x),
                        sy(p.y)
                    ));
                }
            }
            _ => {
                let mut d = String::new();
                for (i, p) in s.points.iter().enumerate() {
                    if i == 0 {
                        d.push_str(&format!("M{:.1},{:.1} ", sx(p.x), sy(p.y)));
                    } else if s.style == "step" {
                        let prev = &s.points[i - 1];
                        d.push_str(&format!(
                            "L{:.1},{:.1} L{:.1},{:.1} ",
                            sx(p.x),
                            sy(prev.y),
                            sx(p.x),
                            sy(p.y)
                        ));
                    } else {
                        d.push_str(&format!("L{:.1},{:.1} ", sx(p.x), sy(p.y)));
                    }
                }
                let slot = primary.iter().position(|q| q.label == s.label).unwrap_or(0);
                let dash = if s.style == "step" {
                    r#" stroke-dasharray="4 3""#
                } else {
                    ""
                };
                body.push_str(&format!(
                    r#"<path class="xh-line xh-s{slot}" d="{}" fill="none"{dash}/>"#,
                    d.trim()
                ));
            }
        }
    }

    // x labels: every categorical label (thinned to 12) or numeric ticks
    if categorical {
        let labels: Vec<(f64, String)> = {
            let mut m: Vec<(f64, String)> = Vec::new();
            for s in &primary {
                for p in &s.points {
                    if let Some(l) = &p.label {
                        if !m.iter().any(|(x, _)| (x - p.x).abs() < 1e-9) {
                            m.push((p.x, l.clone()));
                        }
                    }
                }
            }
            m.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
            m
        };
        let every = labels.len().div_ceil(12).max(1);
        for (i, (x, l)) in labels.iter().enumerate() {
            if i % every != 0 {
                continue;
            }
            body.push_str(&format!(
                r#"<text class="xh-tick" x="{:.1}" y="{:.1}" text-anchor="middle">{}</text>"#,
                sx(*x),
                H - PAD_B + 18.0,
                esc(l)
            ));
        }
    } else {
        for t in nice_ticks(x_min, x_max, 5) {
            body.push_str(&format!(
                r#"<text class="xh-tick" x="{:.1}" y="{:.1}" text-anchor="middle">{}</text>"#,
                sx(t),
                H - PAD_B + 18.0,
                fmt_val(t)
            ));
        }
    }

    // axis titles + legend line
    let legend = primary
        .iter()
        .enumerate()
        .map(|(i, s)| format!("{} ({})", s.label, ["solid", "muted", "dotted", "pale"][i.min(3)]))
        .collect::<Vec<_>>()
        .join(" · ");
    body.push_str(&format!(
        r#"<text class="xh-axis" x="{:.1}" y="{:.1}" text-anchor="middle">{}</text><text class="xh-axis" x="14" y="{:.1}" transform="rotate(-90 14 {:.1})" text-anchor="middle">{}</text>"#,
        PAD_L + plot_w / 2.0,
        H - 8.0,
        esc(chart["x_label"].as_str().unwrap_or_default()),
        PAD_T + plot_h / 2.0,
        PAD_T + plot_h / 2.0,
        esc(chart["y_label"].as_str().unwrap_or_default())
    ));

    format!(
        r#"<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{}"><style>.xh-grid{{stroke:#d8d2c4;stroke-width:1}}.xh-zero{{stroke:#8a8474;stroke-width:1;stroke-dasharray:2 3}}.xh-tick{{font:11px Georgia,serif;fill:#6b6557}}.xh-axis{{font:12px Georgia,serif;fill:#4a4536}}.xh-exposure{{fill:#e7e1d2}}.xh-band{{fill:#345d7e;opacity:.13}}.xh-whisker{{stroke:#345d7e;stroke-width:1;opacity:.55}}.xh-line.xh-s0{{stroke:#345d7e;stroke-width:1.8}}.xh-line.xh-s1,.xh-line{{stroke:#8a8474;stroke-width:1.4}}.xh-dot{{fill:#345d7e}}.xh-dot.xh-s0{{fill:#8a8474}}.xh-bar{{fill:#b8c4d0}}.xh-bar.xh-s1{{fill:#8fa3b5}}</style>{}<text class="xh-tick" x="{:.1}" y="{:.1}" text-anchor="end">{}</text></svg>"#,
        esc(chart["title"].as_str().unwrap_or_default()),
        body,
        W - PAD_R,
        12.0,
        esc(&legend)
    )
}

/// The exhibit's exact-value twin as plain HTML: the record satisfies chart
/// and table parity the same way the live product does.
pub fn render_value_table(chart: &Value) -> String {
    let series = parse_series(chart);
    let primary: Vec<&Series> = series.iter().filter(|s| !is_secondary(&s.label)).collect();
    let secondary = series.iter().find(|s| is_secondary(&s.label));
    let mut xs: Vec<f64> = series
        .iter()
        .flat_map(|s| s.points.iter().map(|p| p.x))
        .collect();
    xs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    xs.dedup();

    let mut head = format!("<th>{}</th>", esc(chart["x_label"].as_str().unwrap_or_default()));
    for s in &primary {
        head.push_str(&format!("<th>{}</th>", esc(&s.label)));
        if s.points.iter().any(|p| p.se.is_some()) {
            head.push_str("<th>&plusmn;2 SE range</th>");
        }
    }
    if let Some(sec) = secondary {
        head.push_str(&format!("<th>{}</th>", esc(&sec.label)));
    }

    let mut rows = String::new();
    for x in &xs {
        let label = series
            .iter()
            .flat_map(|s| s.points.iter())
            .find(|p| (p.x - x).abs() < 1e-9 && p.label.is_some())
            .and_then(|p| p.label.clone())
            .unwrap_or_else(|| fmt_val(*x));
        let mut row = format!("<th>{}</th>", esc(&label));
        for s in &primary {
            let pt = s.points.iter().find(|p| (p.x - x).abs() < 1e-9);
            row.push_str(&format!(
                "<td>{}</td>",
                pt.map(|p| fmt_val(p.y)).unwrap_or_default()
            ));
            if s.points.iter().any(|p| p.se.is_some()) {
                let range = pt
                    .and_then(|p| p.se.map(|se| (p, se)))
                    .map(|(p, se)| {
                        format!(
                            "{} to {}",
                            fmt_val(p.y * (-2.0 * se).exp()),
                            fmt_val(p.y * (2.0 * se).exp())
                        )
                    })
                    .unwrap_or_default();
                row.push_str(&format!("<td>{range}</td>"));
            }
        }
        if let Some(sec) = secondary {
            let v = sec
                .points
                .iter()
                .find(|p| (p.x - x).abs() < 1e-9)
                .map(|p| fmt_val(p.y))
                .unwrap_or_default();
            row.push_str(&format!("<td>{v}</td>"));
        }
        rows.push_str(&format!("<tr>{row}</tr>"));
    }
    format!(r#"<table class="xh-table"><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>"#)
}

/// The lift chart, rebuilt from the frozen lift array with the same
/// derivation the console uses — the numbers stay the recorded ones.
fn lift_chart_json(evidence: &Value) -> Option<Value> {
    let lift = evidence["lift"].as_array()?;
    if lift.is_empty() {
        return None;
    }
    let pts = |key: &str| -> Vec<Value> {
        lift.iter()
            .map(|b| {
                json!({
                    "x": b["decile"].as_f64().unwrap_or(0.0),
                    "y": b[key].as_f64().unwrap_or(0.0),
                    "label": b["decile"].as_f64().map(|d| format!("{}", d as i64)),
                })
            })
            .collect()
    };
    let first = &lift[0];
    let last = &lift[lift.len() - 1];
    let ratio = |lo: f64, hi: f64| if lo > 0.0 { hi / lo } else { 0.0 };
    Some(json!({
        "kind": "lift",
        "title": "Actual frequency by risk decile",
        "x_label": "Decile of predicted rate, equal exposure",
        "y_label": "Claims per car year",
        "series": [
            {"label": "Earned exposure", "style": "bar", "points": pts("exposure")},
            {"label": "Actual, this model", "style": "bar", "points": pts("actual")},
            {"label": "Predicted", "style": "line", "points": pts("predicted")},
            {"label": "Actual, v12 deciles", "style": "dot", "points": pts("baseline_actual")},
        ],
        "notes": [format!(
            "Top decile against bottom decile: {:.2}x here, {:.2}x on v12",
            ratio(first["actual"].as_f64().unwrap_or(0.0), last["actual"].as_f64().unwrap_or(0.0)),
            ratio(first["baseline_actual"].as_f64().unwrap_or(0.0), last["baseline_actual"].as_f64().unwrap_or(0.0)),
        )],
        "gloss": "",
    }))
}

/// The minimal viable sign-off set: the winner's first decision chart plus
/// the lift staircase, each with its value table and the run's own notes.
pub fn build_exhibits(evidence: &Value, winner_code: &str) -> Value {
    let mut out = Vec::new();
    let mut push = |chart: &Value| {
        let svg = render_chart_svg(chart);
        if svg.is_empty() {
            return;
        }
        let notes = chart["notes"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|n| n.as_str())
                    .collect::<Vec<_>>()
                    .join(" · ")
            })
            .unwrap_or_default();
        out.push(json!({
            "kind": chart["kind"],
            "title": chart["title"],
            "svg": svg,
            "table": render_value_table(chart),
            "note": notes,
        }));
    };
    if let Some(first) = evidence["charts"].as_array().and_then(|a| a.first()) {
        push(first);
    }
    if let Some(lift) = lift_chart_json(evidence) {
        push(&lift);
    }
    json!({ "winner_code": winner_code, "exhibits": out })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_chart() -> Value {
        json!({
            "kind": "age_curve",
            "title": "Driver age relativity",
            "x_label": "Driver age",
            "y_label": "Relativity, age 45 = 1.00",
            "notes": ["a note"],
            "gloss": "",
            "series": [
                {"label": "Earned exposure", "style": "bar", "points": [
                    {"x": 20.0, "y": 900.0, "label": null}, {"x": 45.0, "y": 4000.0, "label": null}, {"x": 80.0, "y": 300.0, "label": null}
                ]},
                {"label": "Fitted spline", "style": "line", "points": [
                    {"x": 20.0, "y": 1.8, "label": null, "se": 0.04},
                    {"x": 45.0, "y": 1.0, "label": null},
                    {"x": 80.0, "y": 1.3, "label": null, "se": 0.09}
                ]}
            ]
        })
    }

    #[test]
    fn svg_is_deterministic_and_carries_the_marks() {
        let c = fixture_chart();
        let a = render_chart_svg(&c);
        let b = render_chart_svg(&c);
        assert_eq!(a, b, "the frozen artifact must be reproducible");
        assert!(a.starts_with("<svg"));
        // one line path for the spline, one band (two banded points), three
        // exposure bars, one zero line
        assert_eq!(a.matches(r#"<path class="xh-line"#).count(), 1);
        assert_eq!(a.matches(r#"<path class="xh-band"#).count(), 1);
        assert_eq!(a.matches(r#"<rect class="xh-exposure""#).count(), 3);
        assert!(a.contains("xh-zero"));
        assert!(a.contains("Driver age"));
    }

    #[test]
    fn svg_escapes_labels() {
        let mut c = fixture_chart();
        c["title"] = json!("A <risky> & \"quoted\" title");
        let svg = render_chart_svg(&c);
        assert!(!svg.contains("<risky>"));
        assert!(svg.contains("&lt;risky&gt; &amp;"));
    }

    #[test]
    fn value_table_rows_match_distinct_x_and_band_iff_se() {
        let c = fixture_chart();
        let t = render_value_table(&c);
        assert_eq!(t.matches("<tr>").count(), 4, "header + 3 x rows");
        assert!(t.contains("2 SE range"));
        // the reference age has no se: its range cell is empty
        assert!(t.contains("<td></td>"));
        assert!(t.contains(" to "));
    }

    #[test]
    fn exhibits_build_from_frozen_evidence() {
        let evidence = json!({
            "charts": [fixture_chart()],
            "lift": [
                {"decile": 1, "exposure": 100.0, "actual": 0.04, "predicted": 0.05, "baseline_actual": 0.05},
                {"decile": 2, "exposure": 100.0, "actual": 0.09, "predicted": 0.08, "baseline_actual": 0.08}
            ],
            "fold_deltas": [],
        });
        let ex = build_exhibits(&evidence, "EXP-07");
        assert_eq!(ex["winner_code"], "EXP-07");
        let list = ex["exhibits"].as_array().unwrap();
        assert_eq!(list.len(), 2, "decision chart + lift");
        assert_eq!(list[1]["kind"], "lift");
        assert!(list[1]["svg"].as_str().unwrap().contains("xh-exposure"));
        assert!(list[0]["note"].as_str().unwrap().contains("a note"));
    }

    #[test]
    fn empty_evidence_builds_an_empty_exhibit_list() {
        let ex = build_exhibits(&json!({"charts": [], "lift": []}), "EXP-01");
        assert_eq!(ex["exhibits"].as_array().unwrap().len(), 0);
    }
}
