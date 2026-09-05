-- Read-only preflight for Family Product Analytics V1.
select
  to_regclass('public.user_profiles') is not null as profiles_ok,
  to_regclass('public.players') is not null as players_ok,
  to_regclass('public.saas_billing_accounts') is not null as billing_ok,
  to_regprocedure('public.iq_account_is_active()') is not null as account_ok,
  to_regprocedure('public.iq_v8_family_product_snapshot(uuid)') is not null as family_product_ok,
  to_regprocedure('iq_private.family_can_view_player(uuid,uuid)') is not null as family_access_ok,
  to_regprocedure('public.iq_v3_is_global_superadmin()') is not null as superadmin_ok;

select
  to_regclass('public.product_event_catalog') is null as catalog_absent,
  to_regclass('public.product_analytics_events') is null as events_absent,
  to_regprocedure('public.iq_v9_track_product_event(text,uuid,text,text,text,text,text,integer)') is null as track_absent,
  to_regprocedure('public.iq_v9_product_metrics(integer)') is null as metrics_absent;
