-- Controlled rollback for V20. Refuses to discard real triage audit data.
begin;

drop function if exists public.iq_v20_review_product_feedback(uuid,text,text);
drop function if exists public.iq_v20_list_product_feedback(text,integer);

do $v20_rollback_guard$
begin
  if exists (
    select 1 from public.product_feedback
    where reviewed_by is not null or reviewed_at is not null or review_note is not null
  ) then
    raise exception 'EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_ROLLBACK_REVIEW_DATA_PRESENT';
  end if;
end
$v20_rollback_guard$;

drop index if exists public.product_feedback_reviewed_by_idx;
drop index if exists public.product_feedback_status_updated_at_idx;
alter table public.product_feedback drop constraint if exists product_feedback_review_note_ck;
alter table public.product_feedback
  drop column if exists review_note,
  drop column if exists reviewed_at,
  drop column if exists reviewed_by;

commit;
