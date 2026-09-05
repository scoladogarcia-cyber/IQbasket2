-- Read-only preflight for Family Development Context V1.
select
  to_regclass('public.training_sessions') is not null as training_ok,
  to_regclass('public.training_participants') is not null as participants_ok,
  to_regclass('public.external_development_sessions') is not null as external_ok,
  to_regclass('public.player_objective_profiles') is not null as objectives_ok,
  to_regclass('public.player_objective_targets') is not null as targets_ok,
  to_regclass('public.product_event_catalog') is not null as analytics_ok;

select
  to_regprocedure('public.iq_v8_family_create_link_invitation(uuid,uuid,text,integer)') is not null as invite_ok,
  to_regprocedure('public.iq_v8_family_claim_link(text)') is not null as claim_ok,
  to_regprocedure('public.iq_saas_entitlement_check(text,uuid,uuid,text,integer)') is not null as entitlement_ok,
  to_regprocedure('iq_private.family_can_view_player(uuid,uuid)') is not null as family_access_ok;

select
  to_regprocedure('public.iq_v10_family_development_context(uuid,uuid)') is null as context_absent,
  not exists(select 1 from public.product_event_catalog where code='FAMILY_WEEKLY_PLAN_VIEWED') as event_absent;
