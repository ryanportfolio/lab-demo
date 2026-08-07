//! The context expert: ask a question about the run, get an answer built from
//! the run's own artifacts.
//!
//! It is deterministic on purpose. No model is called and none is needed: the
//! answers are composed from the fits, guardrail readings, and evidence this
//! run already produced, and every answer carries the steps it took and the
//! experiments it read, so a reader can check it against the same artifacts.
//! It reads and it draws. It cannot fit, merge, or approve anything.

use crate::schema::{
    chart_from_json, evidence_from_json, Answer, AnswerStep, Citation, Evidence, EvidenceChart,
    EvidenceSeries, Pt,
};
use serde_json::Value;
use sqlx::PgPool;

/// Questions offered in the palette. Each one lands on a real artifact.
pub const SUGGESTED: [&str; 5] = [
    "What is driving the elevated frequency for younger drivers?",
    "Why was the territory experiment scrapped?",
    "Which experiment won, and does the lift hold outside the training data?",
    "Why is the mileage column not being used?",
    "Does the data need a negative binomial family?",
];

struct ExpRow {
    code: String,
    name: String,
    status: String,
    verdict: Option<String>,
    fit: Option<Value>,
    rails: Option<Value>,
    evidence: Option<Value>,
}

impl ExpRow {
    fn chart(&self, kind: &str) -> Option<EvidenceChart> {
        let e = self.evidence.as_ref()?;
        e["charts"]
            .as_array()?
            .iter()
            .find(|c| c["kind"].as_str() == Some(kind))
            .map(chart_from_json)
    }
    fn f(&self, key: &str) -> Option<f64> {
        self.fit.as_ref().and_then(|f| f[key].as_f64())
    }
    fn rail(&self, key: &str) -> Option<f64> {
        self.rails.as_ref().and_then(|g| g[key].as_f64())
    }
    fn folds(&self) -> (usize, usize) {
        let all = self
            .fit
            .as_ref()
            .and_then(|f| f["folds_pass"].as_array().cloned())
            .unwrap_or_default();
        (
            all.iter().filter(|v| v.as_bool() == Some(true)).count(),
            all.len(),
        )
    }
    fn evidence_typed(&self) -> Option<Evidence> {
        self.evidence
            .as_ref()
            .map(|v| evidence_from_json(&self.code, v))
    }
}

