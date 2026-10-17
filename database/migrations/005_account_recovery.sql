-- New account-recovery tables only. No user or credential backfill.
-- Expected low-volume account traffic, below 100,000 recovery requests/year initially.
-- UUIDs are application-generated opaque identifiers. Token plaintext is never persisted.
CREATE TABLE seven.account_recoveries (
 account_recovery_id uuid NOT NULL,
 user_id uuid NOT NULL,
 token_hash varchar(64) NOT NULL,
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 revoked_at timestamptz,
 delivery_failed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT account_recoveries_pk PRIMARY KEY (account_recovery_id),
 CONSTRAINT account_recoveries_token_uk UNIQUE (token_hash),
 CONSTRAINT account_recoveries_user_fk FOREIGN KEY (user_id) REFERENCES seven.users(user_id) ON DELETE RESTRICT
);
ALTER TABLE seven.account_recoveries OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.account_recoveries TO seven_app;
GRANT SELECT ON seven.account_recoveries TO seven_readonly;
CREATE INDEX account_recoveries_user_ix ON seven.account_recoveries(user_id);
CREATE INDEX account_recoveries_expiry_ix ON seven.account_recoveries(expires_at);
COMMENT ON TABLE seven.account_recoveries IS 'Single-use 15-minute SHA-256 recovery token hashes linked to an account; contains account-linked security metadata. Application purges records seven days after expiry; immutable account audit remains.';
COMMENT ON COLUMN seven.account_recoveries.token_hash IS 'SHA-256 of a random 256-bit token; the unhashed token appears only in the private delivery channel.';
COMMENT ON COLUMN seven.account_recoveries.delivery_failed_at IS 'Delivery adapter failure revokes this link; no provider payload or destination is stored here.';

CREATE TABLE seven.account_rate_limits (
 account_rate_limit_id uuid NOT NULL,
 scope_hash varchar(64) NOT NULL,
 window_started_at timestamptz NOT NULL,
 request_count integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT account_rate_limits_pk PRIMARY KEY (account_rate_limit_id),
 CONSTRAINT account_rate_limits_scope_window_uk UNIQUE (scope_hash,window_started_at),
 CONSTRAINT account_rate_limits_count_ck CHECK (request_count>0)
);
ALTER TABLE seven.account_rate_limits OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.account_rate_limits TO seven_app;
GRANT SELECT ON seven.account_rate_limits TO seven_readonly;
CREATE INDEX account_rate_limits_window_ix ON seven.account_rate_limits(window_started_at);
COMMENT ON TABLE seven.account_rate_limits IS 'Atomic shared-worker recovery and password-attempt counters. Hashes scope action with IP/email/account; raw identifiers are not stored. Application purges windows older than one day.';
