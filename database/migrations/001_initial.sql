-- 7even initial schema. New empty database; no legacy records are imported.
-- Estimated first release: <100,000 reservations/year; append-only journals grow with effects.
-- PII: account email/name and reservation contact notes. Retention requires production policy review.
-- All timestamps are timestamptz; app maintains updated_at. UUIDs are externally generated opaque IDs.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='seven_owner') THEN CREATE ROLE seven_owner NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='seven_app') THEN CREATE ROLE seven_app NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='seven_readonly') THEN CREATE ROLE seven_readonly NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS seven AUTHORIZATION seven_owner;
GRANT USAGE ON SCHEMA seven TO seven_app, seven_readonly;
CREATE TABLE seven.roles (
 role_id bigint GENERATED ALWAYS AS IDENTITY,
 role_code varchar(40) NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT roles_pk PRIMARY KEY (role_id),
 CONSTRAINT roles_code_uk UNIQUE (role_code)
);
ALTER TABLE seven.roles OWNER TO seven_owner;
GRANT SELECT ON seven.roles TO seven_app, seven_readonly;
COMMENT ON TABLE seven.roles IS 'Versioned active lookup of roles; retained codes preserve history.';
INSERT INTO seven.roles (role_code) VALUES ('CUSTOMER'),('BUSINESS_OWNER'),('RECEPTION'),('ADMIN') ON CONFLICT (role_code) DO NOTHING;
CREATE TABLE seven.workflow_states (
 workflow_state_id bigint GENERATED ALWAYS AS IDENTITY,
 workflow_state_code varchar(40) NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT workflow_states_pk PRIMARY KEY (workflow_state_id),
 CONSTRAINT workflow_states_code_uk UNIQUE (workflow_state_code)
);
ALTER TABLE seven.workflow_states OWNER TO seven_owner;
GRANT SELECT ON seven.workflow_states TO seven_app, seven_readonly;
COMMENT ON TABLE seven.workflow_states IS 'Versioned active lookup of workflow_states; retained codes preserve history.';
INSERT INTO seven.workflow_states (workflow_state_code) VALUES ('PENDING'),('ACTIVE'),('APPROVED'),('SUSPENDED'),('REJECTED'),('HELD'),('CONFIRMED'),('CHECKED_IN'),('COMPLETED'),('CANCELLED'),('EXPIRED'),('FAILED'),('UNKNOWN'),('PAID_REVIEW_REQUIRED'),('SUCCESSFUL'),('SETTLED'),('FLAGGED'),('REQUESTED'),('DISPATCHED'),('INITIATED'),('DELIVERED'),('CONSUMED'),('PROPOSED'),('ACCEPTED'),('DECLINED'),('UNPAID'),('PAID'),('REFUND_PENDING'),('REFUNDED'),('REVIEW_REQUIRED'),('UNSETTLED'),('FULFILLED'),('PAYMENT_REVIEW'),('AVAILABLE'),('LOCKED'),('REVOKED') ON CONFLICT (workflow_state_code) DO NOTHING;
CREATE TABLE seven.sectors (
 sector_id bigint GENERATED ALWAYS AS IDENTITY,
 sector_code varchar(40) NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT sectors_pk PRIMARY KEY (sector_id),
 CONSTRAINT sectors_code_uk UNIQUE (sector_code)
);
ALTER TABLE seven.sectors OWNER TO seven_owner;
GRANT SELECT ON seven.sectors TO seven_app, seven_readonly;
COMMENT ON TABLE seven.sectors IS 'Versioned active lookup of sectors; retained codes preserve history.';
INSERT INTO seven.sectors (sector_code) VALUES ('STAY'),('DINING'),('EXPERIENCE') ON CONFLICT (sector_code) DO NOTHING;
CREATE TABLE seven.exchange_kinds (
 exchange_kind_id bigint GENERATED ALWAYS AS IDENTITY,
 exchange_kind_code varchar(40) NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT exchange_kinds_pk PRIMARY KEY (exchange_kind_id),
 CONSTRAINT exchange_kinds_code_uk UNIQUE (exchange_kind_code)
);
ALTER TABLE seven.exchange_kinds OWNER TO seven_owner;
GRANT SELECT ON seven.exchange_kinds TO seven_app, seven_readonly;
COMMENT ON TABLE seven.exchange_kinds IS 'Versioned active lookup of exchange_kinds; retained codes preserve history.';
INSERT INTO seven.exchange_kinds (exchange_kind_code) VALUES ('GIFT'),('SWAP') ON CONFLICT (exchange_kind_code) DO NOTHING;
CREATE TABLE seven.users (
 user_id uuid NOT NULL,
 email varchar(320) NOT NULL UNIQUE, display_name varchar(160) NOT NULL, phone varchar(30) NOT NULL DEFAULT '', password_hash varchar(256) NOT NULL, role_id bigint NOT NULL REFERENCES seven.roles(role_id) ON DELETE RESTRICT, is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT users_pk PRIMARY KEY (user_id)
);
ALTER TABLE seven.users OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.users TO seven_app;
GRANT SELECT ON seven.users TO seven_readonly;
COMMENT ON TABLE seven.users IS 'Accounts; password hashes are never projected to clients.';
CREATE TABLE seven.sessions (
 session_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES seven.users (user_id) ON DELETE RESTRICT, token_hash varchar(64) NOT NULL UNIQUE, csrf_hash varchar(64) NOT NULL, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT sessions_pk PRIMARY KEY (session_id)
);
ALTER TABLE seven.sessions OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.sessions TO seven_app;
GRANT SELECT ON seven.sessions TO seven_readonly;
COMMENT ON TABLE seven.sessions IS 'Opaque session hashes and anti-CSRF token hashes; no plaintext session token storage.';
CREATE TABLE seven.businesses (
 business_id uuid NOT NULL,
 business_name varchar(180) NOT NULL, slug varchar(100) NOT NULL UNIQUE, city varchar(120) NOT NULL, description varchar(4000) NOT NULL DEFAULT '', workflow_state_id bigint NOT NULL REFERENCES seven.workflow_states(workflow_state_id) ON DELETE RESTRICT, subaccount_id varchar(100), bank_revision integer NOT NULL DEFAULT 0, revision integer NOT NULL DEFAULT 1, details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT businesses_pk PRIMARY KEY (business_id)
);
ALTER TABLE seven.businesses OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.businesses TO seven_app;
GRANT SELECT ON seven.businesses TO seven_readonly;
COMMENT ON TABLE seven.businesses IS 'Tenant authority and approved business settlement mapping; bank revisions are immutable per checkout.';
CREATE TABLE seven.venues (
 venue_id uuid NOT NULL,
 business_id uuid NOT NULL REFERENCES seven.businesses (business_id) ON DELETE RESTRICT, venue_name varchar(180) NOT NULL, address_line varchar(500) NOT NULL, city varchar(120) NOT NULL, timezone_name varchar(80) NOT NULL DEFAULT 'Africa/Lagos',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT venues_pk PRIMARY KEY (venue_id)
);
ALTER TABLE seven.venues OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.venues TO seven_app;
GRANT SELECT ON seven.venues TO seven_readonly;
COMMENT ON TABLE seven.venues IS 'Business venues use explicit IANA timezone for availability.';
CREATE TABLE seven.memberships (
 membership_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES seven.users (user_id) ON DELETE RESTRICT, business_id uuid NOT NULL REFERENCES seven.businesses (business_id) ON DELETE RESTRICT, role_id bigint NOT NULL REFERENCES seven.roles(role_id) ON DELETE RESTRICT, is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT memberships_pk PRIMARY KEY (membership_id), CONSTRAINT memberships_user_business_uk UNIQUE(user_id,business_id)
);
ALTER TABLE seven.memberships OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.memberships TO seven_app;
GRANT SELECT ON seven.memberships TO seven_readonly;
COMMENT ON TABLE seven.memberships IS 'Tenant-scoped business and reception capabilities.';
CREATE TABLE seven.offerings (
 offering_id uuid NOT NULL,
 business_id uuid NOT NULL REFERENCES seven.businesses (business_id) ON DELETE RESTRICT, venue_id uuid NULL REFERENCES seven.venues (venue_id) ON DELETE RESTRICT, sector_id bigint NOT NULL REFERENCES seven.sectors(sector_id) ON DELETE RESTRICT, title varchar(180) NOT NULL, description varchar(5000) NOT NULL, city varchar(120) NOT NULL, price_minor bigint NOT NULL CHECK(price_minor >= 0), discount_minor bigint NOT NULL DEFAULT 0 CHECK(discount_minor >= 0), tax_bps integer NOT NULL DEFAULT 0 CHECK(tax_bps >= 0 AND tax_bps <= 10000), currency_code varchar(3) NOT NULL DEFAULT 'NGN', is_published boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1, details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT offerings_pk PRIMARY KEY (offering_id)
);
ALTER TABLE seven.offerings OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.offerings TO seven_app;
GRANT SELECT ON seven.offerings TO seven_readonly;
COMMENT ON TABLE seven.offerings IS 'Hospitality offerings with exact integer minor-unit service prices and bounded terms.';
CREATE TABLE seven.inventory_windows (
 inventory_window_id uuid NOT NULL,
 offering_id uuid NOT NULL REFERENCES seven.offerings (offering_id) ON DELETE RESTRICT, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, capacity integer NOT NULL CHECK(capacity>=0), allocated_count integer NOT NULL DEFAULT 0 CHECK(allocated_count>=0 AND allocated_count<=capacity), revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT inventory_windows_pk PRIMARY KEY (inventory_window_id), CONSTRAINT inventory_windows_offering_start_uk UNIQUE(offering_id,starts_at), CONSTRAINT inventory_windows_interval_ck CHECK(ends_at>starts_at)
);
ALTER TABLE seven.inventory_windows OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.inventory_windows TO seven_app;
GRANT SELECT ON seven.inventory_windows TO seven_readonly;
COMMENT ON TABLE seven.inventory_windows IS 'Authoritative room-night, sitting or occurrence capacity locked during all allocations.';
CREATE TABLE seven.quotes (
 quote_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES seven.users (user_id) ON DELETE RESTRICT, offering_id uuid NOT NULL REFERENCES seven.offerings (offering_id) ON DELETE RESTRICT, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, quantity integer NOT NULL CHECK(quantity>0), amounts jsonb NOT NULL, inventory_ids jsonb NOT NULL, expires_at timestamptz NOT NULL, terms_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT quotes_pk PRIMARY KEY (quote_id)
);
ALTER TABLE seven.quotes OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.quotes TO seven_app;
GRANT SELECT ON seven.quotes TO seven_readonly;
COMMENT ON TABLE seven.quotes IS 'Immutable server quote snapshots; quoting does not allocate inventory.';
CREATE TABLE seven.reservations (
 reservation_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES seven.users (user_id) ON DELETE RESTRICT, business_id uuid NOT NULL REFERENCES seven.businesses (business_id) ON DELETE RESTRICT, offering_id uuid NOT NULL REFERENCES seven.offerings (offering_id) ON DELETE RESTRICT, quote_id uuid NOT NULL REFERENCES seven.quotes (quote_id) ON DELETE RESTRICT, workflow_state_id bigint NOT NULL REFERENCES seven.workflow_states(workflow_state_id) ON DELETE RESTRICT, payment_state_id bigint NOT NULL REFERENCES seven.workflow_states(workflow_state_id) ON DELETE RESTRICT, expires_at timestamptz NOT NULL, revision integer NOT NULL DEFAULT 1, service_notes varchar(1000) NOT NULL DEFAULT '', is_walk_in boolean NOT NULL DEFAULT false, fulfilled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT reservations_pk PRIMARY KEY (reservation_id), CONSTRAINT reservations_quote_uk UNIQUE(quote_id)
);
ALTER TABLE seven.reservations OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.reservations TO seven_app;
GRANT SELECT ON seven.reservations TO seven_readonly;
COMMENT ON TABLE seven.reservations IS 'Reservation state is independent of provider payment and bank settlement.';
CREATE TABLE seven.allocations (
 allocation_id uuid NOT NULL,
 reservation_id uuid NOT NULL REFERENCES seven.reservations (reservation_id) ON DELETE RESTRICT, inventory_window_id uuid NOT NULL REFERENCES seven.inventory_windows (inventory_window_id) ON DELETE RESTRICT, quantity integer NOT NULL CHECK(quantity>0), is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT allocations_pk PRIMARY KEY (allocation_id), CONSTRAINT allocations_reservation_window_uk UNIQUE(reservation_id,inventory_window_id)
);
ALTER TABLE seven.allocations OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.allocations TO seven_app;
GRANT SELECT ON seven.allocations TO seven_readonly;
COMMENT ON TABLE seven.allocations IS 'Each hold/confirmed allocation releases once; inactive rows retain history.';
CREATE TABLE seven.payment_attempts (
 payment_attempt_id uuid NOT NULL,
 reservation_id uuid NOT NULL REFERENCES seven.reservations (reservation_id) ON DELETE RESTRICT, merchant_reference varchar(100) NOT NULL UNIQUE, provider_transaction_id varchar(100) UNIQUE, workflow_state_id bigint NOT NULL REFERENCES seven.workflow_states(workflow_state_id) ON DELETE RESTRICT, settlement_state_id bigint NOT NULL REFERENCES seven.workflow_states(workflow_state_id) ON DELETE RESTRICT, currency_code varchar(3) NOT NULL, amount_minor bigint NOT NULL CHECK(amount_minor>0), commission_minor bigint NOT NULL CHECK(commission_minor>=0), business_subaccount varchar(100) NOT NULL, bank_revision integer NOT NULL, checkout_url varchar(2048), provider_details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT payment_attempts_pk PRIMARY KEY (payment_attempt_id)
);
ALTER TABLE seven.payment_attempts OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.payment_attempts TO seven_app;
GRANT SELECT ON seven.payment_attempts TO seven_readonly;
COMMENT ON TABLE seven.payment_attempts IS 'Immutable checkout binding and separately verified provider receipt/settlement.';
CREATE TABLE seven.refunds (
 refund_id uuid NOT NULL,
 payment_attempt_id uuid NOT NULL REFERENCES seven.payment_attempts (payment_attempt_id) ON DELETE RESTRICT, amount_minor bigint NOT NULL CHECK(amount_minor>0), workflow_state_id bigint NOT NULL REFERENCES seven.workflow_states(workflow_state_id) ON DELETE RESTRICT, provider_refund_id varchar(100), reason varchar(1000) NOT NULL, operation_reference varchar(100) NOT NULL UNIQUE, provider_details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT refunds_pk PRIMARY KEY (refund_id)
);
ALTER TABLE seven.refunds OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.refunds TO seven_app;
GRANT SELECT ON seven.refunds TO seven_readonly;
COMMENT ON TABLE seven.refunds IS 'Durable refund intent; dispatched uncertainty forbids blind retry.';
CREATE TABLE seven.money_journals (
 money_journal_id uuid NOT NULL,
 source_reference varchar(180) NOT NULL UNIQUE, currency_code varchar(3) NOT NULL, description varchar(500) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT money_journals_pk PRIMARY KEY (money_journal_id)
);
ALTER TABLE seven.money_journals OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.money_journals TO seven_app;
GRANT SELECT ON seven.money_journals TO seven_readonly;
COMMENT ON TABLE seven.money_journals IS 'Immutable balanced monetary event headers by currency; corrections compensate.';
CREATE TABLE seven.money_postings (
 money_posting_id uuid NOT NULL,
 money_journal_id uuid NOT NULL REFERENCES seven.money_journals (money_journal_id) ON DELETE RESTRICT, account_code varchar(180) NOT NULL, amount_minor bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT money_postings_pk PRIMARY KEY (money_posting_id)
);
ALTER TABLE seven.money_postings OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.money_postings TO seven_app;
GRANT SELECT ON seven.money_postings TO seven_readonly;
COMMENT ON TABLE seven.money_postings IS 'Signed exact monetary postings; deferred balance trigger enforces zero sum.';
CREATE TABLE seven.points_journals (
 points_journal_id uuid NOT NULL,
 source_reference varchar(180) NOT NULL UNIQUE, description varchar(500) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT points_journals_pk PRIMARY KEY (points_journal_id)
);
ALTER TABLE seven.points_journals OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.points_journals TO seven_app;
GRANT SELECT ON seven.points_journals TO seven_readonly;
COMMENT ON TABLE seven.points_journals IS 'Immutable integer points journal headers; no cash conversion implied.';
CREATE TABLE seven.points_postings (
 points_posting_id uuid NOT NULL,
 points_journal_id uuid NOT NULL REFERENCES seven.points_journals (points_journal_id) ON DELETE RESTRICT, account_code varchar(180) NOT NULL, points bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT points_postings_pk PRIMARY KEY (points_posting_id)
);
ALTER TABLE seven.points_postings OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.points_postings TO seven_app;
GRANT SELECT ON seven.points_postings TO seven_readonly;
COMMENT ON TABLE seven.points_postings IS 'Signed integer points postings; customer accounts may have nonspendable reversal shortfall.';
CREATE TABLE seven.rewards (
 reward_id uuid NOT NULL,
 business_id uuid NOT NULL REFERENCES seven.businesses (business_id) ON DELETE RESTRICT, title varchar(180) NOT NULL, description varchar(2000) NOT NULL, points_cost integer NOT NULL CHECK(points_cost>0), remaining_count integer NOT NULL CHECK(remaining_count>=0), expires_at timestamptz NOT NULL, is_transferable boolean NOT NULL DEFAULT false, is_published boolean NOT NULL DEFAULT true, initial_capacity integer NOT NULL DEFAULT 0, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT rewards_pk PRIMARY KEY (reward_id)
);
ALTER TABLE seven.rewards OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.rewards TO seven_app;
GRANT SELECT ON seven.rewards TO seven_readonly;
COMMENT ON TABLE seven.rewards IS 'Business-funded benefit inventory and transfer eligibility.';
CREATE TABLE seven.entitlements (
 entitlement_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES seven.users (user_id) ON DELETE RESTRICT, business_id uuid NOT NULL REFERENCES seven.businesses (business_id) ON DELETE RESTRICT, reward_id uuid NOT NULL REFERENCES seven.rewards (reward_id) ON DELETE RESTRICT, workflow_state_id bigint NOT NULL REFERENCES seven.workflow_states(workflow_state_id) ON DELETE RESTRICT, expires_at timestamptz NOT NULL, is_transferable boolean NOT NULL, is_locked boolean NOT NULL DEFAULT false, redemption_code varchar(80) NOT NULL UNIQUE, revision integer NOT NULL DEFAULT 1, source_reference varchar(180) NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT entitlements_pk PRIMARY KEY (entitlement_id)
);
ALTER TABLE seven.entitlements OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.entitlements TO seven_app;
GRANT SELECT ON seven.entitlements TO seven_readonly;
COMMENT ON TABLE seven.entitlements IS 'One current owner per redeemed benefit; bookings are not exchangeable entitlements.';
CREATE TABLE seven.exchanges (
 exchange_id uuid NOT NULL,
 proposer_user_id uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT, recipient_user_id uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT, entitlement_id uuid NOT NULL REFERENCES seven.entitlements(entitlement_id) ON DELETE RESTRICT, desired_entitlement_id uuid REFERENCES seven.entitlements(entitlement_id) ON DELETE RESTRICT, revision integer NOT NULL DEFAULT 1, exchange_kind_id bigint NOT NULL REFERENCES seven.exchange_kinds(exchange_kind_id) ON DELETE RESTRICT, workflow_state_id bigint NOT NULL REFERENCES seven.workflow_states(workflow_state_id) ON DELETE RESTRICT, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT exchanges_pk PRIMARY KEY (exchange_id)
);
ALTER TABLE seven.exchanges OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.exchanges TO seven_app;
GRANT SELECT ON seven.exchanges TO seven_readonly;
COMMENT ON TABLE seven.exchanges IS 'Gift/swap proposals lock transferable unconsumed benefits; acceptance changes ownership atomically.';
CREATE TABLE seven.idempotencies (
 idempotency_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES seven.users (user_id) ON DELETE RESTRICT, operation_key varchar(200) NOT NULL, operation_name varchar(100) NOT NULL, payload_hash varchar(64) NOT NULL, response_body jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT idempotencies_pk PRIMARY KEY (idempotency_id), CONSTRAINT idempotencies_actor_key_uk UNIQUE(user_id,operation_key)
);
ALTER TABLE seven.idempotencies OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.idempotencies TO seven_app;
GRANT SELECT ON seven.idempotencies TO seven_readonly;
COMMENT ON TABLE seven.idempotencies IS 'Actor-scoped durable replay keys bind operation and payload.';
CREATE TABLE seven.audit_events (
 audit_event_id uuid NOT NULL,
 user_id uuid NULL REFERENCES seven.users (user_id) ON DELETE RESTRICT, business_id uuid NULL REFERENCES seven.businesses (business_id) ON DELETE RESTRICT, action_code varchar(100) NOT NULL, resource_id varchar(100), details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT audit_events_pk PRIMARY KEY (audit_event_id)
);
ALTER TABLE seven.audit_events OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.audit_events TO seven_app;
GRANT SELECT ON seven.audit_events TO seven_readonly;
COMMENT ON TABLE seven.audit_events IS 'Attributable append-only audit with redacted business context.';
CREATE TABLE seven.outbox_events (
 outbox_event_id uuid NOT NULL,
 business_id uuid NULL REFERENCES seven.businesses (business_id) ON DELETE RESTRICT, event_code varchar(100) NOT NULL, details jsonb NOT NULL, processed_at timestamptz, attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error varchar(1000),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT outbox_events_pk PRIMARY KEY (outbox_event_id)
);
ALTER TABLE seven.outbox_events OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.outbox_events TO seven_app;
GRANT SELECT ON seven.outbox_events TO seven_readonly;
COMMENT ON TABLE seven.outbox_events IS 'Transactional durable follow-up records; bounded processing preserves failures.';
CREATE TABLE seven.notifications (
 notification_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES seven.users (user_id) ON DELETE RESTRICT, title varchar(180) NOT NULL, body varchar(1000) NOT NULL, read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT notifications_pk PRIMARY KEY (notification_id)
);
ALTER TABLE seven.notifications OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.notifications TO seven_app;
GRANT SELECT ON seven.notifications TO seven_readonly;
COMMENT ON TABLE seven.notifications IS 'User-scoped durable in-app notifications.';
CREATE TABLE seven.observations (
 observation_id uuid NOT NULL,
 business_id uuid NOT NULL REFERENCES seven.businesses (business_id) ON DELETE RESTRICT, offering_id uuid NULL REFERENCES seven.offerings (offering_id) ON DELETE RESTRICT, event_code varchar(60) NOT NULL, source_reference varchar(180) NOT NULL UNIQUE, observed_at timestamptz NOT NULL DEFAULT now(), is_synthetic boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT observations_pk PRIMARY KEY (observation_id)
);
ALTER TABLE seven.observations OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.observations TO seven_app;
GRANT SELECT ON seven.observations TO seven_readonly;
COMMENT ON TABLE seven.observations IS 'Measured first-party demand observations; synthetic seed records never imply live demand.';
CREATE TABLE seven.sync_events (
 sync_event_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES seven.users (user_id) ON DELETE RESTRICT, business_id uuid NOT NULL REFERENCES seven.businesses (business_id) ON DELETE RESTRICT, device_id varchar(100) NOT NULL, client_event_id varchar(100) NOT NULL, event_version integer NOT NULL, payload_hash varchar(64) NOT NULL, result_body jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT sync_events_pk PRIMARY KEY (sync_event_id), CONSTRAINT sync_events_source_uk UNIQUE(business_id,device_id,client_event_id)
);
ALTER TABLE seven.sync_events OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.sync_events TO seven_app;
GRANT SELECT ON seven.sync_events TO seven_readonly;
COMMENT ON TABLE seven.sync_events IS 'Versioned first-party reception event acknowledgments with durable replay identity.';
CREATE TABLE seven.provider_events (
 provider_event_id uuid NOT NULL,
 event_reference varchar(180) NOT NULL UNIQUE, event_code varchar(100) NOT NULL, details jsonb NOT NULL, processed_at timestamptz, attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error varchar(1000),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT provider_events_pk PRIMARY KEY (provider_event_id)
);
ALTER TABLE seven.provider_events OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.provider_events TO seven_app;
GRANT SELECT ON seven.provider_events TO seven_readonly;
COMMENT ON TABLE seven.provider_events IS 'Authenticated redacted provider inbox; persisted before webhook acknowledgment.';
-- Indexed by actual operational queue, foreign-owner and date-range access patterns.
CREATE INDEX reservations_business_created_idx ON seven.reservations(business_id,created_at DESC);
CREATE INDEX reservations_user_created_idx ON seven.reservations(user_id,created_at DESC);
CREATE INDEX reservations_expiry_idx ON seven.reservations(expires_at,workflow_state_id);
CREATE INDEX offerings_business_published_idx ON seven.offerings(business_id,is_published);
CREATE INDEX allocations_window_active_idx ON seven.allocations(inventory_window_id) WHERE is_active;
CREATE INDEX points_postings_account_idx ON seven.points_postings(account_code);
CREATE INDEX money_postings_account_idx ON seven.money_postings(account_code);
CREATE INDEX notifications_user_created_idx ON seven.notifications(user_id,created_at DESC);
CREATE INDEX observations_business_date_idx ON seven.observations(business_id,observed_at);
CREATE INDEX outbox_pending_idx ON seven.outbox_events(next_attempt_at) WHERE processed_at IS NULL;
CREATE INDEX provider_pending_idx ON seven.provider_events(next_attempt_at) WHERE processed_at IS NULL;
CREATE INDEX sessions_expiry_idx ON seven.sessions(expires_at);
CREATE INDEX entitlements_owner_idx ON seven.entitlements(user_id,created_at DESC);

