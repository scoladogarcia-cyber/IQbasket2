-- Demo-only ABAC hotfix: enable player self-service on synthetic wellness data.
-- Idempotent and scoped exclusively to the synthetic demo legal-basis marker.
begin;

update public.player360_processing_authorizations
set purposes = case
  when 'PLAYER_SELF_SERVICE'=any(purposes) then purposes
  else array_append(purposes,'PLAYER_SELF_SERVICE')
end
where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
  and status='ACTIVE'
  and legal_basis_code='SYNTHETIC_DEMO_NON_PERSONAL'
  and 'nutrition'=any(modules)
  and 'recovery'=any(modules);

do $check$
begin
  if exists (
    select 1
    from public.player360_processing_authorizations
    where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
      and status='ACTIVE'
      and legal_basis_code='SYNTHETIC_DEMO_NON_PERSONAL'
      and not ('PLAYER_SELF_SERVICE'=any(purposes))
  ) then
    raise exception 'DEMO_PLAYER_SELF_SERVICE_AUTHORIZATION_MISSING';
  end if;
end
$check$;

commit;
