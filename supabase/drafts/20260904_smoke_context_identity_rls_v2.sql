-- Transactional smoke for own-only contextual identity reads. Always rolls back.
\set ON_ERROR_STOP on
begin;

with test_user as (
  select id from public.user_profiles where lower(email)='test@test.com' limit 1
), foreign_user as (
  select id from public.user_profiles
  where id <> (select id from test_user) order by id limit 1
), scope as (
  select t.club_id, ts.season_id
  from public.team_seasons ts
  join public.teams t on t.id=ts.team_id
  order by ts.id limit 1
)
insert into public.club_season_memberships
  (user_id,club_id,season_id,function_role,status)
select test_user.id,scope.club_id,scope.season_id,'RLS_AUDIT_V2','ACTIVE'
from test_user cross join scope
union all
select foreign_user.id,scope.club_id,scope.season_id,'RLS_AUDIT_V2','ACTIVE'
from foreign_user cross join scope
on conflict do nothing;

with test_user as (
  select id from public.user_profiles where lower(email)='test@test.com' limit 1
), foreign_user as (
  select id from public.user_profiles
  where id <> (select id from test_user) order by id limit 1
), target_player as (
  select id from public.players order by id limit 1
)
insert into public.user_player_links
  (user_id,player_id,relation_type,status)
select test_user.id,target_player.id,'RLS_AUDIT_V2','ACTIVE'
from test_user cross join target_player
union all
select foreign_user.id,target_player.id,'RLS_AUDIT_V2','ACTIVE'
from foreign_user cross join target_player
on conflict do nothing;

select 'CTX_RLS_V2_SEED' as section,
       (select count(*) from public.club_season_memberships
        where function_role='RLS_AUDIT_V2')=2 as club_seeded,
       (select count(*) from public.user_player_links
        where relation_type='RLS_AUDIT_V2')=2 as player_links_seeded;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',up.id::text,'email',up.email,'role','authenticated')::text,
  true
) as jwt_claims
from public.user_profiles up
where lower(up.email)='test@test.com'
\gset

set local role authenticated;
select 'CTX_RLS_V2_OWN_READ' as section,
       (select count(*) from public.club_season_memberships
        where function_role='RLS_AUDIT_V2')=1 as club_own_only,
       (select bool_and(user_id=auth.uid()) from public.club_season_memberships
        where function_role='RLS_AUDIT_V2') as club_owner_ok,
       (select count(*) from public.user_player_links
        where relation_type='RLS_AUDIT_V2')=1 as player_link_own_only,
       (select bool_and(user_id=auth.uid()) from public.user_player_links
        where relation_type='RLS_AUDIT_V2') as player_link_owner_ok;

select 'CTX_RLS_V2_WRITE_BLOCK' as section,
       not has_table_privilege('authenticated','public.team_season_memberships','INSERT') as team_insert_blocked,
       not has_table_privilege('authenticated','public.club_season_memberships','UPDATE') as club_update_blocked,
       not has_table_privilege('authenticated','public.user_player_links','DELETE') as player_delete_blocked;

rollback;
