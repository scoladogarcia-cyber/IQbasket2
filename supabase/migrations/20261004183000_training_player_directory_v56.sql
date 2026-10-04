-- =============================================================================
-- IQBasket · Training Player Directory V56
-- Permission-aware, paginated selector for training participants.
-- Current team-season roster is always ranked first.
-- Page size is capped server-side at 15.
-- =============================================================================

begin;

do $preflight$
begin
  if to_regclass('public.players') is null
     or to_regclass('public.teams') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.roster_memberships') is null
     or to_regprocedure('public.iq_v4_can_manage_training(uuid)') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null
  then
    raise exception 'TRAINING_PLAYER_DIRECTORY_V56_PREREQUISITES_MISSING';
  end if;
end
$preflight$;

create or replace function public.iq_v56_search_training_players(
  p_team_season_id uuid,
  p_query text default '',
  p_page integer default 1,
  p_page_size integer default 15
)
returns table(
  player_id uuid,
  first_name text,
  last_name text,
  photo_url text,
  jersey integer,
  primary_position text,
  team_id uuid,
  team_name text,
  is_current_roster boolean,
  is_current_team boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path=''
as $fn$
declare
  v_team_id uuid;
  v_club_id uuid;
  v_season_id uuid;
  v_query text:=lower(trim(coalesce(p_query,'')));
  v_page integer:=greatest(1,coalesce(p_page,1));
  v_page_size integer:=least(15,greatest(1,coalesce(p_page_size,15)));
  v_offset integer;
  v_profile_role text;
  v_is_superadmin boolean:=false;
  v_can_browse_club boolean:=false;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v4_can_manage_training(p_team_season_id) then
    raise exception 'TRAINING_MANAGE_DENIED';
  end if;

  select ts.team_id, t.club_id, ts.season_id
    into v_team_id, v_club_id, v_season_id
  from public.team_seasons ts
  join public.teams t on t.id=ts.team_id
  where ts.id=p_team_season_id;

  if v_team_id is null then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  select upper(coalesce(pr.role,''))
    into v_profile_role
  from public.profiles pr
  where pr.id=auth.uid();

  v_is_superadmin:=public.iq_v3_is_global_superadmin();

  v_can_browse_club:=
    v_is_superadmin
    or v_profile_role in ('SUPERADMIN','ADMIN')
    or exists (
      select 1
      from public.club_season_memberships csm
      where csm.user_id=auth.uid()
        and csm.club_id=v_club_id
        and (csm.season_id is null or csm.season_id=v_season_id)
        and upper(coalesce(csm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
        and (csm.valid_from is null or csm.valid_from<=now())
        and (csm.valid_until is null or csm.valid_until>=now())
    );

  v_offset:=(v_page-1)*v_page_size;

  return query
  with current_roster as (
    select distinct on (rm.player_id)
      rm.player_id,
      rm.jersey,
      rm.primary_position
    from public.roster_memberships rm
    where rm.team_season_id=p_team_season_id
      and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
    order by rm.player_id, rm.updated_at desc nulls last, rm.created_at desc nulls last
  ),
  scoped as (
    select
      p.id as player_id,
      p.first_name,
      p.last_name,
      p.photo_url,
      coalesce(cr.jersey,p.jersey) as jersey,
      coalesce(nullif(cr.primary_position,''),p.primary_position) as primary_position,
      p.team_id,
      case when cr.player_id is not null then target_team.name else pt.name end as team_name,
      (cr.player_id is not null) as is_current_roster,
      (
        cr.player_id is not null
        or p.team_id=v_team_id
        or exists (
          select 1
          from public.roster_memberships rm_hist
          join public.team_seasons ts_hist on ts_hist.id=rm_hist.team_season_id
          where rm_hist.player_id=p.id and ts_hist.team_id=v_team_id
        )
      ) as is_current_team,
      case
        when cr.player_id is not null then 0
        when p.team_id=v_team_id or exists (
          select 1
          from public.roster_memberships rm_hist
          join public.team_seasons ts_hist on ts_hist.id=rm_hist.team_season_id
          where rm_hist.player_id=p.id and ts_hist.team_id=v_team_id
        ) then 1
        else 2
      end as priority
    from public.players p
    left join current_roster cr on cr.player_id=p.id
    left join public.teams pt on pt.id=p.team_id
    cross join lateral (
      select t.name from public.teams t where t.id=v_team_id
    ) target_team
    where
      (
        cr.player_id is not null
        or p.team_id=v_team_id
        or exists (
          select 1
          from public.roster_memberships rm_hist
          join public.team_seasons ts_hist on ts_hist.id=rm_hist.team_season_id
          where rm_hist.player_id=p.id and ts_hist.team_id=v_team_id
        )
        or (
          v_can_browse_club
          and exists (
            select 1 from public.teams pteam
            where pteam.id=p.team_id and pteam.club_id=v_club_id
          )
        )
        or v_is_superadmin
      )
      and (
        v_query=''
        or lower(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) like '%'||v_query||'%'
        or lower(coalesce(p.last_name,'')||' '||coalesce(p.first_name,'')) like '%'||v_query||'%'
        or lower(coalesce(pt.name,'')) like '%'||v_query||'%'
        or coalesce(p.jersey::text,'')=v_query
      )
  ),
  ranked as (
    select s.*,count(*) over() as total_count
    from scoped s
  )
  select
    r.player_id,r.first_name,r.last_name,r.photo_url,r.jersey,r.primary_position,
    r.team_id,r.team_name,r.is_current_roster,r.is_current_team,r.total_count
  from ranked r
  order by r.priority, r.jersey nulls last, lower(coalesce(r.last_name,'')), lower(coalesce(r.first_name,''))
  offset v_offset
  limit v_page_size;
end
$fn$;

revoke all on function public.iq_v56_search_training_players(uuid,text,integer,integer)
  from public,anon;
grant execute on function public.iq_v56_search_training_players(uuid,text,integer,integer)
  to authenticated;

comment on function public.iq_v56_search_training_players(uuid,text,integer,integer) is
'Paginated training player selector. Max 15 rows/page. Current team-season roster first; broader memory scope remains permission-bound.';

commit;
