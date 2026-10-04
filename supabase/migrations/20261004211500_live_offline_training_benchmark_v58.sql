-- IQBasket V58 · offline live integrity + training classification + benchmark foundation
-- Additive/backward-compatible migration. Existing V28/V55 callers remain valid.

alter table public.games
  add column if not exists capture_revision bigint not null default 0,
  add column if not exists capture_synced_at timestamptz;

create schema if not exists iq_v58_private;
revoke all on schema iq_v58_private from public, anon, authenticated;

create table if not exists iq_v58_private.game_capture_receipts (
  game_id uuid not null references public.games(id) on delete cascade,
  client_operation_id uuid not null,
  actor_user_id uuid not null,
  base_revision bigint,
  applied_revision bigint not null,
  payload_fingerprint text,
  created_at timestamptz not null default now(),
  primary key (game_id, client_operation_id)
);
create index if not exists game_capture_receipts_actor_idx
  on iq_v58_private.game_capture_receipts(actor_user_id, created_at desc);

create or replace function iq_v58_private.save_capture(
  p_game_id uuid,
  p_team_score integer,
  p_opponent_score integer,
  p_starter_ids uuid[],
  p_stats jsonb,
  p_periods jsonb,
  p_events jsonb,
  p_lease_token text,
  p_client_operation_id uuid,
  p_base_revision bigint default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_current bigint;
  v_applied bigint;
  v_result jsonb;
  v_existing bigint;
  v_fingerprint text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_game_id is null or p_client_operation_id is null then
    raise exception 'GAME_AND_OPERATION_REQUIRED' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_game_id::text));
  select capture_revision into v_current
  from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND' using errcode='P0002'; end if;

  select applied_revision into v_existing
  from iq_v58_private.game_capture_receipts
  where game_id=p_game_id and client_operation_id=p_client_operation_id;
  if v_existing is not null then
    return jsonb_build_object(
      'ok',true,'replayed',true,'capture_revision',v_existing,
      'client_operation_id',p_client_operation_id
    );
  end if;

  if p_base_revision is not null and p_base_revision <> v_current then
    raise exception 'GAME_CAPTURE_CONFLICT expected=% actual=%',p_base_revision,v_current
      using errcode='40001';
  end if;

  v_result := iq_v28_private.save_capture(
    p_game_id,p_team_score,p_opponent_score,p_starter_ids,
    p_stats,p_periods,p_events,p_lease_token
  );

  v_applied := v_current + 1;
  update public.games
    set capture_revision=v_applied, capture_synced_at=now()
    where id=p_game_id;

  v_fingerprint := encode(
    extensions.digest(
      convert_to(coalesce(p_events,'[]'::jsonb)::text || '|' ||
                 coalesce(p_stats,'[]'::jsonb)::text || '|' ||
                 coalesce(p_periods,'[]'::jsonb)::text,'UTF8'),
      'sha256'
    ), 'hex'
  );

  insert into iq_v58_private.game_capture_receipts(
    game_id,client_operation_id,actor_user_id,base_revision,applied_revision,payload_fingerprint
  ) values (
    p_game_id,p_client_operation_id,v_uid,p_base_revision,v_applied,v_fingerprint
  );

  return coalesce(v_result,'{}'::jsonb) || jsonb_build_object(
    'ok',true,'replayed',false,'capture_revision',v_applied,
    'client_operation_id',p_client_operation_id
  );
end;
$$;

create or replace function public.iq_v58_save_game_capture(
  p_game_id uuid,
  p_team_score integer default null,
  p_opponent_score integer default null,
  p_starter_ids uuid[] default null,
  p_stats jsonb default null,
  p_periods jsonb default null,
  p_events jsonb default null,
  p_lease_token text default null,
  p_client_operation_id uuid default null,
  p_base_revision bigint default null
) returns jsonb
language sql
set search_path=''
as $$
  select iq_v58_private.save_capture(
    p_game_id,p_team_score,p_opponent_score,p_starter_ids,p_stats,p_periods,p_events,
    p_lease_token,p_client_operation_id,p_base_revision
  );
