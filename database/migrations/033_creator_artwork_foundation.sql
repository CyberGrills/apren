-- 7EVEN creator profiles and African artwork submissions.
-- Repository migration only; deployment is a separate reviewed release action.
CREATE TABLE seven.creator_profiles (
  creator_id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  slug varchar(120) NOT NULL UNIQUE,
  display_name varchar(80) NOT NULL,
  city varchar(100) NOT NULL,
  region varchar(100),
  country_code char(2) NOT NULL,
  disciplines text[] NOT NULL,
  biography varchar(1500) NOT NULL,
  portfolio_urls text[] NOT NULL DEFAULT '{}',
  profile_status varchar(24) NOT NULL DEFAULT 'DRAFT' CHECK (profile_status IN ('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED','VERIFIED','REJECTED','SUSPENDED')),
  submitted_at timestamptz, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE seven.creator_profiles OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE ON seven.creator_profiles TO seven_app;
GRANT SELECT ON seven.creator_profiles TO seven_readonly;
ALTER TABLE seven.creator_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.creator_profiles FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE POLICY seven_readonly_select_access ON seven.creator_profiles FOR SELECT TO seven_readonly USING (profile_status='VERIFIED');
CREATE INDEX creator_profiles_review_queue_idx ON seven.creator_profiles(profile_status,submitted_at) WHERE profile_status='PENDING_REVIEW';

CREATE TABLE seven.creator_artworks (
  artwork_id uuid PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES seven.creator_profiles(creator_id) ON DELETE RESTRICT,
  slug varchar(140) NOT NULL UNIQUE,
  title varchar(160) NOT NULL,
  discipline varchar(40) NOT NULL CHECK (discipline IN ('DIGITAL_ART','PHOTOGRAPHY','FASHION_DESIGN','ILLUSTRATION','SCULPTURE','PAINTING','TEXTILE_ART','CRAFT','HERITAGE_STORY','OTHER')),
  description varchar(5000) NOT NULL,
  creation_year integer CHECK (creation_year BETWEEN 1000 AND 2100),
  origin jsonb NOT NULL DEFAULT '{}',
  cultural_context varchar(3000) NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  accessibility_text varchar(500) NOT NULL,
  rights jsonb NOT NULL,
  content_notice jsonb NOT NULL DEFAULT '{}',
  status varchar(24) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_UPLOAD','PENDING_REVIEW','CHANGES_REQUESTED','APPROVED','REJECTED','ARCHIVED','SUSPENDED')),
  public_active boolean NOT NULL DEFAULT false,
  confirm_public_visibility boolean NOT NULL DEFAULT false,
  submitted_at timestamptz, reviewed_at timestamptz, published_at timestamptz,
  review_version integer NOT NULL DEFAULT 0,
  review_feedback jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT public_active OR (status='APPROVED' AND published_at IS NOT NULL))
);
ALTER TABLE seven.creator_artworks OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE ON seven.creator_artworks TO seven_app;
GRANT SELECT ON seven.creator_artworks TO seven_readonly;
ALTER TABLE seven.creator_artworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.creator_artworks FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE POLICY seven_readonly_select_access ON seven.creator_artworks FOR SELECT TO seven_readonly USING (
  public_active AND status='APPROVED' AND EXISTS (SELECT 1 FROM seven.creator_profiles c WHERE c.creator_id=creator_artworks.creator_id AND c.profile_status='VERIFIED')
);
CREATE INDEX creator_artworks_creator_status_idx ON seven.creator_artworks(creator_id,status,updated_at DESC);
CREATE INDEX creator_artworks_public_feed_idx ON seven.creator_artworks(published_at DESC,artwork_id DESC) WHERE public_active AND status='APPROVED';

CREATE TABLE seven.creator_artwork_media (
  media_id uuid PRIMARY KEY,
  artwork_id uuid NOT NULL REFERENCES seven.creator_artworks(artwork_id) ON DELETE RESTRICT,
  uploaded_by uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  storage_bucket varchar(100) NOT NULL DEFAULT 'creator-artwork-media',
  storage_path varchar(700) NOT NULL UNIQUE,
  original_filename varchar(255) NOT NULL,
  mime_type varchar(80) NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  caption varchar(300) NOT NULL DEFAULT '',
  accessibility_text varchar(500) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'PENDING_UPLOAD' CHECK (status IN ('PENDING_UPLOAD','READY_FOR_REVIEW','REMOVED')),
  upload_expires_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE seven.creator_artwork_media OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE ON seven.creator_artwork_media TO seven_app;
GRANT SELECT ON seven.creator_artwork_media TO seven_readonly;
ALTER TABLE seven.creator_artwork_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.creator_artwork_media FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE POLICY seven_readonly_select_access ON seven.creator_artwork_media FOR SELECT TO seven_readonly USING (
  status='READY_FOR_REVIEW' AND EXISTS (
    SELECT 1 FROM seven.creator_artworks a JOIN seven.creator_profiles c USING(creator_id)
    WHERE a.artwork_id=creator_artwork_media.artwork_id AND a.public_active AND a.status='APPROVED' AND c.profile_status='VERIFIED'
  )
);
CREATE INDEX creator_artwork_media_artwork_idx ON seven.creator_artwork_media(artwork_id,status,sort_order);
CREATE UNIQUE INDEX creator_artwork_one_cover_idx ON seven.creator_artwork_media(artwork_id) WHERE is_cover AND status='READY_FOR_REVIEW';
DO $creator_artwork_storage$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    VALUES ('creator-artwork-media','creator-artwork-media',false,10485760,ARRAY['image/jpeg','image/png','image/webp','image/avif']::text[])
    ON CONFLICT(id) DO NOTHING;
  END IF;
END;
$creator_artwork_storage$;
COMMENT ON TABLE seven.creator_profiles IS 'Creator applications; only verified profiles are public.';
COMMENT ON TABLE seven.creator_artworks IS 'Creator-submitted African artworks; approval publishes only after rights gates.';
COMMENT ON TABLE seven.creator_artwork_media IS 'Private creator media; public projections expose approved artwork only.';