pub async fn ask(pool: &PgPool, run_id: i64, question: &str) -> Result<Answer, String> {
    let rows: Vec<(
        String,
        String,
        String,
        Option<String>,
        Option<Value>,
        Option<Value>,
        Option<Value>,
    )> = sqlx::query_as(
        "SELECT code, name, status, verdict_text, fit_summary, guardrails, evidence FROM experiments WHERE run_id = $1 ORDER BY id",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    if rows.is_empty() {
        return Err("that run has no experiments to read".into());
    }
    let exps: Vec<ExpRow> = rows
        .into_iter()
        .map(|r| ExpRow {
            code: r.0,
            name: r.1,
            status: r.2,
            verdict: r.3,
            fit: r.4,
            rails: r.5,
            evidence: r.6,
        })
        .collect();

    let run: Option<(String, Option<Value>)> =
        sqlx::query_as("SELECT status, outcome FROM runs WHERE id = $1")
            .bind(run_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;
    let (status, outcome) = run.ok_or("that run does not exist")?;
    let outcome = outcome.unwrap_or(Value::Null);

    // Dispositions and the run outcome are written when the run finishes, so
    // answering before then would quote verdicts that are about to change
    if status != "complete" {
        let landed = exps.iter().filter(|e| e.status != "running").count();
        return Ok(Answer {
            question: question.to_string(),
            intent: "run still working".into(),
            paragraphs: vec![
                format!(
                    "This run is still working: {landed} of {} experiments have landed. Verdicts and the run ledger are written when the last fit finishes.",
                    exps.len()
                ),
                "Answers here are built from finished artifacts, so this one waits rather than quoting a number that is about to change."
                    .into(),
            ],
            gloss: "The experiments are still running, so there is nothing settled to explain yet. Ask again when the board says the run is complete.".into(),
            citations: Vec::new(),
            steps: vec![AnswerStep {
                tool: "readRunLedger".into(),
                target: format!("run {run_id}, still working"),
                status: "Waiting".into(),
            }],
            charts: Vec::new(),
        });
    }

    let q = question.to_lowercase();
    let intent = classify(&q);
    let mut steps = vec![
        AnswerStep {
            tool: "matchQuestion".into(),
            target: intent.label().into(),
            status: "Completed".into(),
        },
        AnswerStep {
            tool: "readRunLedger".into(),
            target: format!("run {run_id}, {} experiments", exps.len()),
            status: "Completed".into(),
        },
    ];

    let mut a = match intent {
        Intent::AgeCurve => {
            let mut a = age_answer(&exps);
            // v12's own decomposition answers the "what is driving it" half
            // of the question, before any experiment is considered
            if let Some(c) = outcome.get("segment_effects").filter(|v| !v.is_null()) {
                let chart = chart_from_json(c);
                let mut lead = vec![format!(
                    "{}. The bars below split that gap by rating factor, and they multiply back to it.",
                    chart.notes.first().cloned().unwrap_or_default()
                )];
                lead.extend(a.paragraphs.drain(..));
                a.paragraphs = lead;
                a.charts.insert(0, chart);
            }
            a
        }
        Intent::Territory => territory_answer(&exps),
        Intent::Missingness => missingness_answer(&exps),
        Intent::Family => family_answer(&exps),
        Intent::Interaction => interaction_answer(&exps),
        Intent::Accidents => accidents_answer(&exps),
        Intent::Winner => winner_answer(&exps, &outcome),
        Intent::Validation => validation_answer(&exps, &outcome),
        Intent::Metric => metric_answer(&exps, &outcome),
        Intent::Unknown => unknown_answer(&exps),
    };

    for c in &a.citations {
        steps.push(AnswerStep {
            tool: "readFitArtifact".into(),
            target: c.code.clone(),
            status: "Completed".into(),
        });
    }
    for c in &a.charts {
        steps.push(AnswerStep {
            tool: "renderChart".into(),
            target: c.kind.clone(),
            status: "Completed".into(),
        });
    }
    a.question = question.to_string();
    a.intent = intent.label().into();
    a.steps = steps;
    Ok(a)
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Intent {
    AgeCurve,
    Territory,
    Missingness,
    Family,
    Interaction,
    Accidents,
    Winner,
    Validation,
    Metric,
    Unknown,
}

impl Intent {
    fn label(self) -> &'static str {
        match self {
            Intent::AgeCurve => "driver age effect",
            Intent::Territory => "territory movement",
            Intent::Missingness => "mileage missingness",
            Intent::Family => "count family and dispersion",
            Intent::Interaction => "age and vehicle interaction",
            Intent::Accidents => "prior accidents",
            Intent::Winner => "run outcome",
            Intent::Validation => "validation and holdout",
            Intent::Metric => "metric definitions",
            Intent::Unknown => "no artifact matched",
        }
    }
}

fn has(q: &str, words: &[&str]) -> bool {
    words.iter().any(|w| q.contains(w))
}

fn classify(q: &str) -> Intent {
    // Specific artifacts first, so "young drivers in old cars" does not get
    // answered with the age curve
    if has(q, &["interaction", "old cars", "older cars", "old vehicle"]) {
        return Intent::Interaction;
    }
    if has(
        q,
        &[
            "territor",
            "zone",
            "relativit",
            "filed",
            "regulator",
            "dislocation",
        ],
    ) {
        return Intent::Territory;
    }
    if has(
        q,
        &["mileage", "missing", "blank", "data quality", "impute"],
    ) {
        return Intent::Missingness;
    }
    if has(
        q,
        &[
            "negative binomial",
            "overdispers",
            "dispersion",
            "family",
            "aic",
            "nb2",
        ],
    ) {
        return Intent::Family;
    }
    if has(q, &["accident", "prior claim", "cap"]) {
        return Intent::Accidents;
    }
    // A question naming the winner is asking about the outcome even when it
    // also asks whether the lift holds; that answer carries both
    if has(
        q,
        &[
            "winner",
            "won",
            "best",
            "recommend",
            "which experiment",
            "what should",
            "promote",
        ],
    ) {
        return Intent::Winner;
    }
    if has(
        q,
        &[
            "hold out",
            "holdout",
            "fold",
            "overfit",
            "generalis",
            "generaliz",
            "trust",
            "real lift",
        ],
    ) {
        return Intent::Validation;
    }
    // A metric question has to name a metric, or anything opening with
    // "what is" would land here
    if has(
        q,
        &["gini", "deviance", "aic", "separation", "lorenz", "metric"],
    ) && !has(q, &["young", "age"])
    {
        return Intent::Metric;
    }
    if has(
        q,
        &[
            "young",
            "age",
            "curve",
            "spline",
            "older driver",
            "elevated",
        ],
    ) {
        return Intent::AgeCurve;
    }
    Intent::Unknown
}

fn find<'a>(exps: &'a [ExpRow], code: &str) -> Option<&'a ExpRow> {
    exps.iter().find(|e| e.code == code)
}

