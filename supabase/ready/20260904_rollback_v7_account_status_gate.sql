-- IQBasket V7 - Operational rollback for account-status enforcement
-- Restores pre-V7 authorization behavior without deleting account audit data.
begin;

update public.user_account_controls
set account_status = 'ACTIVE',
    status_reason = 'V7_OPERATIONAL_ROLLBACK',
    changed_at = now(),
    changed_by = null
where account_status <> 'ACTIVE';

-- Restore the exact pre-V7 helper bodies from the installation snapshots.
do $block$
declare
  v_item text[];
  v_definition text;
begin
  foreach v_item slice 1 in array array[
    array['iq_v3_is_global_superadmin','iq_v7_unchecked_v3_is_global_superadmin',''],
    array['iq_v3_can_read_team_season','iq_v7_unchecked_v3_can_read_team_season','uuid'],
    array['iq_v3_can_manage_team_season','iq_v7_unchecked_v3_can_manage_team_season','uuid'],
    array['iq_v3_can_manage_roster','iq_v7_unchecked_v3_can_manage_roster','uuid'],
    array['iq_v4_has_player360_action_role','iq_v7_unchecked_v4_has_player360_action_role','uuid,text[],text[],text[]'],
    array['iq_v4_can_view_player360_team_season','iq_v7_unchecked_v4_can_view_player360_team_season','uuid'],
    array['iq_v4_can_manage_training','iq_v7_unchecked_v4_can_manage_training','uuid'],
    array['iq_v4_can_manage_evaluation','iq_v7_unchecked_v4_can_manage_evaluation','uuid'],
    array['iq_v4e_can_access_sensitive_resource','iq_v7_unchecked_v4e_can_access_sensitive_resource','uuid,uuid,text,text,text'],
    array['iq_v5_current_role','iq_v7_unchecked_v5_current_role',''],
    array['iq_v5_can_access_team','iq_v7_unchecked_v5_can_access_team','uuid'],
    array['iq_v5_role_for_game','iq_v7_unchecked_v5_role_for_game','uuid'],
    array['iq_v6_role_for_team_season','iq_v7_unchecked_v6_role_for_team_season','uuid'],
    array['iq_ai_reserve_usage','iq_v7_unchecked_ai_reserve_usage','uuid,uuid,uuid,uuid,integer,text']
  ]
  loop    if to_regprocedure(format('public.%I(%s)', v_item[2], v_item[3])) is not null then
      select pg_get_functiondef(
        to_regprocedure(format('public.%I(%s)', v_item[2], v_item[3]))
      ) into v_definition;
      v_definition := replace(
        v_definition,
        format('FUNCTION public.%I(', v_item[2]),
        format('FUNCTION public.%I(', v_item[1])
      );
      execute v_definition;
    end if;
  end loop;
end
$block$;

-- Remove account policies and write triggers from every public table.
do $block$
declare r record;
begin
  for r in
    select n.nspname schema_name, c.relname table_name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind='r'
  loop
    execute format('drop policy if exists iq_account_active_guard on %I.%I', r.schema_name, r.table_name);
    execute format('drop trigger if exists iq_account_active_write_guard on %I.%I', r.schema_name, r.table_name);
  end loop;
end
$block$;-- Tables marked by the V7 compatibility policy were RLS-disabled before V7.
do $block$
declare r record;
begin
  for r in
    select schemaname, tablename
    from pg_policies
    where policyname = 'iq_v7_active_legacy_compat'
  loop
    execute format('drop policy if exists iq_v7_account_boundary on %I.%I', r.schemaname, r.tablename);
    execute format('drop policy if exists iq_v7_active_legacy_compat on %I.%I', r.schemaname, r.tablename);
    execute format('alter table %I.%I disable row level security', r.schemaname, r.tablename);
  end loop;
end
$block$;

-- user_profiles was RLS-disabled before V7. Restore that operational posture.
drop trigger if exists iq_v7_guard_user_profile_update on public.user_profiles;
drop policy if exists iq_v7_user_profiles_select_active on public.user_profiles;
drop policy if exists iq_v7_user_profiles_update_safe on public.user_profiles;
drop policy if exists iq_account_active_guard on public.user_profiles;
alter table public.user_profiles disable row level security;

-- Restore the pre-V7 translations posture.
drop policy if exists iq_v7_active_translation_write on public.translations;
do $block$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='translations'
      and policyname='Escritura de traducciones'
  ) then
    create policy "Escritura de traducciones"
      on public.translations for all to public using (true);
  end if;
end
$block$;
alter table public.translations disable row level security;-- Keep account-control tables and audit history for traceability.
do $block$
begin
  if exists (
    select 1 from public.user_account_controls
    where account_status <> 'ACTIVE'
  ) then
    raise exception 'V7_ROLLBACK_ACCOUNT_REACTIVATION_FAILED';
  end if;
end
$block$;

commit;

-- NOTE: safe signup role handling intentionally remains after rollback.