CREATE FUNCTION seven.enforce_money_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT coalesce(sum(amount_minor),0) FROM seven.money_postings WHERE money_journal_id=NEW.money_journal_id)<>0 THEN RAISE EXCEPTION 'Unbalanced monetary journal'; END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION seven.enforce_money_balance() OWNER TO seven_owner;
CREATE CONSTRAINT TRIGGER money_journal_balance AFTER INSERT ON seven.money_postings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION seven.enforce_money_balance();
CREATE FUNCTION seven.enforce_points_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT coalesce(sum(points),0) FROM seven.points_postings WHERE points_journal_id=NEW.points_journal_id)<>0 THEN RAISE EXCEPTION 'Unbalanced points journal'; END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION seven.enforce_points_balance() OWNER TO seven_owner;
CREATE CONSTRAINT TRIGGER points_journal_balance AFTER INSERT ON seven.points_postings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION seven.enforce_points_balance();

CREATE TABLE seven.policies (
 policy_id bigint GENERATED ALWAYS AS IDENTITY,
 earn_spend_minor bigint NOT NULL CHECK(earn_spend_minor>0), earn_points integer NOT NULL CHECK(earn_points>0),
 hold_minutes integer NOT NULL CHECK(hold_minutes>0), reason varchar(500) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT policies_pk PRIMARY KEY(policy_id)
);
ALTER TABLE seven.policies OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.policies TO seven_app;
GRANT SELECT ON seven.policies TO seven_readonly;
COMMENT ON TABLE seven.policies IS 'Immutable points/hold policy versions; 10 percent service commission is fixed in engine.';
INSERT INTO seven.policies(earn_spend_minor,earn_points,hold_minutes,reason) VALUES(100000,10,15,'Initial development policy; review before real customers.');
CREATE TABLE seven.sources (
 source_id uuid NOT NULL, business_id uuid NOT NULL REFERENCES seven.businesses(business_id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT, is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT sources_pk PRIMARY KEY(source_id), CONSTRAINT sources_business_user_uk UNIQUE(business_id,user_id)
);
ALTER TABLE seven.sources OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE ON seven.sources TO seven_app;
GRANT SELECT ON seven.sources TO seven_readonly;
COMMENT ON TABLE seven.sources IS 'First-party reception source identity bound to authenticated user and tenant.';