fn cite(e: &ExpRow) -> Citation {
    Citation {
        code: e.code.clone(),
        label: e.name.clone(),
        status: e.status.clone(),
    }
}

fn blank(gloss: &str) -> Answer {
    Answer {
        question: String::new(),
        intent: String::new(),
        paragraphs: Vec::new(),
        gloss: gloss.into(),
        citations: Vec::new(),
        steps: Vec::new(),
        charts: Vec::new(),
    }
}

fn pct(v: f64) -> String {
    format!("{v:.1}%")
}

fn age_answer(exps: &[ExpRow]) -> Answer {
    let src = exps
        .iter()
        .find(|e| e.chart("age_curve").is_some())
        .or_else(|| find(exps, "EXP-01"));
    let Some(e) = src else {
        return unknown_answer(exps);
    };
    let mut a = blank("The current model sorts drivers into five age groups and charges one price inside each group. The smooth line is what the same data says risk really does with age, so where the two disagree, drivers in one group are paying the same price for different risk.");
    if let Some(chart) = e.chart("age_curve") {
        let curve = chart
            .series
            .iter()
            .find(|s| s.label.contains("spline"))
            .cloned();
        if let Some(s) = curve {
            let peak = s
                .points
                .iter()
                .max_by(|x, y| x.y.partial_cmp(&y.y).unwrap())
                .cloned();
            let at25 = s.points.iter().find(|p| p.x == 25.0).cloned();
            let at18 = s.points.iter().find(|p| p.x == 18.0).cloned();
            if let (Some(p), Some(p25), Some(p18)) = (peak, at25, at18) {
                a.paragraphs.push(format!(
                    "Against age 45 at 1.00, the fitted curve reads {:.2} at age 18 and {:.2} at age 25, with its highest point at age {}. The filed model prices 18 to 24 as one band, so all of that movement happens inside a single price today.",
                    p18.y, p25.y, p.x as i32
                ));
            }
        }
        a.charts.push(chart);
    }
    if let (Some(d), Some(rows)) = (
        e.f("delta_gini"),
        e.evidence_typed().and_then(|ev| ev.facts.map(|f| f.rows)),
    ) {
        let (held, total) = e.folds();
        a.paragraphs.push(format!(
            "{} fits that shape as a natural cubic spline on {} training rows. Separation moves by {:+.3} Gini against v12, and the gain repeats on {} of {} cross validation folds.",
            e.code,
            plab_platform::executor::fmt_thousands(rows as usize),
            d,
            held,
            total
        ));
    }
    if let Some(v) = &e.verdict {
        a.paragraphs.push(format!(
            "The verdict written against this artifact was {}, {}.",
            e.status, v
        ));
    }
    a.citations.push(cite(e));
    a
}

