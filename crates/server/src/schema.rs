//! GraphQL schema. Role enforcement happens in resolvers, not in UI state:
//! approveReview rejects the agent role before touching the database.

use crate::runsvc::{self, ActorRole};
use async_graphql::{Context, EmptySubscription, Enum, Object, Result, Schema, SimpleObject, ID};
use sqlx::PgPool;

pub type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

#[derive(Enum, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Role {
    Human,
    Agent,
}

impl Role {
    fn actor(self) -> ActorRole {
        match self {
            Role::Human => ActorRole::Human,
            Role::Agent => ActorRole::Agent,
        }
    }
}

#[derive(SimpleObject)]
pub struct DatasetSummary {
    pub rows: i64,
    pub exposure: f64,
    pub claims: i64,
    pub frequency: f64,
    pub missing_mileage_pct: f64,
}

#[derive(SimpleObject)]
pub struct ModelVersion {
    pub id: ID,
    pub name: String,
    pub version: i32,
    pub status: String,
    pub factors: Vec<String>,
    pub factor_count: i32,
    pub gini: Option<f64>,
    pub parent_version: Option<i32>,
    pub created_by_run: Option<ID>,
}

#[derive(SimpleObject)]
pub struct Experiment {
    pub code: String,
    pub name: String,
    pub hypothesis: String,
    pub wave: i32,
    pub status: String,
    pub progress: Option<String>,
    pub gini: Option<f64>,
    pub delta_gini: Option<f64>,
    pub deviance_change_pct: Option<f64>,
    pub aic_delta: Option<f64>,
    pub folds_pass: Option<Vec<bool>>,
    pub budget_used: Option<i32>,
    pub verdict_tag: Option<String>,
    pub verdict_text: Option<String>,
    pub gloss_text: Option<String>,
    pub lineage: Option<String>,
}

#[derive(SimpleObject, Clone)]
pub struct Pt {
    pub x: f64,
    pub y: f64,
    /// tick label when the x axis is categorical
    pub label: Option<String>,
}

#[derive(SimpleObject, Clone)]
pub struct EvidenceSeries {
    pub label: String,
    pub style: String,
    pub points: Vec<Pt>,
}

#[derive(SimpleObject, Clone)]
pub struct EvidenceChart {
    pub kind: String,
    pub title: String,
    pub x_label: String,
    pub y_label: String,
    pub series: Vec<EvidenceSeries>,
    pub notes: Vec<String>,
    pub gloss: String,
}

#[derive(SimpleObject, Clone)]
pub struct LiftBucket {
    pub decile: i32,
    pub exposure: f64,
    pub actual: f64,
    pub predicted: f64,
    pub baseline_actual: f64,
}

#[derive(SimpleObject, Clone)]
pub struct FitFacts {
    pub rows: i64,
    pub params: i32,
    pub iterations: i32,
    pub converged: bool,
    pub gini: f64,
    pub baseline_gini: f64,
    pub deviance: f64,
    pub aic: f64,
    pub alpha: Option<f64>,
}

/// What the platform kept from one experiment's fits. The agent's contract
/// never carries this; it is here so a reader can check the verdict against
/// the artifact it was written from.
#[derive(SimpleObject, Clone)]
pub struct Evidence {
    pub code: String,
    pub facts: Option<FitFacts>,
    pub lift: Vec<LiftBucket>,
    pub fold_deltas: Vec<f64>,
    pub charts: Vec<EvidenceChart>,
}

/// One step the context expert took, shown to the reader so the answer can be
/// checked against the same artifacts.
#[derive(SimpleObject, Clone)]
pub struct AnswerStep {
    pub tool: String,
    pub target: String,
    pub status: String,
}

#[derive(SimpleObject, Clone)]
pub struct Citation {
    pub code: String,
    pub label: String,
    pub status: String,
}

#[derive(SimpleObject, Clone)]
pub struct Answer {
    pub question: String,
    /// which artifact the question was routed to
    pub intent: String,
    pub paragraphs: Vec<String>,
    pub gloss: String,
    pub citations: Vec<Citation>,
    pub steps: Vec<AnswerStep>,
    pub charts: Vec<EvidenceChart>,
}

#[derive(SimpleObject)]
pub struct RailState {
    pub key: String,
    pub label: String,
    pub mark: String,
    pub note: Option<String>,
}

#[derive(SimpleObject)]
pub struct RunCounts {
    pub spawned: i32,
    pub landed: i32,
    pub candidates: i32,
    pub scrapped: i32,
}

