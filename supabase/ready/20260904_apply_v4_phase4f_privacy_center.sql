-- =============================================================================
-- IQBasket v4 · Phase 4F · Privacy Center read API
-- Date: 2026-09-04
--
-- Additive only:
-- - no new tables;
-- - no direct SELECT grants on privacy tables;
-- - exposes least-privilege, team-season-scoped read RPCs for the admin UI.
-- =============================================================================

begin;

do $iq4f_preconditions$
begin
  if to_regprocedure('public.iq_v4e_can_admin_privacy(uuid)') is null
     or to_regclass('public.player360_subject_relationships') is null
     or to_regclass('public.player360_processing_authorizations') is null
     or to_regclass('public.player360_sensitive_access_requests') is null
     or to_regclass('public.player360_sensitive_access_grants') is null
     or to_regclass('public.player360_privacy_audit_log') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.players') is null
     or to_regclass('public.user_profiles') is null then
    raise exception 'PRIVACY_CENTER_V1_PREREQUISITES_MISSING';
  end if;
end;
$iq4f_preconditions$;

-- Shared policy in every public RPC:
-- 1) authenticated user;
-- 2) backend contextual privacy-admin capability;
-- 3) optional player constrained to the requested team-season.

create function public.iq_v4f_privacy_center_snapshot(
  p_team_season_id uuid,
  p_player_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $iq4f$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_v4e_can_admin_privacy(p_team_season_id) then
    raise exception 'PRIVACY_CENTER_ADMIN_DENIED';
  end if;
  if p_player_id is not null and not exists (
    select 1 from public.roster_memberships rm
    where rm.team_season_id = p_team_season_id and rm.player_id = p_player_id
  ) then
    raise exception 'PRIVACY_CENTER_PLAYER_SCOPE_INVALID';
  end if;

  select jsonb_build_object(
    'team_season_id', p_team_season_id,
    'player_id', p_player_id,
    'counts', jsonb_build_object(
      'relationships', (
        select count(*) from public.player360_subject_relationships r
        where r.status = 'ACTIVE'
          and (r.valid_until is null or r.valid_until > now())
          and (p_player_id is null or r.player_id = p_player_id)
          and exists (
            select 1 from public.roster_memberships rm
            where rm.team_season_id = p_team_season_id and rm.player_id = r.player_id
          )
      ),
      'authorizations', (
        select count(*) from public.player360_processing_authorizations a
        where a.team_season_id = p_team_season_id
          and a.status = 'ACTIVE'
          and (a.valid_until is null or a.valid_until > now())
          and (p_player_id is null or a.player_id = p_player_id)
      ),
      'active_grants', (
        select count(*) from public.player360_sensitive_access_grants g
        where g.team_season_id = p_team_season_id
          and g.status = 'ACTIVE'
          and (g.valid_until is null or g.valid_until > now())
          and (p_player_id is null or g.player_id = p_player_id)
      ),
      'pending_requests', (
        select count(*) from public.player360_sensitive_access_requests q
        where q.team_season_id = p_team_season_id
          and q.status = 'PENDING'
          and (p_player_id is null or q.player_id = p_player_id)
      )
    ),
    'players', coalesce((
      select jsonb_agg(row_data order by row_data->>'last_name', row_data->>'first_name')
      from (
        select jsonb_build_object(
          'player_id', p.id,
          'first_name', coalesce(p.first_name,''),
          'last_name', coalesce(p.last_name,''),
          'jersey', rm.jersey,
          'active_authorizations', (
            select count(*) from public.player360_processing_authorizations a
            where a.team_season_id = p_team_season_id
              and a.player_id = p.id
              and a.status = 'ACTIVE'
              and (a.valid_until is null or a.valid_until > now())
          ),
          'active_grants', (
            select count(*) from public.player360_sensitive_access_grants g
            where g.team_season_id = p_team_season_id
              and g.player_id = p.id
              and g.status = 'ACTIVE'
              and (g.valid_until is null or g.valid_until > now())
          ),
          'pending_requests', (
            select count(*) from public.player360_sensitive_access_requests q
            where q.team_season_id = p_team_season_id
              and q.player_id = p.id
              and q.status = 'PENDING'
          )
        ) as row_data
        from public.roster_memberships rm
        join public.players p on p.id = rm.player_id
        where rm.team_season_id = p_team_season_id
          and (p_player_id is null or p.id = p_player_id)
      ) s
    ), '[]'::jsonb),
    'relationships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'player_id', r.player_id,
        'relationship_type', r.relationship_type,
        'status', r.status,
        'valid_from', r.valid_from,
        'valid_until', r.valid_until,
        'verification_source', r.verification_source,
        'user', jsonb_build_object(
          'email', coalesce(up.email,''),
          'first_name', coalesce(up.first_name,''),
          'last_name', coalesce(up.last_name,'')
        )
      ) order by r.created_at desc)
      from public.player360_subject_relationships r
      left join public.user_profiles up on up.id = r.user_id
      where (p_player_id is null or r.player_id = p_player_id)
        and exists (
          select 1 from public.roster_memberships rm
          where rm.team_season_id = p_team_season_id and rm.player_id = r.player_id
        )
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$iq4f$;