fn territory_answer(exps: &[ExpRow]) -> Answer {
    let mut a = blank("Territory multipliers are on file with the regulator, so an experiment that edits them is a filing question rather than a modelling one. An experiment that leaves them alone can still shift what a zone pays on average, and that is measured separately and held to the same limit.");
    if let Some(e) = find(exps, "EXP-03") {
        let mv = e.rail("territory_movement_pct").unwrap_or(0.0);
        let lim = e.rail("territory_limit_pct").unwrap_or(5.0);
        let zone = e
            .rails
            .as_ref()
            .and_then(|g| g["territory_worst_zone"].as_str())
            .unwrap_or("its worst zone")
            .to_string();
        a.paragraphs.push(format!(
            "{} rebuilt the territory table with a credibility blend, which moves the filed relativities directly. The largest move was {} on {}, against a limit of {}, so the platform scrapped it before it could reach a review.",
            e.code,
            pct(mv),
            zone,
            pct(lim)
        ));
        if let Some(c) = e.chart("territory") {
            a.charts.push(c);
        }
        a.citations.push(cite(e));
    }
    if let Some(w) = exps.iter().find(|e| e.status == "winner") {
        let mv = w.rail("territory_movement_pct").unwrap_or(0.0);
        let lim = w.rail("territory_limit_pct").unwrap_or(5.0);
        let zone = w
            .rails
            .as_ref()
            .and_then(|g| g["territory_worst_zone"].as_str())
            .unwrap_or("its worst zone")
            .to_string();
        a.paragraphs.push(format!(
            "{} keeps the filed relativities frozen in its fit. What it moves is the zone level average rate, and that dislocation reads {} on {}, inside the same {} limit.",
            w.code,
            pct(mv),
            zone,
            pct(lim)
        ));
        a.citations.push(cite(w));
    }
    a
}

fn missingness_answer(exps: &[ExpRow]) -> Answer {
    let Some(e) = exps.iter().find(|x| x.chart("missingness").is_some()) else {
        return unknown_answer(exps);
    };
    let chart = e.chart("missingness");
    let frequency = e.chart("missing_frequency");
    let mut a = blank("The blank mileage boxes are not spread evenly across the book, and drivers with a blank do not claim at the same rate as drivers without one. Filling the blanks in would price that pattern by accident, so the platform left the column alone and said why.");
    a.paragraphs.push(format!(
        "{} was refused before any fit ran. The profiler reads the mileage column as missing not at random: the missing share differs by region, and the rows that are missing it claim at a different rate from the rows that are not.",
        e.code
    ));
    if let Some(c) = &chart {
        for n in &c.notes {
            a.paragraphs.push(n.clone());
        }
    }
    if let Some(c) = &frequency {
        for n in &c.notes {
            a.paragraphs.push(n.clone());
        }
    }
    if let Some(v) = &e.verdict {
        a.paragraphs.push(format!("Verdict on record: {v}."));
    }
    a.charts.extend(chart);
    a.charts.extend(frequency);
    a.citations.push(cite(e));
    a
}

