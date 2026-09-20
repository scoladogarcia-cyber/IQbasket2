-- Allows a roster manager to correct the START of a single, open eligibility
-- stint within its own team-season. Never changes another season or stats.
BEGIN;

CREATE OR REPLACE FUNCTION public.iq_v3_update_roster_start(
  p_team_season_id uuid,
  p_player_id uuid,
  p_new_start date
)
RETURNS public.roster_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  member_row public.roster_memberships;
  stint_row public.roster_membership_stints;
  season_start date;
  season_end date;
  data_state text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.iq_v3_can_manage_roster(p_team_season_id) THEN
    RAISE EXCEPTION 'TEAM_SEASON_MANAGE_DENIED';
  END IF;
  IF p_new_start IS NULL THEN RAISE EXCEPTION 'ROSTER_START_DATE_REQUIRED'; END IF;

  SELECT sc.start_date, sc.end_date, ts.data_status
  INTO season_start, season_end, data_state
  FROM public.team_seasons ts
  JOIN public.season_catalog sc ON sc.id = ts.season_id
  WHERE ts.id = p_team_season_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEAM_SEASON_NOT_FOUND'; END IF;
  IF upper(coalesce(data_state, 'ACTIVE')) <> 'ACTIVE' THEN
    RAISE EXCEPTION 'TEAM_SEASON_FROZEN';
  END IF;
  IF (season_start IS NOT NULL AND p_new_start < season_start)
     OR (season_end IS NOT NULL AND p_new_start > season_end) THEN
    RAISE EXCEPTION 'ROSTER_DATE_OUTSIDE_SEASON';
  END IF;

  SELECT * INTO member_row
  FROM public.roster_memberships rm
  WHERE rm.team_season_id = p_team_season_id
    AND rm.player_id = p_player_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROSTER_MEMBER_NOT_FOUND'; END IF;
  IF upper(member_row.status) NOT IN ('ACTIVE', 'ACTIVO') THEN
    RAISE EXCEPTION 'ROSTER_MEMBER_NOT_ACTIVE';
  END IF;

  -- Deliberately refuse multi-interval history; editing a past transfer or
  -- rejoin requires a dedicated workflow and must not silently shift stints.
  IF (SELECT count(*) FROM public.roster_membership_stints rs
      WHERE rs.roster_membership_id = member_row.id) <> 1 THEN
    RAISE EXCEPTION 'ROSTER_DATE_MULTI_STINT_REQUIRES_REVIEW';
  END IF;
  SELECT * INTO stint_row
  FROM public.roster_membership_stints rs
  WHERE rs.roster_membership_id = member_row.id
  FOR UPDATE;
  IF stint_row.id IS NULL OR stint_row.valid_until IS NOT NULL THEN
    RAISE EXCEPTION 'ROSTER_OPEN_STINT_REQUIRED';
  END IF;

  -- Protect existing box scores, play-by-play and starter-only appearances.
  -- Other seasons are intentionally not considered here.
  IF EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.team_season_id = p_team_season_id
      AND g.date < p_new_start
      AND (
        EXISTS (
          SELECT 1 FROM public.player_game_stats pgs
          WHERE pgs.game_id = g.id AND pgs.player_id = p_player_id
        )
        OR EXISTS (
          SELECT 1 FROM public.game_events ge
          WHERE ge.game_id = g.id AND ge.player_id = p_player_id
        )
        OR coalesce(g.starter_ids, '[]'::jsonb) ? p_player_id::text
      )
  ) THEN
    RAISE EXCEPTION 'ROSTER_START_AFTER_RECORDED_PARTICIPATION';
  END IF;

  IF stint_row.valid_from = p_new_start THEN RETURN member_row; END IF;

  UPDATE public.roster_membership_stints
  SET valid_from = p_new_start,
      source = 'MANUAL_DATE_CORRECTION',
      updated_at = now()
  WHERE id = stint_row.id;

  UPDATE public.roster_memberships
  SET joined_at = p_new_start::timestamptz,
      updated_at = now()
  WHERE id = member_row.id
  RETURNING * INTO member_row;

  RETURN member_row;
END;
$$;

REVOKE ALL ON FUNCTION public.iq_v3_update_roster_start(uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.iq_v3_update_roster_start(uuid,uuid,date) TO authenticated;
COMMIT;
