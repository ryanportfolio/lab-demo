//! Seeding: regenerate the deterministic dataset in-process, COPY it into
//! Postgres, run the filing fit, and create the v12 model row with its
//! frozen filed relativity table and real baseline metrics.

use plab_core::{to_csv_line, PolicyRow, N_ZONES, ZONES};
use plab_fit::design::{build_design, predict_rate, ModelSpec};
use plab_fit::glm::{fit_glm, Family};
use plab_fit::metrics::gini;
use plab_platform::executor::RunConfig;
use plab_platform::filing;
use serde_json::json;
use sqlx::postgres::PgPoolCopyExt;
use sqlx::PgPool;

pub async fn seed(pool: &PgPool) -> Result<(), String> {
    let existing: i64 = sqlx::query_scalar("SELECT count(*) FROM policies")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    if existing > 0 {
        println!("policies already seeded ({existing} rows), skipping data load");
    } else {
        let g = plab_datagen::generate();
        println!("generated {} rows, loading via COPY", g.rows.len());
        let mut copy = pool
            .copy_in_raw(
                "COPY policies (policy_id, driver_age, vehicle_age, prior_accidents, territory, region, vehicle_use, marital_status, homeowner, multi_policy, credit_tier, safe_driver, annual_mileage, earned_exposure, period, claim_count, fold) FROM STDIN WITH (FORMAT csv)",
            )
            .await
            .map_err(|e| e.to_string())?;
        let mut buf = String::with_capacity(1 << 20);
        for r in &g.rows {
            // core CSV line order matches the COPY column list except region,
            // which we splice in after territory
            let line = to_csv_line(r);
            let mut fields: Vec<&str> = line.split(',').collect();
            let region = r.region();
            fields.insert(5, region);
            buf.push_str(&fields.join(","));
            buf.push('\n');
            if buf.len() > (1 << 20) {
                copy.send(buf.as_bytes()).await.map_err(|e| e.to_string())?;
                buf.clear();
            }
        }
        if !buf.is_empty() {
            copy.send(buf.as_bytes()).await.map_err(|e| e.to_string())?;
        }
        copy.finish().await.map_err(|e| e.to_string())?;
        println!("policies loaded");
    }

    let v12_exists: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM model_versions WHERE name = $1 AND version = 12",
    )
    .bind(super::runsvc::MODEL_NAME)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    if v12_exists > 0 {
        println!("v12 already present, done");
        return Ok(());
    }

    // Baseline metrics with the frozen filed table, all real fits
    let rows = load_policies(pool).await?;
    let config = RunConfig::default();
    let filing_rows: Vec<&PolicyRow> = rows
        .iter()
        .filter(|r| matches!(r.period.as_str(), "2023H1" | "2023H2"))
        .collect();
    let filed_rel = filing::filed_relativities(&filing_rows, config.filing_k)?;
    let filed_log: Vec<f64> = filed_rel.iter().map(|r| r.ln()).collect();
    let train: Vec<&PolicyRow> = rows.iter().filter(|r| !r.period.is_holdout()).collect();
    let spec = ModelSpec::v12();
    let d = build_design(&train, &spec, &filed_log);
    let fit = fit_glm(&d.x, &d.y, &d.offset, Family::Poisson)?;
    let rates = predict_rate(&d, &fit);
    let g12 = gini(&rates, &d.y, &d.exposure);

    let filed_table: Vec<serde_json::Value> = (0..N_ZONES)
        .map(|z| {
            json!({
                "zone": plab_core::zone_code(z as u8),
                "region": ZONES[z].region,
                "relativity": filed_rel[z],
            })
        })
        .collect();

    sqlx::query(
        "INSERT INTO model_versions (name, version, status, factors, metrics, parent_version) VALUES ($1, 12, 'active', $2, $3, 11)",
    )
    .bind(super::runsvc::MODEL_NAME)
    .bind(json!({
        "list": super::runsvc::V12_FACTORS,
        "filed_territory_relativities": filed_table,
    }))
    .bind(json!({
        "gini": g12,
        "deviance": fit.deviance,
        "aic": fit.aic,
        "train_rows": train.len(),
    }))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    println!(
        "v12 created: gini {g12:.4}, deviance {:.1}, aic {:.1}",
        fit.deviance, fit.aic
    );
    Ok(())
}

pub async fn load_policies(pool: &PgPool) -> Result<Vec<PolicyRow>, String> {
    let rows: Vec<(i32, i32, i32, i32, String, String, String, bool, bool, String, bool, Option<f64>, f64, String, i32, Option<i16>)> = sqlx::query_as(
        "SELECT policy_id, driver_age, vehicle_age, prior_accidents, territory, vehicle_use, marital_status, homeowner, multi_policy, credit_tier, safe_driver, annual_mileage, earned_exposure, period, claim_count, fold FROM policies ORDER BY policy_id",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.into_iter()
        .map(|t| {
            Ok(PolicyRow {
                policy_id: t.0 as u32,
                driver_age: t.1 as u8,
                vehicle_age: t.2 as u8,
                prior_accidents: t.3 as u8,
                territory: plab_core::zone_index(&t.4).ok_or("bad territory")?,
                vehicle_use: plab_core::VehicleUse::parse(&t.5).ok_or("bad vehicle_use")?,
                marital_status: plab_core::Marital::parse(&t.6).ok_or("bad marital")?,
                homeowner: t.7,
                multi_policy: t.8,
                credit_tier: plab_core::CreditTier::parse(&t.9).ok_or("bad credit")?,
                safe_driver: t.10,
                annual_mileage: t.11,
                earned_exposure: t.12,
                period: plab_core::Period::parse(&t.13).ok_or("bad period")?,
                claim_count: t.14 as u8,
                fold: t.15.map(|f| f as u8),
            })
        })
        .collect()
}
