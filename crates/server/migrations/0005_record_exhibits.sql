-- Sign-off exhibits: static renderings of the decision evidence, compiled
-- from the run's frozen evidence inside the approval transaction. A separate
-- column, not approved_package: that jsonb is the human-signed summary on a
-- hot read path, and NULL here cleanly means "approval predates exhibits".
ALTER TABLE reviews ADD COLUMN exhibits jsonb;