fn family_answer(exps: &[ExpRow]) -> Answer {
    let Some(e) = exps.iter().find(|x| x.chart("count_dist").is_some()) else {
        return unknown_answer(exps);
    };
    let mut a = blank("A second error model was tried that allows more variety between drivers than the standard one. It describes how many claims land better, but it ranks the same drivers in the same order, so it does not earn a factor slot on its own.");
    let aic = e.f("aic_delta").unwrap_or(0.0);
    let d = e.f("delta_gini").unwrap_or(0.0);
    // The Gini move here is normally too small to print at three places, so
    // the sentence has to stay true either way
    let sep = if d.abs() < 0.0005 {
        "separation does not move by as much as 0.001 Gini, so the ranking is unchanged".to_string()
    } else {
        format!("separation moves by {d:+.3} Gini")
    };
    a.paragraphs.push(format!(
        "{} refit the same terms under a negative binomial family. AIC moves by {aic:+.0}, and AIC is the comparison to use here because deviance is not comparable across families. On the same fits, {sep}.",
        e.code
    ));
    if let Some(c) = e.chart("count_dist") {
        for n in &c.notes {
            a.paragraphs.push(n.clone());
        }
        a.charts.push(c);
    }
    a.citations.push(cite(e));
    a
}

fn interaction_answer(exps: &[ExpRow]) -> Answer {
    let Some(e) = exps.iter().find(|x| x.chart("interaction").is_some()) else {
        return unknown_answer(exps);
    };
    let mut a = blank("The idea was that young drivers in older cars might be riskier than the two facts suggest on their own. The cell holds few drivers, and what they actually claim sits close to what the model already expects for them, so there is nothing left for a new rule to explain.");
    let d = e.f("delta_gini").unwrap_or(0.0);
    let (held, total) = e.folds();
    a.paragraphs.push(format!(
        "{} added a single interaction column for young drivers in older vehicles. It moves separation by {d:+.3} Gini and holds on {held} of {total} folds.",
        e.code
    ));
    if let Some(c) = e.chart("interaction") {
        for n in &c.notes {
            a.paragraphs.push(n.clone());
        }
        a.charts.push(c);
    }
    if let Some(v) = &e.verdict {
        a.paragraphs.push(format!("Verdict on record: {v}."));
    }
    a.citations.push(cite(e));
    a
}

fn accidents_answer(exps: &[ExpRow]) -> Answer {
    let Some(e) = exps.iter().find(|x| x.chart("accidents").is_some()) else {
        return unknown_answer(exps);
    };
    let mut a = blank("Drivers with more accidents behind them do claim more often. Almost nobody has three or more, so the model treats three and above as one group rather than pricing a handful of drivers on their own.");
    let d = e.f("delta_gini").unwrap_or(0.0);
    let (held, total) = e.folds();
    a.paragraphs.push(format!(
        "{} adds prior accident count capped at three. Separation moves by {d:+.3} Gini and the gain repeats on {held} of {total} folds.",
        e.code
    ));
    if let Some(c) = e.chart("accidents") {
        for n in &c.notes {
            a.paragraphs.push(n.clone());
        }
        a.charts.push(c);
    }
    a.citations.push(cite(e));
    a
}

fn lift_chart(e: &ExpRow) -> Option<EvidenceChart> {
    let ev = e.evidence_typed()?;
    if ev.lift.is_empty() {
        return None;
    }
    let mk = |f: fn(&crate::schema::LiftBucket) -> f64, label: &str, style: &str| EvidenceSeries {
        label: label.into(),
        style: style.into(),
        points: ev
            .lift
            .iter()
            .map(|b| Pt {
                x: b.decile as f64,
                y: f(b),
                label: Some(b.decile.to_string()),
            })
            .collect(),
    };
    let lo = ev.lift.first().map(|b| b.actual).unwrap_or(0.0);
    let hi = ev.lift.last().map(|b| b.actual).unwrap_or(0.0);
    let blo = ev.lift.first().map(|b| b.baseline_actual).unwrap_or(0.0);
    let bhi = ev.lift.last().map(|b| b.baseline_actual).unwrap_or(0.0);
    let span = |a: f64, b: f64| if a > 0.0 { b / a } else { 0.0 };
    Some(EvidenceChart {
        kind: "lift".into(),
        title: format!("Actual frequency by risk decile, {}", e.code),
        x_label: "Decile of predicted rate, equal exposure".into(),
        y_label: "Claims per car year".into(),
        series: vec![
            mk(|b| b.actual, "Actual, this model", "bar"),
            mk(|b| b.predicted, "Predicted, this model", "line"),
            mk(|b| b.baseline_actual, "Actual, v12 deciles", "dot"),
        ],
        notes: vec![
            format!(
                "Top decile against bottom decile: {:.2}x on this model, {:.2}x on v12",
                span(lo, hi),
                span(blo, bhi)
            ),
            "Buckets hold equal earned exposure, so bar heights compare directly".into(),
        ],
        gloss: "Drivers are lined up from the ones this model thinks are safest to the ones it thinks are riskiest, then cut into ten equal groups. The bars are what each group actually claimed, so a staircase that climbs means the model is sorting real risk and not just noise.".into(),
    })
}

