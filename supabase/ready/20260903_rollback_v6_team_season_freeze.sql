-- IQBasket V6 · TEAM-SEASON FREEZE ROLLBACK
-- Non-destructive. Audit tables/columns remain. A frozen scope must be reopened first.
begin;

do $$
begin
  if exists (
    select 1 from public.team_seasons
    where upper(coalesce(data_status,'ACTIVE'))='FROZEN'
  ) then
    raise exception 'REOPEN_FROZEN_TEAM_SEASONS_BEFORE_V6_ROLLBACK';
  end if;
end $$;

drop policy if exists "v6 games unfrozen insert guard" on public.games;

drop trigger if exists trg_iq_v6_guard_frozen_team_season_game on public.games;
drop trigger if exists trg_iq_v6_guard_frozen_roster_membership on public.roster_memberships;
drop trigger if exists trg_iq_v6_guard_frozen_roster_stint on public.roster_membership_stints;

drop function if exists public.iq_v6_guard_frozen_team_season_game();
drop function if exists public.iq_v6_guard_frozen_roster_membership();
drop function if exists public.iq_v6_guard_frozen_roster_stint();

revoke all on function public.iq_v6_request_team_season_freeze(uuid,text) from authenticated;
revoke all on function public.iq_v6_set_team_season_data_state(uuid,text,text) from authenticated;
revoke all on function public.iq_v6_resolve_team_season_freeze_request(uuid,text,text) from authenticated;
revoke all on function public.iq_v6_can_manage_team_season_freeze(uuid) from authenticated;
revoke all on function public.iq_v6_can_request_team_season_freeze(uuid) from authenticated;
revoke all on function public.iq_v6_role_for_team_season(uuid) from authenticated;
revoke all on function public.iq_v6_team_season_freeze_capabilities() from authenticated;

-- Restore Phase 3F roster authorization (no data_status freeze condition).
create or replace function public.iq_v3_can_manage_roster(
  target_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1 from public.user_profiles up
        where up.id=auth.uid()
          and upper(coalesce(up.global_role,up.role,'USER'))='SUPERADMIN'
      )
      or exists (
        select 1 from public.team_season_memberships m
        where m.user_id=auth.uid()
          and m.team_season_id=target_team_season_id
          and upper(m.status)='ACTIVE'
          and upper(m.function_role) in (
            'ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE'
          )
      )
      or exists (
        select 1
        from public.team_seasons ts
        join public.teams t on t.id=ts.team_id
        join public.club_season_memberships cm
          on cm.club_id=t.club_id and cm.season_id=ts.season_id
        where ts.id=target_team_season_id
          and cm.user_id=auth.uid()
          and upper(cm.status)='ACTIVE'
          and upper(cm.function_role) in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO')
      )
    );
$$;

drop policy if exists iq_v6_team_season_freeze_requests_read
  on public.team_season_freeze_requests;
drop policy if exists iq_v6_team_season_freeze_history_read
  on public.team_season_freeze_history;

commit;
