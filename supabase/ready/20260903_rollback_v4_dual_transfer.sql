-- =============================================================================
-- IQBasket V4 · Non-destructive dual transfer rollback
-- Disables V4 actions and restores the legacy SUPERADMIN-only approval function.
-- Additive review/audit data is preserved.
-- =============================================================================

begin;

revoke execute on function public.iq_v4_can_review_transfer_scope(uuid) from authenticated;
revoke execute on function public.iq_v4_transfer_request_capabilities() from authenticated;
revoke execute on function public.iq_v4_request_transfer(uuid,uuid,uuid,date) from authenticated;
revoke execute on function public.iq_v4_review_transfer_side(uuid,text,text,date,text) from authenticated;
revoke execute on function public.iq_v4_finalize_transfer_request(uuid) from authenticated;
revoke select on public.roster_transfer_reviews from authenticated;

create or replace function public.iq_v3_approve_transfer_request(
  p_request_id uuid,
  p_last_date_from date,
  p_first_date_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.roster_transfer_requests;
  transfer_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_can_approve_transfer_request() then
    raise exception 'TRANSFER_APPROVAL_DENIED';
  end if;

  if p_last_date_from is null or p_first_date_to is null then
    raise exception 'TRANSFER_DATES_REQUIRED';
  end if;

  if p_first_date_to <= p_last_date_from then
    raise exception 'TARGET_START_MUST_BE_AFTER_SOURCE_END';
  end if;

  select *
    into request_row
  from public.roster_transfer_requests
  where id = p_request_id
  for update;

  if request_row.id is null then
    raise exception 'TRANSFER_REQUEST_NOT_FOUND';
  end if;

  if request_row.status <> 'PENDING' then
    raise exception 'TRANSFER_REQUEST_NOT_PENDING';
  end if;

  transfer_result := public.iq_v3_transfer_player(
    request_row.player_id,
    request_row.from_team_season_id,
    request_row.to_team_season_id,
    p_last_date_from,
    p_first_date_to,
    null,
    null
  );

  update public.roster_transfer_requests
     set status = 'APPROVED',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         approved_last_date_from = p_last_date_from,
         approved_first_date_to = p_first_date_to,
         rejection_reason = null,
         updated_at = now()
   where id = request_row.id
   returning * into request_row;

  update public.roster_transfer_requests
     set status = 'CANCELLED',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason = 'SUPERSEDED_BY_APPROVED_TRANSFER',
         updated_at = now()
   where id <> request_row.id
     and player_id = request_row.player_id
     and from_team_season_id = request_row.from_team_season_id
     and status = 'PENDING';

  return jsonb_build_object(
    'request', to_jsonb(request_row),
    'transfer', transfer_result
  );
end;
$$;

revoke all on function public.iq_v3_approve_transfer_request(uuid,date,date)
  from public, anon;
grant execute on function public.iq_v3_approve_transfer_request(uuid,date,date)
  to authenticated;

commit;
