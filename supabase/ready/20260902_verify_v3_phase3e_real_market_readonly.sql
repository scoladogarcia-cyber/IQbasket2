-- =============================================================================
-- IQBasket v3 · PHASE 3E REAL DATABASE MARKET VERIFICATION · READ ONLY
-- Date: 2026-09-02
--
-- Intended for GitHub Actions using SUPABASE_DB_URL.
-- Performs no persistent writes. Transaction is READ ONLY and ends ROLLBACK.
-- =============================================================================

begin read only;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'afdf727e-8aa4-43b2-8ee4-bfc63a715a51',
    'role', 'authenticated',
    'email', 'scolado@nechigroup.com'
  )::text,
  true
);

set local role authenticated;

do $$
declare
  v_target_team_season_id uuid;
  v_target_season_id uuid;
  v_candidates integer;
  v_bad_scope integer;
  v_caps jsonb;
begin
  if auth.uid() is null or not public.iq_v3_is_global_superadmin() then
    raise exception 'PHASE3E_REAL_DB_AUTH_CONTEXT_FAILED';
  end if;

  select target.id
    into v_target_team_season_id
  from public.team_seasons target
  where exists (
    select 1
    from public.team_seasons src
    join public.roster_memberships rm
      on rm.team_season_id = src.id
    join public.roster_membership_stints rs
      on rs.roster_membership_id = rm.id
     and rs.valid_until is null
    where src.season_id = target.season_id
      and src.id <> target.id
  )
  order by target.created_at desc
  limit 1;

  if v_target_team_season_id is null then
    raise exception 'PHASE3E_REAL_DB_NO_MARKET_TARGET';
  end if;

  select ts.season_id
    into v_target_season_id
  from public.team_seasons ts
  where ts.id = v_target_team_season_id;

  select count(*)
    into v_candidates
  from public.iq_v3_list_transfer_market(v_target_team_season_id);

  if v_candidates <= 0 then
    raise exception 'PHASE3E_REAL_DB_MARKET_EMPTY';
  end if;

  select count(*)
    into v_bad_scope
  from public.iq_v3_list_transfer_market(v_target_team_season_id) m
  where m.from_team_season_id = v_target_team_season_id
     or m.global_season_id is distinct from v_target_season_id
     or m.player_id is null
     or m.source_team_id is null;

  if v_bad_scope <> 0 then
    raise exception 'PHASE3E_REAL_DB_MARKET_SCOPE_INVALID: %', v_bad_scope;
  end if;

  v_caps := public.iq_v3_transfer_request_capabilities();

  if coalesce((v_caps ->> 'market_directory')::boolean, false) is not true then
    raise exception 'PHASE3E_REAL_DB_MARKET_CAPABILITY_MISSING';
  end if;

  if coalesce(v_caps ->> 'market_profile_scope', '') <> 'MINIMAL_SEASONAL_V1' then
    raise exception 'PHASE3E_REAL_DB_MARKET_PROFILE_SCOPE_INVALID';
  end if;

  raise notice
    'PHASE3E_REAL_DB_READONLY_OK target_team_season=% candidates=%',
    v_target_team_season_id,
    v_candidates;
end $$;

select
  'PHASE3E_REAL_DB_READONLY' as section,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (
    select count(*)
    from public.player_game_stats pgs
    join public.games g on g.id = pgs.game_id
    where g.team_season_id is not null
      and not public.iq_v3_player_eligible_on_date(
        pgs.player_id,
        g.team_season_id,
        g.date::date
      )
  ) as invalid_stats,
  (
    select count(*)
    from public.game_events ge
    join public.games g on g.id = ge.game_id
    where ge.player_id is not null
      and g.team_season_id is not null
      and not public.iq_v3_player_eligible_on_date(
        ge.player_id,
        g.team_season_id,
        g.date::date
      )
  ) as invalid_events,
  true as read_only_check_completed;

reset role;

rollback;
