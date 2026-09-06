-- IQBasket V20 - Early Adopter Feedback Triage V1
-- SUPERADMIN-only review boundary for Early Access product feedback.
begin;

do $v20_prereq$
begin
  if to_regclass('public.product_feedback') is null
     or to_regprocedure('public.iq_v19_submit_product_feedback(text,text,text,text,text,jsonb)') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null then
    raise exception 'EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_PREREQUISITES_MISSING';
  end if;
end
$v20_prereq$;

alter table public.product_feedback
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

do $v20_note_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.product_feedback'::regclass
      and conname='product_feedback_review_note_ck'
  ) then
    alter table public.product_feedback
      add constraint product_feedback_review_note_ck
      check (review_note is null or char_length(review_note) <= 2000);
  end if;
end
$v20_note_constraint$;

create index if not exists product_feedback_status_updated_at_idx
  on public.product_feedback(status, updated_at desc);
create index if not exists product_feedback_reviewed_by_idx
  on public.product_feedback(reviewed_by);

create or replace function public.iq_v20_list_product_feedback(
  p_status text default null,
  p_limit integer default 100
) returns table(
  feedback_id uuid,
  user_id uuid,
  submitter_name text,
  submitter_email text,
  role_snapshot text,
  category text,
  severity text,
  message text,
  route text,
  release_code text,
  client_context jsonb,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  reviewed_by uuid,
  reviewer_name text,
  reviewed_at timestamptz,
  review_note text
)
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_status text:=nullif(upper(trim(coalesce(p_status,''))), '');
  v_limit integer:=least(greatest(coalesce(p_limit,100),1),300);
begin
  if auth.uid() is null or not public.iq_v3_is_global_superadmin() then
    raise exception 'PRODUCT_FEEDBACK_VIEW_DENIED' using errcode='42501';
  end if;
  if v_status is not null
     and v_status not in ('NEW','REVIEWING','PLANNED','RESOLVED','DISMISSED') then
    raise exception 'PRODUCT_FEEDBACK_STATUS_INVALID' using errcode='22023';
  end if;

  return query
  select
    f.id,
    f.user_id,
    coalesce(
      nullif(trim(concat_ws(' ',submitter.first_name,submitter.last_name)),''),
      submitter.email,
      'Usuario'
    )::text,
    submitter.email::text,
    f.role_snapshot,
    f.category,
    f.severity,
    f.message,
    f.route,
    f.release_code,
    f.client_context,
    f.status,
    f.created_at,
    f.updated_at,
    f.reviewed_by,
    coalesce(
      nullif(trim(concat_ws(' ',reviewer.first_name,reviewer.last_name)),''),
      reviewer.email,
      case when f.reviewed_by is null then null else 'SUPERADMIN' end
    )::text,
    f.reviewed_at,
    f.review_note
  from public.product_feedback f
  left join public.user_profiles submitter on submitter.id=f.user_id
  left join public.user_profiles reviewer on reviewer.id=f.reviewed_by
  where v_status is null or f.status=v_status
  order by
    case f.severity when 'BLOCKER' then 0 when 'IMPORTANT' then 1 when 'MINOR' then 2 else 3 end,
    f.created_at desc
  limit v_limit;
end;
$function$;

revoke all on function public.iq_v20_list_product_feedback(text,integer)
  from public,anon,authenticated;
grant execute on function public.iq_v20_list_product_feedback(text,integer)
  to authenticated;

create or replace function public.iq_v20_review_product_feedback(
  p_feedback_id uuid,
  p_status text,
  p_note text default null
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_status text:=upper(trim(coalesce(p_status,'')));
  v_note text:=nullif(trim(coalesce(p_note,'')), '');
  v_updated integer:=0;
begin
  if auth.uid() is null or not public.iq_v3_is_global_superadmin() then
    raise exception 'PRODUCT_FEEDBACK_REVIEW_DENIED' using errcode='42501';
  end if;
  if p_feedback_id is null then
    raise exception 'PRODUCT_FEEDBACK_ID_REQUIRED' using errcode='22023';
  end if;
  if v_status not in ('NEW','REVIEWING','PLANNED','RESOLVED','DISMISSED') then
    raise exception 'PRODUCT_FEEDBACK_STATUS_INVALID' using errcode='22023';
  end if;
  if char_length(coalesce(v_note,'')) > 2000 then
    raise exception 'PRODUCT_FEEDBACK_REVIEW_NOTE_TOO_LONG' using errcode='22023';
  end if;
  if v_status='DISMISSED' and v_note is null then
    raise exception 'PRODUCT_FEEDBACK_DISMISS_NOTE_REQUIRED' using errcode='22023';
  end if;

  update public.product_feedback
  set status=v_status,
      review_note=v_note,
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      updated_at=now()
  where id=p_feedback_id;
  get diagnostics v_updated=row_count;
  if v_updated<>1 then
    raise exception 'PRODUCT_FEEDBACK_NOT_FOUND' using errcode='P0002';
  end if;
  return true;
end;
$function$;

revoke all on function public.iq_v20_review_product_feedback(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.iq_v20_review_product_feedback(uuid,text,text)
  to authenticated;

-- Direct browser access remains forbidden. V20 operates through narrow RPCs only.
revoke all on table public.product_feedback from public,anon,authenticated;

comment on column public.product_feedback.reviewed_by is
  'SUPERADMIN who last triaged the feedback through the V20 RPC boundary.';
comment on column public.product_feedback.review_note is
  'Internal triage note, max 2000 chars. Never exposed outside SUPERADMIN RPCs.';

do $v20_verify$
begin
  if not (select relrowsecurity from pg_class where oid='public.product_feedback'::regclass) then
    raise exception 'EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_RLS_REQUIRED';
  end if;
  if has_table_privilege('authenticated','public.product_feedback','SELECT')
     or has_table_privilege('authenticated','public.product_feedback','UPDATE') then
    raise exception 'EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_DIRECT_TABLE_ACCESS_OPEN';
  end if;
  if has_function_privilege('anon','public.iq_v20_list_product_feedback(text,integer)','EXECUTE')
     or has_function_privilege('anon','public.iq_v20_review_product_feedback(uuid,text,text)','EXECUTE') then
    raise exception 'EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_ANON_RPC_OPEN';
  end if;
end
$v20_verify$;

commit;
