-- =============================================================================
-- IQBasket V40 · Safe game deletion boundary
--
-- Fixes the false-success deletion path in the browser. A game may have an
-- immutable play-state trail (ON DELETE RESTRICT), so deletion must be handled
-- atomically in the database instead of firing unrelated deletes in parallel.
--
-- Product rule:
-- - only users already authorized by iq_private.can_delete_game may delete;
-- - linked development evidence or generated reports block destructive delete;
-- - lifecycle/system rows are removed only inside this privileged transaction;
-- - a compact, non-sensitive deletion audit survives the game row.
-- =============================================================================

begin;

create schema if not exists iq_v40_private;
revoke all on schema iq_v40_private from public, anon, authenticated;
grant usage on schema iq_v40_private to authenticated;

create table if not exists public.game_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  team_id uuid not null,
  team_season_id uuid null,
  deleted_by uuid not null,
  deleted_at timestamptz not null default now(),
  opponent text null,
  game_date date null,
  play_state text null,
  reason text null,
  deleted_counts jsonb not null default '{}'::jsonb
);

create index if not exists idx_game_deletion_audit_game_id
  on public.game_deletion_audit(game_id);
create index if not exists idx_game_deletion_audit_team_id_deleted_at
  on public.game_deletion_audit(team_id, deleted_at desc);

alter table public.game_deletion_audit enable row level security;
revoke all on table public.game_deletion_audit from public, anon, authenticated;

create or replace function iq_v40_private.delete_game(
  p_game_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_game public.games%rowtype;
  v_counts jsonb;
  v_reports bigint := 0;
  v_development_refs bigint := 0;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_game_id is null then
    raise exception 'GAME_DELETE_ID_REQUIRED' using errcode='22023';
  end if;
  if p_reason is not null and char_length(trim(p_reason)) > 500 then
    raise exception 'GAME_DELETE_REASON_TOO_LONG' using errcode='22023';
  end if;

  select * into v_game
  from public.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'GAME_DELETE_NOT_FOUND' using errcode='P0002';
  end if;

  if not iq_private.can_delete_game(p_game_id) then
    raise exception 'GAME_DELETE_DENIED' using errcode='42501';
  end if;

  select count(*) into v_reports
  from public.reports
  where game_id = p_game_id;

  select count(*) into v_development_refs
  from public.player_development_action_evidence
  where game_id = p_game_id;

  if v_reports > 0 or v_development_refs > 0 then
    raise exception 'GAME_DELETE_REFERENCED' using
      errcode='23503',
      detail=format('reports=%s development_evidence=%s', v_reports, v_development_refs);
  end if;

  select jsonb_build_object(
    'player_game_stats', (select count(*) from public.player_game_stats where game_id=p_game_id),
    'team_game_stats', (select count(*) from public.team_game_stats where game_id=p_game_id),
    'period_scores', (select count(*) from public.game_period_scores where game_id=p_game_id),
    'game_events', (select count(*) from public.game_events where game_id=p_game_id),
    'play_by_play', (select count(*) from public.play_by_play_events where game_id=p_game_id),
    'lineups', (select count(*) from public.lineup_game_stats where game_id=p_game_id),
    'state_transitions', (select count(*) from public.game_play_state_transitions where game_id=p_game_id)
  ) into v_counts;

  insert into public.game_deletion_audit(
    game_id,
    team_id,
    team_season_id,
    deleted_by,
    opponent,
    game_date,
    play_state,
    reason,
    deleted_counts
  ) values (
    v_game.id,
    v_game.team_id,
    v_game.team_season_id,
    auth.uid(),
    left(coalesce(v_game.opponent,''), 200),
    v_game.date,
    upper(coalesce(v_game.play_state,'SCHEDULED')),
    nullif(trim(coalesce(p_reason,'')), ''),
    v_counts
  );

  -- NO ACTION children must be removed explicitly. Cascade-owned children are
  -- intentionally left to PostgreSQL so the relationship stays authoritative.
  delete from public.team_game_stats where game_id = p_game_id;
  delete from public.player_game_stats where game_id = p_game_id;

  -- This table is deliberately RESTRICT to protect lifecycle history from ad-hoc
  -- browser deletes. Only this audited privileged transaction may remove it.
  delete from public.game_play_state_transitions where game_id = p_game_id;

  delete from public.games where id = p_game_id;
  if not found then
    raise exception 'GAME_DELETE_FAILED' using errcode='P0001';
  end if;

  return jsonb_build_object(
    'deleted', true,
    'game_id', p_game_id,
    'deleted_counts', v_counts
  );
end;
$function$;

revoke all on function iq_v40_private.delete_game(uuid,text)
  from public, anon, authenticated;
grant execute on function iq_v40_private.delete_game(uuid,text)
  to authenticated;

create or replace function public.iq_v40_delete_game(
  p_game_id uuid,
  p_reason text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select iq_v40_private.delete_game(p_game_id, p_reason);
$function$;

revoke all on function public.iq_v40_delete_game(uuid,text)
  from public, anon, authenticated;
grant execute on function public.iq_v40_delete_game(uuid,text)
  to authenticated;

commit;