fn winner_answer(exps: &[ExpRow], outcome: &Value) -> Answer {
    let Some(w) = exps.iter().find(|e| e.status == "winner") else {
        return blank("No experiment has cleared the guardrails yet in this run, so there is nothing to promote.");
    };
    let mut a = blank("One experiment came out ahead on accuracy while staying inside every limit that was set before the run started. The gain it shows on data it has never seen is the one worth trusting, and it is smaller than the training gain, which is normal.");
    let d = w.f("delta_gini").unwrap_or(0.0);
    let g = w.f("gini").unwrap_or(0.0);
    let (held, total) = w.folds();
    let budget = w.rail("budget_used").unwrap_or(0.0);
    let limit = w.rail("budget_limit").unwrap_or(0.0);
    a.paragraphs.push(format!(
        "{} is the winner: Gini {g:.3}, a move of {d:+.3} against v12, holding on {held} of {total} folds, and spending {budget:.0} of {limit:.0} factor slots.",
        w.code
    ));
    let train = outcome["train_delta"].as_f64();
    let hold = outcome["holdout_delta"].as_f64();
    if let (Some(t), Some(h)) = (train, hold) {
        a.paragraphs.push(format!(
            "On the out of time holdout, which is the most recent half year and was never fit on, the move is {h:+.3} against {t:+.3} in training.",
        ));
    }
    let scrapped: Vec<&str> = exps
        .iter()
        .filter(|e| e.status == "scrapped")
        .map(|e| e.code.as_str())
        .collect();
    if !scrapped.is_empty() {
        a.paragraphs.push(format!(
            "{} did not survive: {}. Each one carries its reason in the run ledger, so the same ground does not get walked twice.",
            scrapped.len(),
            scrapped.join(", ")
        ));
    }
    a.charts.extend(lift_chart(w));
    a.citations.push(cite(w));
    a
}

fn fold_chart(e: &ExpRow) -> Option<EvidenceChart> {
    let ev = e.evidence_typed()?;
    if ev.fold_deltas.is_empty() {
        return None;
    }
    let points: Vec<Pt> = ev
        .fold_deltas
        .iter()
        .enumerate()
        .map(|(i, d)| Pt {
            x: i as f64 + 1.0,
            y: *d,
            label: Some(format!("{}", i + 1)),
        })
        .collect();
    let held = ev.fold_deltas.iter().filter(|d| **d > 0.0).count();
    let worst = ev.fold_deltas.iter().cloned().fold(f64::MAX, f64::min);
    Some(EvidenceChart {
        kind: "folds".into(),
        title: format!("Change in separation by fold, {}", e.code),
        x_label: "Cross validation fold".into(),
        y_label: "Change in Gini against v12".into(),
        series: vec![EvidenceSeries {
            label: "Fold delta".into(),
            style: "bar".into(),
            points,
        }],
        notes: vec![
            format!(
                "{held} of {} folds land above zero, and the weakest reads {worst:+.3}",
                ev.fold_deltas.len()
            ),
            "Each fold refits the baseline and the variant on the same rows, so the pair is comparable".into(),
        ],
        gloss: "The data is cut into five slices, and the whole comparison is rerun five times, each time holding one slice back. A gain that shows up on every slice is a gain, and one that shows up on some slices is noise.".into(),
    })
}

