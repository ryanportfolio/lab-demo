-- The artifacts behind each verdict: lift buckets, fold deltas, fit facts, and
-- the archetype chart the platform kept. Written by the run executor, read by
-- the console when a card is opened.
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS evidence jsonb;
