-- IQBasket v3 PHASE 3A.1 - STAFF TABLE RLS HARDENING
-- =============================================================================
-- SECURITY-ONLY / NON-DESTRUCTIVE.
-- Protects team_season_staff_assignments before any legacy coach backfill.
-- Direct browser writes are denied; writes must use SECURITY DEFINER RPCs.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.team_season_staff_assignments') is null then
    raise exception 'PHASE3A_REQUIRED';
  end if;

  if to_regprocedure('public.iq_v3_can_read_team_season(uuid)') is null then
    raise exception 'SEASON_SELECT_RLS_FIX_REQUIRED';
  end if;
end $$;

alter table public.team_season_staff_assignments
  enable row level security;

-- Explicit privileges: authenticated may read through RLS only.
-- No direct insert/update/delete from browser roles.
revoke all on table public.team_season_staff_assignments from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.team_season_staff_assignments
  from authenticated;
grant select on table public.team_season_staff_assignments to authenticated;

drop policy if exists iq_v3_staff_select_authorized
  on public.team_season_staff_assignments;

create policy iq_v3_staff_select_authorized
  on public.team_season_staff_assignments
  for select
  to authenticated
  using (
    public.iq_v3_can_read_team_season(team_season_id)
  );

commit;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('authenticated', 'public.team_season_staff_assignments', 'SELECT') as authenticated_can_select,
  has_table_privilege('authenticated', 'public.team_season_staff_assignments', 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.team_season_staff_assignments', 'UPDATE') as authenticated_can_update,
  has_table_privilege('authenticated', 'public.team_season_staff_assignments', 'DELETE') as authenticated_can_delete
from pg_class c
where c.oid = 'public.team_season_staff_assignments'::regclass;

select
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'team_season_staff_assignments'
order by policyname;
