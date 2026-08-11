//! Portfolio slices: the drill-down path from an aggregate chart mark to the
//! policies underneath it. A slice is a reader's filter over the observed
//! portfolio — it never touches a fit. Every number here is recomputed from
//! `policies` rows at read time and labeled observed; the fitted lines and
//! standard errors stay on the full-data evidence charts they were estimated
//! on, which is why the charts built here carry no `se` at all.

use async_graphql::{InputObject, SimpleObject};
use sqlx::{PgPool, Postgres, QueryBuilder};

use crate::schema::{EvidenceChart, EvidenceSeries, Pt};

/// One constraint of a slice. `field` names a whitelisted column; numeric
/// fields use `lo`/`hi` (inclusive, either open), categorical fields use
/// `values`. Anything else is rejected, never interpolated.
#[derive(InputObject, Clone)]
pub struct SliceFilter {
    pub field: String,
    pub values: Option<Vec<String>>,
    pub lo: Option<f64>,
    pub hi: Option<f64>,
}

#[derive(SimpleObject)]
pub struct SliceSummary {
    pub rows: i64,
    pub exposure: f64,
    pub claims: i64,
    /// claims per earned car year inside the slice
    pub frequency: f64,
    /// the whole portfolio's frequency, so a slice reads against its book
    pub book_frequency: f64,
    /// share of total earned exposure this slice holds, in percent
    pub exposure_share_pct: f64,
    /// observed one-way charts recomputed inside the slice
    pub charts: Vec<EvidenceChart>,
}

#[derive(SimpleObject)]
pub struct SlicePolicy {
    pub policy_id: i32,
    pub driver_age: i32,
    pub vehicle_age: i32,
    pub prior_accidents: i32,
    pub territory: String,
    pub region: String,
    pub earned_exposure: f64,
    pub period: String,
    pub claim_count: i32,
    pub fold: Option<i32>,
}

#[derive(SimpleObject)]
pub struct SliceRecords {
    pub total: i64,
    pub offset: i32,
    pub policies: Vec<SlicePolicy>,
}

/// Whitelisted slice columns. The SQL text for a field comes from here and
/// only here; a request's `field` string never reaches the query.
#[derive(Clone, Copy, PartialEq)]
enum Field {
    DriverAge,
    PriorAccidents,
    Territory,
    Region,
}

impl Field {
    fn parse(name: &str) -> Result<Field, String> {
        match name {
            "driver_age" => Ok(Field::DriverAge),
            "prior_accidents" => Ok(Field::PriorAccidents),
            "territory" => Ok(Field::Territory),
            "region" => Ok(Field::Region),
            other => Err(format!("unknown slice field: {other}")),
        }
    }
    fn column(self) -> &'static str {
        match self {
            Field::DriverAge => "driver_age",
            Field::PriorAccidents => "prior_accidents",
            Field::Territory => "territory",
            Field::Region => "region",
        }
    }
    fn categorical(self) -> bool {
        matches!(self, Field::Territory | Field::Region)
    }
}

/// Append `AND column ...` clauses for every filter. Numeric bounds bind as
/// i64 (the columns are ints), categorical values bind as a text array.
fn push_filters(
    builder: &mut QueryBuilder<'_, Postgres>,
    filters: &[SliceFilter],
) -> Result<(), String> {
    for filter in filters {
        let field = Field::parse(&filter.field)?;
        if field.categorical() {
            let values = filter
                .values
                .as_ref()
                .filter(|v| !v.is_empty())
                .ok_or_else(|| format!("{} needs values", filter.field))?;
            builder.push(" AND ");
            builder.push(field.column());
            builder.push(" = ANY(");
            builder.push_bind(values.clone());
            builder.push(")");
        } else {
            if filter.lo.is_none() && filter.hi.is_none() {
                return Err(format!("{} needs lo and/or hi", filter.field));
            }
            if let Some(lo) = filter.lo {
                builder.push(" AND ");
                builder.push(field.column());
                builder.push(" >= ");
                builder.push_bind(lo.round() as i64);
            }
            if let Some(hi) = filter.hi {
                builder.push(" AND ");
                builder.push(field.column());
                builder.push(" <= ");
                builder.push_bind(hi.round() as i64);
            }
        }
    }
    Ok(())
}

/// `(exposure, claims)` grouped rows keyed by a label, from which every slice
/// chart is built.
struct Level {
    label: String,
    x: f64,
    exposure: f64,
    claims: i64,
}

