-- V55: genuine deletion, unlike V4 archive (which retains participant rows in historical aggregates).
-- DDL only: existing sessions and historic statistics are not changed by applying this migration.
create table if not exists public.training_session_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  team_season_id uuid not null,
  session_date date not null,
  deleted_by uuid not null,
  deleted_at timestamptz not null default now(),
  participants_removed integer not null,
  blocks_removed integer not null
);
alter table public.training_session_deletion_audit enable row level security;
revoke all on public.training_session_deletion_audit from public,anon,authenticated;

-- Separate backend DELETE boundary; V4's broader edit privilege is NOT sufficient.
create or replace function public.iq_v55_can_delete_training(p_team_season_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.iq_account_is_active()
    and public.iq_v4_can_manage_training(p_team_season_id)
    and exists (
      select 1 from public.team_seasons ts join public.teams t on t.id=ts.team_id
      where ts.id=p_team_season_id and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
        and (
          public.iq_v3_is_global_superadmin()
          or exists (select 1 from public.team_season_memberships m
            where m.user_id=auth.uid() and m.team_season_id=ts.id
              and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
              and (m.valid_from is null or m.valid_from<=now())
              and (m.valid_until is null or m.valid_until>now())
              and upper(m.function_role) in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE'))
          or exists (select 1 from public.club_season_memberships cm
            where cm.user_id=auth.uid() and cm.club_id=t.club_id and cm.season_id=ts.season_id
              and upper(coalesce(cm.status,'ACTIVE'))='ACTIVE'
              and (cm.valid_from is null or cm.valid_from<=now())
              and (cm.valid_until is null or cm.valid_until>now())
              and upper(cm.function_role) in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'))
          or exists (select 1 from public.user_profiles up
            cross join lateral jsonb_array_elements_text(coalesce(to_jsonb(up.assigned_team_ids),'[]'::jsonb)) assigned(team_id)
            where up.id=auth.uid() and assigned.team_id=ts.team_id::text
              and upper(coalesce(up.global_role,up.role,'USER')) in ('ADMIN','ENTRENADOR'))
        )
    );
$$;
revoke all on function public.iq_v55_can_delete_training(uuid) from public,anon;
grant execute on function public.iq_v55_can_delete_training(uuid) to authenticated;

create or replace function public.iq_v55_delete_training(
 p_session_id uuid,p_team_season_id uuid,p_revision jsonb,p_confirm boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_session public.training_sessions%rowtype;
  v_blocks jsonb; v_participants jsonb; v_assignments jsonb;
  v_people integer; v_block_count integer;
begin
  if auth.uid() is null or not coalesce(p_confirm,false) then
    raise exception 'TRAINING_DELETE_EXPLICIT_CONFIRMATION_REQUIRED';
  end if;
  select * into v_session from public.training_sessions where id=p_session_id for update;
  if not found or v_session.team_season_id is distinct from p_team_season_id
    or upper(v_session.status)='ARCHIVED' then
    raise exception 'TRAINING_DELETE_NOT_FOUND_OR_WRONG_SCOPE';
  end if;
  if not public.iq_v55_can_delete_training(p_team_season_id) then
    raise exception 'TRAINING_DELETE_PERMISSION_OR_FROZEN_SEASON' using errcode='42501';
  end if;
  if p_revision is null or v_session.updated_at is distinct from (p_revision->>'session')::timestamptz then
    raise exception 'TRAINING_CHANGED_RELOAD_REQUIRED';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at) order by id),'[]'::jsonb),count(*)::integer
    into v_blocks,v_block_count from public.training_blocks where training_session_id=p_session_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at) order by id),'[]'::jsonb),count(*)::integer
    into v_participants,v_people from public.training_participants where training_session_id=p_session_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'updated_at',a.updated_at) order by a.id),'[]'::jsonb)
    into v_assignments from public.training_block_participation a
    join public.training_blocks b on b.id=a.block_id where b.training_session_id=p_session_id;
  if v_blocks is distinct from coalesce(p_revision->'blocks','[]'::jsonb)
    or v_participants is distinct from coalesce(p_revision->'participants','[]'::jsonb)
    or v_assignments is distinct from coalesce(p_revision->'assignments','[]'::jsonb) then
    raise exception 'TRAINING_CHILDREN_CHANGED_RELOAD_REQUIRED';
  end if;
  -- A development action may refer to this session. Do not silently erase that evidence.
  if exists(select 1 from public.player_development_action_evidence e where e.training_session_id=p_session_id) then
    raise exception 'TRAINING_LINKED_DEVELOPMENT_EVIDENCE_UNLINK_FIRST';
  end if;
  insert into public.training_session_deletion_audit
    (session_id,team_season_id,session_date,deleted_by,participants_removed,blocks_removed)
    values(p_session_id,p_team_season_id,v_session.session_date,auth.uid(),v_people,v_block_count);
  -- FKs cascade only this session's participant, block and per-block assignment rows.
  -- Direct-read family/coach histories immediately stop seeing the deleted session.
  delete from public.training_sessions where id=p_session_id and team_season_id=p_team_season_id;
  if not found then raise exception 'TRAINING_DELETE_CONCURRENT_CHANGE'; end if;
  return jsonb_build_object('deleted',true,'session_id',p_session_id,
    'participants_removed',v_people,'blocks_removed',v_block_count);
end;$$;
revoke all on function public.iq_v55_delete_training(uuid,uuid,jsonb,boolean) from public,anon;
grant execute on function public.iq_v55_delete_training(uuid,uuid,jsonb,boolean) to authenticated;
notify pgrst,'reload schema';
