-- Installed V19 feedback smoke. All rows are rolled back.
begin;
create temporary table v19_feedback_smoke_result(
  submit_ok boolean,
  provenance_ok boolean,
  direct_access_blocked boolean
) on commit drop;

do $v19_smoke$
declare
  v_user uuid;
  v_feedback uuid;
  v_submit_ok boolean:=false;
  v_provenance_ok boolean:=false;
  v_direct_access_blocked boolean:=false;
begin
  select up.id into v_user
  from public.user_profiles up
  join public.user_account_controls c on c.user_id=up.id
  where c.account_status='ACTIVE'
  order by up.id
  limit 1;

  if v_user is null then
    raise exception 'EARLY_ADOPTER_FEEDBACK_V1_SMOKE_FIXTURE_MISSING';
  end if;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  v_feedback:=public.iq_v19_submit_product_feedback(
    'BUG','MINOR','V19 transactional smoke','#/feedback',
    'smoke:rollback',jsonb_build_object('viewport','390x844','online',true)
  );

  v_submit_ok:=v_feedback is not null and exists (
    select 1 from public.product_feedback f
    where f.id=v_feedback and f.user_id=v_user and f.category='BUG' and f.severity='MINOR'
  );

  v_provenance_ok:=exists (
    select 1 from public.product_feedback f
    where f.id=v_feedback
      and f.release_code='smoke:rollback'
      and f.route='#/feedback'
      and f.client_context->>'viewport'='390x844'
      and coalesce(f.role_snapshot,'')<>''
  );

  v_direct_access_blocked:=not has_table_privilege('authenticated','public.product_feedback','SELECT')
    and not has_table_privilege('authenticated','public.product_feedback','INSERT');

  if not v_submit_ok or not v_provenance_ok or not v_direct_access_blocked then
    raise exception 'EARLY_ADOPTER_FEEDBACK_V1_SMOKE_FAILED';
  end if;

  insert into v19_feedback_smoke_result values(v_submit_ok,v_provenance_ok,v_direct_access_blocked);
end
$v19_smoke$;

select 'EARLY_ADOPTER_FEEDBACK_V1_INSTALLED_SMOKE_ROLLBACK' as section,
  submit_ok,provenance_ok,direct_access_blocked
from v19_feedback_smoke_result;

rollback;
