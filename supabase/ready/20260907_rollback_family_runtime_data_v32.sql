-- =============================================================================
-- IQBasket · Rollback Family Runtime Data V32
-- Restores the pre-V32 sensitive-resource wrapper and removes only V32 RPCs.
-- =============================================================================
begin;

create or replace function public.iq_v4e_can_access_sensitive_resource(
  p_player_id uuid,
  p_team_season_id uuid,
  p_module text,
  p_action text,
  p_purpose text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select public.iq_account_is_active()
    and (
      public.iq_v7_unchecked_v4e_can_access_sensitive_resource(
        p_player_id,p_team_season_id,p_module,p_action,p_purpose
      )
      or iq_private.iq_v22_submission_materialization_allowed(
        p_player_id,p_team_season_id,p_module,p_action,p_purpose
      )
    );
$function$;

revoke all on function public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)
  to authenticated;

drop function if exists public.iq_v32_family_player360_snapshot(uuid,uuid);
drop function if exists public.iq_v32_family_player_passport(uuid);
drop function if exists public.iq_v32_family_list_players();
drop function if exists iq_private.iq_v32_guardian_linked_wellness_read_allowed(uuid,uuid,text,text,text);

commit;
