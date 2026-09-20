-- Supabase can explicitly grant EXECUTE to anon when creating new functions.
-- This incremental migration closes the privilege on environments that already
-- applied the earlier roster-date migration, without touching roster records.
BEGIN;
REVOKE ALL ON FUNCTION public.iq_v3_update_roster_start(uuid,uuid,date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iq_v3_update_roster_start(uuid,uuid,date)
  TO authenticated;
COMMIT;
