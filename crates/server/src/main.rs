//! GraphQL server for the Experiments console. Role enforcement lives in the
//! GraphQL layer: the modeling agent can open a review, it cannot approve
//! one, and hiding a button is not the mechanism.

mod runsvc;
mod schema;
mod seed;

use async_graphql::{EmptySubscription, Schema};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    extract::State,
    http::{header, HeaderMap, Method, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use schema::{AppSchema, MutationRoot, QueryRoot, Role};
use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() {
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must point at the Postgres instance");
    let pool = PgPoolOptions::new()
        .max_connections(8)
        .connect(&database_url)
        .await
        .expect("connect to postgres");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("run migrations");

    // Optional demo reset: when RESET_DEMO carries a nonce this boot has not
    // seen before, wipe runs, reviews, and every version above v12 so the
    // site greets its next visitor with the fresh v12 story. Nonce-guarded
    // so restarts never wipe state mid-demo.
    if let Ok(nonce) = std::env::var("RESET_DEMO") {
        reset_demo_if_new_nonce(&pool, &nonce)
            .await
            .expect("demo reset");
    }

    // Seeding is idempotent: dataset COPY and the v12 filing fit run once,
    // later boots skip in milliseconds
    seed::seed(&pool).await.expect("seed");
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--seed") {
        return;
    }

    let schema = Schema::build(QueryRoot, MutationRoot, EmptySubscription)
        .data(pool.clone())
        .finish();

    let app = Router::new()
        .route(
            "/graphql",
            get(graphiql).post(graphql_handler).options(preflight),
        )
        .fallback(static_handler)
        .with_state(schema);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("bind");
    println!("server listening on http://0.0.0.0:{port}/graphql");
    axum::serve(listener, app).await.expect("serve");
}

async fn reset_demo_if_new_nonce(
    pool: &sqlx::PgPool,
    nonce: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS demo_meta (key text PRIMARY KEY, value text NOT NULL)",
    )
    .execute(pool)
    .await?;
    let seen: Option<(String,)> =
        sqlx::query_as("SELECT value FROM demo_meta WHERE key = 'reset_nonce'")
            .fetch_optional(pool)
            .await?;
    if seen.as_ref().map(|(v,)| v.as_str()) == Some(nonce) {
        return Ok(());
    }
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM reviews").execute(&mut *tx).await?;
    sqlx::query("DELETE FROM experiments").execute(&mut *tx).await?;
    sqlx::query("DELETE FROM runs").execute(&mut *tx).await?;
    sqlx::query("DELETE FROM model_versions WHERE version > 12")
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE model_versions SET status = 'active' WHERE version = 12")
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO demo_meta (key, value) VALUES ('reset_nonce', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
    )
    .bind(nonce)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    println!("demo state reset (nonce {nonce})");
    Ok(())
}

/// Serve the built frontend (SPA fallback to index.html). No static-file
/// crate needed for a handful of asset types.
async fn static_handler(uri: axum::http::Uri) -> Response {
    let dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "frontend/dist".into());
    let path = uri.path().trim_start_matches('/');
    if path.contains("..") {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let candidate = if path.is_empty() {
        format!("{dir}/index.html")
    } else {
        format!("{dir}/{path}")
    };
    let (bytes, name) = match tokio::fs::read(&candidate).await {
        Ok(b) => (b, candidate),
        Err(_) => match tokio::fs::read(format!("{dir}/index.html")).await {
            Ok(b) => (b, format!("{dir}/index.html")),
            Err(_) => return StatusCode::NOT_FOUND.into_response(),
        },
    };
    let mime = match name.rsplit('.').next() {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript",
        Some("css") => "text/css",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("woff2") => "font/woff2",
        Some("json") => "application/json",
        _ => "application/octet-stream",
    };
    ([(header::CONTENT_TYPE, mime)], bytes).into_response()
}

async fn graphql_handler(
    State(schema): State<AppSchema>,
    headers: HeaderMap,
    req: GraphQLRequest,
) -> Response {
    let role = match headers
        .get("x-actor-role")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_ascii_lowercase())
        .as_deref()
    {
        Some("agent") => Role::Agent,
        _ => Role::Human,
    };
    let resp: GraphQLResponse = schema.execute(req.into_inner().data(role)).await.into();
    with_cors(resp.into_response())
}

async fn graphiql() -> Response {
    with_cors(
        Html(
            async_graphql::http::GraphiQLSource::build()
                .endpoint("/graphql")
                .finish(),
        )
        .into_response(),
    )
}

async fn preflight() -> Response {
    with_cors(StatusCode::NO_CONTENT.into_response())
}

/// Local dev CORS: the Vite frontend runs on another localhost port.
fn with_cors(mut resp: Response) -> Response {
    let h = resp.headers_mut();
    h.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        header::HeaderValue::from_static("*"),
    );
    h.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        header::HeaderValue::from_static("content-type, x-actor-role, x-actor-name"),
    );
    h.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        header::HeaderValue::from_static(Method::POST.as_str()),
    );
    resp
}
