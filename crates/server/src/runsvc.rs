//! Run orchestration: startRun spawns the real executor on a blocking
//! thread, streams its progress events into Postgres, and when the run
//! completes the modeling agent opens the review through the same domain
//! path a mutation would use.

use plab_core::protocol::Disposition;
use plab_platform::executor::{execute, ExperimentRecord, RunConfig, RunEvent, RunOutcome};
use serde_json::json;
use sqlx::PgPool;

pub const MODEL_NAME: &str = "Bodily Injury Frequency";
pub const V12_FACTORS: [&str; 9] = [
    "driver_age bands",
    "territory",
    "vehicle_age bands",
    "vehicle_use",
    "marital_status",
    "homeowner",
    "multi_policy",
    "credit_tier",
    "safe_driver",
];

pub const DEFAULT_GOAL: &str = "Improve lift on Bodily Injury Frequency v12 without adding more than two rating factors. Keep territory relativities within filed tolerance.";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActorRole {
    Human,
    Agent,
}

impl ActorRole {
    pub fn as_str(self) -> &'static str {
        match self {
            ActorRole::Human => "human",
            ActorRole::Agent => "agent",
        }
    }
}

/// Insert the run row and launch the executor in the background. Returns the
/// new run id immediately; the frontend polls for progress.
pub async fn start_run(pool: &PgPool, goal: Option<String>) -> Result<i64, String> {
    // Every run anchors on the v12 scenario row: the experiments and their
    // fits are defined against v12, so replays must not silently rebase onto
    // whatever version the last approval created
    let base: (i64,) = sqlx::query_as(
        "SELECT id FROM model_versions WHERE name = $1 AND version = 12",
    )
    .bind(MODEL_NAME)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("no v12 model, seed first: {e}"))?;

    let config = RunConfig::default();
    let goal = goal.unwrap_or_else(|| DEFAULT_GOAL.to_string());
    let run_id: (i64,) = sqlx::query_as(
        "INSERT INTO runs (base_model_id, branch_name, goal, guardrails, status) VALUES ($1, '', $2, $3, 'running') RETURNING id",
    )
    .bind(base.0)
    .bind(&goal)
    .bind(json!({
        "budget_limit": config.guardrails.budget_limit,
        "territory_limit_pct": config.guardrails.territory_limit_pct,
        "folds_required": config.guardrails.folds_required,
    }))
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    let run_id = run_id.0;
    sqlx::query("UPDATE runs SET branch_name = $1 WHERE id = $2")
        .bind(format!("run/{run_id}-experiments"))
        .bind(run_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    let pool = pool.clone();
    tokio::spawn(async move {
        if let Err(e) = drive_run(&pool, run_id, config).await {
            eprintln!("run {run_id} failed: {e}");
            let _ = sqlx::query("UPDATE runs SET status = 'failed' WHERE id = $1")
                .bind(run_id)
                .execute(&pool)
                .await;
        }
    });
    Ok(run_id)
}

async fn drive_run(pool: &PgPool, run_id: i64, config: RunConfig) -> Result<(), String> {
    let rows = super::seed::load_policies(pool).await?;

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<RunEvent>();
    let exec = tokio::task::spawn_blocking(move || {
        let mut sink = |ev: RunEvent| {
            let _ = tx.send(ev);
        };
        execute(&rows, config, &mut sink)
    });

    while let Some(ev) = rx.recv().await {
        persist_event(pool, run_id, &ev).await?;
    }
    let outcome = exec
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    finish_run(pool, run_id, &outcome).await
}

async fn persist_event(pool: &PgPool, run_id: i64, ev: &RunEvent) -> Result<(), String> {
    match ev {
        RunEvent::Spawned {
            code,
            name,
            hypothesis,
            wave,
        } => {
            sqlx::query(
                "INSERT INTO experiments (run_id, code, name, hypothesis, wave, status, progress) VALUES ($1, $2, $3, $4, $5, 'running', 'queued') ON CONFLICT (run_id, code) DO NOTHING",
            )
            .bind(run_id)
            .bind(code)
            .bind(name)
            .bind(hypothesis)
            .bind(*wave as i32)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        }
        RunEvent::Stage { code, stage } => {
            sqlx::query(
                "UPDATE experiments SET progress = $1 WHERE run_id = $2 AND code = $3",
            )
            .bind(stage)
            .bind(run_id)
            .bind(code)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        }
        RunEvent::Landed { record } => {
            update_experiment(pool, run_id, record).await?;
        }
        RunEvent::Finished => {}
    }
    Ok(())
}

