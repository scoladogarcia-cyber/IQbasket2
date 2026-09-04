-- IQBasket SaaS Entitlements V1 - RPC boundary repair after controlled smoke.
-- Public wrappers are SECURITY DEFINER because commercial tables/internal resolvers
-- intentionally have no authenticated privileges. Both wrappers revalidate auth,
-- account lifecycle and sports/privacy subject access before reading entitlements.
begin;

create or replace function public.iq_saas_entitlement_check(
  p_subject_type text,p_subject_id uuid,p_team_season_id uuid,
  p_entitlement_code text,p_required_units integer default 1
)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_result jsonb;
  v_type text;
  v_allowed boolean:=false;
  v_required integer:=greatest(coalesce(p_required_units,1),0);
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;

  v_result:=iq_private.saas_effective_entitlement_for_user(
    auth.uid(),p_subject_type,p_subject_id,p_team_season_id,p_entitlement_code
  );
  if not coalesce((v_result->>'known')::boolean,false) then return v_result; end if;
  if v_result->>'billing_account_id' is null then return v_result; end if;

  v_type:=v_result->>'value_type';
  if v_type='BOOLEAN' then
    v_allowed:=coalesce((v_result->>'boolean_value')::boolean,false);
  elsif v_type='INTEGER' then
    v_allowed:=coalesce((v_result->>'integer_value')::integer,0)>=v_required;
  elsif v_type='TEXT' then
    v_allowed:=nullif(trim(coalesce(v_result->>'text_value','')),'') is not null;
  end if;

  return v_result || jsonb_build_object(
    'allowed',v_allowed,
    'required_units',v_required,
    'reason_code',case when v_allowed then 'ENTITLED' else 'ENTITLEMENT_LIMIT_OR_DISABLED' end
  );
end;
$function$;
revoke all on function public.iq_saas_entitlement_check(text,uuid,uuid,text,integer)
  from public,anon;
grant execute on function public.iq_saas_entitlement_check(text,uuid,uuid,text,integer)
  to authenticated;
create or replace function public.iq_saas_entitlement_snapshot(
  p_subject_type text,p_subject_id uuid,p_team_season_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare v_entitlements jsonb;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;

  if not iq_private.saas_user_can_access_subject(
    auth.uid(),p_subject_type,p_subject_id,p_team_season_id
  ) then
    raise exception 'SAAS_SUBJECT_ACCESS_DENIED' using errcode='42501';
  end if;

  select coalesce(jsonb_object_agg(c.code,
    iq_private.saas_effective_entitlement_for_user(
      auth.uid(),p_subject_type,p_subject_id,p_team_season_id,c.code
    )
  ),'{}'::jsonb)
  into v_entitlements
  from public.saas_entitlement_catalog c where c.is_active;
  return jsonb_build_object(
    'subject_type',upper(trim(p_subject_type)),
    'subject_id',p_subject_id,
    'team_season_id',p_team_season_id,
    'entitlements',v_entitlements
  );
end;
$function$;
revoke all on function public.iq_saas_entitlement_snapshot(text,uuid,uuid)
  from public,anon;
grant execute on function public.iq_saas_entitlement_snapshot(text,uuid,uuid)
  to authenticated;

-- The internal resolver remains unreachable from the authenticated role.
revoke all on function iq_private.saas_effective_entitlement_for_user(uuid,text,uuid,uuid,text)
  from public,anon,authenticated;

do $block$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('iq_saas_entitlement_check','iq_saas_entitlement_snapshot')
      and not p.prosecdef
  ) then raise exception 'SAAS_V1_RPC_BOUNDARY_NOT_DEFINER'; end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('iq_saas_entitlement_check','iq_saas_entitlement_snapshot')
      and has_function_privilege('anon',p.oid,'EXECUTE')
  ) then raise exception 'SAAS_V1_RPC_ANON_EXECUTE'; end if;

  if has_function_privilege(
    'authenticated',
    'iq_private.saas_effective_entitlement_for_user(uuid,text,uuid,uuid,text)',
    'EXECUTE'
  ) then raise exception 'SAAS_V1_INTERNAL_RESOLVER_EXPOSED'; end if;
end
$block$;

commit;