/// One row of the run's action record: what the agent (or, for the final
/// approval, the human) did, previewable and attributable.
#[derive(SimpleObject, Clone)]
pub struct AgentAction {
    pub seq: i32,
    pub actor: String,
    pub kind: String,
    pub target: String,
    pub detail: String,
    pub before_state: Option<String>,
    pub after_state: Option<String>,
    pub reversible: bool,
    pub refusal_reason: Option<String>,
    pub experiment_code: Option<String>,
    pub at_ms: f64,
}

#[derive(SimpleObject)]
pub struct Run {
    pub id: ID,
    pub goal: String,
    pub branch_name: String,
    pub status: String,
    pub started_at_ms: f64,
    pub elapsed_ms: Option<f64>,
    pub baseline_gini: Option<f64>,
    pub baseline_factors: Option<i32>,
    pub train_rows: Option<i64>,
    pub winner_code: Option<String>,
    pub train_delta: Option<f64>,
    pub holdout_delta: Option<f64>,
    pub experiments: Vec<Experiment>,
    pub rails: Vec<RailState>,
    pub counts: RunCounts,
    pub review_id: Option<ID>,
    pub review_status: Option<String>,
    pub base_model_version: i32,
    pub actions: Vec<AgentAction>,
}

#[derive(SimpleObject)]
pub struct GuardrailRow {
    pub what: String,
    pub how: String,
}

#[derive(SimpleObject)]
pub struct LedgerRow {
    pub code: String,
    pub disp: String,
    pub why: String,
}

/// The decision-time snapshot frozen at sign-off; renders what the reviewer
/// approved even after the resulting version is superseded or retired.
#[derive(SimpleObject, Clone)]
pub struct ApprovedPackage {
    pub winner_code: String,
    pub base_version: i32,
    pub new_version: i32,
    pub train_delta: f64,
    pub holdout_delta: f64,
    pub guardrails_held: i32,
    pub actions_total: i32,
    pub actions_refused: i32,
    pub weakest_point: String,
}

#[derive(SimpleObject)]
pub struct Review {
    pub id: ID,
    pub run_id: ID,
    pub status: String,
    pub opened_by: String,
    pub winner_code: String,
    pub paragraphs: Vec<String>,
    pub gloss: String,
    pub guardrail_rows: Vec<GuardrailRow>,
    pub ledger_rows: Vec<LedgerRow>,
    pub train_delta: f64,
    pub holdout_delta: f64,
    pub approved_by: Option<String>,
    pub result_version: Option<i32>,
    pub base_version: i32,
    /// The version approving this review will create (or did create)
    pub next_version: i32,
    /// active | superseded | retired; None while the review is open
    pub result_status: Option<String>,
    pub approved_at_ms: Option<f64>,
    pub package: Option<ApprovedPackage>,
    /// When not active: the run whose approval now holds the lineage
    pub replaced_by_run: Option<ID>,
    pub replaced_by_version: Option<i32>,
}

