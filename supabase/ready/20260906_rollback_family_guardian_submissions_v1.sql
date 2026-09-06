-- Controlled rollback for V18.
-- psql \ir resolves this path relative to the current script directory.
-- First restore the exact versioned V14 public functions / guard.
\ir 20260905_apply_player_data_submissions_v1.sql

begin;

do $v18_rollback_guard$
begin
  if exists (
    select 1
    from public.player_data_submissions
    where actor_relation='GUARDIAN'
  ) then
    raise exception 'FAMILY_GUARDIAN_SUBMISSIONS_V1_ROLLBACK_GUARDIAN_DATA_PRESENT';
  end if;
end
$v18_rollback_guard$;

drop function if exists public.iq_v18_review_player_submission(uuid,text,text);
drop function if exists public.iq_v18_list_player_submission_reviews(uuid,boolean,integer);
drop function if exists public.iq_v18_list_my_player_submissions(uuid,uuid,integer);
drop function if exists public.iq_v18_submit_player_submission(uuid);
drop function if exists public.iq_v18_save_player_submission_draft(uuid,uuid,uuid,text,jsonb);
drop function if exists iq_private.iq_v18_validate_submission_payload(text,jsonb);
drop function if exists iq_private.iq_v18_player_submission_relation(uuid,uuid);

alter table public.player_data_submissions
  drop constraint if exists player_data_submissions_actor_relation_check;
alter table public.player_data_submissions
  drop column if exists actor_relation;

commit;
