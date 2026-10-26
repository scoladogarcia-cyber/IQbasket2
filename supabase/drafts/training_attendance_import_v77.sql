-- DRAFT ONLY · IQBasket V77 Training Attendance CSV bulk apply.
-- DO NOT APPLY TO PRODUCTION WITHOUT external backup, nonproduction rehearsal,
-- schema preflight, authenticated/anon RLS tests, team-season acceptance and rollback.
-- This is NOT a Supabase migration in ready/: deliberately isolated until reviewed.
-- No changes to historical records upon installing the objects; grants start empty.

CREATE SCHEMA IF NOT EXISTS iq_v77_private;
REVOKE ALL ON SCHEMA iq_v77_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS iq_v77_private.training_import_grants (
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  PRIMARY KEY (team_season_id, user_id)
);
ALTER TABLE iq_v77_private.training_import_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE iq_v77_private.training_import_grants FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS iq_v77_private.training_import_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_season_id uuid NOT NULL,
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  player_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  before_row jsonb NOT NULL,
  after_row jsonb NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE iq_v77_private.training_import_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE iq_v77_private.training_import_audit FROM PUBLIC, anon, authenticated;

-- Only a verified global superadmin can activate an import grant;
-- a sports team permission alone never grants bulk-write access.
CREATE OR REPLACE FUNCTION public.iq_v77_set_training_import_grant(
  p_team_season_id uuid,p_user_id uuid,p_enabled boolean,p_expires_at timestamptz DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.iq_account_is_active()
    OR NOT public.iq_v3_is_global_superadmin() THEN
    RAISE EXCEPTION 'IMPORT_GRANT_DENIED' USING ERRCODE='42501';
  END IF;
  IF p_team_season_id IS NULL OR p_user_id IS NULL OR p_enabled IS NULL OR
     NOT EXISTS (SELECT 1 FROM public.team_seasons t WHERE t.id=p_team_season_id) OR
     NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p_user_id) THEN
    RAISE EXCEPTION 'IMPORT_GRANT_INVALID';
  END IF;
  IF p_enabled THEN
    IF p_expires_at IS NULL OR p_expires_at<=now() OR p_expires_at>now()+interval '90 days'
    THEN RAISE EXCEPTION 'IMPORT_GRANT_EXPIRY_REQUIRED'; END IF;
    INSERT INTO iq_v77_private.training_import_grants
      (team_season_id,user_id,granted_by,expires_at)
    VALUES (p_team_season_id,p_user_id,auth.uid(),p_expires_at)
    ON CONFLICT (team_season_id,user_id)
      DO UPDATE SET granted_by=excluded.granted_by,granted_at=now(),expires_at=excluded.expires_at;
  ELSE
    DELETE FROM iq_v77_private.training_import_grants
      WHERE team_season_id=p_team_season_id AND user_id=p_user_id;
  END IF;
  RETURN TRUE;
