//! The reconstruction pack: `GET /record/{run_id}` serves a standalone
//! decision record assembled from database rows alone — no SPA, no
//! JavaScript, printable. Documentation as a byproduct: every section is
//! shown as it was recorded at the time; the only live-derived fact is the
//! status line, and it says so.

use axum::{
    extract::Path,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Extension,
};
use sqlx::PgPool;

use crate::schema::{fetch_review_by_run, Review};

/// One action row with its timestamp already formatted by Postgres, so the
/// document needs no date code and no JavaScript.
pub struct RecordAction {
    pub seq: i32,
    pub actor: String,
    pub kind: String,
    pub target: String,
    pub detail: String,
    pub before_state: Option<String>,
    pub after_state: Option<String>,
    pub reversible: bool,
    pub refusal_reason: Option<String>,
    pub at: String,
}

pub struct RecordData {
    pub run_id: i64,
    pub goal: String,
    pub started_at: String,
    pub elapsed_ms: Option<i64>,
    pub approved_at: Option<String>,
    pub generated_at: String,
    pub review: Review,
    pub actions: Vec<RecordAction>,
    /// sign-off exhibits rendered inside the approval transaction; None on
    /// approvals that predate them
    pub exhibits: Option<serde_json::Value>,
}

pub async fn record_handler(
    Path(run_id): Path<i64>,
    Extension(pool): Extension<PgPool>,
) -> Response {
    match load_record(&pool, run_id).await {
        Ok(Some(data)) => html_response(StatusCode::OK, render_record(&data)),
        Ok(None) => html_response(
            StatusCode::NOT_FOUND,
            not_found_page(run_id),
        ),
        Err(e) => html_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!(
                "<!doctype html><meta charset=\"utf-8\"><title>Decision record</title><p>Could not assemble the record: {}</p>",
                esc(&e.to_string())
            ),
        ),
    }
}

fn html_response(status: StatusCode, body: String) -> Response {
    (
        status,
        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
        body,
    )
        .into_response()
}

