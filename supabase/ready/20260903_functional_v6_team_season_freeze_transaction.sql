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

create temp table iq_v6_functional_context on commit drop as
select
  ts.id as team_season_id,
  min(g.id) as manual_game_id,
  count(distinct g.id)::integer as game_count
from public.team_seasons ts
join public.games g on g.team_season_id=ts.id
join public.roster_memberships rm on rm.team_season_id=ts.id
where upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
  and upper(coalesce(g.edit_state,'OPEN'))='OPEN'
group by ts.id
having count(distinct g.id) >= 2
order by count(distinct g.id) desc, ts.id
limit 1;

do $$
begin
  if not exists (select 1 from iq_v6_functional_context) then
    raise exception 'V6_FUNCTIONAL_SCOPE_WITH_TWO_GAMES_AND_ROSTER_NOT_FOUND';
  end if;
end $$;

-- Simulate a manual lock that predates season closure.
select public.iq_v5_set_game_edit_state(
  c.manual_game_id,
  'LOCKED',
  'V6_FUNCTIONAL_PREEXISTING_MANUAL_LOCK'
)
from iq_v6_functional_context c;

do $$
declare
  v_ts uuid;
  v_manual uuid;
begin
  select team_season_id,manual_game_id into v_ts,v_manual
  from iq_v6_functional_context;

  if not exists (
    select 1 from public.games
    where id=v_manual
      and upper(edit_state)='LOCKED'
      and lock_reason='V6_FUNCTIONAL_PREEXISTING_MANUAL_LOCK'
  ) then
    raise exception 'V6_FUNCTIONAL_PRELOCK_FAILED';
  end if;
end $$;

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
  v_count integer;
  v_token uuid;
  v_tagged integer;
begin
  select team_season_id,manual_game_id,game_count
    into v_ts,v_manual,v_count
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
      and lock_reason='V6_FUNCTIONAL_PREEXISTING_MANUAL_LOCK'
  ) then
    raise exception 'V6_FUNCTIONAL_MANUAL_LOCK_WAS_OVERWRITTEN';
  end if;

  select count(*) into v_tagged
  from public.games
  where team_season_id=v_ts
    and upper(edit_state)='LOCKED'
    and coalesce(lock_reason,'') like 'TEAM_SEASON_FREEZE:' || v_token::text || '%';

  if v_tagged <> v_count - 1 then
    raise exception 'V6_FUNCTIONAL_FREEZE_TAG_COUNT_MISMATCH expected=% actual=%',
      v_count - 1, v_tagged;
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
      and g.lock_reason='V6_FUNCTIONAL_PREEXISTING_MANUAL_LOCK'
  ) as manual_lock_preserved_ok,
  not exists (
    select 1
    from iq_v6_functional_context c
    join public.games g on g.team_season_id=c.team_season_id
    where g.id<>c.manual_game_id
      and upper(coalesce(g.edit_state,'OPEN'))<>'OPEN'
  ) as lifecycle_games_reopened_ok,
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
        and g.lock_reason='V6_FUNCTIONAL_PREEXISTING_MANUAL_LOCK'
    )
    and not exists (
      select 1
      from iq_v6_functional_context c
      join public.games g on g.team_season_id=c.team_season_id
      where g.id<>c.manual_game_id
        and upper(coalesce(g.edit_state,'OPEN'))<>'OPEN'
    )
    and exists (
      select 1
      from iq_v6_functional_context c
      where public.iq_v3_can_manage_roster(c.team_season_id)
    )
  ) as all_ok;

rollback;
