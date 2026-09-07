-- IQBasket V30 · Persistent Family links + independent quick capture + team comparison
-- Keeps guardian identity player-scoped so active links automatically follow a player across teams.
begin;

-- -----------------------------------------------------------------------------
-- 1. Family relationship duration carried by the invitation, not by team scope.
-- -----------------------------------------------------------------------------
alter table public.family_player_link_invitations
  add column if not exists relationship_duration_code text not null default 'INDEFINITE';

do $v30_duration_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.family_player_link_invitations'::regclass
      and conname='family_link_relationship_duration_check'
  ) then
    alter table public.family_player_link_invitations
      add constraint family_link_relationship_duration_check
      check (relationship_duration_code in ('INDEFINITE','7_DAYS','30_DAYS','12_MONTHS'));
  end if;
end
$v30_duration_constraint$;

create schema if not exists iq_v30_private;
revoke all on schema iq_v30_private from public,anon,authenticated;
grant usage on schema iq_v30_private to authenticated;

create or replace function iq_v30_private.normalize_relationship_duration(p_code text)
returns text
language plpgsql
immutable
set search_path=''
as $function$
declare
  v_code text:=upper(trim(coalesce(p_code,'INDEFINITE')));
begin
  if v_code not in ('INDEFINITE','7_DAYS','30_DAYS','12_MONTHS') then
    raise exception 'FAMILY_LINK_DURATION_INVALID';
  end if;
  return v_code;
end
$function$;

create or replace function iq_v30_private.relationship_valid_until(p_code text,p_from timestamptz default now())
returns timestamptz
language plpgsql
stable
set search_path=''
as $function$
declare
  v_code text:=iq_v30_private.normalize_relationship_duration(p_code);
begin
  case v_code
    when 'INDEFINITE' then return null;
    when '7_DAYS' then return p_from + interval '7 days';
    when '30_DAYS' then return p_from + interval '30 days';
    when '12_MONTHS' then return p_from + interval '12 months';
  end case;
  return null;
end
$function$;