/// One row of the run index: enough to find a run and know its fate.
#[derive(SimpleObject)]
pub struct RunSummary {
    pub id: ID,
    pub status: String,
    pub started_at_ms: f64,
    pub winner_code: Option<String>,
    pub holdout_delta: Option<f64>,
    pub review_status: Option<String>,
    /// true when this run's approved version is the one currently in force
    pub in_force: bool,
    pub next_version: i32,
}

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn dataset_summary(&self, ctx: &Context<'_>) -> Result<DatasetSummary> {
        let pool = ctx.data::<PgPool>()?;
        let (rows, exposure, claims, missing): (i64, Option<f64>, Option<i64>, Option<i64>) =
            sqlx::query_as(
                "SELECT count(*), sum(earned_exposure), sum(claim_count)::bigint, count(*) FILTER (WHERE annual_mileage IS NULL) FROM policies",
            )
            .fetch_one(pool)
            .await?;
        let exposure = exposure.unwrap_or(0.0);
        let claims = claims.unwrap_or(0);
        Ok(DatasetSummary {
            rows,
            exposure,
            claims,
            frequency: if exposure > 0.0 {
                claims as f64 / exposure
            } else {
                0.0
            },
            missing_mileage_pct: if rows > 0 {
                100.0 * missing.unwrap_or(0) as f64 / rows as f64
            } else {
                0.0
            },
        })
    }

    async fn active_model(&self, ctx: &Context<'_>) -> Result<ModelVersion> {
        let pool = ctx.data::<PgPool>()?;
        fetch_model(pool, "status = 'active'").await
    }

    async fn model_versions(&self, ctx: &Context<'_>) -> Result<Vec<ModelVersion>> {
        let pool = ctx.data::<PgPool>()?;
        let rows: Vec<ModelRow> = sqlx::query_as(
            "SELECT id, name, version, status, factors, metrics, parent_version, created_by_run FROM model_versions WHERE name = $1 ORDER BY version",
        )
        .bind(runsvc::MODEL_NAME)
        .fetch_all(pool)
        .await?;
        Ok(rows.into_iter().map(model_from_row).collect())
    }

    /// The artifacts behind one experiment's verdict, loaded when a reader
    /// opens the card rather than on every poll.
    async fn evidence(
        &self,
        ctx: &Context<'_>,
        run_id: ID,
        code: String,
    ) -> Result<Option<Evidence>> {
        let pool = ctx.data::<PgPool>()?;
        fetch_evidence(pool, run_id.parse::<i64>()?, &code).await
    }

    /// The context expert. Answers are composed from this run's artifacts and
    /// carry the steps taken, so nothing here rests on trust. Reading is open
    /// to both roles; changing a model is not something this path can do.
    async fn ask(
        &self,
        ctx: &Context<'_>,
        run_id: ID,
        question: String,
    ) -> Result<Answer> {
        let pool = ctx.data::<PgPool>()?;
        crate::context::ask(pool, run_id.parse::<i64>()?, &question)
            .await
            .map_err(async_graphql::Error::new)
    }

    /// Questions the console offers, each one landing on a real artifact.
    async fn suggested_questions(&self) -> Vec<String> {
        crate::context::SUGGESTED.iter().map(|s| s.to_string()).collect()
    }

    async fn runs(&self, ctx: &Context<'_>) -> Result<Vec<RunSummary>> {
        let pool = ctx.data::<PgPool>()?;
        let rows: Vec<(i64, String, f64, Option<String>, Option<f64>, Option<String>, bool, i32)> =
            sqlx::query_as(
                "SELECT r.id, r.status, (EXTRACT(EPOCH FROM r.started_at) * 1000)::float8, r.outcome->>'winner_code', (r.outcome->>'holdout_delta')::float8, rv.status, COALESCE(mv.status = 'active', false), bmv.version + 1 FROM runs r JOIN model_versions bmv ON bmv.id = r.base_model_id LEFT JOIN reviews rv ON rv.run_id = r.id LEFT JOIN model_versions mv ON mv.id = rv.result_version ORDER BY r.id DESC LIMIT 40",
            )
            .fetch_all(pool)
            .await?;
        Ok(rows
            .into_iter()
            .map(
                |(id, status, started_at_ms, winner_code, holdout_delta, review_status, in_force, next_version)| RunSummary {
                    id: ID(id.to_string()),
                    status,
                    started_at_ms,
                    winner_code,
                    holdout_delta,
                    review_status,
                    in_force,
                    next_version,
                },
            )
            .collect())
    }

    async fn run(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Run>> {
        let pool = ctx.data::<PgPool>()?;
        fetch_run(pool, id.parse::<i64>()?).await
    }

    async fn latest_run(&self, ctx: &Context<'_>) -> Result<Option<Run>> {
        let pool = ctx.data::<PgPool>()?;
        let id: Option<(i64,)> =
            sqlx::query_as("SELECT id FROM runs ORDER BY id DESC LIMIT 1")
                .fetch_optional(pool)
                .await?;
        match id {
            Some((id,)) => fetch_run(pool, id).await,
            None => Ok(None),
        }
    }

    async fn review(&self, ctx: &Context<'_>, run_id: ID) -> Result<Option<Review>> {
        let pool = ctx.data::<PgPool>()?;
        fetch_review_by_run(pool, run_id.parse::<i64>()?).await
    }
}

pub struct MutationRoot;

#[Object]
impl MutationRoot {
    async fn start_run(&self, ctx: &Context<'_>, goal: Option<String>) -> Result<Run> {
        let pool = ctx.data::<PgPool>()?;
        let id = runsvc::start_run(pool, goal).await?;
        Ok(fetch_run(pool, id).await?.expect("run just created"))
    }

