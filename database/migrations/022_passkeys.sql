-- Public keys only. Biometric measurements and device PINs stay on the authenticator.
CREATE TABLE seven.passkeys (
 passkey_id uuid NOT NULL,
 user_id uuid NOT NULL,
 credential_id varchar(1400) NOT NULL,
 public_key bytea NOT NULL,
 signature_counter bigint NOT NULL,
 passkey_name varchar(80) NOT NULL,
 transports varchar(32)[] NOT NULL DEFAULT '{}',
 device_type varchar(16) NOT NULL,
 backed_up boolean NOT NULL,
 last_used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT passkeys_pk PRIMARY KEY (passkey_id),
 CONSTRAINT passkeys_credential_uk UNIQUE (credential_id),
 CONSTRAINT passkeys_user_fk FOREIGN KEY (user_id) REFERENCES seven.users(user_id) ON DELETE RESTRICT,
 CONSTRAINT passkeys_counter_ck CHECK (signature_counter BETWEEN 0 AND 4294967295),
 CONSTRAINT passkeys_public_key_ck CHECK (octet_length(public_key) BETWEEN 32 AND 4096)
);
ALTER TABLE seven.passkeys OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.passkeys TO seven_app;
CREATE INDEX passkeys_user_ix ON seven.passkeys(user_id);
ALTER TABLE seven.passkeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.passkeys FOR ALL TO seven_app USING (true) WITH CHECK (true);
COMMENT ON TABLE seven.passkeys IS 'Owner-scoped WebAuthn public credentials. No private keys or biometric information; credential counters are updated under a row lock after signature verification.';

CREATE TABLE seven.passkey_challenges (
 passkey_challenge_id uuid NOT NULL,
 user_id uuid,
 binding_hash varchar(64) NOT NULL,
 challenge_hash varchar(64) NOT NULL,
 purpose_code varchar(20) NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT passkey_challenges_pk PRIMARY KEY (passkey_challenge_id),
 CONSTRAINT passkey_challenges_binding_uk UNIQUE (binding_hash),
 CONSTRAINT passkey_challenges_user_fk FOREIGN KEY (user_id) REFERENCES seven.users(user_id) ON DELETE RESTRICT,
 CONSTRAINT passkey_challenges_purpose_ck CHECK (purpose_code IN ('registration','authentication'))
);
ALTER TABLE seven.passkey_challenges OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.passkey_challenges TO seven_app;
CREATE INDEX passkey_challenges_expiry_ix ON seven.passkey_challenges(expires_at);
ALTER TABLE seven.passkey_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.passkey_challenges FOR ALL TO seven_app USING (true) WITH CHECK (true);
COMMENT ON TABLE seven.passkey_challenges IS 'Browser-bound SHA-256 WebAuthn challenges, single-use even when verification fails. Five-minute expiry; expired rows removed during option requests. No raw challenge or browser binding is persisted.';
