-- Controlled rollback for V21. Refuses to discard real delegation/audit history.
begin;

do $v21_rollback_guard$
begin
  if to_regclass('public.game_capture_delegations') is not null and exists (
    select 1 from public.game_capture_delegations
  ) then
    raise exception 'GAME_CAPTURE_DELEGATION_V1_ROLLBACK_DELEGATION_DATA_PRESENT';
  end if;
  if to_regclass('public.game_capture_delegation_events') is not null and exists (
    select 1 from public.game_capture_delegation_events
  ) then
    raise exception 'GAME_CAPTURE_DELEGATION_V1_ROLLBACK_EVENT_DATA_PRESENT';
  end if;
  if to_regclass('public.game_capture_write_audit') is not null and exists (
    select 1 from public.game_capture_write_audit
  ) then
    raise exception 'GAME_CAPTURE_DELEGATION_V1_ROLLBACK_WRITE_AUDIT_PRESENT';
  end if;
end
$v21_rollback_guard$;

-- Restore the canonical V13 lifecycle authority exactly as it existed before V21.
create or replace function iq_private.game_play_state_actor_allowed(
  p_game_id uuid,
  p_target text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  with game_scope as (
    select g.id,g.team_id,g.team_season_id,ts.season_id,t.club_id
    from public.games g
    left join public.team_seasons ts on ts.id=g.team_season_id
    left join public.teams t on t.id=g.team_id
    where g.id=p_game_id
  ), membership_roles as (
    select upper(m.function_role) role
    from game_scope gs
    join public.team_season_memberships m on m.team_season_id=gs.team_season_id
    where m.user_id=auth.uid()
      and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
      and (m.valid_from is null or m.valid_from<=now())
      and (m.valid_until is null or m.valid_until>now())
    union all
    select upper(cm.function_role) role
    from game_scope gs
    join public.club_season_memberships cm on cm.club_id=gs.club_id and cm.season_id=gs.season_id
    where cm.user_id=auth.uid()
      and upper(coalesce(cm.status,'ACTIVE'))='ACTIVE'
      and (cm.valid_from is null or cm.valid_from<=now())
      and (cm.valid_until is null or cm.valid_until>now())
  )
  select auth.uid() is not null
    and public.iq_account_is_active()
    and (
      public.iq_v3_is_global_superadmin()
      or exists (
        select 1 from membership_roles mr
        where case iq_private.game_play_state_action_for_target(p_target)
          when 'CANCEL_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR')
          when 'PREPARE_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA')
          when 'START_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA')
          when 'FINISH_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA')
          else false
        end
      )
    );
$function$;
revoke all on function iq_private.game_play_state_actor_allowed(uuid,text) from public,anon,authenticated;

drop function if exists public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb);
drop function if exists public.iq_v21_game_capture_snapshot(uuid);
drop function if exists public.iq_v21_revoke_game_capture_delegation(uuid,text);
drop function if exists public.iq_v21_grant_game_capture_delegation(uuid,text,text[],timestamptz,timestamptz,text);
drop function if exists public.iq_v21_list_game_capture_delegations(uuid);
drop function if exists public.iq_v21_my_game_capture_delegations();

drop schema if exists iq_v21_private cascade;

drop table if exists public.game_capture_write_audit;
drop table if exists public.game_capture_delegation_events;
drop table if exists public.game_capture_delegations;

commit;
