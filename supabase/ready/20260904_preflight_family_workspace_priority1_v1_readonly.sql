-- Read-only preflight for IQBasket Family Workspace Priority 1 V1.
select
  to_regclass('public.player360_subject_relationships') is not null as relations_ok,
  to_regclass('public.saas_billing_accounts') is not null as billing_ok,
  to_regclass('public.roster_memberships') is not null as roster_ok,
  to_regprocedure('public.iq_v4e_can_admin_privacy(uuid)') is not null as privacy_admin_ok,
  to_regprocedure('public.iq_saas_entitlement_check(text,uuid,uuid,text,integer)') is not null as entitlement_ok,
  to_regprocedure('iq_private.account_is_active(uuid)') is not null as account_status_ok,
  to_regprocedure('extensions.digest(text,text)') is not null as digest_ok;

select
  to_regclass('public.family_player_link_invitations') is null as invitations_absent,
  to_regprocedure('public.iq_v8_family_claim_link(text)') is null as claim_absent,
  to_regprocedure('public.iq_v8_family_player_passport(uuid)') is null as passport_absent,
  to_regprocedure('public.iq_v8_family_player360_snapshot(uuid,uuid)') is null as player360_absent;

select
  exists(select 1 from public.saas_plans where code='FAMILY_FREE' and status='ACTIVE') as free_plan_ok,
  exists(select 1 from public.saas_plans where code='FAMILY' and account_type='FAMILY') as family_plan_ok,
  exists(select 1 from public.user_profiles where lower(email)='scolado@nechigroup.com') as superadmin_ok,
  exists(select 1 from public.user_profiles where lower(email)='test@test.com') as smoke_user_ok;