create function public.iq_v4f_list_privacy_authorizations(
  p_team_season_id uuid,
  p_player_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $iq4f$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_v4e_can_admin_privacy(p_team_season_id) then
    raise exception 'PRIVACY_CENTER_ADMIN_DENIED';
  end if;
  if p_player_id is not null and not exists (
    select 1 from public.roster_memberships rm
    where rm.team_season_id = p_team_season_id and rm.player_id = p_player_id
  ) then
    raise exception 'PRIVACY_CENTER_PLAYER_SCOPE_INVALID';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'player_id', a.player_id,
    'player', jsonb_build_object(
      'first_name', coalesce(p.first_name,''),
      'last_name', coalesce(p.last_name,''),
      'jersey', rm.jersey
    ),
    'modules', a.modules,
    'purposes', a.purposes,
    'authorization_type', a.authorization_type,
    'legal_basis_code', a.legal_basis_code,
    'special_category_condition_code', a.special_category_condition_code,
    'ai_processing_allowed', a.ai_processing_allowed,
    'representative_user_id', a.representative_user_id,
    'representative', case when rep.id is null then null else jsonb_build_object(
      'email', coalesce(rep.email,''),
      'first_name', coalesce(rep.first_name,''),
      'last_name', coalesce(rep.last_name,'')
    ) end,
    'evidence_reference', a.evidence_reference,
    'status', a.status,
    'valid_from', a.valid_from,
    'valid_until', a.valid_until,
    'created_at', a.created_at
  ) order by a.created_at desc), '[]'::jsonb)
  into v_result
  from public.player360_processing_authorizations a
  join public.roster_memberships rm
    on rm.team_season_id = a.team_season_id and rm.player_id = a.player_id
  join public.players p on p.id = a.player_id
  left join public.user_profiles rep on rep.id = a.representative_user_id
  where a.team_season_id = p_team_season_id
    and (p_player_id is null or a.player_id = p_player_id);

  return v_result;
end;
$iq4f$;

