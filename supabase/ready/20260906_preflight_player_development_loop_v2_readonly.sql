-- IQBasket · Player Development Loop V2 · read-only preflight
-- Must not modify schema or data.

do $v2_preflight$
begin
  if to_regclass('public.player_development_cycles') is not null
     or to_regclass('public.player_development_actions') is not null
     or to_regclass('public.player_development_action_evidence') is not null then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_ALREADY_INSTALLED';
  end if;

  if to_regclass('public.player_objective_profiles') is null
     or to_regclass('public.player_objective_targets') is null
     or to_regclass('public.training_sessions') is null
     or to_regclass('public.external_development_sessions') is null
     or to_regclass('public.games') is null
     or to_regprocedure('public.iq_v4_can_manage_objective_profile(uuid)') is null
     or to_regprocedure('public.iq_saas_entitlement_check(text,uuid,uuid,text,integer)') is null then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_PREREQUISITES_MISSING';
  end if;
  if not exists (
    select 1
    from public.player_objective_profiles op
    join public.team_seasons ts on ts.id=op.team_season_id
    join public.player_objective_targets ot on ot.profile_id=op.id
    join public.player_game_stats pgs on pgs.player_id=op.player_id
    join public.games g on g.id=pgs.game_id and g.team_season_id=op.team_season_id
    where op.status='ACTIVE'
      and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
      and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
      and exists (
        select 1 from public.roster_memberships rm
        where rm.team_season_id=op.team_season_id
          and rm.player_id=op.player_id
      )
  ) then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_SMOKE_CONTEXT_MISSING';
  end if;
end
$v2_preflight$;

select
  'PLAYER_DEVELOPMENT_LOOP_V2_PREFLIGHT' as section,
  true as phase_ok;
