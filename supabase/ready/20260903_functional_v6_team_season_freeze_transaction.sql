-- IQBasket V6 · FUNCTIONAL TEAM-SEASON FREEZE TEST · TRANSACTIONAL
-- Exercises freeze/reopen on real scoped data and always rolls back.
begin;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', up.id::text,
    'email', lower(up.email),
    'role', 'authenticated'
  )::text,
  true
)
from public.user_profiles up
where lower(up.email)='scolado@nechigroup.com'
limit 1;

do $$
begin
  if auth.uid() is null or public.iq_v5_current_role() <> 'SUPERADMIN' then
    raise exception 'V6_FUNCTIONAL_SUPERADMIN_CONTEXT_FAILED';
  end if;
end $$;

-- Pick a real scope with roster and at least two games. We deliberately keep
-- one game as a pre-existing manual lock and make another one OPEN inside the
-- transaction so freeze/reopen can be exercised regardless of current state.
create temp table iq_v6_functional_context on commit drop as
select
  ts.id as team_season_id,
  (
    select g1.id
    from public.games g1
    where g1.team_season_id=ts.id
    order by
      case when upper(coalesce(g1.edit_state,'OPEN'))='LOCKED' then 0 else 1 end,
      g1.id::text
    limit 1
  ) as manual_game_id,
  (
    select g2.id
    from public.games g2
    where g2.team_season_id=ts.id
      and g2.id <> (
        select g3.id
        from public.games g3
        where g3.team_season_id=ts.id
        order by
          case when upper(coalesce(g3.edit_state,'OPEN'))='LOCKED' then 0 else 1 end,
          g3.id::text
        limit 1
      )
    order by g2.id::text
    limit 1
  ) as lifecycle_game_id,
  (
    select count(*)::integer
    from public.games gx
    where gx.team_season_id=ts.id
  ) as game_count
from public.team_seasons ts
where upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
  and exists (
    select 1 from public.roster_memberships rm
    where rm.team_season_id=ts.id
  )
  and (
    select count(*) from public.games g
    where g.team_season_id=ts.id
  ) >= 2
order by game_count desc, ts.id
limit 1;

do $$
begin
  if not exists (select 1 from iq_v6_functional_context) then
    raise exception 'V6_FUNCTIONAL_SCOPE_WITH_TWO_GAMES_AND_ROSTER_NOT_FOUND';
  end if;
end $$;

-- Ensure the manual game is locked before season closure.
do $$
declare
  v_game uuid;
begin
  select manual_game_id into v_game from iq_v6_functional_context;
  if exists (
    select 1 from public.games
    where id=v_game and upper(coalesce(edit_state,'OPEN'))='OPEN'
  ) then
    perform public.iq_v5_set_game_edit_state(
      v_game,
      'LOCKED',
      'V6_FUNCTIONAL_PREEXISTING_MANUAL_LOCK'
    );
  end if;
end $$;

alter table iq_v6_functional_context add column manual_lock_reason text;
update iq_v6_functional_context c
set manual_lock_reason=g.lock_reason
from public.games g
where g.id=c.manual_game_id;

-- Ensure a different game is OPEN so V6 must lock it.
do $$
declare
  v_game uuid;
begin
  select lifecycle_game_id into v_game from iq_v6_functional_context;
  if exists (
    select 1 from public.games
    where id=v_game and upper(coalesce(edit_state,'OPEN'))='LOCKED'
  ) then
    perform public.iq_v5_set_game_edit_state(
      v_game,
      'OPEN',
      'V6_FUNCTIONAL_TEMPORARY_OPEN'
    );
  end if;
end $$;

do $$
declare
  v_manual uuid;
  v_lifecycle uuid;
begin
  select manual_game_id,lifecycle_game_id
    into v_manual,v_lifecycle
  from iq_v6_functional_context;

  if not exists (
    select 1 from public.games
    where id=v_manual and upper(edit_state)='LOCKED'
  ) then
    raise exception 'V6_FUNCTIONAL_MANUAL_PRELOCK_FAILED';
  end if;

  if not exists (
    select 1 from public.games
    where id=v_lifecycle and upper(coalesce(edit_state,'OPEN'))='OPEN'
  ) then
    raise exception 'V6_FUNCTIONAL_LIFECYCLE_GAME_NOT_OPEN';
  end if;
end $$;

create temp table iq_v6_pre_freeze_state on commit drop as
select
  g.id,
  g.edit_state,
  g.lock_reason
from public.games g
join iq_v6_functional_context c on c.team_season_id=g.team_season_id;

create temp table iq_v6_freeze_result on commit drop as
select public.iq_v6_set_team_season_data_state(
  c.team_season_id,
  'FROZEN',
  'V6 functional closure'
) as result
from iq_v6_functional_context c;

do $$
declare
  v_ts uuid;
  v_manual uuid;
  v_lifecycle uuid;
  v_manual_reason text;
  v_token uuid;