fn observed_chart(
    kind: &str,
    title: &str,
    x_label: &str,
    labelled: bool,
    levels: &[Level],
    total_exposure: f64,
    note: &str,
) -> EvidenceChart {
    let observed = levels
        .iter()
        .map(|level| Pt {
            x: level.x,
            y: if level.exposure > 0.0 {
                level.claims as f64 / level.exposure
            } else {
                0.0
            },
            label: labelled.then(|| level.label.clone()),
            se: None,
        })
        .collect();
    let share = levels
        .iter()
        .map(|level| Pt {
            x: level.x,
            y: if total_exposure > 0.0 {
                100.0 * level.exposure / total_exposure
            } else {
                0.0
            },
            label: labelled.then(|| level.label.clone()),
            se: None,
        })
        .collect();
    EvidenceChart {
        kind: kind.into(),
        title: title.into(),
        x_label: x_label.into(),
        y_label: "Claims per car year".into(),
        series: vec![
            EvidenceSeries {
                label: "Observed".into(),
                style: if labelled { "bar" } else { "line" }.into(),
                points: observed,
            },
            EvidenceSeries {
                label: "Share of exposure".into(),
                style: "dot".into(),
                points: share,
            },
        ],
        notes: vec![note.into()],
        gloss: "Raw claim experience inside the current slice. Thin exposure makes a level jumpy, not meaningful — read the share dots first.".into(),
    }
}

async fn grouped(
    pool: &PgPool,
    filters: &[SliceFilter],
    group_expr: &str,
) -> Result<Vec<(String, f64, i64)>, async_graphql::Error> {
    let mut builder: QueryBuilder<'_, Postgres> = QueryBuilder::new(format!(
        "SELECT {group_expr}::text AS level, coalesce(sum(earned_exposure), 0), coalesce(sum(claim_count), 0)::bigint FROM policies WHERE true",
    ));
    push_filters(&mut builder, filters).map_err(async_graphql::Error::new)?;
    builder.push(format!(" GROUP BY {group_expr} ORDER BY {group_expr}"));
    Ok(builder.build_query_as().fetch_all(pool).await?)
}

pub async fn summary(
    pool: &PgPool,
    filters: Vec<SliceFilter>,
) -> Result<SliceSummary, async_graphql::Error> {
    let mut builder: QueryBuilder<'_, Postgres> = QueryBuilder::new(
        "SELECT count(*), coalesce(sum(earned_exposure), 0), coalesce(sum(claim_count), 0)::bigint FROM policies WHERE true",
    );
    push_filters(&mut builder, &filters).map_err(async_graphql::Error::new)?;
    let (rows, exposure, claims): (i64, f64, i64) =
        builder.build_query_as().fetch_one(pool).await?;

    let (book_exposure, book_claims): (f64, i64) = sqlx::query_as(
        "SELECT coalesce(sum(earned_exposure), 0), coalesce(sum(claim_count), 0)::bigint FROM policies",
    )
    .fetch_one(pool)
    .await?;

    let note = "Observed only: fitted lines and standard errors describe the full portfolio and stay on the evidence charts.";
    let mut charts = Vec::new();
    if rows > 0 {
        let ages = grouped(pool, &filters, "driver_age").await?;
        charts.push(observed_chart(
            "slice_age",
            "Observed frequency by driver age",
            "Driver age",
            false,
            &ages
                .iter()
                .map(|(label, exp, clm)| Level {
                    x: label.parse().unwrap_or(0.0),
                    label: label.clone(),
                    exposure: *exp,
                    claims: *clm,
                })
                .collect::<Vec<_>>(),
            exposure,
            note,
        ));

        let accidents = grouped(pool, &filters, "least(prior_accidents, 5)").await?;
        charts.push(observed_chart(
            "slice_accidents",
            "Observed frequency by prior accidents",
            "Prior accidents",
            true,
            &accidents
                .iter()
                .map(|(label, exp, clm)| {
                    let k: f64 = label.parse().unwrap_or(0.0);
                    Level {
                        x: k,
                        label: if k >= 5.0 { "5+".into() } else { label.clone() },
                        exposure: *exp,
                        claims: *clm,
                    }
                })
                .collect::<Vec<_>>(),
            exposure,
            note,
        ));

        for (field, kind, title) in [
            ("territory", "slice_territory", "Observed frequency by territory"),
            ("region", "slice_region", "Observed frequency by region"),
        ] {
            let rows = grouped(pool, &filters, field).await?;
            charts.push(observed_chart(
                kind,
                title,
                if field == "territory" { "Territory" } else { "Region" },
                true,
                &rows
                    .iter()
                    .enumerate()
                    .map(|(index, (label, exp, clm))| Level {
                        x: index as f64,
                        label: label.clone(),
                        exposure: *exp,
                        claims: *clm,
                    })
                    .collect::<Vec<_>>(),
                exposure,
                note,
            ));
        }
    }

    Ok(SliceSummary {
        rows,
        exposure,
        claims,
        frequency: if exposure > 0.0 { claims as f64 / exposure } else { 0.0 },
        book_frequency: if book_exposure > 0.0 {
            book_claims as f64 / book_exposure
        } else {
            0.0
        },
        exposure_share_pct: if book_exposure > 0.0 {
            100.0 * exposure / book_exposure
        } else {
            0.0
        },
        charts,
    })
}

