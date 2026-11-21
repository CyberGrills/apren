-- Customer-owned profile avatars in private Supabase Storage.
-- Repository migration only; production execution is a separately approved release action.
CREATE TABLE seven.customer_profile_media (
  media_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  storage_bucket varchar(100) NOT NULL DEFAULT 'customer-profile-photos',
  storage_path varchar(700) NOT NULL UNIQUE,
  mime_type varchar(80) NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 5242880),
  status varchar(24) NOT NULL DEFAULT 'PENDING_UPLOAD'
    CHECK (status IN ('PENDING_UPLOAD','CURRENT','REPLACED','REMOVED')),
  upload_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE seven.customer_profile_media OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE ON seven.customer_profile_media TO seven_app;
GRANT SELECT ON seven.customer_profile_media TO seven_readonly;
ALTER TABLE seven.customer_profile_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.customer_profile_media FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE POLICY seven_readonly_no_access ON seven.customer_profile_media FOR SELECT TO seven_readonly USING (false);
CREATE UNIQUE INDEX customer_profile_media_one_current_per_user_idx
  ON seven.customer_profile_media(user_id) WHERE status = 'CURRENT';
CREATE INDEX customer_profile_media_user_status_idx
  ON seven.customer_profile_media(user_id,status,created_at DESC);
DO $customer_profile_storage$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
    VALUES ('customer-profile-photos','customer-profile-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp','image/avif']::text[])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$customer_profile_storage$;
COMMENT ON TABLE seven.customer_profile_media IS 'Private customer-owned profile avatars; only the owning customer receives short-lived signed image URLs.';