    /// Agent or human: opening a review is a shared primitive
    async fn open_review(&self, ctx: &Context<'_>, run_id: ID) -> Result<Review> {
        let pool = ctx.data::<PgPool>()?;
        let role = *ctx.data::<Role>().unwrap_or(&Role::Human);
        let run_id = run_id.parse::<i64>()?;
        runsvc::open_review(pool, run_id, role.actor()).await?;
        Ok(fetch_review_by_run(pool, run_id)
            .await?
            .expect("review just opened"))
    }

    /// HUMAN ONLY: the agent can open this review, it cannot approve it
    async fn approve_review(&self, ctx: &Context<'_>, review_id: ID) -> Result<ModelVersion> {
        let pool = ctx.data::<PgPool>()?;
        let role = *ctx.data::<Role>().unwrap_or(&Role::Human);
        let v13_id =
            runsvc::approve_review(pool, review_id.parse::<i64>()?, role.actor(), "reviewer")
                .await?;
        fetch_model(pool, &format!("id = {v13_id}")).await
    }
}

type ModelRow = (
    i64,
    String,
    i32,
    String,
    serde_json::Value,
    serde_json::Value,
    Option<i32>,
    Option<i64>,
);

fn model_from_row(r: ModelRow) -> ModelVersion {
    let factors: Vec<String> = r.4["list"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    ModelVersion {
        id: ID(r.0.to_string()),
        name: r.1,
        version: r.2,
        status: r.3,
        factor_count: factors.len() as i32,
        factors,
        gini: r.5["gini"].as_f64(),
        parent_version: r.6,
        created_by_run: r.7.map(|id| ID(id.to_string())),
    }
}

async fn fetch_model(pool: &PgPool, where_clause: &str) -> Result<ModelVersion> {
    let sql = format!(
        "SELECT id, name, version, status, factors, metrics, parent_version, created_by_run FROM model_versions WHERE name = $1 AND {where_clause} ORDER BY version DESC LIMIT 1"
    );
    let row: ModelRow = sqlx::query_as(&sql)
        .bind(runsvc::MODEL_NAME)
        .fetch_one(pool)
        .await?;
    Ok(model_from_row(row))
}

pub fn chart_from_json(v: &serde_json::Value) -> EvidenceChart {
    let strs = |key: &str| -> Vec<String> {
        v[key]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|s| s.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default()
    };
    EvidenceChart {
        kind: v["kind"].as_str().unwrap_or_default().into(),
        title: v["title"].as_str().unwrap_or_default().into(),
        x_label: v["x_label"].as_str().unwrap_or_default().into(),
        y_label: v["y_label"].as_str().unwrap_or_default().into(),
        notes: strs("notes"),
        gloss: v["gloss"].as_str().unwrap_or_default().into(),
        series: v["series"]
            .as_array()
            .map(|a| {
                a.iter()
                    .map(|s| EvidenceSeries {
                        label: s["label"].as_str().unwrap_or_default().into(),
                        style: s["style"].as_str().unwrap_or("line").into(),
                        points: s["points"]
                            .as_array()
                            .map(|p| {
                                p.iter()
                                    .map(|pt| Pt {
                                        x: pt["x"].as_f64().unwrap_or(0.0),
                                        y: pt["y"].as_f64().unwrap_or(0.0),
                                        label: pt["label"].as_str().map(String::from),
                                    })
                                    .collect()
                            })
                            .unwrap_or_default(),
                    })
                    .collect()
            })
            .unwrap_or_default(),
    }
}

pub fn evidence_from_json(code: &str, v: &serde_json::Value) -> Evidence {
    Evidence {
        code: code.to_string(),
        facts: v["facts"].as_object().map(|f| FitFacts {
            rows: f["rows"].as_i64().unwrap_or(0),
            params: f["params"].as_i64().unwrap_or(0) as i32,
            iterations: f["iterations"].as_i64().unwrap_or(0) as i32,
            converged: f["converged"].as_bool().unwrap_or(false),
            gini: f["gini"].as_f64().unwrap_or(0.0),
            baseline_gini: f["baseline_gini"].as_f64().unwrap_or(0.0),
            deviance: f["deviance"].as_f64().unwrap_or(0.0),
            aic: f["aic"].as_f64().unwrap_or(0.0),
            alpha: f["alpha"].as_f64(),
        }),
        lift: v["lift"]
            .as_array()
            .map(|a| {
                a.iter()
                    .map(|b| LiftBucket {
                        decile: b["decile"].as_i64().unwrap_or(0) as i32,
                        exposure: b["exposure"].as_f64().unwrap_or(0.0),
                        actual: b["actual"].as_f64().unwrap_or(0.0),
                        predicted: b["predicted"].as_f64().unwrap_or(0.0),
                        baseline_actual: b["baseline_actual"].as_f64().unwrap_or(0.0),
                    })
                    .collect()
            })
            .unwrap_or_default(),
        fold_deltas: v["fold_deltas"]
            .as_array()
            .map(|a| a.iter().filter_map(|d| d.as_f64()).collect())
            .unwrap_or_default(),
        charts: v["charts"]
            .as_array()
            .map(|a| a.iter().map(chart_from_json).collect())
            .unwrap_or_default(),
    }
}

pub async fn fetch_evidence(
    pool: &PgPool,
    run_id: i64,
    code: &str,
) -> Result<Option<Evidence>> {
    let row: Option<(Option<serde_json::Value>,)> = sqlx::query_as(
        "SELECT evidence FROM experiments WHERE run_id = $1 AND code = $2",
    )
    .bind(run_id)
    .bind(code)
    .fetch_optional(pool)
    .await?;
    Ok(row
        .and_then(|(v,)| v)
        .map(|v| evidence_from_json(code, &v)))
}

async fn fetch_run(pool: &PgPool, id: i64) -> Result<Option<Run>> {
    let run: Option<(
        i64,
        String,
        String,
        String,
        serde_json::Value,
        Option<serde_json::Value>,
        f64,
        Option<i64>,
        i32,
    )> = sqlx::query_as(
        "SELECT r.id, r.goal, r.branch_name, r.status, r.guardrails, r.outcome, (EXTRACT(EPOCH FROM r.started_at) * 1000)::float8, r.elapsed_ms, mv.version FROM runs r JOIN model_versions mv ON mv.id = r.base_model_id WHERE r.id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    let Some((id, goal, branch_name, status, rails_cfg, outcome, started_at_ms, elapsed_ms, base_model_version)) =
        run
    else {
        return Ok(None);
    };

    let exp_rows: Vec<(
        String,
        String,
        String,
        i32,
        String,
        Option<String>,
        Option<serde_json::Value>,
        Option<serde_json::Value>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT code, name, hypothesis, wave, status, progress, fit_summary, guardrails, verdict_tag, verdict_text, gloss_text, lineage FROM experiments WHERE run_id = $1 ORDER BY id",
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let mut experiments = Vec::with_capacity(exp_rows.len());
    for r in &exp_rows {
        let fit = r.6.as_ref();
        experiments.push(Experiment {
            code: r.0.clone(),
            name: r.1.clone(),
            hypothesis: r.2.clone(),
            wave: r.3,
            status: r.4.clone(),
            progress: r.5.clone(),
            gini: fit.and_then(|f| f["gini"].as_f64()),
            delta_gini: fit.and_then(|f| f["delta_gini"].as_f64()),
            deviance_change_pct: fit.and_then(|f| f["deviance_change_pct"].as_f64()),
            aic_delta: fit.and_then(|f| f["aic_delta"].as_f64()),
            folds_pass: fit.and_then(|f| {
                f["folds_pass"].as_array().map(|a| {
                    a.iter().filter_map(|v| v.as_bool()).collect::<Vec<bool>>()
                })
            }),
            budget_used: fit.and_then(|f| f["budget_used"].as_i64()).map(|v| v as i32),
            verdict_tag: r.8.clone(),
            verdict_text: r.9.clone(),
            gloss_text: r.10.clone(),
            lineage: r.11.clone(),
        })
    }

    let landed = exp_rows.iter().filter(|r| r.4 != "running").count() as i32;
    let candidates = exp_rows
        .iter()
        .filter(|r| matches!(r.4.as_str(), "candidate" | "winner" | "absorbed"))
        .count() as i32;
    let scrapped = exp_rows.iter().filter(|r| r.4 == "scrapped").count() as i32;
    let counts = RunCounts {
        spawned: exp_rows.len() as i32,
        landed,
        candidates,
        scrapped,
    };

    let rails = rail_states(&rails_cfg, &exp_rows, &status);

    let review: Option<(i64, String)> =
        sqlx::query_as("SELECT id, status FROM reviews WHERE run_id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?;

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
        Option<String>,
        f64,
    )> = sqlx::query_as(
        "SELECT seq, actor, kind, target, detail, before_state, after_state, reversible, refusal_reason, experiment_code, (EXTRACT(EPOCH FROM at) * 1000)::float8 FROM agent_actions WHERE run_id = $1 ORDER BY seq",
    )
    .bind(id)
    .fetch_all(pool)
    .await?;
    let actions = action_rows
        .into_iter()
        .map(
            |(seq, actor, kind, target, detail, before_state, after_state, reversible, refusal_reason, experiment_code, at_ms)| AgentAction {
                seq,
                actor,
                kind,
                target,
                detail,
                before_state,
                after_state,
                reversible,
                refusal_reason,
                experiment_code,
                at_ms,
            },
        )
        .collect();

    let outcome_ref = outcome.as_ref();
    Ok(Some(Run {
        id: ID(id.to_string()),
        goal,
        branch_name,
        status,
        started_at_ms,
        elapsed_ms: elapsed_ms.map(|v| v as f64),
        baseline_gini: outcome_ref.and_then(|o| o["baseline"]["gini"].as_f64()),
        baseline_factors: outcome_ref
            .and_then(|o| o["baseline"]["factors"].as_i64())
            .map(|v| v as i32),
        train_rows: outcome_ref.and_then(|o| o["baseline"]["train_rows"].as_i64()),
        winner_code: outcome_ref
            .and_then(|o| o["winner_code"].as_str())
            .map(String::from),
        train_delta: outcome_ref.and_then(|o| o["train_delta"].as_f64()),
        holdout_delta: outcome_ref.and_then(|o| o["holdout_delta"].as_f64()),
        experiments,
        rails,
        counts,
        review_id: review.as_ref().map(|(rid, _)| ID(rid.to_string())),
        review_status: review.map(|(_, s)| s),
        base_model_version,
        actions,
    }))
}

type ExpRow = (
    String,
    String,
    String,
    i32,
    String,
    Option<String>,
    Option<serde_json::Value>,
    Option<serde_json::Value>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
);

/// Rail marks for the console: a tripped guardrail is the rail WORKING
/// (enforced), and when the run completes with a clean winner every rail
/// reads passed. Notes name the experiment each rail scrapped.
fn rail_states(cfg: &serde_json::Value, exps: &[ExpRow], run_status: &str) -> Vec<RailState> {
    let budget_limit = cfg["budget_limit"].as_u64().unwrap_or(2);
    let territory_limit = cfg["territory_limit_pct"].as_f64().unwrap_or(5.0);
    let folds_required = cfg["folds_required"].as_u64().unwrap_or(5);

    let mut budget_note = None;
    let mut territory_note = None;
    let mut folds_note = None;
    for e in exps {
        if e.4 != "scrapped" {
            continue;
        }
        let Some(g) = e.7.as_ref() else { continue };
        if !g["budget_ok"].as_bool().unwrap_or(true) {
            budget_note = Some(format!("enforced, {} scrapped", e.0));
        }
        if !g["territory_ok"].as_bool().unwrap_or(true) {
            territory_note = Some(format!("enforced, {} scrapped", e.0));
        }
        // folds note only when folds were the binding reason, which the
        // verdict records
        if e.9.as_deref() == Some("gain does not survive fold jitter") {
            folds_note = Some(format!("enforced, {} scrapped", e.0));
        }
    }

    let complete = run_status == "complete";
    let mark = |note: &Option<String>| -> String {
        if complete {
            "passed".to_string()
        } else if note.is_some() {
            "enforced".to_string()
        } else {
            "idle".to_string()
        }
    };

    vec![
        RailState {
            key: "budget".into(),
            label: format!("At most {budget_limit} new rating factors"),
            mark: mark(&budget_note),
            note: budget_note,
        },
        RailState {
            key: "territory".into(),
            label: format!("Territory rate movement within {territory_limit:.0}%"),
            mark: mark(&territory_note),
            note: territory_note,
        },
        RailState {
            key: "folds".into(),
            label: format!("Lift must hold across {folds_required} folds"),
            mark: mark(&folds_note),
            note: folds_note,
        },
    ]
}

async fn fetch_review_by_run(pool: &PgPool, run_id: i64) -> Result<Option<Review>> {
    let row: Option<(
        i64,
        String,
        String,
        String,
        serde_json::Value,
        serde_json::Value,
        serde_json::Value,
        f64,
        f64,
        Option<String>,
        Option<i64>,
        Option<serde_json::Value>,
        Option<f64>,
    )> = sqlx::query_as(
        "SELECT id, winner_code, status, opened_by, summary, guardrail_rows, ledger_rows, train_delta, holdout_delta, approved_by, result_version, approved_package, (EXTRACT(EPOCH FROM approved_at) * 1000)::float8 FROM reviews WHERE run_id = $1",
    )
    .bind(run_id)
    .fetch_optional(pool)
    .await?;
    let Some(r) = row else { return Ok(None) };

    let mut version_status: Option<String> = None;
    let result_version: Option<i32> = match r.10 {
        Some(vid) => {
            let v: Option<(i32, String)> =
                sqlx::query_as("SELECT version, status FROM model_versions WHERE id = $1")
                    .bind(vid)
                    .fetch_optional(pool)
                    .await?;
            version_status = v.as_ref().map(|(_, s)| s.clone());
            v.map(|(v, _)| v)
        }
        None => None,
    };
    let result_status = crate::runsvc::result_status(&r.2, &version_status).map(String::from);
    // For a non-active approval, name what actually took its place so the
    // review can say "replaced by run N's vM" instead of leaking mechanics
    let mut replaced_by_run: Option<ID> = None;
    let mut replaced_by_version: Option<i32> = None;
    if matches!(result_status.as_deref(), Some("retired") | Some("superseded")) {
        let active: Option<(i32, Option<i64>)> = sqlx::query_as(
            "SELECT version, created_by_run FROM model_versions WHERE name = $1 AND status = 'active' AND created_by_run IS NOT NULL AND created_by_run != $2",
        )
        .bind(crate::runsvc::MODEL_NAME)
        .bind(run_id)
        .fetch_optional(pool)
        .await?;
        if let Some((v, by_run)) = active {
            replaced_by_version = Some(v);
            replaced_by_run = by_run.map(|id| ID(id.to_string()));
        }
    }
    let package = r.11.as_ref().map(|p| ApprovedPackage {
        winner_code: p["winner_code"].as_str().unwrap_or_default().to_string(),
        base_version: p["base_version"].as_i64().unwrap_or_default() as i32,
        new_version: p["new_version"].as_i64().unwrap_or_default() as i32,
        train_delta: p["train_delta"].as_f64().unwrap_or_default(),
        holdout_delta: p["holdout_delta"].as_f64().unwrap_or_default(),
        guardrails_held: p["guardrails_held"].as_i64().unwrap_or_default() as i32,
        actions_total: p["actions_total"].as_i64().unwrap_or_default() as i32,
        actions_refused: p["actions_refused"].as_i64().unwrap_or_default() as i32,
        weakest_point: p["weakest_point"].as_str().unwrap_or_default().to_string(),
    });
    let base_version: (i32,) = sqlx::query_as(
        "SELECT mv.version FROM runs ru JOIN model_versions mv ON mv.id = ru.base_model_id WHERE ru.id = $1",
    )
    .bind(run_id)
    .fetch_one(pool)
    .await?;
    // The merge lands one above the version this run branched from. Numbering
    // off the highest row instead would offer a version no run branched from
    // once a replay had already merged once.
    let next_version = result_version.unwrap_or(base_version.0 + 1);

    Ok(Some(Review {
        id: ID(r.0.to_string()),
        run_id: ID(run_id.to_string()),
        winner_code: r.1,
        status: r.2,
        opened_by: r.3,
        paragraphs: r.4["paragraphs"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default(),
        gloss: r.4["gloss"].as_str().unwrap_or_default().to_string(),
        guardrail_rows: r.5
            .as_array()
            .map(|a| {
                a.iter()
                    .map(|v| GuardrailRow {
                        what: v["what"].as_str().unwrap_or_default().to_string(),
                        how: v["how"].as_str().unwrap_or_default().to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default(),
        ledger_rows: r.6
            .as_array()
            .map(|a| {
                a.iter()
                    .map(|v| LedgerRow {
                        code: v["code"].as_str().unwrap_or_default().to_string(),
                        disp: v["disp"].as_str().unwrap_or_default().to_string(),
                        why: v["why"].as_str().unwrap_or_default().to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default(),
        train_delta: r.7,
        holdout_delta: r.8,
        approved_by: r.9,
        result_version,
        base_version: base_version.0,
        next_version,
        result_status,
        approved_at_ms: r.12,
        package,
        replaced_by_run,
        replaced_by_version,
    }))
}
