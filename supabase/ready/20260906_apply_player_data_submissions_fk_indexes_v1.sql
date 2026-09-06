begin;

-- Cover the reviewer audit FK without changing the submission workflow.
create index if not exists player_data_submissions_reviewed_by_fk_idx
  on public.player_data_submissions(reviewed_by);

commit;
