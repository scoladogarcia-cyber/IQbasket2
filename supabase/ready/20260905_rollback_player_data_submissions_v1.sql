begin;

do $$
begin
  if to_regclass('public.player_data_submissions') is not null
     and exists (select 1 from public.player_data_submissions limit 1) then
    raise exception 'ROLLBACK_REFUSED_PLAYER_SUBMISSION_HISTORY_EXISTS';
  end if;
end $$;

drop trigger if exists trg_iq_v14_guard_validated_wellness_history
  on public.player360_wellness_entries;
drop function if exists iq_private.iq_v14_guard_validated_wellness_history();
drop function if exists public.iq_v14_review_player_submission(uuid,text,text);
drop function if exists public.iq_v14_list_player_submission_reviews(uuid,boolean,integer);
drop function if exists public.iq_v14_list_my_player_submissions(uuid,integer);
drop function if exists public.iq_v14_submit_player_submission(uuid);
drop function if exists public.iq_v14_save_player_submission_draft(uuid,uuid,uuid,text,jsonb);
drop function if exists iq_private.iq_v14_can_review_player_submission(uuid,uuid,text,jsonb);
drop function if exists iq_private.iq_v14_player_submission_is_self(uuid,uuid);
drop table if exists public.player_data_submissions;

commit;