begin
  select team_season_id,manual_game_id,lifecycle_game_id,manual_lock_reason
    into v_ts,v_manual,v_lifecycle,v_manual_reason
  from iq_v6_functional_context;

  select freeze_token into v_token
  from public.team_seasons
  where id=v_ts;

  if v_token is null then
    raise exception 'V6_FUNCTIONAL_FREEZE_TOKEN_MISSING';
  end if;

  if not exists (
    select 1 from public.team_seasons
    where id=v_ts and upper(coalesce(data_status,'ACTIVE'))='FROZEN'
  ) then
    raise exception 'V6_FUNCTIONAL_SCOPE_NOT_FROZEN';
  end if;

  if not exists (
    select 1 from public.games
    where id=v_manual
      and upper(edit_state)='LOCKED'
      and lock_reason is not distinct from v_manual_reason
  ) then
    raise exception 'V6_FUNCTIONAL_MANUAL_LOCK_WAS_OVERWRITTEN';
  end if;

  if not exists (
    select 1 from public.games
    where id=v_lifecycle
      and upper(edit_state)='LOCKED'
      and coalesce(lock_reason,'') like 'TEAM_SEASON_FREEZE:' || v_token::text || '%'
  ) then
    raise exception 'V6_FUNCTIONAL_LIFECYCLE_GAME_NOT_TAGGED';
  end if;

  if public.iq_v3_can_manage_roster(v_ts) then
    raise exception 'V6_FUNCTIONAL_FROZEN_ROSTER_HELPER_ALLOWED_WRITE';
  end if;
end $$;

-- Defense in depth: a direct roster mutation must fail while frozen.
do $$
declare
  v_membership uuid;
  v_blocked boolean := false;
begin
  select rm.id into v_membership
  from public.roster_memberships rm
  join iq_v6_functional_context c on c.team_season_id=rm.team_season_id
  limit 1;

  begin
    update public.roster_memberships
       set status=status
     where id=v_membership;
  exception
    when insufficient_privilege then
      if sqlerrm='TEAM_SEASON_FROZEN' then
        v_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_blocked then
    raise exception 'V6_FUNCTIONAL_DIRECT_ROSTER_WRITE_NOT_BLOCKED';
  end if;
end $$;

create temp table iq_v6_reopen_result on commit drop as
select public.iq_v6_set_team_season_data_state(
  c.team_season_id,
  'ACTIVE',
  'V6 functional reopen'
) as result
from iq_v6_functional_context c;

select
  'TEAM_SEASON_FREEZE_FUNCTIONAL' as section,
  exists (
    select 1
    from iq_v6_functional_context c
    join public.team_seasons ts on ts.id=c.team_season_id
    where upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
  ) as scope_reopened_ok,
  exists (
    select 1
    from iq_v6_functional_context c
    join public.games g on g.id=c.manual_game_id
    where upper(g.edit_state)='LOCKED'
      and g.lock_reason is not distinct from c.manual_lock_reason
  ) as manual_lock_preserved_ok,
  exists (
    select 1
    from iq_v6_functional_context c
    join public.games g on g.id=c.lifecycle_game_id
    where upper(coalesce(g.edit_state,'OPEN'))='OPEN'
  ) as lifecycle_game_reopened_ok,
  not exists (
    select 1
    from iq_v6_functional_context c
    join public.games g on g.team_season_id=c.team_season_id
    where upper(coalesce(g.edit_state,'OPEN'))='LOCKED'
      and coalesce(g.lock_reason,'') like 'TEAM_SEASON_FREEZE:%'
  ) as no_freeze_locks_left_ok,
  exists (
    select 1
    from iq_v6_functional_context c
    where public.iq_v3_can_manage_roster(c.team_season_id)
  ) as roster_helper_restored_ok,
  (
    exists (
      select 1
      from iq_v6_functional_context c
      join public.team_seasons ts on ts.id=c.team_season_id
      where upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
    )
    and exists (
      select 1
      from iq_v6_functional_context c
      join public.games g on g.id=c.manual_game_id
      where upper(g.edit_state)='LOCKED'
        and g.lock_reason is not distinct from c.manual_lock_reason
    )
    and exists (
      select 1
      from iq_v6_functional_context c
      join public.games g on g.id=c.lifecycle_game_id
      where upper(coalesce(g.edit_state,'OPEN'))='OPEN'
    )
    and not exists (
      select 1
      from iq_v6_functional_context c
      join public.games g on g.team_season_id=c.team_season_id
      where upper(coalesce(g.edit_state,'OPEN'))='LOCKED'
        and coalesce(g.lock_reason,'') like 'TEAM_SEASON_FREEZE:%'
    )
    and exists (
      select 1
      from iq_v6_functional_context c
      where public.iq_v3_can_manage_roster(c.team_season_id)
    )
  ) as all_ok;

rollback;
