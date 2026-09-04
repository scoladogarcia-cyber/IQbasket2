-- =============================================================================
-- IQBasket v4 · Phase 4F · Privacy Center request review
-- Adds the missing explicit rejection path for sensitive access requests.
-- =============================================================================

begin;

create function public.iq_v4f_reject_sensitive_access_request(
  p_request_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $iq4f$
declare
  v_row public.player360_sensitive_access_requests;
  v_reason text := trim(coalesce(p_reason,''));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(v_reason) = 0 then raise exception 'PRIVACY_CENTER_REJECTION_REASON_REQUIRED'; end if;

  select * into v_row
  from public.player360_sensitive_access_requests
  where id = p_request_id
  for update;

  if v_row.id is null then raise exception 'PRIVACY_CENTER_REQUEST_NOT_FOUND'; end if;
  if not public.iq_v4e_can_admin_privacy(v_row.team_season_id) then
    raise exception 'PRIVACY_CENTER_ADMIN_DENIED';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'PRIVACY_CENTER_REQUEST_ALREADY_REVIEWED';
  end if;

  update public.player360_sensitive_access_requests
  set status = 'REJECTED',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = v_reason
  where id = p_request_id
    and status = 'PENDING';

  perform public.iq_v4e_log_privacy_event(
    'SENSITIVE_ACCESS_REJECTED',
    'ACCESS_REQUEST',
    v_row.id,
    v_row.player_id,
    v_row.team_season_id,
    'UPDATE',
    null,
    'DENY',
    'ADMIN_REJECTED',
    jsonb_build_object(
      'target_user_id', v_row.requested_by,
      'modules', v_row.modules,
      'actions', v_row.actions,
      'purposes', v_row.purposes,
      'review_reason', v_reason
    )
  );

  return true;
end;
$iq4f$;

revoke all on function public.iq_v4f_reject_sensitive_access_request(uuid,text)
from public, anon, authenticated;

grant execute on function public.iq_v4f_reject_sensitive_access_request(uuid,text)
to authenticated;

commit;
