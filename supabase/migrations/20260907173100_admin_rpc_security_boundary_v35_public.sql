-- =============================================================================
-- IQBasket V35 · Administrative RPC privilege boundary · public wrappers
--
-- Phase 2 preserves every browser-visible signature while replacing exposed
-- SECURITY DEFINER endpoints with SECURITY INVOKER wrappers.
-- =============================================================================

begin;

create or replace function public.iq_admin_set_account_status(
  p_user_id uuid,
  p_account_status text,
  p_reason text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select iq_v35_private.admin_set_account_status(
    p_user_id,
    p_account_status,
    p_reason
  );
$function$;

create or replace function public.iq_v7_assign_user_role_context(
  p_user_id uuid,
  p_role text,
  p_linked_player_id uuid,
  p_team_season_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select iq_v35_private.assign_user_role_context(
    p_user_id,
    p_role,
    p_linked_player_id,
    p_team_season_id
  );
$function$;

create or replace function public.iq_v7_assign_user_role_context(
  p_user_id uuid,
  p_role text,
  p_linked_player_id uuid default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
begin
  if upper(trim(coalesce(p_role,'')))='JUGADOR' then
    raise exception 'PLAYER_LINK_TEAM_SEASON_REQUIRED';
  end if;
  return public.iq_v7_assign_user_role_context(
    p_user_id,
    p_role,
    p_linked_player_id,
    null
  );
end;
$function$;

create or replace function public.iq_v7_assign_user_role(
  p_user_id uuid,
  p_role text
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select public.iq_v7_assign_user_role_context(
    p_user_id,
    p_role,
    null,
    null
  );
$function$;

revoke all on function public.iq_admin_set_account_status(uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.iq_v7_assign_user_role_context(uuid,text,uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.iq_v7_assign_user_role_context(uuid,text,uuid)
  from public, anon, authenticated;
revoke all on function public.iq_v7_assign_user_role(uuid,text)
  from public, anon, authenticated;

grant execute on function public.iq_admin_set_account_status(uuid,text,text)
  to authenticated;
grant execute on function public.iq_v7_assign_user_role_context(uuid,text,uuid,uuid)
  to authenticated;
grant execute on function public.iq_v7_assign_user_role_context(uuid,text,uuid)
  to authenticated;
grant execute on function public.iq_v7_assign_user_role(uuid,text)
  to authenticated;

commit;
