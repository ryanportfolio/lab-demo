CREATE TABLE policies (
  policy_id        int PRIMARY KEY,
  driver_age       int NOT NULL,
  vehicle_age      int NOT NULL,
  prior_accidents  int NOT NULL,
  territory        text NOT NULL,
  region           text NOT NULL,
  vehicle_use      text NOT NULL,
  marital_status   text NOT NULL,
  homeowner        boolean NOT NULL,
  multi_policy     boolean NOT NULL,
  credit_tier      text NOT NULL,
  safe_driver      boolean NOT NULL,
  annual_mileage   double precision,
  earned_exposure  double precision NOT NULL,
  period           text NOT NULL,
  claim_count      int NOT NULL,
  fold             smallint
);

CREATE TABLE model_versions (
  id             bigserial PRIMARY KEY,
  name           text NOT NULL,
  version        int NOT NULL,
  status         text NOT NULL,
  factors        jsonb NOT NULL,
  metrics        jsonb NOT NULL,
  parent_version int,
  created_by_run bigint,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

CREATE TABLE runs (
  id            bigserial PRIMARY KEY,
  base_model_id bigint NOT NULL REFERENCES model_versions(id),
  branch_name   text NOT NULL,
  goal          text NOT NULL,
  guardrails    jsonb NOT NULL,
  status        text NOT NULL,
  outcome       jsonb,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  elapsed_ms    bigint
);

CREATE TABLE experiments (
  id           bigserial PRIMARY KEY,
  run_id       bigint NOT NULL REFERENCES runs(id),
  code         text NOT NULL,
  name         text NOT NULL,
  hypothesis   text NOT NULL,
  wave         int NOT NULL,
  status       text NOT NULL,
  progress     text,
  fit_summary  jsonb,
  guardrails   jsonb,
  verdict_tag  text,
  verdict_text text,
  gloss_text   text,
  lineage      text,
  spawned_at   timestamptz NOT NULL DEFAULT now(),
  landed_at    timestamptz,
  UNIQUE (run_id, code)
);

CREATE TABLE reviews (
  id             bigserial PRIMARY KEY,
  run_id         bigint NOT NULL REFERENCES runs(id) UNIQUE,
  winner_code    text NOT NULL,
  status         text NOT NULL,
  opened_by      text NOT NULL,
  summary        jsonb NOT NULL,
  guardrail_rows jsonb NOT NULL,
  ledger_rows    jsonb NOT NULL,
  train_delta    double precision NOT NULL,
  holdout_delta  double precision NOT NULL,
  approved_by    text,
  opened_at      timestamptz NOT NULL DEFAULT now(),
  approved_at    timestamptz,
  result_version bigint REFERENCES model_versions(id)
);
