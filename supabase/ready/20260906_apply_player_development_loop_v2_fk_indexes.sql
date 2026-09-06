-- IQBasket · Player Development Loop V2 · FK index hardening
-- Additive/idempotent patch for an already-installed V16 schema.

begin;

create index if not exists player_development_action_cycle_scope_fk_idx
  on public.player_development_actions(
    cycle_id,
    team_season_id,
    player_id
  );

create index if not exists player_development_evidence_action_scope_fk_idx
  on public.player_development_action_evidence(
    action_id,
    cycle_id,
    team_season_id,
    player_id
  );

commit;
