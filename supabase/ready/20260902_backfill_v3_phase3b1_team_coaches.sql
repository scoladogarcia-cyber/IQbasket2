-- IQBasket v3 PHASE 3B.1 - COPY LEGACY TEAM COACH INTO V3 STAFF
-- =============================================================================
-- ADDITIVE / REVERSIBLE DATA COPY.
-- Copies teams.coach_name into the canonical team-season staff table only when:
--   1) the team has exactly ONE ACTIVE team_season;
--   2) no active HEAD_COACH already exists for that team_season;
--   3) teams.coach_name is non-empty.
-- Does NOT modify or delete teams.coach_name.
-- =============================================================================

begin;

do $$
declare
  ambiguous_count integer;
begin
  if to_regclass('public.team_season_staff_assignments') is null then
    raise exception 'PHASE3A_REQUIRED';
  end if;

  select count(*)
    into ambiguous_count
  from (
    select ts.team_id
    from public.team_seasons ts
    join public.teams t on t.id = ts.team_id
    where upper(coalesce(ts.status, 'ACTIVE')) = 'ACTIVE'
      and nullif(trim(coalesce(t.coach_name, '')), '') is not null
    group by ts.team_id
    having count(*) <> 1
  ) q;

  if ambiguous_count <> 0 then
    raise exception 'AMBIGUOUS_ACTIVE_TEAM_SEASONS: %', ambiguous_count;
  end if;
end $$;

insert into public.team_season_staff_assignments (
  team_season_id,
  staff_role,
  user_id,
  external_name,
  status
)
select
  ts.id,
  'HEAD_COACH',
  null,
  trim(t.coach_name),
  'ACTIVE'
from public.team_seasons ts
join public.teams t
  on t.id = ts.team_id
where upper(coalesce(ts.status, 'ACTIVE')) = 'ACTIVE'
  and nullif(trim(coalesce(t.coach_name, '')), '') is not null
  and not exists (
    select 1
    from public.team_season_staff_assignments a
    where a.team_season_id = ts.id
      and upper(a.staff_role) = 'HEAD_COACH'
      and upper(a.status) = 'ACTIVE'
  );

do $$
declare
  missing_count integer;
begin
  select count(*)
    into missing_count
  from public.team_seasons ts
  join public.teams t
    on t.id = ts.team_id
  where upper(coalesce(ts.status, 'ACTIVE')) = 'ACTIVE'
    and nullif(trim(coalesce(t.coach_name, '')), '') is not null
    and not exists (
      select 1
      from public.team_season_staff_assignments a
      where a.team_season_id = ts.id
        and upper(a.staff_role) = 'HEAD_COACH'
        and upper(a.status) = 'ACTIVE'
    );

  if missing_count <> 0 then
    raise exception 'TEAM_COACH_BACKFILL_INCOMPLETE: %', missing_count;
  end if;
end $$;

commit;

select
  ts.id as team_season_id,
  t.name as team_name,
  sc.name as season_name,
  a.external_name as head_coach,
  'COPIED_FROM_TEAMS_WITHOUT_DELETING_LEGACY' as migration_status
from public.team_season_staff_assignments a
join public.team_seasons ts
  on ts.id = a.team_season_id
join public.teams t
  on t.id = ts.team_id
join public.season_catalog sc
  on sc.id = ts.season_id
where upper(a.staff_role) = 'HEAD_COACH'
  and upper(a.status) = 'ACTIVE'
order by t.name;
