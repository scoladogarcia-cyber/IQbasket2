-- Player Passport V1 rollback. Preserves historical passport evaluations/scores.
begin;
drop function if exists public.iq_v4_save_player_measurement(uuid,uuid,text,numeric,text,timestamptz,text,text,text);
drop function if exists public.iq_v4_save_player_passport_evaluation(uuid,uuid,date,text,text,jsonb,text,text,text,uuid);
drop function if exists public.iq_v4_player_passport_snapshot(uuid,uuid);
drop policy if exists iq_player_passport_scores_commercial_gate on public.player_evaluation_scores;
drop function if exists iq_private.iq_v4_passport_score_access(uuid,text);
drop function if exists iq_private.iq_v4_score_is_player_passport(text);
drop function if exists public.iq_v4_can_access_player_passport(uuid,uuid);
-- Tables/columns and catalog rows are intentionally retained because historical evaluations may reference them.
commit;
