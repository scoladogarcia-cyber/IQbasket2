-- IQBasket Player Passport V1 - explicit RLS deny policies + FK lookup indexes.
begin;

alter table public.player360_evaluation_rubrics enable row level security;
alter table public.player360_evaluation_rubric_anchors enable row level security;
alter table public.player_evaluation_evidence enable row level security;
alter table public.player360_measurements enable row level security;

revoke all on public.player360_evaluation_rubrics,public.player360_evaluation_rubric_anchors,
  public.player_evaluation_evidence,public.player360_measurements from public,anon,authenticated;

drop policy if exists iq_player_passport_rubrics_no_direct on public.player360_evaluation_rubrics;
create policy iq_player_passport_rubrics_no_direct
  on public.player360_evaluation_rubrics for all to anon,authenticated
  using(false) with check(false);

drop policy if exists iq_player_passport_rubric_anchors_no_direct on public.player360_evaluation_rubric_anchors;
create policy iq_player_passport_rubric_anchors_no_direct
  on public.player360_evaluation_rubric_anchors for all to anon,authenticated
  using(false) with check(false);

drop policy if exists iq_player_passport_evidence_no_direct on public.player_evaluation_evidence;
create policy iq_player_passport_evidence_no_direct
  on public.player_evaluation_evidence for all to anon,authenticated
  using(false) with check(false);

drop policy if exists iq_player_passport_measurements_no_direct on public.player360_measurements;
create policy iq_player_passport_measurements_no_direct
  on public.player360_measurements for all to anon,authenticated
  using(false) with check(false);

create index if not exists idx_player_evaluation_evidence_score
  on public.player_evaluation_evidence(evaluation_score_id);
create index if not exists idx_player360_measurements_team_season
  on public.player360_measurements(team_season_id,measured_at desc)
  where team_season_id is not null;

commit;