fn fit_summary_json(r: &ExperimentRecord) -> Option<serde_json::Value> {
    r.fit.as_ref().map(|f| {
        json!({
            "gini": f.gini,
            "delta_gini": f.delta_gini,
            "deviance_change_pct": f.deviance_change_pct,
            "aic_delta": f.aic_delta,
            "fold_deltas": f.fold_deltas,
            "folds_pass": f.folds_pass,
            "budget_used": f.budget_used,
        })
    })
}

fn rails_json(r: &ExperimentRecord) -> Option<serde_json::Value> {
    r.rails.as_ref().map(|g| {
        json!({
            "budget_used": g.budget_used,
            "budget_limit": g.budget_limit,
            "budget_ok": g.budget_ok,
            "territory_movement_pct": g.territory_movement_pct,
            "territory_worst_zone": g.territory_worst_zone,
            "territory_direct": g.territory_direct,
            "territory_limit_pct": g.territory_limit_pct,
            "territory_ok": g.territory_ok,
            "folds_required": g.folds_required,
            "folds_held": g.folds_held,
            "folds_ok": g.folds_ok,
        })
    })
}

async fn update_experiment(
    pool: &PgPool,
    run_id: i64,
    r: &ExperimentRecord,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE experiments SET status = $1, progress = NULL, fit_summary = $2, guardrails = $3, verdict_tag = $4, verdict_text = $5, gloss_text = $6, lineage = $7, landed_at = COALESCE(landed_at, now()) WHERE run_id = $8 AND code = $9",
    )
    .bind(status_of(r.disposition))
    .bind(fit_summary_json(r))
    .bind(rails_json(r))
    .bind(r.verdict.disposition.tag())
    .bind(&r.verdict.expert_text)
    .bind(&r.verdict.gloss_text)
    .bind(&r.verdict.lineage)
    .bind(run_id)
    .bind(r.plan.code)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn status_of(d: Disposition) -> &'static str {
    match d {
        Disposition::Candidate => "candidate",
        Disposition::Scrapped => "scrapped",
        Disposition::Winner => "winner",
        Disposition::Absorbed => "absorbed",
    }
}

