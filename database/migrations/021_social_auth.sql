-- Additive social identity support. No account/email backfill or automatic linking.
-- Expected initial volume below 100,000 sign-ins/year. UUIDs are application generated.
CREATE TABLE seven.social_auth_providers (
 provider_code varchar(20) NOT NULL,
 CONSTRAINT social_auth_providers_pk PRIMARY KEY(provider_code)
);
ALTER TABLE seven.social_auth_providers OWNER TO seven_owner;
GRANT SELECT ON seven.social_auth_providers TO seven_app, seven_readonly;
INSERT INTO seven.social_auth_providers(provider_code) VALUES ('google'),('apple');

CREATE TABLE seven.social_auth_identities (
 identity_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT,
 provider_code varchar(20) NOT NULL REFERENCES seven.social_auth_providers(provider_code) ON DELETE RESTRICT,
 provider_subject varchar(255) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT social_auth_identities_pk PRIMARY KEY(identity_id),
 CONSTRAINT social_auth_identities_subject_uk UNIQUE(provider_code,provider_subject),
 CONSTRAINT social_auth_identities_user_provider_uk UNIQUE(user_id,provider_code)
);
ALTER TABLE seven.social_auth_identities OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.social_auth_identities TO seven_app;
GRANT SELECT ON seven.social_auth_identities TO seven_readonly;
COMMENT ON TABLE seven.social_auth_identities IS 'Provider subject identifiers are account credentials. Email equality never links accounts. Existing accounts link only after an authenticated recent sign-in or password check.';

CREATE TABLE seven.social_auth_challenges (
 challenge_id uuid NOT NULL,
 state_hash varchar(64) NOT NULL,
 browser_hash varchar(64) NOT NULL,
 provider_code varchar(20) NOT NULL REFERENCES seven.social_auth_providers(provider_code) ON DELETE RESTRICT,
 nonce varchar(43) NOT NULL,
 code_verifier varchar(43) NOT NULL,
 return_path varchar(1000) NOT NULL,
 linking_user_id uuid REFERENCES seven.users(user_id) ON DELETE RESTRICT,
 linking_session_id uuid REFERENCES seven.sessions(session_id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT social_auth_challenges_pk PRIMARY KEY(challenge_id),
 CONSTRAINT social_auth_challenges_state_uk UNIQUE(state_hash)
);
ALTER TABLE seven.social_auth_challenges OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.social_auth_challenges TO seven_app;
CREATE INDEX social_auth_challenges_expiry_ix ON seven.social_auth_challenges(expires_at);
COMMENT ON TABLE seven.social_auth_challenges IS 'Ten-minute browser-bound one-use OAuth attempts. State and browser secrets are hashed. PKCE verifier and nonce are ephemeral server credentials, not exposed through public APIs or readonly grants. Purged one day after expiry.';

ALTER TABLE seven.social_auth_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE seven.social_auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE seven.social_auth_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.social_auth_providers FOR SELECT TO seven_app USING(true);
CREATE POLICY seven_readonly_select_access ON seven.social_auth_providers FOR SELECT TO seven_readonly USING(true);
CREATE POLICY seven_app_server_access ON seven.social_auth_identities FOR ALL TO seven_app USING(true) WITH CHECK(true);
CREATE POLICY seven_readonly_select_access ON seven.social_auth_identities FOR SELECT TO seven_readonly USING(true);
CREATE POLICY seven_app_server_access ON seven.social_auth_challenges FOR ALL TO seven_app USING(true) WITH CHECK(true);
