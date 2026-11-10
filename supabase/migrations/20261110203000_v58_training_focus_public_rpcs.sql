-- IQBasket V84 · Repair authenticated training-focus saves through private RPCs.
--
-- Root cause: public wrappers ran SECURITY INVOKER while iq_v58_private
-- correctly denies schema USAGE to browser roles. Do not grant USAGE.
-- Only these two public API functions are replaced. No data or policies change.
--
-- Security boundary:
--  1) authenticated-only EXECUTE, explicit auth.uid/account-active checks;
--  2) iq_v4_can_manage_training(team_season_id) enforces per-season RBAC/ABAC;
--  3) session UUID, team-season and status are verified while row-locked;
--  4) existing iq_v58_private SECURITY DEFINER functions validate payloads.
-- search_path is empty and every function/relation is schema-qualified.
begin;

create or replace function public.iq_v58_set_training_focus_codes(
  p_session_id uuid,
  p_team_season_id uuid,
  p_focus_codes text[]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.iq_v4_can_manage_training(p_team_season_id) then
    raise exception 'TRAINING_EDIT_FORBIDDEN' using errcode = '42501';
  end if;
  perform 1 from public.training_sessions s
   where s.id = p_session_id
     and s.team_season_id = p_team_season_id
     and upper(s.status) not in ('CANCELLED', 'ARCHIVED')
   for update;
  if not found then
    raise exception 'TRAINING_SESSION_NOT_EDITABLE' using errcode = 'P0002';
  end if;
  return iq_v58_private.set_training_focus_codes(
    p_session_id, p_team_season_id, p_focus_codes
  );
end;
$function$;

create or replace function public.iq_v58_set_training_focus_allocation(
  p_session_id uuid,
  p_team_season_id uuid,
  p_allocations jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.iq_v4_can_manage_training(p_team_season_id) then
    raise exception 'TRAINING_EDIT_FORBIDDEN' using errcode = '42501';
  end if;
  perform 1 from public.training_sessions s
   where s.id = p_session_id
     and s.team_season_id = p_team_season_id
     and upper(s.status) not in ('CANCELLED', 'ARCHIVED')
   for update;
  if not found then
    raise exception 'TRAINING_SESSION_NOT_EDITABLE' using errcode = 'P0002';
  end if;
  return iq_v58_private.set_training_focus_allocation(
    p_session_id, p_team_season_id, p_allocations
  );
end;
$function$;

revoke all on function public.iq_v58_set_training_focus_codes(uuid,uuid,text[])
 from public, anon, authenticated;
revoke all on function public.iq_v58_set_training_focus_allocation(uuid,uuid,jsonb)
 from public, anon, authenticated;
grant execute on function public.iq_v58_set_training_focus_codes(uuid,uuid,text[])
 to authenticated;
grant execute on function public.iq_v58_set_training_focus_allocation(uuid,uuid,jsonb)
 to authenticated;

-- Keep private schema/table privileges unchanged: no direct Data API access.
commit;
