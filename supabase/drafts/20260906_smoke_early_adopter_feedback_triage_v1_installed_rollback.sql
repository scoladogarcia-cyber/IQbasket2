-- Installed V20 functional smoke. Every mutation is rolled back.
begin;
create temporary table v20_feedback_triage_smoke_result(
  superadmin_list_ok boolean,
  review_audit_ok boolean,
  non_superadmin_denied boolean,
  direct_access_blocked boolean
) on commit drop;

do $v20_smoke$
declare
  v_superadmin uuid;
  v_other uuid;
  v_feedback uuid;
  v_list_ok boolean:=false;
  v_review_ok boolean:=false;
  v_denied boolean:=false;
  v_direct boolean:=false;
begin
  select up.id into v_superadmin
  from public.user_profiles up
  join public.user_account_controls c on c.user_id=up.id
  where c.account_status='ACTIVE'
    and upper(coalesce(up.global_role,up.role,''))='SUPERADMIN'
  order by up.id limit 1;

  select up.id into v_other
  from public.user_profiles up
  join public.user_account_controls c on c.user_id=up.id
  where c.account_status='ACTIVE'
    and upper(coalesce(up.global_role,up.role,''))<>'SUPERADMIN'
  order by up.id limit 1;

  if v_superadmin is null or v_other is null then
    raise exception 'EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_SMOKE_FIXTURE_MISSING';
  end if;

  insert into public.product_feedback(
    user_id,role_snapshot,category,severity,message,route,release_code,client_context,status
  ) values (
    v_other,'INVITADO','BUG','IMPORTANT','V20 transactional triage smoke','#/feedback',
    'smoke:v20','{"viewport":"390x844"}'::jsonb,'NEW'
  ) returning id into v_feedback;

  perform set_config('request.jwt.claim.sub',v_superadmin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  select exists (
    select 1 from public.iq_v20_list_product_feedback('NEW',100) f
    where f.feedback_id=v_feedback and f.status='NEW' and f.severity='IMPORTANT'
  ) into v_list_ok;

  perform public.iq_v20_review_product_feedback(v_feedback,'PLANNED','V20 smoke planned');
  select exists (
    select 1 from public.product_feedback f
    where f.id=v_feedback and f.status='PLANNED'
      and f.reviewed_by=v_superadmin and f.reviewed_at is not null
      and f.review_note='V20 smoke planned'
  ) into v_review_ok;

  perform set_config('request.jwt.claim.sub',v_other::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  begin
    perform 1 from public.iq_v20_list_product_feedback(null,10);
  exception when others then
    v_denied:=sqlerrm like '%PRODUCT_FEEDBACK_VIEW_DENIED%';
  end;

  v_direct:=not has_table_privilege('authenticated','public.product_feedback','SELECT')
    and not has_table_privilege('authenticated','public.product_feedback','UPDATE');

  if not v_list_ok or not v_review_ok or not v_denied or not v_direct then
    raise exception 'EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_SMOKE_FAILED';
  end if;
  insert into v20_feedback_triage_smoke_result values(v_list_ok,v_review_ok,v_denied,v_direct);
end
$v20_smoke$;

select 'EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_INSTALLED_SMOKE_ROLLBACK' as section,
  superadmin_list_ok,review_audit_ok,non_superadmin_denied,direct_access_blocked
from v20_feedback_triage_smoke_result;
rollback;