/// A record exists only for a run whose review was approved: the document is
/// the signed decision, not a live view of work in progress.
async fn load_record(pool: &PgPool, run_id: i64) -> Result<Option<RecordData>, sqlx::Error> {
    let review = match fetch_review_by_run(pool, run_id).await {
        Ok(Some(r)) if r.status == "approved" => r,
        Ok(_) => return Ok(None),
        Err(e) => {
            return Err(sqlx::Error::Protocol(e.message));
        }
    };

    let meta: Option<(String, Option<i64>, String, Option<String>, String)> = sqlx::query_as(
        "SELECT r.goal, r.elapsed_ms, \
                to_char(r.started_at AT TIME ZONE 'UTC', 'DD Mon YYYY, HH24:MI') || ' UTC', \
                to_char(rv.approved_at AT TIME ZONE 'UTC', 'DD Mon YYYY, HH24:MI') || ' UTC', \
                to_char(now() AT TIME ZONE 'UTC', 'DD Mon YYYY, HH24:MI') || ' UTC' \
         FROM runs r JOIN reviews rv ON rv.run_id = r.id WHERE r.id = $1",
    )
    .bind(run_id)
    .fetch_optional(pool)
    .await?;
    let Some((goal, elapsed_ms, started_at, approved_at, generated_at)) = meta else {
        return Ok(None);
    };

    let action_rows: Vec<(
        i32,
        String,
        String,
        String,
        String,
        Option<String>,
        Option<String>,
        bool,
        Option<String>,
        String,
    )> = sqlx::query_as(
        "SELECT seq, actor, kind, target, detail, before_state, after_state, reversible, refusal_reason, \
                to_char(at AT TIME ZONE 'UTC', 'HH24:MI:SS') \
         FROM agent_actions WHERE run_id = $1 ORDER BY seq",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await?;
    let actions = action_rows
        .into_iter()
        .map(
            |(seq, actor, kind, target, detail, before_state, after_state, reversible, refusal_reason, at)| RecordAction {
                seq,
                actor,
                kind,
                target,
                detail,
                before_state,
                after_state,
                reversible,
                refusal_reason,
                at,
            },
        )
        .collect();

    let exhibits: Option<(Option<serde_json::Value>,)> =
        sqlx::query_as("SELECT exhibits FROM reviews WHERE run_id = $1")
            .bind(run_id)
            .fetch_optional(pool)
            .await?;

    Ok(Some(RecordData {
        run_id,
        goal,
        elapsed_ms,
        started_at,
        approved_at,
        generated_at,
        review,
        actions,
        exhibits: exhibits.and_then(|(e,)| e),
    }))
}

pub fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Platform copy uses `**bold**` spans; render them after escaping.
fn md_bold(escaped: &str) -> String {
    let mut out = String::with_capacity(escaped.len());
    for (i, part) in escaped.split("**").enumerate() {
        if i % 2 == 1 {
            out.push_str("<b>");
            out.push_str(part);
            out.push_str("</b>");
        } else {
            out.push_str(part);
        }
    }
    out
}

fn fmt_delta(g: f64) -> String {
    format!("{}{:.3}", if g >= 0.0 { "+" } else { "" }, g)
}

fn not_found_page(run_id: i64) -> String {
    format!(
        "<!doctype html><meta charset=\"utf-8\"><title>Decision record</title>\
         <body style=\"font-family:system-ui;max-width:640px;margin:80px auto\">\
         <h1>No decision record</h1>\
         <p>Run {run_id} has no approved decision. A record exists only once a \
         human has approved the run's review.</p></body>"
    )
}

pub fn render_record(d: &RecordData) -> String {
    let r = &d.review;
    let mut html = String::with_capacity(32 * 1024);

    html.push_str("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">");
    html.push_str("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">");
    html.push_str(&format!(
        "<title>Decision record · Run {} · Bodily Injury Frequency</title>",
        d.run_id
    ));
    html.push_str(STYLE);
    html.push_str("</head><body><article>");

    // 1 — masthead
    html.push_str(&format!(
        "<header><p class=\"eyebrow\">Decision record · assembled from platform records</p>\
         <h1>Run {} · Bodily Injury Frequency</h1>\
         <p class=\"mast\">v{} → <strong>v{}</strong> · approved by {}{}</p>\
         <p class=\"gen\">Generated {} directly from the platform's stored records. \
         Nothing below was written for this document; each section says when it was recorded.</p></header>",
        d.run_id,
        r.base_version,
        r.next_version,
        esc(r.approved_by.as_deref().unwrap_or("reviewer")),
        d.approved_at
            .as_deref()
            .map(|t| format!(" on {}", esc(t)))
            .unwrap_or_default(),
        esc(&d.generated_at),
    ));

    // 2 — fate: the one live-derived fact, labeled as such
    let active = r.result_status.as_deref() == Some("active");
    if active {
        html.push_str(&format!(
            "<section class=\"fate ok\"><h2>Status</h2>\
             <p><strong>In force.</strong> v{} is the version currently in force.</p>\
             <p class=\"when\">Checked when this record was generated — the only line in this document that is not a stored record.</p></section>",
            r.next_version
        ));
    } else {
        let replaced = match (&r.replaced_by_run, r.replaced_by_version) {
            (Some(run), Some(v)) => format!(
                " The v{} this approval created was later replaced by run {}'s approval of its own v{}. \
                 The winner below still won this run; only the resulting version was replaced.",
                r.next_version, esc(&run.0), v
            ),
            _ => format!(
                " The v{} this approval created is no longer the version in force.",
                r.next_version
            ),
        };
        html.push_str(&format!(
            "<section class=\"fate gone\"><h2>Status</h2>\
             <p><strong>No longer in force.</strong>{replaced} Everything below is kept exactly as it was signed.</p>\
             <p class=\"when\">Checked when this record was generated — the only line in this document that is not a stored record.</p></section>"
        ));
    }

    // 3 — the decision, frozen in the approval transaction
    html.push_str("<section><h2>The decision</h2>");
    match &r.package {
        Some(p) => {
            html.push_str(&format!(
                "<p>{} created <strong>v{}</strong> from v{}: {} Gini on train, {} on held-out data. \
                 {} guardrails held. {} agent actions recorded, {} refused by the platform's own limits.</p>\
                 <p>Weakest point named at sign-off: {}</p>",
                esc(&p.winner_code),
                p.new_version,
                p.base_version,
                fmt_delta(p.train_delta),
                fmt_delta(p.holdout_delta),
                p.guardrails_held,
                p.actions_total,
                p.actions_refused,
                esc(&p.weakest_point),
            ));
            if let Some(ms) = d.elapsed_ms {
                html.push_str(&format!(
                    "<p>Question to decision: the run took {:.1}s from \"{}\" to a package a human could sign.</p>",
                    ms as f64 / 1000.0,
                    esc(&d.goal)
                ));
            }
        }
        None => {
            html.push_str(
                "<p>This approval was recorded before decision-time snapshots existed, so there is \
                 no frozen summary. The sections below are the contemporaneous records that do exist.</p>",
            );
        }
    }
    html.push_str("<p class=\"when\">Frozen inside the approval transaction — recorded at sign-off, not assembled later.</p></section>");

    // 3b — the decision evidence, compiled to static exhibits at sign-off.
    // The SVG below is a stored string: rendered once inside the approval
    // transaction from the run's frozen evidence, then never recomputed. A
    // renderer bug at sign-off stays in the record, exactly like a typo in
    // the signed summary would — the record shows what was signed.
    html.push_str("<section class=\"exhibits\"><h2>Decision evidence</h2>");
    match d.exhibits.as_ref().and_then(|e| e["exhibits"].as_array()) {
        Some(list) if !list.is_empty() => {
            for ex in list {
                html.push_str(&format!(
                    "<figure><figcaption>{}</figcaption>{}{}",
                    esc(ex["title"].as_str().unwrap_or_default()),
                    ex["svg"].as_str().unwrap_or_default(),
                    ex["table"].as_str().unwrap_or_default(),
                ));
                let note = ex["note"].as_str().unwrap_or_default();
                if !note.is_empty() {
                    html.push_str(&format!("<p class=\"xh-note\">{}</p>", esc(note)));
                }
                html.push_str("</figure>");
            }
            html.push_str(&format!(
                "<p class=\"when\">Rendered from the run's frozen evidence inside the approval transaction at sign-off{} — recorded at sign-off, not reconstructed at read time.</p>",
                d.approved_at
                    .as_deref()
                    .map(|a| format!(" ({})", esc(a)))
                    .unwrap_or_default()
            ));
        }
        _ => {
            html.push_str(
                "<p>This approval predates sign-off exhibits; the frozen numbers live in the \
                 platform's evidence records.</p>",
            );
        }
    }
    html.push_str("</section>");

    // 4 — what the reviewer was told
    html.push_str("<section><h2>What the reviewer was told</h2>");
    for p in &r.paragraphs {
        html.push_str(&format!("<p>{}</p>", md_bold(&esc(p))));
    }
    html.push_str("<p class=\"when\">Written when the review was opened, before approval.</p></section>");

    // 5 — guardrails
    html.push_str("<section><h2>Guardrails</h2><table><thead><tr><th>Limit</th><th>How it held</th></tr></thead><tbody>");
    for g in &r.guardrail_rows {
        html.push_str(&format!(
            "<tr><td>{}</td><td>{}</td></tr>",
            esc(&g.what),
            md_bold(&esc(&g.how))
        ));
    }
    html.push_str("</tbody></table><p class=\"when\">The limits the agent worked under, as shown at review time.</p></section>");

    // 6 — experiment ledger
    html.push_str(&format!(
        "<section><h2>Experiment ledger</h2><p>All {} experiments and why each lived or died.</p>\
         <table><thead><tr><th>Code</th><th>Disposition</th><th>Why</th></tr></thead><tbody>",
        r.ledger_rows.len()
    ));
    for row in &r.ledger_rows {
        html.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td>{}</td></tr>",
            esc(&row.code),
            esc(&row.disp),
            esc(&row.why)
        ));
    }
    html.push_str("</tbody></table><p class=\"when\">Written as each experiment landed.</p></section>");

    // 7 — the full action record
    html.push_str(&format!(
        "<section><h2>Agent action record</h2>\
         <p>Every action the platform recorded for this run, in order, starting {} — including \
         what the agent refused to do and the one irreversible human action at the end.</p>\
         <table class=\"actions\"><thead><tr><th>#</th><th>Time (UTC)</th><th>Who</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead><tbody>",
        esc(&d.started_at)
    ));
    for a in &d.actions {
        let mut detail = esc(&a.detail);
        if let (Some(before), Some(after)) = (&a.before_state, &a.after_state) {
            detail.push_str(&format!(
                "<br><span class=\"diff\">{} → {}</span>",
                esc(before),
                esc(after)
            ));
        }
        if let Some(reason) = &a.refusal_reason {
            detail.push_str(&format!(
                "<br><span class=\"refusal\">Refused: {}</span>",
                esc(reason)
            ));
        }
        html.push_str(&format!(
            "<tr class=\"{}{}\"><td>{}</td><td>{}</td><td>{}</td><td>{}{}</td><td>{}</td><td>{}</td></tr>",
            esc(&a.actor),
            if a.kind == "refuse" { " refused" } else { "" },
            a.seq,
            esc(&a.at),
            if a.actor == "human" { "Human" } else { "Agent" },
            esc(&a.kind),
            if a.reversible { "" } else { " · irreversible" },
            esc(&a.target),
            detail,
        ));
    }
    html.push_str("</tbody></table><p class=\"when\">Recorded as each action happened — a byproduct of the work, not a reconstruction.</p></section>");

    // 8 — provenance
    html.push_str(
        "<section class=\"provenance\"><h2>Provenance</h2><ul>\
         <li><b>Agent action record</b> — written during the run, one row per action, as it happened.</li>\
         <li><b>Review narrative, guardrails, ledger</b> — written when the review was opened.</li>\
         <li><b>The decision</b> — frozen inside the approval transaction at sign-off.</li>\
         <li><b>Decision evidence</b> — static exhibits rendered from the run's frozen evidence inside the same approval transaction, stored as data.</li>\
         <li><b>Status</b> — the only live fact, checked when this document was generated.</li>\
         </ul></section>",
    );

    html.push_str("</article></body></html>");
    html
}

const STYLE: &str = "<style>\
:root{color-scheme:light}\
*{box-sizing:border-box}\
body{margin:0;background:#f5f4f0;font-family:Georgia,'Times New Roman',serif;color:#1d1c1a;line-height:1.55}\
article{max-width:880px;margin:0 auto;padding:56px 40px 80px;background:#fffefb}\
h1{font-size:1.7rem;margin:.2em 0 .3em}\
h2{font-size:1.05rem;margin:0 0 .5em;text-transform:uppercase;letter-spacing:.06em}\
section{margin:2.2em 0;padding-top:1.2em;border-top:1px solid #d8d5cc}\
.eyebrow{font-family:ui-monospace,Consolas,monospace;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:#6b675e;margin:0}\
.mast{font-size:1.05rem}\
.gen{color:#55524a;font-size:.9rem}\
.when{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;color:#6b675e;margin-top:.9em}\
.fate p{margin:.3em 0}\
.fate.ok strong{color:#1d6b33}\
.fate.gone strong{color:#8a4a12}\
table{width:100%;border-collapse:collapse;font-size:.88rem}\
th{text-align:left;font-family:ui-monospace,Consolas,monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:#6b675e;padding:6px 10px 6px 0;border-bottom:1px solid #b8b4a8}\
td{padding:7px 10px 7px 0;border-bottom:1px solid #e4e1d8;vertical-align:top}\
.actions td{font-size:.82rem}\
.actions tr.human td{background:#f3efe2}\
.actions tr.refused td{background:#faf1ea}\
.diff{font-family:ui-monospace,Consolas,monospace;font-size:.76rem;color:#55524a}\
.refusal{color:#8a4a12}\
.provenance ul{padding-left:1.2em}\
.provenance li{margin:.4em 0}\
.exhibits figure{margin:1.4em 0}\
.exhibits figcaption{font-weight:600;margin-bottom:.5em}\
.exhibits svg{width:100%;height:auto;background:#fffefb;border:1px solid #e4e1d8}\
.xh-table{margin-top:.7em;font-size:.8rem}\
.xh-table td,.xh-table th{text-align:right}\
.xh-table th:first-child,.xh-table td:first-child{text-align:left}\
.xh-note{font-size:.85rem;color:#55524a}\
@media print{body{background:#fff}article{max-width:none;padding:0}}\
</style>";

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{ApprovedPackage, GuardrailRow, LedgerRow};
    use async_graphql::ID;

    fn review(result_status: &str, package: bool) -> Review {
        Review {
            id: ID("1".into()),
            run_id: ID("7".into()),
            status: "approved".into(),
            opened_by: "agent".into(),
            winner_code: "EXP-07".into(),
            paragraphs: vec!["The **spline** holds on holdout.".into()],
            gloss: String::new(),
            guardrail_rows: vec![GuardrailRow {
                what: "Territory movement".into(),
                how: "Largest move **3.1%** against a 5% cap".into(),
            }],
            ledger_rows: vec![LedgerRow {
                code: "EXP-01".into(),
                disp: "Scrapped".into(),
                why: "gain does not survive fold jitter".into(),
            }],
            train_delta: 0.0132,
            holdout_delta: 0.011,
            approved_by: Some("Alex Reviewer".into()),
            result_version: Some(13),
            base_version: 12,
            next_version: 13,
            result_status: Some(result_status.into()),
            approved_at_ms: Some(1.0),
            package: package.then(|| ApprovedPackage {
                winner_code: "EXP-07".into(),
                base_version: 12,
                new_version: 13,
                train_delta: 0.0132,
                holdout_delta: 0.011,
                guardrails_held: 3,
                actions_total: 26,
                actions_refused: 4,
                weakest_point: "9.8% of exposure".into(),
            }),
            replaced_by_run: Some(ID("9".into())),
            replaced_by_version: Some(13),
        }
    }

    fn data(result_status: &str, package: bool) -> RecordData {
        RecordData {
            run_id: 7,
            goal: "Lift BI frequency Gini".into(),
            started_at: "09 Aug 2026, 10:00 UTC".into(),
            elapsed_ms: Some(41_300),
            approved_at: Some("09 Aug 2026, 10:02 UTC".into()),
            generated_at: "09 Aug 2026, 12:00 UTC".into(),
            review: review(result_status, package),
            actions: vec![
                RecordAction {
                    seq: 1,
                    actor: "agent".into(),
                    kind: "refuse".into(),
                    target: "EXP-03 <script>".into(),
                    detail: "budget".into(),
                    before_state: Some("5 bands".into()),
                    after_state: Some("spline".into()),
                    reversible: true,
                    refusal_reason: Some("budget exceeded".into()),
                    at: "10:00:07".into(),
                },
                RecordAction {
                    seq: 2,
                    actor: "human".into(),
                    kind: "approve".into(),
                    target: "Model version v13".into(),
                    detail: "Approved EXP-07".into(),
                    before_state: None,
                    after_state: None,
                    reversible: false,
                    refusal_reason: None,
                    at: "10:02:11".into(),
                },
            ],
            exhibits: None,
        }
    }

    #[test]
    fn exhibits_render_inline_with_their_footnote() {
        let mut d = data("active", true);
        let chart = serde_json::json!({
            "kind": "age_curve",
            "title": "Driver age relativity",
            "x_label": "Driver age",
            "y_label": "Relativity",
            "notes": ["one note"],
            "series": [{"label": "Fitted spline", "style": "line", "points": [
                {"x": 20.0, "y": 1.8, "se": 0.04}, {"x": 45.0, "y": 1.0}, {"x": 80.0, "y": 1.3, "se": 0.09}
            ]}]
        });
        d.exhibits = Some(crate::exhibit::build_exhibits(
            &serde_json::json!({"charts": [chart], "lift": []}),
            "EXP-07",
        ));
        let html = render_record(&d);
        assert!(html.contains("<svg"), "stored SVG embeds inline");
        assert!(html.contains("recorded at sign-off, not reconstructed at read time"));
        assert!(html.contains("Driver age relativity"));
        assert!(html.contains("xh-table"));
    }

    #[test]
    fn missing_exhibits_fall_back_honestly() {
        let html = render_record(&data("active", true));
        assert!(html.contains("predates sign-off exhibits"));
    }

    #[test]
    fn escapes_untrusted_text() {
        let html = render_record(&data("active", true));
        assert!(!html.contains("<script>"));
        assert!(html.contains("EXP-03 &lt;script&gt;"));
    }

    #[test]
    fn active_record_names_the_version_in_force() {
        let html = render_record(&data("active", true));
        assert!(html.contains("In force."));
        assert!(html.contains("v13 is the version currently in force"));
        assert!(html.contains("frozen"));
        assert!(html.contains("Weakest point named at sign-off: 9.8% of exposure"));
        assert!(html.contains("+0.013 Gini on train"));
        assert!(html.contains("41.3s"));
    }

    #[test]
    fn replaced_record_says_so_in_plain_language() {
        let html = render_record(&data("superseded", true));
        assert!(html.contains("No longer in force."));
        assert!(html.contains("replaced by run 9's approval of its own v13"));
        assert!(html.contains("kept exactly as it was signed"));
    }

    #[test]
    fn pre_snapshot_approval_is_honest_about_the_gap() {
        let html = render_record(&data("active", false));
        assert!(html.contains("before decision-time snapshots existed"));
        assert!(!html.contains("Weakest point named at sign-off"));
    }

    #[test]
    fn action_table_carries_diffs_refusals_and_the_human_approve() {
        let html = render_record(&data("active", true));
        assert!(html.contains("5 bands → spline"));
        assert!(html.contains("Refused: budget exceeded"));
        assert!(html.contains("approve · irreversible"));
        assert!(html.contains("<b>3.1%</b>"));
    }
}
