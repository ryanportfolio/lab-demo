-- Decision-time snapshot: what the reviewer approved, frozen at sign-off so
-- a superseded or retired review still renders the package that was signed.
ALTER TABLE reviews ADD COLUMN approved_package jsonb;
