-- Nullable lease fields safely add recovery claims to the small new inbox.
ALTER TABLE seven.provider_events ADD COLUMN lease_id uuid;
ALTER TABLE seven.provider_events ADD COLUMN lease_expires_at timestamptz;
COMMENT ON COLUMN seven.provider_events.lease_id IS 'Worker claim identity; expired leases can be reclaimed after a crash.';
COMMENT ON COLUMN seven.provider_events.lease_expires_at IS 'Limits the claim duration independently of browser or process lifetime.';
ALTER TABLE seven.refunds ADD CONSTRAINT refunds_provider_id_uk UNIQUE(provider_refund_id);
COMMENT ON COLUMN seven.refunds.provider_refund_id IS 'Provider refund identifier; cannot be applied to two local refund intents.';
