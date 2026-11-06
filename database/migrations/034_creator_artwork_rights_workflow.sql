-- 7EVEN artwork rights evidence and cultural permission workflow.
-- Repository migration only. Production application is a separate reviewed release.
CREATE TABLE seven.creator_artwork_rights_evidence (
  evidence_id uuid PRIMARY KEY,
  artwork_id uuid NOT NULL REFERENCES seven.creator_artworks(artwork_id) ON DELETE RESTRICT,
  submitted_by uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  evidence_type varchar(32) NOT NULL CHECK (evidence_type IN ('LICENSE','OWNERSHIP','AUTHORIZED_REPRESENTATIVE','SOURCE_PERMISSION','OTHER')),
  issuer_name varchar(160) NOT NULL,
  evidence_reference varchar(500) NOT NULL,
  description varchar(1500) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW','VERIFIED','REJECTED')),
  reviewed_by uuid REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_reason varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='PENDING_REVIEW' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (status IN ('VERIFIED','REJECTED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL))
);
ALTER TABLE seven.creator_artwork_rights_evidence OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE ON seven.creator_artwork_rights_evidence TO seven_app;
ALTER TABLE seven.creator_artwork_rights_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.creator_artwork_rights_evidence FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE INDEX creator_artwork_rights_evidence_queue_idx ON seven.creator_artwork_rights_evidence(status,created_at) WHERE status='PENDING_REVIEW';
CREATE INDEX creator_artwork_rights_evidence_artwork_idx ON seven.creator_artwork_rights_evidence(artwork_id,created_at DESC);

CREATE TABLE seven.creator_artwork_community_permissions (
  permission_id uuid PRIMARY KEY,
  artwork_id uuid NOT NULL REFERENCES seven.creator_artworks(artwork_id) ON DELETE RESTRICT,
  submitted_by uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  community_name varchar(160) NOT NULL,
  authority_name varchar(160) NOT NULL,
  permission_scope varchar(1000) NOT NULL,
  evidence_reference varchar(500) NOT NULL,
  cultural_context varchar(1500) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW','APPROVED','REJECTED')),
  reviewed_by uuid REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_reason varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='PENDING_REVIEW' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (status IN ('APPROVED','REJECTED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL))
);
ALTER TABLE seven.creator_artwork_community_permissions OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE ON seven.creator_artwork_community_permissions TO seven_app;
ALTER TABLE seven.creator_artwork_community_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.creator_artwork_community_permissions FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE INDEX creator_artwork_community_permissions_queue_idx ON seven.creator_artwork_community_permissions(status,created_at) WHERE status='PENDING_REVIEW';
CREATE INDEX creator_artwork_community_permissions_artwork_idx ON seven.creator_artwork_community_permissions(artwork_id,created_at DESC);

CREATE TABLE seven.creator_artwork_attribution_reviews (
  attribution_review_id uuid PRIMARY KEY,
  artwork_id uuid NOT NULL REFERENCES seven.creator_artworks(artwork_id) ON DELETE RESTRICT,
  submitted_by uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  attribution_text varchar(300) NOT NULL,
  source_description varchar(1000) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW','VERIFIED','REJECTED')),
  reviewed_by uuid REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_reason varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='PENDING_REVIEW' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (status IN ('VERIFIED','REJECTED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL))
);
ALTER TABLE seven.creator_artwork_attribution_reviews OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE ON seven.creator_artwork_attribution_reviews TO seven_app;
ALTER TABLE seven.creator_artwork_attribution_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.creator_artwork_attribution_reviews FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE INDEX creator_artwork_attribution_reviews_artwork_idx ON seven.creator_artwork_attribution_reviews(artwork_id,created_at DESC);

CREATE TABLE seven.creator_artwork_rights_decisions (
  decision_id uuid PRIMARY KEY,
  artwork_id uuid NOT NULL REFERENCES seven.creator_artworks(artwork_id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  decision_type varchar(32) NOT NULL CHECK (decision_type IN ('EVIDENCE_SUBMITTED','EVIDENCE_VERIFIED','EVIDENCE_REJECTED','COMMUNITY_PERMISSION_SUBMITTED','COMMUNITY_PERMISSION_APPROVED','COMMUNITY_PERMISSION_REJECTED','ATTRIBUTION_SUBMITTED','ATTRIBUTION_VERIFIED','ATTRIBUTION_REJECTED','RIGHTS_HOLD','RESTORED')),
  subject_id uuid,
  reason varchar(1000) NOT NULL,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE seven.creator_artwork_rights_decisions OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.creator_artwork_rights_decisions TO seven_app;
ALTER TABLE seven.creator_artwork_rights_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.creator_artwork_rights_decisions FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE INDEX creator_artwork_rights_decisions_artwork_idx ON seven.creator_artwork_rights_decisions(artwork_id,created_at DESC);
COMMENT ON TABLE seven.creator_artwork_rights_evidence IS 'Private rights evidence metadata; never exposed through public artwork DTOs.';
COMMENT ON TABLE seven.creator_artwork_community_permissions IS 'Private community permission records and moderator decisions.';
COMMENT ON TABLE seven.creator_artwork_attribution_reviews IS 'Auditable attribution review records.';
COMMENT ON TABLE seven.creator_artwork_rights_decisions IS 'Append-only decision history for rights, permissions, attribution and restoration.';
