-- Optional guest profile details. Existing accounts remain valid and fields are not inferred.
ALTER TABLE seven.users
  ADD COLUMN IF NOT EXISTS profile_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE seven.users
  ADD CONSTRAINT users_profile_details_object
  CHECK (jsonb_typeof(profile_details) = 'object');
COMMENT ON COLUMN seven.users.profile_details IS
  'Optional guest-provided preferences and profile details; never use as verified identity evidence.';