$$;
revoke all on function public.iq_v58_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,text,uuid,bigint) from public;
grant execute on function public.iq_v58_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,text,uuid,bigint) to authenticated;

create or replace function public.iq_v58_game_capture_sync_status(p_game_id uuid)
returns jsonb
language sql
stable
set search_path=''
as $$
  select jsonb_build_object(
    'game_id',g.id,
    'capture_revision',g.capture_revision,
    'capture_synced_at',g.capture_synced_at,
    'play_state',g.play_state
  )
  from public.games g
  where g.id=p_game_id;
$$;
revoke all on function public.iq_v58_game_capture_sync_status(uuid) from public;
grant execute on function public.iq_v58_game_capture_sync_status(uuid) to authenticated;

create or replace function iq_v58_private.set_training_focus_codes(
  p_session_id uuid,
  p_team_season_id uuid,
  p_focus_codes text[]
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_codes text[];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.iq_v4_can_manage_training(p_team_season_id) then
    raise exception 'TRAINING_EDIT_FORBIDDEN' using errcode='42501';
  end if;

  select array_agg(distinct upper(trim(x)) order by upper(trim(x)))
  into v_codes
  from unnest(coalesce(p_focus_codes,array[]::text[])) x
  where upper(trim(x)) = any(array[
    'TECHNICAL','SHOOT_FINISH','TACTICAL_TEAM','GAME_5V5','PHYSICAL','RECOVERY_PREMATCH'
  ]::text[]);

  if coalesce(array_length(v_codes,1),0)=0 then
    raise exception 'TRAINING_FOCUS_REQUIRED' using errcode='22023';
  end if;

  update public.training_sessions
  set metadata = coalesce(metadata,'{}'::jsonb)
      || jsonb_build_object(
        'training_focus_codes',to_jsonb(v_codes),
        'training_focus_schema_version','V55',
        'focus_classified_at',now(),
        'focus_classified_by',v_uid
      ),
      updated_at=now(),
      updated_by=v_uid
  where id=p_session_id and team_season_id=p_team_season_id;

  if not found then raise exception 'TRAINING_SESSION_NOT_FOUND' using errcode='P0002'; end if;
  return p_session_id;
end;
$$;

create or replace function public.iq_v58_set_training_focus_codes(
  p_session_id uuid,
  p_team_season_id uuid,
  p_focus_codes text[]
) returns uuid
language sql
set search_path=''
as $$
  select iq_v58_private.set_training_focus_codes(p_session_id,p_team_season_id,p_focus_codes);
$$;
revoke all on function public.iq_v58_set_training_focus_codes(uuid,uuid,text[]) from public;
grant execute on function public.iq_v58_set_training_focus_codes(uuid,uuid,text[]) to authenticated;

-- Network benchmark storage is private: only anonymous aggregate snapshots may be exposed later.
create table if not exists iq_v58_private.benchmark_network_snapshots (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null,
  metric_code text not null,
  calculation_version text not null,
  sample_size integer not null check (sample_size >= 0),
  p10 numeric,
  p25 numeric,
  p50 numeric,
  p75 numeric,
  p90 numeric,
  minimum_value numeric,
  maximum_value numeric,
  criteria jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique (cohort_key,metric_code,calculation_version)
);

create or replace function public.iq_v58_network_benchmark_snapshot(
  p_team_season_id uuid,
  p_cohort_key text,
  p_metric_codes text[]
) returns jsonb
language plpgsql
security definer
set search_path=''
as $
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
$;
revoke all on function public.iq_v58_network_benchmark_snapshot(uuid,text,text[]) from public, anon;
grant execute on function public.iq_v58_network_benchmark_snapshot(uuid,text,text[]) to authenticated;

revoke all on function public.iq_v58_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,text,uuid,bigint) from anon;
revoke all on function public.iq_v58_game_capture_sync_status(uuid) from anon;
revoke all on function public.iq_v58_set_training_focus_codes(uuid,uuid,text[]) from anon;
