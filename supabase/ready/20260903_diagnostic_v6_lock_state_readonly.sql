-- READ ONLY diagnostic for unexpected game lock state.
select
  'LOCK_STATE_SUMMARY' as section,
  upper(coalesce(edit_state,'OPEN')) as edit_state,
  count(*) as games
from public.games
group by upper(coalesce(edit_state,'OPEN'))
order by edit_state;

select
  'LOCK_REASON_SUMMARY' as section,
  case
    when coalesce(lock_reason,'') like 'TEAM_SEASON_FREEZE:%' then 'TEAM_SEASON_FREEZE'
    when coalesce(lock_reason,'') like 'TEAM_SEASON_REOPEN:%' then 'TEAM_SEASON_REOPEN'
    when nullif(trim(coalesce(lock_reason,'')),'') is null then 'NO_REASON'
    else left(lock_reason,120)
  end as reason_group,
  count(*) as games,
  min(locked_at) as first_locked_at,
  max(locked_at) as last_locked_at
from public.games
where upper(coalesce(edit_state,'OPEN'))='LOCKED'
group by 2
order by games desc, reason_group;

select
  'LOCKED_GAMES' as section,
  g.id,
  g.team_season_id,
  g.date,
  g.opponent,
  g.edit_state,
  left(coalesce(g.lock_reason,''),180) as lock_reason,
  g.locked_at,
  g.locked_by,
  coalesce(up.email,'') as locked_by_email
from public.games g
left join public.user_profiles up on up.id=g.locked_by
where upper(coalesce(g.edit_state,'OPEN'))='LOCKED'
order by g.locked_at desc nulls last, g.date desc;

select
  'SEASON_STATE' as section,
  ts.id,
  ts.team_id,
  ts.status,
  ts.data_status,
  ts.freeze_token,
  ts.frozen_at,
  ts.frozen_by,
  ts.reopened_at,
  ts.reopened_by,
  left(coalesce(ts.freeze_reason,''),180) as freeze_reason
from public.team_seasons ts
order by ts.id;

select
  'LOCK_HISTORY_RECENT' as section,
  h.game_id,
  h.action,
  h.created_at,
  h.actor_id,
  coalesce(up.email,'') as actor_email,
  h.actor_role,
  left(coalesce(h.reason,''),180) as reason
from public.game_lock_history h
left join public.user_profiles up on up.id=h.actor_id
order by h.created_at desc
limit 40;

select
  'SEASON_FREEZE_HISTORY_RECENT' as section,
  h.team_season_id,
  h.action,
  h.created_at,
  h.actor_id,
  coalesce(up.email,'') as actor_email,
  h.actor_role,
  left(coalesce(h.reason,''),180) as reason,
  h.metadata
from public.team_season_freeze_history h
left join public.user_profiles up on up.id=h.actor_id
order by h.created_at desc
limit 20;
