CREATE TABLE agent_actions (
  id              bigserial PRIMARY KEY,
  run_id          bigint NOT NULL REFERENCES runs(id),
  seq             int NOT NULL,
  actor           text NOT NULL,
  kind            text NOT NULL,
  target          text NOT NULL,
  detail          text NOT NULL,
  before_state    text,
  after_state     text,
  reversible      boolean NOT NULL,
  refusal_reason  text,
  experiment_code text,
  at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);
