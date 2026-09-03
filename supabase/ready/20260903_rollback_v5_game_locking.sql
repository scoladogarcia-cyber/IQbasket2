-- =============================================================================
-- IQBasket V5 · Non-destructive game locking rollback
-- Restores pre-lock edit/delete semantics while preserving additive audit data.
-- =============================================================================
begin;

drop trigger if exists trg_iq_v5_guard_game_lock_transition on public.games;

create or replace function public.iq_v3_can_edit_game(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.games g
    where g.id = target_game_id
      and g.team_season_id is not null
      and public.iq_v3_has_team_season_role(
        g.team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA']::text[]
      )
  );
$$;

create or replace function public.iq_v3_can_delete_game(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.games g
    where g.id = target_game_id
      and g.team_season_id is not null
      and public.iq_v3_has_team_season_role(
        g.team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
      )
  );
$$;

revoke execute on function public.iq_v5_request_game_lock(uuid,text) from authenticated;
revoke execute on function public.iq_v5_set_game_edit_state(uuid,text,text) from authenticated;
revoke execute on function public.iq_v5_resolve_game_lock_request(uuid,text,text) from authenticated;

commit;
