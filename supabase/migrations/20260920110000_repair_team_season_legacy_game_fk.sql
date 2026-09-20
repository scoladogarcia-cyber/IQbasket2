-- Non-destructive compatibility repair: games.season_id -> seasons.id,
-- whereas team_seasons.season_id -> season_catalog.id. Never put the catalog
-- UUID in games.season_id. Preserve games, statistics and previous seasons.
BEGIN;

-- Invoker helper: callable by the migration owner or from the existing
-- SUPERADMIN-only SECURITY DEFINER link RPC. No direct client grants.
CREATE OR REPLACE FUNCTION public.iq_v3_attach_legacy_season(
  p_team_season_id uuid
)
RETURNS public.team_seasons
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  scope_row public.team_seasons;
  catalog_row public.season_catalog;
  legacy_id uuid;
  candidates integer;
BEGIN
  SELECT * INTO scope_row
  FROM public.team_seasons
  WHERE id = p_team_season_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEAM_SEASON_NOT_FOUND'; END IF;

  SELECT * INTO catalog_row
  FROM public.season_catalog
  WHERE id = scope_row.season_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GLOBAL_SEASON_NOT_FOUND'; END IF;

  IF scope_row.legacy_season_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.seasons s
      WHERE s.id = scope_row.legacy_season_id
        AND s.team_id = scope_row.team_id
    ) THEN
      RAISE EXCEPTION 'LEGACY_SEASON_TEAM_MISMATCH';
    END IF;
    RETURN scope_row;
  END IF;

  -- Reuse a real legacy season if it is unambiguous. Formatting differences
  -- such as 2026/2027 vs 2026-2027 must not create duplicated seasons.
  -- PostgreSQL does not implement min(uuid); order the UUID array explicitly.
  SELECT count(*)::integer, (array_agg(s.id ORDER BY s.created_at, s.id))[1]
  INTO candidates, legacy_id
  FROM public.seasons s
  WHERE s.team_id = scope_row.team_id
    AND regexp_replace(lower(s.name), '[^a-z0-9]', '', 'g') =
        regexp_replace(lower(catalog_row.name), '[^a-z0-9]', '', 'g');

  IF candidates > 1 THEN RAISE EXCEPTION 'AMBIGUOUS_LEGACY_SEASON'; END IF;
  IF legacy_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.team_seasons other
    WHERE other.legacy_season_id = legacy_id
      AND other.id <> scope_row.id
  ) THEN
    RAISE EXCEPTION 'LEGACY_SEASON_ALREADY_LINKED';
  END IF;

  IF legacy_id IS NULL THEN
    INSERT INTO public.seasons (team_id, name, start_date, end_date)
    VALUES (
      scope_row.team_id,
      catalog_row.name,
      catalog_row.start_date,
      catalog_row.end_date
    )
    RETURNING id INTO legacy_id;
  END IF;

  UPDATE public.team_seasons
  SET legacy_season_id = legacy_id,
      updated_at = now()
  WHERE id = scope_row.id
  RETURNING * INTO scope_row;
  RETURN scope_row;
END;
$$;

REVOKE ALL ON FUNCTION public.iq_v3_attach_legacy_season(uuid)
  FROM PUBLIC, anon, authenticated;

-- Repair existing unlinked team-season rows (currently two); this helper
-- only inserts missing parent seasons and populates NULL bridge IDs.
DO $$
DECLARE
  scope_id uuid;
BEGIN
  FOR scope_id IN
    SELECT id FROM public.team_seasons
    WHERE legacy_season_id IS NULL
    ORDER BY id
  LOOP
    PERFORM public.iq_v3_attach_legacy_season(scope_id);
  END LOOP;
END;
$$;

-- Preserve existing authorization and automatic roster seeding when a team
-- is linked to a season in the future. Attach its legacy FK atomically.
CREATE OR REPLACE FUNCTION public.iq_v3_link_team_season(
  p_team_id uuid,
  p_season_id uuid
)
RETURNS public.team_seasons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result_row public.team_seasons;
  season_start date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.iq_v3_is_global_superadmin() THEN
    RAISE EXCEPTION 'SUPERADMIN_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = p_team_id) THEN
    RAISE EXCEPTION 'TEAM_NOT_FOUND';
  END IF;

  SELECT sc.start_date INTO season_start
  FROM public.season_catalog sc WHERE sc.id = p_season_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SEASON_NOT_FOUND'; END IF;

  INSERT INTO public.team_seasons (team_id, season_id, status, data_status)
  VALUES (p_team_id, p_season_id, 'ACTIVE', 'ACTIVE')
  ON CONFLICT (team_id, season_id)
  DO UPDATE SET status = 'ACTIVE', updated_at = now()
  RETURNING * INTO result_row;

  result_row := public.iq_v3_attach_legacy_season(result_row.id);

  IF NOT EXISTS (
    SELECT 1 FROM public.roster_memberships rm
    WHERE rm.team_season_id = result_row.id
  ) THEN
    PERFORM public.iq_v3_seed_team_season_roster(
      result_row.id, coalesce(season_start, current_date)
    );
  END IF;
  RETURN result_row;
END;
$$;

REVOKE ALL ON FUNCTION public.iq_v3_link_team_season(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.iq_v3_link_team_season(uuid,uuid) TO authenticated;

-- No team-season may remain without a valid parent reference after repair.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.team_seasons ts
    LEFT JOIN public.seasons s ON s.id = ts.legacy_season_id
    WHERE s.id IS NULL OR s.team_id <> ts.team_id
  ) THEN
    RAISE EXCEPTION 'TEAM_SEASON_LEGACY_BRIDGE_VERIFICATION_FAILED';
  END IF;
END;
$$;

COMMIT;