create function public.iq_v4f_list_sensitive_access(
  p_team_season_id uuid,
  p_player_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $iq4f$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_v4e_can_admin_privacy(p_team_season_id) then
    raise exception 'PRIVACY_CENTER_ADMIN_DENIED';
  end if;
  if p_player_id is not null and not exists (
    select 1 from public.roster_memberships rm
    where rm.team_season_id = p_team_season_id and rm.player_id = p_player_id
  ) then
    raise exception 'PRIVACY_CENTER_PLAYER_SCOPE_INVALID';
  end if;

  select jsonb_build_object(
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'requested_by', q.requested_by,
        'requester', jsonb_build_object(
          'email', coalesce(req.email,''),
          'first_name', coalesce(req.first_name,''),
          'last_name', coalesce(req.last_name,'')
        ),
        'player_id', q.player_id,
        'player', jsonb_build_object(
          'first_name', coalesce(p.first_name,''),
          'last_name', coalesce(p.last_name,''),
          'jersey', rm.jersey
        ),
        'modules', q.modules,
        'actions', q.actions,
        'purposes', q.purposes,
        'justification', q.justification,
        'status', q.status,
        'reviewed_by', q.reviewed_by,
        'review_notes', q.review_notes,
        'reviewed_at', q.reviewed_at,
        'created_at', q.created_at
      ) order by q.created_at desc)
      from public.player360_sensitive_access_requests q
      join public.roster_memberships rm
        on rm.team_season_id = q.team_season_id and rm.player_id = q.player_id
      join public.players p on p.id = q.player_id
      left join public.user_profiles req on req.id = q.requested_by
      where q.team_season_id = p_team_season_id
        and (p_player_id is null or q.player_id = p_player_id)
    ), '[]'::jsonb),
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'user_id', g.user_id,
        'user', jsonb_build_object(
          'email', coalesce(u.email,''),
          'first_name', coalesce(u.first_name,''),
          'last_name', coalesce(u.last_name,'')
        ),
        'player_id', g.player_id,
        'player', jsonb_build_object(
          'first_name', coalesce(p.first_name,''),
          'last_name', coalesce(p.last_name,''),
          'jersey', rm.jersey
        ),
        'request_id', g.request_id,
        'modules', g.modules,
        'actions', g.actions,
        'purposes', g.purposes,
        'status', g.status,
        'valid_from', g.valid_from,
        'valid_until', g.valid_until,
        'grant_reason', g.grant_reason,
        'created_at', g.created_at
      ) order by g.created_at desc)
      from public.player360_sensitive_access_grants g
      join public.roster_memberships rm
        on rm.team_season_id = g.team_season_id and rm.player_id = g.player_id
      join public.players p on p.id = g.player_id
      left join public.user_profiles u on u.id = g.user_id
      where g.team_season_id = p_team_season_id
        and (p_player_id is null or g.player_id = p_player_id)
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$iq4f$;

create function public.iq_v4f_list_privacy_audit(
  p_team_season_id uuid,
  p_player_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $iq4f$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit,100), 500));
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_v4e_can_admin_privacy(p_team_season_id) then
    raise exception 'PRIVACY_CENTER_ADMIN_DENIED';
  end if;
  if p_player_id is not null and not exists (
    select 1 from public.roster_memberships rm
    where rm.team_season_id = p_team_season_id and rm.player_id = p_player_id
  ) then
    raise exception 'PRIVACY_CENTER_PLAYER_SCOPE_INVALID';
  end if;

  select coalesce(jsonb_agg(row_data order by occurred_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      l.occurred_at,
      jsonb_build_object(
        'id', l.id,
        'actor_user_id', l.actor_user_id,
        'actor', case when up.id is null then null else jsonb_build_object(
          'email', coalesce(up.email,''),
          'first_name', coalesce(up.first_name,''),
          'last_name', coalesce(up.last_name,'')
        ) end,
        'event_type', l.event_type,
        'entity_type', l.entity_type,
        'entity_id', l.entity_id,
        'player_id', l.player_id,
        'module', l.module,
        'action', l.action,
        'purpose', l.purpose,
        'decision', l.decision,
        'reason_code', l.reason_code,
        'metadata', l.metadata,
        'occurred_at', l.occurred_at
      ) as row_data
    from public.player360_privacy_audit_log l
    left join public.user_profiles up on up.id = l.actor_user_id
    where l.team_season_id = p_team_season_id
      and (p_player_id is null or l.player_id = p_player_id)
    order by l.occurred_at desc
    limit v_limit
  ) s;

  return v_result;
end;
$iq4f$;

revoke all on function public.iq_v4f_privacy_center_snapshot(uuid,uuid) from public, anon, authenticated;
revoke all on function public.iq_v4f_list_privacy_authorizations(uuid,uuid) from public, anon, authenticated;
revoke all on function public.iq_v4f_list_sensitive_access(uuid,uuid) from public, anon, authenticated;
revoke all on function public.iq_v4f_list_privacy_audit(uuid,uuid,integer) from public, anon, authenticated;

grant execute on function public.iq_v4f_privacy_center_snapshot(uuid,uuid) to authenticated;
grant execute on function public.iq_v4f_list_privacy_authorizations(uuid,uuid) to authenticated;
grant execute on function public.iq_v4f_list_sensitive_access(uuid,uuid) to authenticated;
grant execute on function public.iq_v4f_list_privacy_audit(uuid,uuid,integer) to authenticated;

commit;
