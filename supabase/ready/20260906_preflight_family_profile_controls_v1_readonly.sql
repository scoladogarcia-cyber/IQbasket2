-- IQBasket V26 · readonly preflight
select
  to_regprocedure('public.iq_v17_family_authorization_scope()') is not null as family_scope_rpc_ok,
  to_regprocedure('public.iq_v6_role_for_team_season(uuid)') is not null as contextual_role_helper_ok,
  to_regprocedure('public.iq_account_is_active()') is not null as account_gate_ok,
  to_regclass('public.player360_subject_relationships') is not null as relationships_table_ok,
  to_regclass('public.roster_memberships') is not null as roster_table_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='player360_subject_relationships'
      and column_name='revoked_at'
  ) as revoked_at_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='player360_subject_relationships'
      and column_name='revoked_by'
  ) as revoked_by_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='player360_subject_relationships'
      and column_name='revocation_reason'
  ) as revocation_reason_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='player360_subject_relationships'
      and column_name='updated_at'
  ) as relationship_updated_at_ok;
