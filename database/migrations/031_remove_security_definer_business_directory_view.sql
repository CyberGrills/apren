-- A public SECURITY DEFINER view was evaluated during Preview work and removed.
-- The directory is served through the authenticated server database role instead.
-- This defensive drop keeps the public schema free of that view on every environment.
DROP VIEW IF EXISTS public.seven_business_directory;