END;$fn$;
REVOKE ALL ON FUNCTION public.iq_v77_set_training_import_grant(uuid,uuid,boolean,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iq_v77_set_training_import_grant(uuid,uuid,boolean,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.iq_v77_apply_training_attendance_import(
  p_team_season_id uuid,p_changes jsonb,p_confirmation text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  v_change jsonb;
  v_seen text[]:=ARRAY[]::text[];
  v_key text;
  v_session public.training_sessions%ROWTYPE;
  v_participant public.training_participants%ROWTYPE;
  v_new_status text;
  v_minutes integer;
  v_old_status text;
  v_old_minutes integer;
  v_rows integer:=0;
  v_season_status text;
  v_participant_id uuid;
  v_session_id uuid;
  v_player_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.iq_account_is_active()
    THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_confirmation IS DISTINCT FROM 'APLICAR_ASISTENCIA'
    THEN RAISE EXCEPTION 'IMPORT_CONFIRMATION_REQUIRED'; END IF;
  IF p_team_season_id IS NULL OR jsonb_typeof(p_changes) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_changes) NOT BETWEEN 1 AND 500
     OR pg_catalog.pg_column_size(p_changes)>300000
    THEN RAISE EXCEPTION 'TRAINING_IMPORT_INVALID_BATCH'; END IF;
  IF NOT public.iq_v4_can_manage_training(p_team_season_id)
    OR NOT EXISTS (
      SELECT 1 FROM iq_v77_private.training_import_grants g
      WHERE g.team_season_id=p_team_season_id AND g.user_id=auth.uid()
        AND g.expires_at>now()
    ) THEN
    RAISE EXCEPTION 'TRAINING_IMPORT_PERMISSION_DENIED' USING ERRCODE='42501';
  END IF;
  -- Serialize with season locking, prevent updates to closed/frozen seasons.
  SELECT upper(t.data_status) INTO v_season_status
    FROM public.team_seasons t WHERE t.id=p_team_season_id FOR UPDATE;
  IF NOT FOUND OR v_season_status<>'ACTIVE'
    THEN RAISE EXCEPTION 'TRAINING_IMPORT_SEASON_LOCKED'; END IF;

  -- First pass: deterministic row locks and complete validation, no writes yet.
  FOR v_change IN
    SELECT value FROM pg_catalog.jsonb_array_elements(p_changes)
    ORDER BY (value->>'sessionId'),(value->>'playerId')
  LOOP
    IF jsonb_typeof(v_change) IS DISTINCT FROM 'object'
      THEN RAISE EXCEPTION 'TRAINING_IMPORT_ROW_INVALID'; END IF;
    v_session_id:=(v_change->>'sessionId')::uuid;
    v_player_id:=(v_change->>'playerId')::uuid;
    v_participant_id:=(v_change->>'participantId')::uuid;
    v_key:=v_session_id::text||'|'||v_player_id::text;
    IF v_key=ANY(v_seen) THEN RAISE EXCEPTION 'TRAINING_IMPORT_DUPLICATE'; END IF;
    v_seen:=array_append(v_seen,v_key);
    SELECT * INTO v_session FROM public.training_sessions s
      WHERE s.id=v_session_id AND s.team_season_id=p_team_season_id FOR UPDATE;
    IF NOT FOUND OR upper(v_session.status)='ARCHIVED'
      THEN RAISE EXCEPTION 'TRAINING_IMPORT_SESSION_SCOPE'; END IF;
    SELECT * INTO v_participant FROM public.training_participants p
      WHERE p.id=v_participant_id AND p.training_session_id=v_session_id
        AND p.team_season_id=p_team_season_id AND p.player_id=v_player_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRAINING_IMPORT_PARTICIPANT_SCOPE'; END IF;
    IF v_session.updated_at IS DISTINCT FROM (v_change->>'sessionUpdatedAt')::timestamptz
      OR v_participant.updated_at IS DISTINCT FROM (v_change->>'participantUpdatedAt')::timestamptz
      THEN RAISE EXCEPTION 'TRAINING_IMPORT_STALE'; END IF;
    v_old_status:=upper(v_participant.attendance_status);
    v_old_minutes:=v_participant.participated_minutes;
    IF v_old_status IS DISTINCT FROM upper(v_change#>>'{expected,attendance}')
      OR v_old_minutes IS DISTINCT FROM (v_change#>>'{expected,minutes}')::integer
      THEN RAISE EXCEPTION 'TRAINING_IMPORT_STALE'; END IF;
    v_new_status:=upper(coalesce(v_change#>>'{proposed,attendance}',''));
    IF v_new_status NOT IN ('PRESENT','PARTIAL','ABSENT','EXCUSED','PLANNED')
      THEN RAISE EXCEPTION 'TRAINING_IMPORT_ATTENDANCE_INVALID'; END IF;
    IF (v_change#>'{proposed,minutes}') IS NULL OR
       jsonb_typeof(v_change#>'{proposed,minutes}') NOT IN ('number','null')
      THEN RAISE EXCEPTION 'TRAINING_IMPORT_MINUTES_MISSING'; END IF;
    v_minutes:=(v_change#>>'{proposed,minutes}')::integer;
    IF v_minutes IS NOT NULL AND (v_minutes<0 OR v_minutes>600 OR
       (v_session.duration_minutes IS NOT NULL AND v_minutes>v_session.duration_minutes))
      THEN RAISE EXCEPTION 'TRAINING_IMPORT_MINUTES_RANGE'; END IF;
    IF v_new_status IN ('ABSENT','EXCUSED','PLANNED') AND coalesce(v_minutes,0)<>0
      THEN RAISE EXCEPTION 'TRAINING_IMPORT_ABSENT_MINUTES'; END IF;
    IF v_new_status IN ('PRESENT','PARTIAL') AND v_session.session_date>current_date
      THEN RAISE EXCEPTION 'TRAINING_IMPORT_FUTURE_ATTENDANCE'; END IF;
    v_rows:=v_rows+1;
  END LOOP;
  -- All inputs checked and locks held. Writes and audit roll back together on error.
  FOR v_change IN
    SELECT value FROM pg_catalog.jsonb_array_elements(p_changes)
    ORDER BY (value->>'sessionId'),(value->>'playerId')
  LOOP
    v_participant_id:=(v_change->>'participantId')::uuid;
    UPDATE public.training_participants SET
      attendance_status=upper(v_change#>>'{proposed,attendance}'),
      participated_minutes=(v_change#>>'{proposed,minutes}')::integer,
      captured_by=auth.uid(),
      updated_at=now()
    WHERE id=v_participant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRAINING_IMPORT_PARTICIPANT_LOST'; END IF;
    INSERT INTO iq_v77_private.training_import_audit (
      team_season_id,session_id,participant_id,player_id,changed_by,before_row,after_row
    ) VALUES (
      p_team_season_id,(v_change->>'sessionId')::uuid,v_participant_id,
      (v_change->>'playerId')::uuid,auth.uid(),
      v_change->'expected',v_change->'proposed'
    );
  END LOOP;
  RETURN jsonb_build_object('status','APPLIED','changed',v_rows,'team_season_id',p_team_season_id);
END;$fn$;
REVOKE ALL ON FUNCTION public.iq_v77_apply_training_attendance_import(uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iq_v77_apply_training_attendance_import(uuid,jsonb,text) TO authenticated;
