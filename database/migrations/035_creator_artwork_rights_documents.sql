-- Private supporting documents for creator artwork rights and community permissions.
-- Repository migration only; production execution requires a separate approved release.
CREATE TABLE seven.creator_artwork_rights_documents (
  document_id uuid PRIMARY KEY,
  artwork_id uuid NOT NULL REFERENCES seven.creator_artworks(artwork_id) ON DELETE RESTRICT,
  evidence_id uuid REFERENCES seven.creator_artwork_rights_evidence(evidence_id) ON DELETE RESTRICT,
  permission_id uuid REFERENCES seven.creator_artwork_community_permissions(permission_id) ON DELETE RESTRICT,
  uploaded_by uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  storage_bucket varchar(100) NOT NULL DEFAULT 'creator-artwork-rights-documents',
  storage_path varchar(700) NOT NULL UNIQUE,
  original_filename varchar(255) NOT NULL,
  mime_type varchar(80) NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 15728640),
  status varchar(24) NOT NULL DEFAULT 'PENDING_UPLOAD' CHECK (status IN ('PENDING_UPLOAD','AVAILABLE','REMOVED')),
  upload_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((evidence_id IS NOT NULL) <> (permission_id IS NOT NULL))
);
ALTER TABLE seven.creator_artwork_rights_documents OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE ON seven.creator_artwork_rights_documents TO seven_app;
ALTER TABLE seven.creator_artwork_rights_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.creator_artwork_rights_documents FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE INDEX creator_artwork_rights_documents_artwork_idx ON seven.creator_artwork_rights_documents(artwork_id,status,created_at DESC);
CREATE INDEX creator_artwork_rights_documents_evidence_idx ON seven.creator_artwork_rights_documents(evidence_id,status) WHERE evidence_id IS NOT NULL;
CREATE INDEX creator_artwork_rights_documents_permission_idx ON seven.creator_artwork_rights_documents(permission_id,status) WHERE permission_id IS NOT NULL;
DO $creator_rights_storage$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    VALUES ('creator-artwork-rights-documents','creator-artwork-rights-documents',false,15728640,ARRAY['application/pdf','image/jpeg','image/png']::text[])
    ON CONFLICT(id) DO NOTHING;
  END IF;
END;
$creator_rights_storage$;
COMMENT ON TABLE seven.creator_artwork_rights_documents IS 'Private, non-public licence, ownership and community-permission evidence documents.';
