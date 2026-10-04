-- IQBasket V58 hotfix · benchmark authorization and explicit anon revokes.
-- Safe after the initial V58 migration and idempotent for controlled rollouts.

revoke all on function public.iq_v58_network_benchmark_snapshot(text,text[]) from public, anon, authenticated;
drop function if exists public.iq_v58_network_benchmark_snapshot(text,text[]);

create or replace function public.iq_v58_network_benchmark_snapshot(
  p_team_season_id uuid,
  p_cohort_key text,
  p_metric_codes text[]
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.iq_v4_can_view_longitudinal_analytics(p_team_season_id) then
    raise exception 'BENCHMARK_VIEW_FORBIDDEN' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'cohort_key',s.cohort_key,
    'metric_code',s.metric_code,
    'sample_size',s.sample_size,
    'reliability',case
      when s.sample_size < 20 then 'HIDDEN'
      when s.sample_size < 50 then 'PROVISIONAL'
      when s.sample_size < 100 then 'REASONABLE'
      else 'ROBUST' end,
    'p10',case when s.sample_size>=20 then s.p10 else null end,
    'p25',case when s.sample_size>=20 then s.p25 else null end,
    'p50',case when s.sample_size>=20 then s.p50 else null end,
    'p75',case when s.sample_size>=20 then s.p75 else null end,
    'p90',case when s.sample_size>=20 then s.p90 else null end,
    'generated_at',s.generated_at,
    'calculation_version',s.calculation_version
  ) order by s.metric_code),'[]'::jsonb)
  into v_result
  from iq_v58_private.benchmark_network_snapshots s
  where s.cohort_key=upper(trim(p_cohort_key))
    and s.metric_code=any(coalesce(p_metric_codes,array[]::text[]));
  return v_result;
end;
$$;

revoke all on function public.iq_v58_network_benchmark_snapshot(uuid,text,text[]) from public, anon;
grant execute on function public.iq_v58_network_benchmark_snapshot(uuid,text,text[]) to authenticated;

revoke all on function public.iq_v58_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,text,uuid,bigint) from anon;
revoke all on function public.iq_v58_game_capture_sync_status(uuid) from anon;
revoke all on function public.iq_v58_set_training_focus_codes(uuid,uuid,text[]) from anon;
