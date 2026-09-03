-- IQBasket v3 PHASE 3B - COPY LEGACY HEAD COACHES INTO V3 STAFF
-- =============================================================================
-- ADDITIVE / REVERSIBLE DATA COPY.
-- Copies legacy seasons.coach_name into team_season_staff_assignments as
-- EXTERNAL staff only when no active HEAD_COACH already exists.
-- Does NOT modify or delete seasons.coach_name.
-- Run only AFTER Phase 3A has been validated.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.team_season_staff_assignments') is null then
    raise exception 'PHASE3A_REQUIRED';
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
  trim(s.coach_name),
  'ACTIVE'
from public.team_seasons ts
join public.seasons s
  on s.id = ts.legacy_season_id
where nullif(trim(coalesce(s.coach_name, '')), '') is not null
  and not exists (
    select 1
    from public.team_season_staff_assignments a
    where a.team_season_id = ts.id
      and upper(a.staff_role) = 'HEAD_COACH'
      and upper(a.status) = 'ACTIVE'
  );

-- Validation before commit.
do $$
declare
  missing_count integer;
begin
  select count(*)
    into missing_count
    from public.team_seasons ts
    join public.seasons s on s.id = ts.legacy_season_id
   where nullif(trim(coalesce(s.coach_name, '')), '') is not null
     and not exists (
       select 1
       from public.team_season_staff_assignments a
       where a.team_season_id = ts.id
         and upper(a.staff_role) = 'HEAD_COACH'
         and upper(a.status) = 'ACTIVE'
     );

  if missing_count <> 0 then
    raise exception 'LEGACY_HEAD_COACH_BACKFILL_INCOMPLETE: %', missing_count;
  end if;
end $$;

commit;

select
  ts.id as team_season_id,
  t.name as team_name,
  sc.name as season_name,
  a.external_name as head_coach,
  'COPIED_WITHOUT_DELETING_LEGACY' as migration_status
from public.team_season_staff_assignments a
join public.team_seasons ts on ts.id = a.team_season_id
join public.teams t on t.id = ts.team_id
join public.season_catalog sc on sc.id = ts.season_id
where upper(a.staff_role) = 'HEAD_COACH'
  and upper(a.status) = 'ACTIVE'
order by t.name;
