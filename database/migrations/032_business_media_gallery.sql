-- Business photo gallery schema and private storage bucket.
-- This file is a repository change only; deployment migration execution is a separate release action.
CREATE TABLE seven.business_media (
  media_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES seven.businesses(business_id) ON DELETE RESTRICT,
  uploaded_by uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  storage_bucket varchar(100) NOT NULL DEFAULT 'business-property-photos',
  storage_path varchar(700) NOT NULL UNIQUE,
  original_filename varchar(255) NOT NULL,
  mime_type varchar(80) NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  caption varchar(300) NOT NULL DEFAULT '',
  alt_text varchar(300) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'PENDING_UPLOAD'
    CHECK (status IN ('PENDING_UPLOAD','PENDING_REVIEW','APPROVED','REJECTED','REMOVED')),
  upload_expires_at timestamptz,
  rejection_reason varchar(500),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_cover boolean NOT NULL DEFAULT false,
  replaced_media_id uuid REFERENCES seven.business_media(media_id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'REJECTED' AND rejection_reason IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL) OR status <> 'REJECTED'),
  CHECK ((status = 'APPROVED' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL) OR status <> 'APPROVED')
);
ALTER TABLE seven.business_media OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE ON seven.business_media TO seven_app;
GRANT SELECT ON seven.business_media TO seven_readonly;
ALTER TABLE seven.business_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.business_media FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE POLICY seven_readonly_approved_media ON seven.business_media FOR SELECT TO seven_readonly USING (status = 'APPROVED');
CREATE INDEX business_media_business_status_order_idx ON seven.business_media(business_id,status,sort_order,created_at);
CREATE INDEX business_media_review_queue_idx ON seven.business_media(status,created_at) WHERE status = 'PENDING_REVIEW';
CREATE UNIQUE INDEX business_media_one_approved_cover_per_business_idx ON seven.business_media(business_id) WHERE is_cover AND status = 'APPROVED';
DO $business_media_storage$
BEGIN
  -- Supabase provides storage.buckets; plain PostgreSQL migration tests do not.
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
    VALUES ('business-property-photos','business-property-photos',false,10485760,ARRAY['image/jpeg','image/png','image/webp','image/avif']::text[])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$business_media_storage$;
COMMENT ON TABLE seven.business_media IS 'Business-owned property photos; public listing projections may expose approved media only.';
