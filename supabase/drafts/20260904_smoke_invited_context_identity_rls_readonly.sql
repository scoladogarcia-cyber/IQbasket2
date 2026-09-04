-- Demo-specific read-only smoke for contextual identity SELECT RLS.
-- Validates the production INVITADO account without changing any row.
\set ON_ERROR_STOP on

begin read only;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',up.id::text,'email',up.email,'role','authenticated')::text,
  true
) as jwt_claims
from public.user_profiles up
where lower(up.email)='test@test.com'
\gset

set local role authenticated;

select
  'INVITED_CONTEXT_RLS_RUNTIME' as section,
  count(*) = 1 as own_demo_membership_visible,
  count(*) filter (where user_id <> auth.uid()) = 0 as no_foreign_membership_visible,
  bool_and(upper(coalesce(function_role,''))='INVITADO') as role_remains_invited
from public.team_season_memberships
where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

rollback;
