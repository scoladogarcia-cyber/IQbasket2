-- =============================================================================
-- IQBasket · Player Journey V1 · FK index hardening
-- Date: 2026-09-05
-- Additive performance patch after production advisor review.
-- =============================================================================

begin;

do $player_journey_index_prereq$
begin
  if to_regclass('public.player_micro_challenges') is null then
    raise exception 'PLAYER_JOURNEY_V1_REQUIRED';
  end if;
end
$player_journey_index_prereq$;

-- The longitudinal lookup index starts with player_id and therefore does not
-- cover FK operations that begin from team_season_id. Keep both access paths.
create index if not exists player_micro_challenge_team_season_fk_idx
  on public.player_micro_challenges(team_season_id);

do $player_journey_index_verify$
begin
  if to_regclass('public.player_micro_challenge_team_season_fk_idx') is null then
    raise exception 'PLAYER_JOURNEY_TEAM_SEASON_FK_INDEX_MISSING';
  end if;
end
$player_journey_index_verify$;

commit;