async fn finish_run(pool: &PgPool, run_id: i64, outcome: &RunOutcome) -> Result<(), String> {
    // Final dispositions can differ from landed-time ones (absorbed, winner
    // rewrite), so refresh every record
    for r in &outcome.records {
        update_experiment(pool, run_id, r).await?;
    }

    let filed_lo = outcome.filed_rel.iter().cloned().fold(f64::MAX, f64::min);
    let filed_hi = outcome.filed_rel.iter().cloned().fold(f64::MIN, f64::max);
    let winner_code = outcome.winner.map(|i| outcome.records[i].plan.code);
    sqlx::query(
        "UPDATE runs SET status = 'complete', finished_at = now(), elapsed_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::bigint, outcome = $1 WHERE id = $2",
    )
    .bind(json!({
        "baseline": {
            "gini": outcome.baseline.gini,
            "deviance": outcome.baseline.deviance,
            "aic": outcome.baseline.aic,
            "factors": outcome.baseline.factors,
            "train_rows": outcome.baseline.train_rows,
        },
        "train_delta": outcome.train_delta,
        "holdout_delta": outcome.holdout_delta,
        "winner_code": winner_code,
        "filed_span": [filed_lo, filed_hi],
        "profile": {
            "rows": outcome.profile.rows,
            "mileage_missing_pct": outcome.profile.mileage_missing_pct,
            "acc3_exposure_pct": outcome.profile.acc3_exposure_pct,
        },
    }))
    .bind(run_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // The agent opens the review, through the same domain function a human
    // caller would hit
    if outcome.winner.is_some() {
        open_review(pool, run_id, ActorRole::Agent).await?;
    }
    Ok(())
}

/// Open (or fetch) the review for a completed run. Both roles may open.
pub async fn open_review(
    pool: &PgPool,
    run_id: i64,
    role: ActorRole,
) -> Result<i64, String> {
    if let Some((id,)) = sqlx::query_as::<_, (i64,)>(
        "SELECT id FROM reviews WHERE run_id = $1",
    )
    .bind(run_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    {
        return Ok(id);
    }

    let (status, outcome): (String, Option<serde_json::Value>) = sqlx::query_as(
        "SELECT status, outcome FROM runs WHERE id = $1",
    )
    .bind(run_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    if status != "complete" {
        return Err("run is not complete, nothing to review".into());
    }
    let outcome = outcome.ok_or("run has no outcome")?;
    let winner_code = outcome["winner_code"]
        .as_str()
        .ok_or("no winner emerged in this run, nothing to review")?
        .to_string();
    let train_delta = outcome["train_delta"].as_f64().unwrap_or(0.0);
    let holdout_delta = outcome["holdout_delta"].as_f64().unwrap_or(0.0);

    let exps: Vec<(String, String, Option<String>, Option<serde_json::Value>, Option<serde_json::Value>)> = sqlx::query_as(
        "SELECT code, status, verdict_text, fit_summary, guardrails FROM experiments WHERE run_id = $1 ORDER BY id",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let profile_acc3 = outcome["profile"]["acc3_exposure_pct"]
        .as_f64()
        .unwrap_or(0.0);
    let summary = plab_agent::review_summary(train_delta, holdout_delta, profile_acc3);

    let review_id: (i64,) = sqlx::query_as(
        "INSERT INTO reviews (run_id, winner_code, status, opened_by, summary, guardrail_rows, ledger_rows, train_delta, holdout_delta) VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8) RETURNING id",
    )
    .bind(run_id)
    .bind(&winner_code)
    .bind(role.as_str())
    .bind(json!({ "paragraphs": summary.paragraphs, "gloss": summary.gloss }))
    .bind(guardrail_rows(&outcome, &exps, &winner_code))
    .bind(ledger_rows(&exps, &winner_code))
    .bind(train_delta)
    .bind(holdout_delta)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(review_id.0)
}

/// Review guardrail rows, platform-built from stored artifacts. Bold spans
/// are wrapped in ** for the frontend. Every sentence stays true for any
/// value the computation can produce.
fn guardrail_rows(
    outcome: &serde_json::Value,
    exps: &[(String, String, Option<String>, Option<serde_json::Value>, Option<serde_json::Value>)],
    winner_code: &str,
) -> serde_json::Value {
    let winner = exps.iter().find(|e| e.0 == winner_code);
    let winner_rails = winner.and_then(|e| e.4.as_ref());
    let budget_used = winner_rails
        .and_then(|g| g["budget_used"].as_u64())
        .unwrap_or(0);
    let budget_limit = winner_rails
        .and_then(|g| g["budget_limit"].as_u64())
        .unwrap_or(2);
    let base_factors = outcome["baseline"]["factors"].as_u64().unwrap_or(9);
    let is_combo = winner_code == "EXP-07";
    let budget_how = if is_combo {
        format!(
            "**{budget_used} of {budget_limit}** used. The spline replaces the banded age factor but still counts against the budget; prior accidents is the second. Net new factors in the plan: one, so the merged model carries **{}**.",
            base_factors + 1
        )
    } else {
        format!(
            "**{budget_used} of {budget_limit}** used by the winning experiment, so the merged model carries **{}**.",
            base_factors + budget_used
        )
    };

    let dislocation = winner_rails
        .and_then(|g| g["territory_movement_pct"].as_f64())
        .unwrap_or(0.0);
    let worst_zone = winner_rails
        .and_then(|g| g["territory_worst_zone"].as_str())
        .unwrap_or("")
        .to_string();
    let limit = winner_rails
        .and_then(|g| g["territory_limit_pct"].as_f64())
        .unwrap_or(5.0);
    let exp03 = exps.iter().find(|e| {
        e.4.as_ref()
            .map(|g| g["territory_direct"].as_bool().unwrap_or(false))
            .unwrap_or(false)
            && e.1 == "scrapped"
    });
    let exp03_clause = match exp03 {
        Some(e) => {
            let m = e.4.as_ref().unwrap()["territory_movement_pct"]
                .as_f64()
                .unwrap_or(0.0);
            format!(
                " except {}, which tested unfreezing them and was scrapped for the {m:.1}% swing",
                e.0
            )
        }
        None => String::new(),
    };
    let territory_how = format!(
        "Filed territory relativities stayed frozen in every fit{exp03_clause}. With relativities pinned, the largest average rate movement inside any one territory, driven by the new factors, is **{dislocation:.1}%**, on {worst_zone}, within the {limit:.0}% limit."
    );

    let folds_held = winner_rails
        .and_then(|g| g["folds_held"].as_u64())
        .unwrap_or(0);
    let folds_required = winner_rails
        .and_then(|g| g["folds_required"].as_u64())
        .unwrap_or(5);
    let train_delta = outcome["train_delta"].as_f64().unwrap_or(0.0);
    let holdout_delta = outcome["holdout_delta"].as_f64().unwrap_or(0.0);
    let lift_how = format!(
        "Lift held on {folds_held} of {folds_required} random folds during the run, then one out of time holdout on 2025 H2. Holdout lift **{holdout_delta:+.3}** against train **{train_delta:+.3}**."
    );

    json!([
        { "what": "Factor budget", "how": budget_how },
        { "what": "Territory stability", "how": territory_how },
        { "what": "Lift validation", "how": lift_how },
    ])
}

fn ledger_rows(
    exps: &[(String, String, Option<String>, Option<serde_json::Value>, Option<serde_json::Value>)],
    winner_code: &str,
) -> serde_json::Value {
    let carried = |code: &str| -> &'static str {
        // what an absorbed experiment contributed to the winner
        match code {
            "EXP-01" => "the spline carried forward",
            "EXP-04" => "the capped count carried forward",
            _ => "carried forward",
        }
    };
    let mut rows: Vec<serde_json::Value> = Vec::new();
    // order: winner, absorbed, scrapped
    for pass in ["winner", "absorbed", "scrapped"] {
        for (code, status, verdict, _, _) in exps {
            if status != pass {
                continue;
            }
            let (disp, why) = match status.as_str() {
                "winner" => ("Winner".to_string(), "promoted in this review".to_string()),
                "absorbed" => (
                    "Absorbed".to_string(),
                    format!("into {winner_code}, {}", carried(code)),
                ),
                _ => (
                    "Scrapped".to_string(),
                    verdict.clone().unwrap_or_default(),
                ),
            };
            rows.push(json!({ "code": code, "disp": disp, "why": why }));
        }
    }
    json!(rows)
}

/// Approve: HUMAN ONLY, enforced by callers passing the request role. The
/// transaction merges the branch: v13 row created, v12 superseded, review
/// stamped, ledger attached through created_by_run.
pub async fn approve_review(
    pool: &PgPool,
    review_id: i64,
    role: ActorRole,
    actor: &str,
) -> Result<i64, String> {
    if role != ActorRole::Human {
        return Err("the agent can open this review, it cannot approve it".into());
    }

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let (run_id, status, winner_code, train_delta, holdout_delta): (i64, String, String, f64, f64) =
        sqlx::query_as(
            "SELECT run_id, status, winner_code, train_delta, holdout_delta FROM reviews WHERE id = $1 FOR UPDATE",
        )
        .bind(review_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("review not found: {e}"))?;
    if status == "approved" {
        return Err("this review is already approved".into());
    }

    let (_base_id, base_version, base_factors, base_metrics): (i64, i32, serde_json::Value, serde_json::Value) =
        sqlx::query_as(
            "SELECT mv.id, mv.version, mv.factors, mv.metrics FROM runs r JOIN model_versions mv ON mv.id = r.base_model_id WHERE r.id = $1",
        )
        .bind(run_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // v13's factor list: the winner's structural change applied to v12's
    let mut factor_list: Vec<String> = base_factors["list"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    if winner_code == "EXP-07" || winner_code == "EXP-01" {
        factor_list = factor_list
            .into_iter()
            .map(|f| {
                if f == "driver_age bands" {
                    "driver_age spline".to_string()
                } else {
                    f
                }
            })
            .collect();
    }
    if winner_code == "EXP-07" || winner_code == "EXP-04" {
        factor_list.push("prior accidents capped".to_string());
    }

    let base_gini = base_metrics["gini"].as_f64().unwrap_or(0.0);
    // Replays can approve again: the merge always creates the next unused
    // version number, parented on the run's base
    let (new_version,): (i32,) = sqlx::query_as(
        "SELECT COALESCE(max(version), 0) + 1 FROM model_versions WHERE name = $1",
    )
    .bind(MODEL_NAME)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    let (v13_id,): (i64,) = sqlx::query_as(
        "INSERT INTO model_versions (name, version, status, factors, metrics, parent_version, created_by_run) VALUES ($1, $2, 'active', $3, $4, $5, $6) RETURNING id",
    )
    .bind(MODEL_NAME)
    .bind(new_version)
    .bind(json!({
        "list": factor_list,
        "filed_territory_relativities": base_factors["filed_territory_relativities"],
    }))
    .bind(json!({
        "gini": base_gini + train_delta,
        "train_delta": train_delta,
        "holdout_delta": holdout_delta,
        "promoted_from": winner_code,
    }))
    .bind(base_version)
    .bind(run_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // Exactly one active version: the merge supersedes every other row,
    // including versions earlier replays created
    sqlx::query(
        "UPDATE model_versions SET status = 'superseded' WHERE name = $1 AND id != $2",
    )
    .bind(MODEL_NAME)
    .bind(v13_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    sqlx::query(
        "UPDATE reviews SET status = 'approved', approved_by = $1, approved_at = now(), result_version = $2 WHERE id = $3",
    )
    .bind(actor)
    .bind(v13_id)
    .bind(review_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(v13_id)
}