fn validation_answer(exps: &[ExpRow], outcome: &Value) -> Answer {
    let Some(w) = exps
        .iter()
        .find(|e| e.status == "winner")
        .or_else(|| exps.iter().find(|e| e.status == "candidate"))
    else {
        return unknown_answer(exps);
    };
    let mut a = blank("Nothing here is judged on the data it learned from alone. Every gain is rerun on five held back slices, and then once more on the most recent half year, which no experiment was allowed to see.");
    let (held, total) = w.folds();
    a.paragraphs.push(format!(
        "{} is checked two ways. Across {total} cross validation folds the gain repeats on {held}, and the platform requires all {total} before an experiment may be promoted.",
        w.code
    ));
    if let (Some(t), Some(h)) = (
        outcome["train_delta"].as_f64(),
        outcome["holdout_delta"].as_f64(),
    ) {
        let shrink = t - h;
        a.paragraphs.push(format!(
            "Out of time, the gain reads {h:+.3} against {t:+.3} in training, a difference of {shrink:+.3}. The out of time number is the one to plan around, because it is the only one measured on a period the fit never saw.",
        ));
    }
    a.charts.extend(fold_chart(w));
    a.citations.push(cite(w));
    a
}

fn metric_answer(exps: &[ExpRow], outcome: &Value) -> Answer {
    let mut a = blank("Gini scores how well a model separates drivers who go on to claim from drivers who do not, where zero is a coin flip. Deviance is its error score, which is never negative, so only the change in it is worth reading.");
    let base = outcome["baseline"]["gini"].as_f64();
    if let Some(b) = base {
        a.paragraphs.push(format!(
            "Gini is exposure weighted here and computed from the ordered Lorenz curve, so it reads separation rather than accuracy of the level. v12 sits at {b:.3} on the training periods.",
        ));
    }
    a.paragraphs.push(
        "Deviance is nonnegative by construction, so this console shows its change and never its raw level as a score. Where two experiments use different count families, the comparison switches to AIC, because deviance is not comparable across families."
            .into(),
    );
    if let Some(w) = exps.iter().find(|e| e.status == "winner") {
        a.paragraphs.push(format!(
            "For {}, the chart below lines every driver up by predicted rate and shows what each tenth actually claimed.",
            w.code
        ));
        a.charts.extend(lift_chart(w));
        a.citations.push(cite(w));
    }
    a
}

fn unknown_answer(exps: &[ExpRow]) -> Answer {
    let mut a = blank("This assistant only answers from what this run actually produced, so a question it has no artifact for gets an honest miss rather than a guess.");
    a.paragraphs.push(
        "No artifact in this run matches that question. Everything answerable here comes from the fits, the guardrail readings, and the profile this run produced, and nothing is invented to fill a gap."
            .into(),
    );
    a.paragraphs.push(format!(
        "The run holds {} experiments: {}. Asking about any of them, about the winner, or about how the lift was validated will land on a real artifact.",
        exps.len(),
        exps.iter()
            .map(|e| e.code.as_str())
            .collect::<Vec<_>>()
            .join(", ")
    ));
    a
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_routes_the_suggested_questions() {
        let expect = [
            Intent::AgeCurve,
            Intent::Territory,
            Intent::Winner,
            Intent::Missingness,
            Intent::Family,
        ];
        for (q, want) in SUGGESTED.iter().zip(expect) {
            assert!(
                classify(&q.to_lowercase()) == want,
                "question routed elsewhere: {q}"
            );
        }
    }

    #[test]
    fn interaction_beats_the_age_keyword() {
        assert!(
            classify("are young drivers in old cars worse") == Intent::Interaction,
            "the interaction cell owns this question, not the age curve"
        );
    }

    #[test]
    fn unmatched_questions_do_not_guess() {
        assert!(classify("what is the weather in texas") == Intent::Unknown);
    }
}