create or replace function iq_v30_private.create_family_link_invitation(
  p_team_season_id uuid,
  p_player_id uuid,
  p_invite_email text,
  p_relationship_duration text default 'INDEFINITE',
  p_code_expires_hours integer default 168
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_duration text:=iq_v30_private.normalize_relationship_duration(p_relationship_duration);
  v_result jsonb;
  v_invitation_id uuid;
begin
  -- Reuse the audited V29 invitation boundary and add only relationship duration.
  v_result:=iq_v29_private.create_family_link_invitation(
    p_team_season_id,p_player_id,p_invite_email,p_code_expires_hours
  );
  v_invitation_id:=nullif(v_result->>'invitation_id','')::uuid;
  if v_invitation_id is null then raise exception 'FAMILY_LINK_INVITATION_CREATE_FAILED'; end if;

  update public.family_player_link_invitations
     set relationship_duration_code=v_duration,
         updated_at=now()
   where id=v_invitation_id;

  return v_result || jsonb_build_object(
    'relationship_duration_code',v_duration,
    'relationship_valid_until',iq_v30_private.relationship_valid_until(v_duration,now())
  );
end
$function$;

create or replace function public.iq_v30_create_family_link_invitation(
  p_team_season_id uuid,
  p_player_id uuid,
  p_invite_email text,
  p_relationship_duration text default 'INDEFINITE',
  p_code_expires_hours integer default 168
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v30_private.create_family_link_invitation(
    p_team_season_id,p_player_id,p_invite_email,p_relationship_duration,p_code_expires_hours
  );
$function$;

-- Claim now applies the requested lifetime to the person-scoped guardian link.
create or replace function public.iq_v8_family_claim_link(p_claim_code text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_hash text;
  v_inv public.family_player_link_invitations;
  v_email text;
  v_relation_id uuid;
  v_product jsonb;
  v_duration text;
  v_valid_until timestamptz;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_claim_code,'')))<20 then
    raise exception 'FAMILY_LINK_CODE_INVALID';
  end if;
  v_hash:=encode(extensions.digest(trim(p_claim_code),'sha256'),'hex');

  select * into v_inv
  from public.family_player_link_invitations
  where token_hash=v_hash and status='PENDING'
  for update;
  if v_inv.id is null then
    return jsonb_build_object('claimed',false,'reason_code','INVITATION_NOT_FOUND');
  end if;
  if v_inv.expires_at<=now() then
    update public.family_player_link_invitations set status='EXPIRED',updated_at=now() where id=v_inv.id;
    return jsonb_build_object('claimed',false,'reason_code','INVITATION_EXPIRED');
  end if;

  select lower(trim(coalesce(up.email,''))) into v_email
  from public.user_profiles up where up.id=auth.uid();
  if v_email='' or v_email<>lower(v_inv.invite_email) then
    raise exception 'FAMILY_LINK_EMAIL_MISMATCH' using errcode='42501';
  end if;

  v_duration:=iq_v30_private.normalize_relationship_duration(v_inv.relationship_duration_code);
  v_valid_until:=iq_v30_private.relationship_valid_until(v_duration,now());

  select r.id into v_relation_id
  from public.player360_subject_relationships r
  where r.user_id=auth.uid() and r.player_id=v_inv.player_id
    and r.relationship_type='GUARDIAN' and r.status='ACTIVE'
    and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
  order by r.created_at desc limit 1;

  if v_relation_id is null then
    insert into public.player360_subject_relationships(
      user_id,player_id,relationship_type,status,valid_until,verification_source,verified_by
    ) values (
      auth.uid(),v_inv.player_id,'GUARDIAN','ACTIVE',v_valid_until,
      'FAMILY_EMAIL_INVITATION',v_inv.created_by
    ) returning id into v_relation_id;
  else
    update public.player360_subject_relationships
       set valid_until=v_valid_until,
           updated_at=now()
     where id=v_relation_id;
  end if;

  update public.family_player_link_invitations
  set status='CLAIMED',claimed_by=auth.uid(),claimed_at=now(),updated_at=now()
  where id=v_inv.id;

  v_product:=iq_private.family_bootstrap_free_account(auth.uid(),v_inv.player_id);

  perform public.iq_v4e_log_privacy_event(
    'FAMILY_LINK_INVITATION_CLAIMED','SUBJECT_RELATIONSHIP',v_relation_id,
    v_inv.player_id,v_inv.team_season_id,'CREATE','FAMILY_SUPPORT','ALLOW','EMAIL_INVITE_CLAIMED_V30',
    jsonb_build_object('invitation_id',v_inv.id,'relationship_duration_code',v_duration,'valid_until',v_valid_until)
  );

  return jsonb_build_object(
    'claimed',true,'reason_code','FAMILY_LINK_ACTIVE',
    'relationship_id',v_relation_id,'player_id',v_inv.player_id,
    'relationship_duration_code',v_duration,'valid_until',v_valid_until,
    'product',v_product
  );
end
$function$;

