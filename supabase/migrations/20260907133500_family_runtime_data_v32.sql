-- =============================================================================
-- IQBasket · Family Runtime Data V32
-- Fixes modern season resolution for Family passport/context and adds a narrow,
-- read-only guardian access rule for linked-player Nutrition/Recovery.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- Preconditions
-- -----------------------------------------------------------------------------
do $preflight$
begin
  if to_regclass('public.season_catalog') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.player360_subject_relationships') is null
     or to_regclass('public.player360_processing_authorizations') is null
     or to_regprocedure('public.iq_v8_family_player_passport(uuid)') is null
     or to_regprocedure('public.iq_v8_family_player360_snapshot(uuid,uuid)') is null
     or to_regprocedure('iq_private.family_can_view_player(uuid,uuid)') is null
     or to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is null
     or to_regprocedure('public.iq_v7_unchecked_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is null
     or to_regprocedure('iq_private.iq_v22_submission_materialization_allowed(uuid,uuid,text,text,text)') is null then
    raise exception 'FAMILY_RUNTIME_DATA_V32_PREREQUISITES_MISSING';
  end if;
end
$preflight$;

-- -----------------------------------------------------------------------------
-- Family player list using the authoritative season_catalog used by team_seasons.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v32_family_list_players()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  with rel as (
    select r.id as relationship_id,r.player_id,r.relationship_type,r.status,
           r.valid_from,r.valid_until,true as can_revoke
    from public.player360_subject_relationships r
    where r.user_id=auth.uid() and r.status='ACTIVE'
      and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
      and r.relationship_type in ('SELF','GUARDIAN')
    union all
    select null::uuid,up.linked_player_id,
           case when upper(coalesce(up.global_role,up.role,''))='JUGADOR' then 'SELF' else 'GUARDIAN' end,
           'ACTIVE',up.created_at,null::timestamptz,false
    from public.user_profiles up
    where up.id=auth.uid() and up.linked_player_id is not null
      and upper(coalesce(up.global_role,up.role,'')) in ('JUGADOR','FAMILIA_TUTOR')
      and not exists (
        select 1 from public.player360_subject_relationships r
        where r.user_id=up.id and r.player_id=up.linked_player_id
          and r.status='ACTIVE' and r.valid_from<=now()
          and (r.valid_until is null or r.valid_until>now())
      )
  ), dedup as (
    select distinct on (player_id) * from rel
    order by player_id,case relationship_type when 'SELF' then 0 else 1 end,valid_from desc
  )
  select case when auth.uid() is null or not public.iq_account_is_active() then '[]'::jsonb
  else coalesce(jsonb_agg(jsonb_build_object(
    'relationship_id',d.relationship_id,
    'relationship_type',d.relationship_type,
    'can_revoke',d.can_revoke,
    'player',jsonb_build_object(
      'id',p.id,'first_name',p.first_name,'last_name',p.last_name,
      'photo_url',p.photo_url,'primary_position',p.primary_position
    ),
    'latest_context',case when ctx.team_season_id is null then null else jsonb_build_object(
      'team_season_id',ctx.team_season_id,'team_id',ctx.team_id,
      'team_name',ctx.team_name,'club_name',ctx.club_name,
      'season_name',ctx.season_name,'season_start',ctx.start_date,'season_end',ctx.end_date,
      'jersey',ctx.jersey,'primary_position',ctx.primary_position
    ) end
  ) order by coalesce(ctx.end_date,ctx.start_date) desc nulls last),'[]'::jsonb) end
  from dedup d
  join public.players p on p.id=d.player_id
  left join lateral (
    select rm.team_season_id,ts.team_id,t.name as team_name,c.name as club_name,
           sc.name as season_name,sc.start_date,sc.end_date,rm.jersey,rm.primary_position
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    join public.teams t on t.id=ts.team_id
    left join public.clubs c on c.id=t.club_id
    join public.season_catalog sc on sc.id=ts.season_id
    where rm.player_id=d.player_id
      and upper(coalesce(rm.status,'ACTIVE'))='ACTIVE'
    order by coalesce(sc.end_date,sc.start_date) desc nulls last,rm.updated_at desc
    limit 1
  ) ctx on true;
$function$;

-- -----------------------------------------------------------------------------
-- Passport V32: keep the already-authorized V8 profile/totals/recent timeline,
-- replacing only the career projection with the modern season catalog.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v32_family_player_passport(p_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_base jsonb;
  v_career jsonb:='[]'::jsonb;
  v_history_allowed boolean:=false;
begin
  v_base:=public.iq_v8_family_player_passport(p_player_id);
  v_history_allowed:=coalesce((v_base#>>'{section_access,game_history}')::boolean,false);

  if v_history_allowed then
    select coalesce(jsonb_agg(jsonb_build_object(
      'team_season_id',rm.team_season_id,'team_id',ts.team_id,
      'team_name',t.name,'club_name',c.name,'season_name',sc.name,
      'season_start',sc.start_date,'season_end',sc.end_date,
      'membership_status',rm.status,'jersey',rm.jersey,
      'primary_position',rm.primary_position,
      'stints',coalesce(st.stints,'[]'::jsonb),
      'games',coalesce(gs.games,0),'minutes',coalesce(gs.minutes,0),
      'points',coalesce(gs.points,0),'rebounds',coalesce(gs.rebounds,0),
      'assists',coalesce(gs.assists,0),'steals',coalesce(gs.steals,0),
      'blocks',coalesce(gs.blocks,0),'turnovers',coalesce(gs.turnovers,0),
      'fg2_made',coalesce(gs.fg2_made,0),'fg2_attempted',coalesce(gs.fg2_attempted,0),
      'fg3_made',coalesce(gs.fg3_made,0),'fg3_attempted',coalesce(gs.fg3_attempted,0),
      'ft_made',coalesce(gs.ft_made,0),'ft_attempted',coalesce(gs.ft_attempted,0),
      'training_sessions',coalesce(tr.sessions,0),'training_minutes',coalesce(tr.minutes,0),
      'technification_sessions',coalesce(ed.sessions,0),'technification_minutes',coalesce(ed.minutes,0)
    ) order by coalesce(sc.end_date,sc.start_date) desc nulls last),'[]'::jsonb)
    into v_career
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    join public.teams t on t.id=ts.team_id
    left join public.clubs c on c.id=t.club_id
    join public.season_catalog sc on sc.id=ts.season_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'valid_from',rs.valid_from,'valid_until',rs.valid_until,'source',rs.source
      ) order by rs.valid_from) as stints
      from public.roster_membership_stints rs
      where rs.roster_membership_id=rm.id
    ) st on true
    left join lateral (
      select count(*)::integer games,
        coalesce(sum(pgs.minutes),0)::integer minutes,
        coalesce(sum(pgs.points),0)::integer points,
        coalesce(sum(coalesce(pgs.off_reb,pgs.rebounds_offensive,0)+coalesce(pgs.def_reb,pgs.rebounds_defensive,0)),0)::integer rebounds,
        coalesce(sum(pgs.assists),0)::integer assists,
        coalesce(sum(pgs.steals),0)::integer steals,
        coalesce(sum(coalesce(pgs.blocks,pgs.blocks_made,0)),0)::integer blocks,
        coalesce(sum(pgs.turnovers),0)::integer turnovers,
        coalesce(sum(pgs.fg2_made),0)::integer fg2_made,
        coalesce(sum(pgs.fg2_attempted),0)::integer fg2_attempted,
        coalesce(sum(pgs.fg3_made),0)::integer fg3_made,
        coalesce(sum(pgs.fg3_attempted),0)::integer fg3_attempted,
        coalesce(sum(pgs.ft_made),0)::integer ft_made,
        coalesce(sum(pgs.ft_attempted),0)::integer ft_attempted
      from public.player_game_stats pgs
      join public.games g on g.id=pgs.game_id
      where pgs.player_id=p_player_id and g.team_season_id=rm.team_season_id
    ) gs on true
    left join lateral (
      select count(*)::integer sessions,
             coalesce(sum(tp.participated_minutes),0)::integer minutes
      from public.training_participants tp
      where tp.player_id=p_player_id and tp.team_season_id=rm.team_season_id
    ) tr on true
    left join lateral (
      select count(*)::integer sessions,
             coalesce(sum(ed.duration_minutes),0)::integer minutes
      from public.external_development_sessions ed
      where ed.player_id=p_player_id and ed.team_season_id=rm.team_season_id
    ) ed on true
    where rm.player_id=p_player_id;
  end if;

  return jsonb_set(v_base,'{career}',v_career,true);
end
$function$;

-- Resolve the modern team-season before delegating to the existing commercial
-- Player360 gate. This fixes NO_SEASON_DATA without widening paid entitlements.
create or replace function public.iq_v32_family_player360_snapshot(
  p_player_id uuid,
  p_team_season_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_team_season_id uuid:=p_team_season_id;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not iq_private.family_can_view_player(auth.uid(),p_player_id) then
    raise exception 'FAMILY_PLAYER_ACCESS_DENIED' using errcode='42501';
  end if;

  if v_team_season_id is null then
    select rm.team_season_id into v_team_season_id
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    join public.season_catalog sc on sc.id=ts.season_id
    where rm.player_id=p_player_id
      and upper(coalesce(rm.status,'ACTIVE'))='ACTIVE'
    order by coalesce(sc.end_date,sc.start_date) desc nulls last,rm.updated_at desc
    limit 1;
  end if;

  return public.iq_v8_family_player360_snapshot(p_player_id,v_team_season_id);
end
$function$;

-- -----------------------------------------------------------------------------
-- Narrow linked-guardian wellness READ rule.
-- A verified active guardian may read Nutrition/Recovery for the linked player
-- when processing for that module is active. It does NOT grant write, archive,
-- export, AI processing, Neuro-Cognitive access, or access to another player.
-- -----------------------------------------------------------------------------
create or replace function iq_private.iq_v32_guardian_linked_wellness_read_allowed(
  p_player_id uuid,
  p_team_season_id uuid,
  p_module text,
  p_action text,
  p_purpose text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and public.iq_account_is_active()
    and lower(trim(coalesce(p_module,''))) in ('nutrition','recovery')
    and upper(trim(coalesce(p_action,'')))='READ'
    and upper(trim(coalesce(p_purpose,'')))='FAMILY_SUPPORT'
    and exists (
      select 1 from public.roster_memberships rm
      where rm.player_id=p_player_id
        and rm.team_season_id=p_team_season_id
        and upper(coalesce(rm.status,'ACTIVE'))='ACTIVE'
    )
    and exists (
      select 1 from public.player360_subject_relationships r
      where r.user_id=auth.uid()
        and r.player_id=p_player_id
        and r.relationship_type='GUARDIAN'
        and r.status='ACTIVE'
        and r.revoked_at is null
        and r.valid_from<=now()
        and (r.valid_until is null or r.valid_until>now())
    )
    and exists (
      select 1 from public.player360_processing_authorizations a
      where a.player_id=p_player_id
        and a.team_season_id=p_team_season_id
        and a.status='ACTIVE'
        and a.valid_from<=now()
        and (a.valid_until is null or a.valid_until>now())
        and lower(trim(coalesce(p_module,'')))=any(a.modules)
    );
$function$;

create or replace function public.iq_v4e_can_access_sensitive_resource(
  p_player_id uuid,
  p_team_season_id uuid,
  p_module text,
  p_action text,
  p_purpose text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select public.iq_account_is_active()
    and (
      public.iq_v7_unchecked_v4e_can_access_sensitive_resource(
        p_player_id,p_team_season_id,p_module,p_action,p_purpose
      )
      or iq_private.iq_v22_submission_materialization_allowed(
        p_player_id,p_team_season_id,p_module,p_action,p_purpose
      )
      or iq_private.iq_v32_guardian_linked_wellness_read_allowed(
        p_player_id,p_team_season_id,p_module,p_action,p_purpose
      )
    );
$function$;

-- -----------------------------------------------------------------------------
-- RPC surface / least privilege
-- -----------------------------------------------------------------------------
revoke all on function public.iq_v32_family_list_players() from public,anon,authenticated;
revoke all on function public.iq_v32_family_player_passport(uuid) from public,anon,authenticated;
revoke all on function public.iq_v32_family_player360_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.iq_v32_family_list_players() to authenticated;
grant execute on function public.iq_v32_family_player_passport(uuid) to authenticated;
grant execute on function public.iq_v32_family_player360_snapshot(uuid,uuid) to authenticated;

revoke all on function iq_private.iq_v32_guardian_linked_wellness_read_allowed(uuid,uuid,text,text,text)
  from public,anon,authenticated;

-- Preserve the existing public access contract of the central ABAC wrapper.
revoke all on function public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)
  to authenticated;

commit;
