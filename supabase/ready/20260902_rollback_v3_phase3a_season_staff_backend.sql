-- IQBasket v3 PHASE 3A ROLLBACK
-- =============================================================================
-- Safe rollback for the backend objects ONLY.
-- Refuses to drop the staff table if real staff assignments already exist.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.team_season_staff_assignments') is not null
     and exists (select 1 from public.team_season_staff_assignments limit 1) then
    raise exception 'ROLLBACK_REFUSED_STAFF_DATA_EXISTS';
  end if;
end $$;

drop function if exists public.iq_v3_remove_team_season_staff(uuid);
drop function if exists public.iq_v3_assign_team_season_staff(uuid,text,uuid,text);
drop function if exists public.iq_v3_set_team_season_status(uuid,text);
drop function if exists public.iq_v3_link_team_season(uuid,uuid);
drop function if exists public.iq_v3_update_global_season(uuid,text,text,date,date,text);
drop function if exists public.iq_v3_create_global_season(text,text,date,date);
drop function if exists public.iq_v3_season_admin_capabilities();
drop function if exists public.iq_v3_staff_membership_role(text);
drop function if exists public.iq_v3_is_global_superadmin();

drop table if exists public.team_season_staff_assignments;

rollback;