pub async fn records(
    pool: &PgPool,
    filters: Vec<SliceFilter>,
    offset: i32,
    limit: i32,
) -> Result<SliceRecords, async_graphql::Error> {
    let offset = offset.max(0);
    let limit = limit.clamp(1, 100);

    let mut count: QueryBuilder<'_, Postgres> =
        QueryBuilder::new("SELECT count(*) FROM policies WHERE true");
    push_filters(&mut count, &filters).map_err(async_graphql::Error::new)?;
    let (total,): (i64,) = count.build_query_as().fetch_one(pool).await?;

    let mut builder: QueryBuilder<'_, Postgres> = QueryBuilder::new(
        "SELECT policy_id, driver_age, vehicle_age, prior_accidents, territory, region, earned_exposure, period, claim_count, fold::int4 FROM policies WHERE true",
    );
    push_filters(&mut builder, &filters).map_err(async_graphql::Error::new)?;
    builder.push(" ORDER BY policy_id LIMIT ");
    builder.push_bind(limit as i64);
    builder.push(" OFFSET ");
    builder.push_bind(offset as i64);
    let rows: Vec<(i32, i32, i32, i32, String, String, f64, String, i32, Option<i32>)> =
        builder.build_query_as().fetch_all(pool).await?;

    Ok(SliceRecords {
        total,
        offset,
        policies: rows
            .into_iter()
            .map(
                |(policy_id, driver_age, vehicle_age, prior_accidents, territory, region, earned_exposure, period, claim_count, fold)| SlicePolicy {
                    policy_id,
                    driver_age,
                    vehicle_age,
                    prior_accidents,
                    territory,
                    region,
                    earned_exposure,
                    period,
                    claim_count,
                    fold,
                },
            )
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sql_of(filters: &[SliceFilter]) -> Result<String, String> {
        let mut builder: QueryBuilder<'_, Postgres> = QueryBuilder::new("WHERE true");
        push_filters(&mut builder, filters)?;
        Ok(builder.sql().to_string())
    }

    #[test]
    fn numeric_range_builds_bound_clauses() {
        let sql = sql_of(&[SliceFilter {
            field: "driver_age".into(),
            values: None,
            lo: Some(18.0),
            hi: Some(24.0),
        }])
        .unwrap();
        assert_eq!(sql, "WHERE true AND driver_age >= $1 AND driver_age <= $2");
    }

    #[test]
    fn open_top_range_keeps_only_the_floor() {
        let sql = sql_of(&[SliceFilter {
            field: "prior_accidents".into(),
            values: None,
            lo: Some(3.0),
            hi: None,
        }])
        .unwrap();
        assert_eq!(sql, "WHERE true AND prior_accidents >= $1");
    }

    #[test]
    fn categorical_binds_an_array_never_the_text() {
        let sql = sql_of(&[SliceFilter {
            field: "territory".into(),
            values: Some(vec!["T-104".into(), "T-105'; DROP TABLE policies;--".into()]),
            lo: None,
            hi: None,
        }])
        .unwrap();
        // the hostile value rides a bind parameter; the SQL text never grows
        assert_eq!(sql, "WHERE true AND territory = ANY($1)");
    }

    #[test]
    fn unknown_field_is_rejected_not_interpolated() {
        let err = sql_of(&[SliceFilter {
            field: "policy_id; DROP TABLE policies".into(),
            values: None,
            lo: Some(1.0),
            hi: None,
        }])
        .unwrap_err();
        assert!(err.contains("unknown slice field"));
    }

    #[test]
    fn categorical_without_values_is_an_error() {
        assert!(sql_of(&[SliceFilter {
            field: "region".into(),
            values: Some(vec![]),
            lo: None,
            hi: None,
        }])
        .is_err());
    }

    #[test]
    fn numeric_without_bounds_is_an_error() {
        assert!(sql_of(&[SliceFilter {
            field: "driver_age".into(),
            values: None,
            lo: None,
            hi: None,
        }])
        .is_err());
    }

    #[test]
    fn slice_charts_are_observed_only_no_se() {
        let chart = observed_chart(
            "slice_age",
            "Observed frequency by driver age",
            "Driver age",
            false,
            &[
                Level { label: "18".into(), x: 18.0, exposure: 10.0, claims: 2 },
                Level { label: "19".into(), x: 19.0, exposure: 0.0, claims: 0 },
            ],
            20.0,
            "note",
        );
        assert!(chart
            .series
            .iter()
            .all(|series| series.points.iter().all(|point| point.se.is_none())));
        // zero-exposure levels read as zero frequency, never a division blowup
        assert_eq!(chart.series[0].points[1].y, 0.0);
        // the share series carries the exposure context: 10 of 20 car years
        assert_eq!(chart.series[1].points[0].y, 50.0);
    }
}