-- -----------------------------------------------------------------------------
-- 2. A current coach sees active guardian links of players in the current roster.
--    No copy is created on transfer: the relationship stays attached to player_id.
-- -----------------------------------------------------------------------------
create or replace function iq_v30_private.can_manage_team_family_links(p_team_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and public.iq_account_is_active()
    and exists (
      select 1 from public.team_seasons ts
      where ts.id=p_team_season_id
        and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
        and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
        and (
          public.iq_v3_is_global_superadmin()
          or upper(coalesce(public.iq_v6_role_for_team_season(ts.id),'')) in (
            'SUPERADMIN','ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR'
          )
        )
    );
$function$;

create or replace function iq_v30_private.list_team_family_links(p_team_season_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_result jsonb;
begin
  if not iq_v30_private.can_manage_team_family_links(p_team_season_id) then
    raise exception 'FAMILY_LINK_TEAM_MANAGE_DENIED' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(item order by player_name,family_email),'[]'::jsonb)
    into v_result
  from (
    select jsonb_build_object(
      'relationship_id',r.id,
      'family_user_id',r.user_id,
      'family_email',up.email,
      'family_name',trim(concat_ws(' ',up.first_name,up.last_name)),
      'player_id',p.id,
      'player_name',trim(concat_ws(' ',p.first_name,p.last_name)),
      'jersey',coalesce(rm.jersey,p.jersey),
      'primary_position',coalesce(rm.primary_position,p.primary_position),
      'valid_from',r.valid_from,
      'valid_until',r.valid_until,
      'indefinite',(r.valid_until is null),
      'verification_source',r.verification_source
    ) item,
    trim(concat_ws(' ',p.first_name,p.last_name)) player_name,
    lower(coalesce(up.email,'')) family_email
    from public.player360_subject_relationships r
    join public.roster_memberships rm on rm.player_id=r.player_id
    join public.players p on p.id=r.player_id
    join public.user_profiles up on up.id=r.user_id
    where rm.team_season_id=p_team_season_id
      and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
      and (rm.joined_at is null or rm.joined_at<=now())
      and (rm.left_at is null or rm.left_at>now())
      and r.relationship_type='GUARDIAN'
      and r.status='ACTIVE'
      and r.valid_from<=now()
      and (r.valid_until is null or r.valid_until>now())
  ) scoped;
  return v_result;
end
$function$;

create or replace function public.iq_v30_list_team_family_links(p_team_season_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select iq_v30_private.list_team_family_links(p_team_season_id);
$function$;

create or replace function iq_v30_private.revoke_family_link(
  p_team_season_id uuid,
  p_relationship_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_rel public.player360_subject_relationships%rowtype;
  v_reason text:=left(nullif(trim(coalesce(p_reason,'')),''),1000);
begin
  if not iq_v30_private.can_manage_team_family_links(p_team_season_id) then
    raise exception 'FAMILY_LINK_TEAM_MANAGE_DENIED' using errcode='42501';
  end if;

  select r.* into v_rel
  from public.player360_subject_relationships r
  join public.roster_memberships rm on rm.player_id=r.player_id
  where r.id=p_relationship_id
    and r.relationship_type='GUARDIAN'
    and r.status='ACTIVE'
    and r.valid_from<=now()
    and (r.valid_until is null or r.valid_until>now())
    and rm.team_season_id=p_team_season_id
    and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
    and (rm.left_at is null or rm.left_at>now())
  for update of r;

  if v_rel.id is null then
    raise exception 'FAMILY_LINK_RELATION_NOT_IN_TEAM_SCOPE' using errcode='42501';
  end if;

  update public.player360_subject_relationships
     set status='REVOKED',
         revoked_at=now(),
         revoked_by=auth.uid(),
         revocation_reason=coalesce(v_reason,'Revocado por staff del equipo'),
         valid_until=coalesce(valid_until,greatest(now(),valid_from+interval '1 microsecond')),
         updated_at=now()
   where id=v_rel.id;

  perform public.iq_v4e_log_privacy_event(
    'SUBJECT_RELATIONSHIP_REVOKED','SUBJECT_RELATIONSHIP',v_rel.id,
    v_rel.player_id,p_team_season_id,'REVOKE','FAMILY_SUPPORT','ALLOW','TEAM_STAFF_REVOKED_V30',
    jsonb_build_object('target_user_id',v_rel.user_id,'reason',v_reason)
  );

  return jsonb_build_object('revoked',true,'relationship_id',v_rel.id,'player_id',v_rel.player_id);
end
$function$;

create or replace function public.iq_v30_revoke_family_link(
  p_team_season_id uuid,
  p_relationship_id uuid,
  p_reason text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v30_private.revoke_family_link(p_team_season_id,p_relationship_id,p_reason);
$function$;

-- -----------------------------------------------------------------------------
-- 3. Family team snapshot. Team metrics are visible; other-player identity is
--    masked server-side according to Family preferences. Position remains visible.
-- -----------------------------------------------------------------------------
create or replace function iq_v30_private.family_team_snapshot(
  p_player_id uuid,
  p_team_season_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_ts uuid:=p_team_season_id;
  v_team_id uuid;
  v_team_name text;
  v_category text;
  v_season_name text;
  v_show_names boolean:=true;
  v_show_jerseys boolean:=true;
  v_linked uuid[]:='{}'::uuid[];
  v_team jsonb;
  v_team_metrics jsonb;
  v_players jsonb;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.player360_subject_relationships r
    where r.user_id=auth.uid() and r.player_id=p_player_id
      and r.relationship_type='GUARDIAN' and r.status='ACTIVE'
      and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
  ) then
    raise exception 'FAMILY_PLAYER_SCOPE_DENIED' using errcode='42501';
  end if;

  if v_ts is null then
    select rm.team_season_id into v_ts
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    where rm.player_id=p_player_id
      and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
      and (rm.joined_at is null or rm.joined_at<=now())
      and (rm.left_at is null or rm.left_at>now())
      and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
    order by coalesce(rm.joined_at,rm.created_at) desc,ts.updated_at desc
    limit 1;
  end if;

  if v_ts is null or not exists (
    select 1 from public.roster_memberships rm
    where rm.team_season_id=v_ts and rm.player_id=p_player_id
      and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
      and (rm.left_at is null or rm.left_at>now())
  ) then
    raise exception 'FAMILY_TEAM_SEASON_SCOPE_DENIED' using errcode='42501';
  end if;

  select ts.team_id,t.name,t.category,s.name
    into v_team_id,v_team_name,v_category,v_season_name
  from public.team_seasons ts
  join public.teams t on t.id=ts.team_id
  left join public.seasons s on s.id=ts.season_id
  where ts.id=v_ts;

  select coalesce(up.family_show_other_player_names,true),
         coalesce(up.family_show_other_player_jerseys,true)
    into v_show_names,v_show_jerseys
  from public.user_profiles up where up.id=auth.uid();

  select coalesce(array_agg(distinct r.player_id),'{}'::uuid[])
    into v_linked
  from public.player360_subject_relationships r
  where r.user_id=auth.uid() and r.relationship_type='GUARDIAN'
    and r.status='ACTIVE' and r.valid_from<=now()
    and (r.valid_until is null or r.valid_until>now());

  v_team:=jsonb_build_object(
    'team_id',v_team_id,'team_season_id',v_ts,'team_name',v_team_name,
    'category',v_category,'season_name',v_season_name
  );

  with g as (
    select * from public.games
    where team_season_id=v_ts and upper(coalesce(play_state,''))='FINISHED'
  ), totals as (
    select count(*)::int games,
      count(*) filter (where coalesce(team_score,0)>coalesce(opponent_score,0))::int wins,
      count(*) filter (where coalesce(team_score,0)<coalesce(opponent_score,0))::int losses,
      coalesce(sum(team_score),0)::int points_for,
      coalesce(sum(opponent_score),0)::int points_against
    from g
  ), tgs as (
    select coalesce(sum(t.assists),0)::int assists,
      coalesce(sum(t.rebounds_offensive),0)::int off_reb,
      coalesce(sum(t.rebounds_defensive),0)::int def_reb,
      coalesce(sum(t.turnovers),0)::int turnovers,
      coalesce(avg(t.efg),0)::numeric efg,
      coalesce(avg(t.ortg),0)::numeric ortg,
      coalesce(avg(t.drtg),0)::numeric drtg
    from public.team_game_stats t join g on g.id=t.game_id
  )
  select jsonb_build_object(
    'games',totals.games,'wins',totals.wins,'losses',totals.losses,
    'points_for',totals.points_for,'points_against',totals.points_against,
    'points_for_avg',case when totals.games>0 then round(totals.points_for::numeric/totals.games,1) else 0 end,
    'points_against_avg',case when totals.games>0 then round(totals.points_against::numeric/totals.games,1) else 0 end,
    'assists',tgs.assists,'rebounds',tgs.off_reb+tgs.def_reb,'turnovers',tgs.turnovers,
    'efg',round(tgs.efg,1),'ortg',round(tgs.ortg,1),'drtg',round(tgs.drtg,1)
  ) into v_team_metrics from totals cross join tgs;

  with roster as (
    select p.id,p.first_name,p.last_name,
      coalesce(rm.jersey,p.jersey) jersey,
      coalesce(rm.primary_position,p.primary_position,'Sin posición') primary_position
    from public.roster_memberships rm
    join public.players p on p.id=rm.player_id
    where rm.team_season_id=v_ts
      and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
      and (rm.joined_at is null or rm.joined_at<=now())
      and (rm.left_at is null or rm.left_at>now())
  ), agg as (
    select r.id,r.first_name,r.last_name,r.jersey,r.primary_position,
      count(distinct pgs.game_id)::int games,
      coalesce(sum(pgs.minutes),0)::int minutes,
      coalesce(sum(pgs.points),0)::int points,
      coalesce(sum(coalesce(pgs.off_reb,0)+coalesce(pgs.def_reb,0)),0)::int rebounds,
      coalesce(sum(pgs.assists),0)::int assists,
      coalesce(sum(pgs.steals),0)::int steals,
      coalesce(sum(pgs.turnovers),0)::int turnovers,
      coalesce(sum(pgs.evaluation),0)::int evaluation,
      coalesce(sum(pgs.plus_minus),0)::int plus_minus
    from roster r
    left join public.player_game_stats pgs on pgs.player_id=r.id
      and exists (
        select 1 from public.games g
        where g.id=pgs.game_id and g.team_season_id=v_ts
          and upper(coalesce(g.play_state,''))='FINISHED'
      )
    group by r.id,r.first_name,r.last_name,r.jersey,r.primary_position
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'player_id',a.id,
    'linked',(a.id=any(v_linked)),
    'first_name',case when a.id=any(v_linked) or v_show_names then a.first_name else null end,
    'last_name',case when a.id=any(v_linked) or v_show_names then a.last_name else null end,
    'jersey',case when a.id=any(v_linked) or v_show_jerseys then a.jersey else null end,
    'primary_position',a.primary_position,
    'games',a.games,'minutes',a.minutes,'points',a.points,'rebounds',a.rebounds,
    'assists',a.assists,'steals',a.steals,'turnovers',a.turnovers,
    'evaluation',a.evaluation,'plus_minus',a.plus_minus,
    'mpg',case when a.games>0 then round(a.minutes::numeric/a.games,1) else 0 end,
    'ppg',case when a.games>0 then round(a.points::numeric/a.games,1) else 0 end,
    'rpg',case when a.games>0 then round(a.rebounds::numeric/a.games,1) else 0 end,
    'apg',case when a.games>0 then round(a.assists::numeric/a.games,1) else 0 end,
    'eval_pg',case when a.games>0 then round(a.evaluation::numeric/a.games,1) else 0 end
  ) order by (a.id=any(v_linked)) desc,a.primary_position,a.jersey nulls last,a.last_name),'[]'::jsonb)
  into v_players from agg a;

  return jsonb_build_object(
    'team',v_team,'team_metrics',coalesce(v_team_metrics,'{}'::jsonb),
    'players',coalesce(v_players,'[]'::jsonb),
    'privacy',jsonb_build_object(
      'show_other_player_names',v_show_names,
      'show_other_player_jerseys',v_show_jerseys
    )
  );
end
$function$;

create or replace function public.iq_v30_family_team_snapshot(
  p_player_id uuid,
  p_team_season_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select iq_v30_private.family_team_snapshot(p_player_id,p_team_season_id);
$function$;

-- -----------------------------------------------------------------------------
-- 4. Independent quick-capture capability. Existing live grants inherit QUICK
--    once for backwards compatibility; future grants may choose them separately.
-- -----------------------------------------------------------------------------
alter table public.game_capture_delegations
  drop constraint if exists game_capture_delegation_capability_check;
alter table public.game_capture_delegations
  add constraint game_capture_delegation_capability_check check (
    capability in ('RECORD_LIVE_GAME','RECORD_QUICK_GAME','EDIT_BOXSCORE','PREPARE_GAME','START_GAME','FINISH_GAME')
  );

with created as (
  insert into public.game_capture_delegations(
    game_id,delegate_user_id,capability,valid_from,valid_until,granted_by,granted_at,grant_note
  )
  select d.game_id,d.delegate_user_id,'RECORD_QUICK_GAME',d.valid_from,d.valid_until,
         d.granted_by,d.granted_at,coalesce(d.grant_note,'') || case when d.grant_note is null then '' else ' · ' end || 'Compatibilidad V30'
  from public.game_capture_delegations d
  where d.capability='RECORD_LIVE_GAME'
    and d.revoked_at is null and d.valid_until>now()
    and not exists (
      select 1 from public.game_capture_delegations q
      where q.game_id=d.game_id and q.delegate_user_id=d.delegate_user_id
        and q.capability='RECORD_QUICK_GAME' and q.revoked_at is null and q.valid_until>now()
    )
  returning id,game_id,delegate_user_id,granted_by,valid_from,valid_until
)
insert into public.game_capture_delegation_events(
  delegation_id,game_id,delegate_user_id,capability,action,actor_user_id,reason,metadata
)
select id,game_id,delegate_user_id,'RECORD_QUICK_GAME','GRANTED',granted_by,
       'Backfill de compatibilidad desde RECORD_LIVE_GAME V30',
       jsonb_build_object('valid_from',valid_from,'valid_until',valid_until,'source','V30_BACKFILL')
from created;

create or replace function iq_v21_private.has_capability(p_game_id uuid,p_capability text)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and public.iq_account_is_active()
    and exists (
      select 1 from public.game_capture_delegations d
      where d.game_id=p_game_id
        and d.delegate_user_id=auth.uid()
        and (
          d.capability=upper(trim(coalesce(p_capability,'')))
          or (
            upper(trim(coalesce(p_capability,'')))='RECORD_LIVE_GAME'
            and d.capability='RECORD_QUICK_GAME'
          )
        )
        and d.revoked_at is null
        and d.valid_from<=now()
        and d.valid_until>now()
    );
$function$;

create or replace function iq_v21_private.grant_delegation(
  p_game_id uuid,
  p_delegate_email text,
  p_capabilities text[],
  p_valid_until timestamptz,
  p_valid_from timestamptz default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_delegate public.user_profiles%rowtype;
  v_game public.games%rowtype;
  v_capability text;
  v_valid_from timestamptz:=coalesce(p_valid_from,now());
  v_delegation_id uuid;
  v_replaced_id uuid;
begin
  if not iq_v21_private.can_manage(p_game_id) then
    raise exception 'GAME_CAPTURE_DELEGATION_MANAGE_DENIED' using errcode='42501';
  end if;
  select * into v_game from public.games where id=p_game_id;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if upper(coalesce(v_game.edit_state,'OPEN'))<>'OPEN' then
    raise exception 'GAME_CAPTURE_DELEGATION_GAME_LOCKED' using errcode='42501';
  end if;
  if p_valid_until is null or p_valid_until<=v_valid_from then
    raise exception 'GAME_CAPTURE_DELEGATION_WINDOW_INVALID';
  end if;
  if p_valid_until>now()+interval '31 days' then
    raise exception 'GAME_CAPTURE_DELEGATION_WINDOW_TOO_LONG';
  end if;
  if coalesce(array_length(p_capabilities,1),0)=0 then
    raise exception 'GAME_CAPTURE_DELEGATION_CAPABILITIES_REQUIRED';
  end if;
  if char_length(coalesce(p_note,''))>1000 then
    raise exception 'GAME_CAPTURE_DELEGATION_NOTE_TOO_LONG';
  end if;

  select * into v_delegate
  from public.user_profiles
  where lower(email)=lower(trim(coalesce(p_delegate_email,'')))
  limit 1;
  if v_delegate.id is null or not public.iq_account_is_active_for_user(v_delegate.id) then
    raise exception 'GAME_CAPTURE_DELEGATE_ACTIVE_ACCOUNT_REQUIRED';
  end if;
  if v_delegate.id=auth.uid() then raise exception 'GAME_CAPTURE_DELEGATE_SELF_NOT_ALLOWED'; end if;

  for v_capability in
    select distinct upper(trim(capability)) from unnest(p_capabilities) as capability
  loop
    if v_capability not in (
      'RECORD_LIVE_GAME','RECORD_QUICK_GAME','EDIT_BOXSCORE','PREPARE_GAME','START_GAME','FINISH_GAME'
    ) then raise exception 'GAME_CAPTURE_DELEGATION_CAPABILITY_INVALID'; end if;

    for v_replaced_id in
      select id from public.game_capture_delegations
      where game_id=p_game_id and delegate_user_id=v_delegate.id
        and capability=v_capability and revoked_at is null and valid_until>now()
    loop
      update public.game_capture_delegations
      set revoked_at=now(),revoked_by=auth.uid(),revoke_reason='Replaced by a new active delegation'
      where id=v_replaced_id;
      insert into public.game_capture_delegation_events(
        delegation_id,game_id,delegate_user_id,capability,action,actor_user_id,reason
      ) values (
        v_replaced_id,p_game_id,v_delegate.id,v_capability,'EXPIRED_REPLACED',auth.uid(),
        'Replaced by a new active delegation'
      );
    end loop;

    insert into public.game_capture_delegations(
      game_id,delegate_user_id,capability,valid_from,valid_until,granted_by,grant_note
    ) values (
      p_game_id,v_delegate.id,v_capability,v_valid_from,p_valid_until,auth.uid(),nullif(trim(coalesce(p_note,'')),'')
    ) returning id into v_delegation_id;

    insert into public.game_capture_delegation_events(
      delegation_id,game_id,delegate_user_id,capability,action,actor_user_id,reason,metadata
    ) values (
      v_delegation_id,p_game_id,v_delegate.id,v_capability,'GRANTED',auth.uid(),
      nullif(trim(coalesce(p_note,'')),''),jsonb_build_object('valid_from',v_valid_from,'valid_until',p_valid_until)
    );
  end loop;

  return iq_v21_private.list_delegations(p_game_id);
end
$function$;

-- Permissions: public RPCs only; implementation remains private.
revoke all on all functions in schema iq_v30_private from public,anon,authenticated;
grant execute on function iq_v30_private.create_family_link_invitation(uuid,uuid,text,text,integer) to authenticated;
grant execute on function iq_v30_private.list_team_family_links(uuid) to authenticated;
grant execute on function iq_v30_private.revoke_family_link(uuid,uuid,text) to authenticated;
grant execute on function iq_v30_private.family_team_snapshot(uuid,uuid) to authenticated;

revoke all on function public.iq_v30_create_family_link_invitation(uuid,uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.iq_v30_list_team_family_links(uuid) from public,anon,authenticated;
revoke all on function public.iq_v30_revoke_family_link(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.iq_v30_family_team_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.iq_v30_create_family_link_invitation(uuid,uuid,text,text,integer) to authenticated;
grant execute on function public.iq_v30_list_team_family_links(uuid) to authenticated;
grant execute on function public.iq_v30_revoke_family_link(uuid,uuid,text) to authenticated;
grant execute on function public.iq_v30_family_team_snapshot(uuid,uuid) to authenticated;

commit;
