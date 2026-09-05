-- =============================================================================
-- IQBasket V8 - Family Workspace Priority 1 V1
-- Date: 2026-09-04
-- Purpose:
--   * verified family <-> player invitation/claim lifecycle;
--   * Family Free onboarding without coupling authorization to payment;
--   * longitudinal player passport across teams/seasons;
--   * family-safe Player360 projection with server-side entitlement checks.
--
-- Security invariants:
--   * paying never creates a subject relationship;
--   * a relationship never bypasses commercial feature limits;
--   * no direct client access to invitation/commercial tables;
--   * passport never returns Nutrition, Recovery or Neuro data.
-- =============================================================================

begin;

do $v8$
begin
  if to_regclass('public.player360_subject_relationships') is null
     or to_regclass('public.saas_billing_accounts') is null
     or to_regclass('public.roster_memberships') is null
     or to_regprocedure('public.iq_v4e_can_admin_privacy(uuid)') is null
     or to_regprocedure('public.iq_saas_entitlement_check(text,uuid,uuid,text,integer)') is null
     or to_regprocedure('iq_private.account_is_active(uuid)') is null then
    raise exception 'FAMILY_WORKSPACE_V1_PREREQUISITES_MISSING';
  end if;
end
$v8$;

create table public.family_player_link_invitations (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  relationship_type text not null default 'GUARDIAN',
  invite_email text not null,
  token_hash text not null unique,
  status text not null default 'PENDING',
  expires_at timestamptz not null,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  claimed_by uuid null references public.user_profiles(id) on delete set null,
  claimed_at timestamptz null,
  revoked_by uuid null references public.user_profiles(id) on delete set null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_link_relationship_check check (relationship_type='GUARDIAN'),
  constraint family_link_status_check check (status in ('PENDING','CLAIMED','REVOKED','EXPIRED')),
  constraint family_link_expiry_check check (expires_at > created_at),
  constraint family_link_claim_check check (
    (status='CLAIMED' and claimed_by is not null and claimed_at is not null)
    or (status<>'CLAIMED')
  )
);

create unique index family_link_pending_email_player_uq
  on public.family_player_link_invitations(player_id,lower(invite_email))
  where status='PENDING';
create index family_link_invitation_creator_idx
  on public.family_player_link_invitations(created_by,created_at desc);

create unique index if not exists saas_family_active_owner_uq
  on public.saas_billing_accounts(owner_user_id)
  where account_type='FAMILY' and status='ACTIVE';

create trigger family_player_link_invitations_touch
before update on public.family_player_link_invitations
for each row execute function public.iq_v4_touch_updated_at();

alter table public.family_player_link_invitations enable row level security;
revoke all on table public.family_player_link_invitations
  from public,anon,authenticated;
create policy iq_family_link_no_direct_client_access
  on public.family_player_link_invitations
  for all to anon,authenticated
  using (false) with check (false);

create or replace function iq_private.family_has_active_relation(
  p_user_id uuid,
  p_player_id uuid
)
returns boolean language sql stable security definer set search_path=''
as $function$
  select p_user_id is not null and p_player_id is not null and (
    exists (
      select 1 from public.player360_subject_relationships r
      where r.user_id=p_user_id and r.player_id=p_player_id
        and r.status='ACTIVE' and r.valid_from<=now()
        and (r.valid_until is null or r.valid_until>now())
        and r.relationship_type in ('SELF','GUARDIAN')
    )
    or exists (
      select 1 from public.user_profiles up
      where up.id=p_user_id and up.linked_player_id=p_player_id
        and upper(coalesce(up.global_role,up.role,'')) in ('JUGADOR','FAMILIA_TUTOR')
    )
  );
$function$;
revoke all on function iq_private.family_has_active_relation(uuid,uuid)
  from public,anon,authenticated;

create or replace function iq_private.family_can_view_player(
  p_user_id uuid,
  p_player_id uuid
)
returns boolean language sql stable security definer set search_path=''
as $function$
  select iq_private.account_is_active(p_user_id)
    and (
      iq_private.family_has_active_relation(p_user_id,p_player_id)
      or exists (
        select 1 from public.user_profiles up
        where up.id=p_user_id
          and upper(coalesce(up.global_role,up.role,''))='SUPERADMIN'
      )
    );
$function$;
revoke all on function iq_private.family_can_view_player(uuid,uuid)
  from public,anon,authenticated;

create or replace function iq_private.family_bootstrap_free_account(
  p_user_id uuid,
  p_player_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $function$
declare
  v_account_id uuid;
  v_plan_id uuid;
  v_plan_code text;
  v_subscription_id uuid;
  v_max_players integer:=0;
  v_subject_count integer:=0;
  v_subject_covered boolean:=false;
  v_display_name text;
begin
  if not iq_private.family_has_active_relation(p_user_id,p_player_id) then
    raise exception 'FAMILY_RELATION_REQUIRED' using errcode='42501';
  end if;

  select a.id into v_account_id
  from public.saas_billing_accounts a
  where a.account_type='FAMILY' and a.owner_user_id=p_user_id and a.status='ACTIVE'
  order by a.created_at asc limit 1;

  if v_account_id is null then
    select coalesce(nullif(trim(concat_ws(' ',up.first_name,up.last_name)),''),'IQBasket Family')
      into v_display_name
    from public.user_profiles up where up.id=p_user_id;

    insert into public.saas_billing_accounts(
      account_type,display_name,owner_user_id,status,source,metadata
    ) values (
      'FAMILY',coalesce(v_display_name,'IQBasket Family'),p_user_id,'ACTIVE','PROMOTION',
      jsonb_build_object('onboarding','FAMILY_FREE_V1')
    ) returning id into v_account_id;
  end if;

  select s.id,p.id,p.code
    into v_subscription_id,v_plan_id,v_plan_code
  from public.saas_subscriptions s
  join public.saas_plans p on p.id=s.plan_id
  where s.billing_account_id=v_account_id
    and s.status in ('TRIAL','ACTIVE','PAST_DUE','GRACE','SUSPENDED')
  order by s.created_at desc limit 1;

  if v_subscription_id is null then
    select p.id,p.code into v_plan_id,v_plan_code
    from public.saas_plans p
    where p.code='FAMILY_FREE' and p.account_type='FAMILY' and p.status='ACTIVE';
    if v_plan_id is null then raise exception 'FAMILY_FREE_PLAN_UNAVAILABLE'; end if;

    insert into public.saas_subscriptions(
      billing_account_id,plan_id,status,source,metadata
    ) values (
      v_account_id,v_plan_id,'ACTIVE','PROMOTION',
      jsonb_build_object('onboarding','FAMILY_FREE_V1')
    ) returning id into v_subscription_id;
  end if;

  select coalesce(pe.integer_value,0) into v_max_players
  from public.saas_plan_entitlements pe
  where pe.plan_id=v_plan_id and pe.entitlement_code='MAX_PLAYERS';

  select exists(
    select 1 from public.saas_billing_subjects bs
    where bs.billing_account_id=v_account_id and bs.subject_type='PLAYER'
      and bs.player_id=p_player_id and bs.status='ACTIVE'
      and bs.valid_from<=now() and (bs.valid_until is null or bs.valid_until>now())
  ) into v_subject_covered;

  if not v_subject_covered then
    select count(*) into v_subject_count
    from public.saas_billing_subjects bs
    where bs.billing_account_id=v_account_id and bs.subject_type='PLAYER'
      and bs.status='ACTIVE' and bs.valid_from<=now()
      and (bs.valid_until is null or bs.valid_until>now());

    if v_subject_count < v_max_players then
      insert into public.saas_billing_subjects(
        billing_account_id,subject_type,player_id,status,source
      ) values (v_account_id,'PLAYER',p_player_id,'ACTIVE','PROMOTION')
      on conflict do nothing;
      v_subject_covered:=true;
    end if;
  end if;

  return jsonb_build_object(
    'billing_account_id',v_account_id,
    'subscription_id',v_subscription_id,
    'plan_code',v_plan_code,
    'max_players',v_max_players,
    'subject_covered',v_subject_covered,
    'reason_code',case when v_subject_covered then 'FAMILY_PRODUCT_READY' else 'PLAYER_LIMIT_REACHED' end
  );
end;
$function$;
revoke all on function iq_private.family_bootstrap_free_account(uuid,uuid)
  from public,anon,authenticated;

create or replace function public.iq_v8_family_list_players()
returns jsonb language sql stable security definer set search_path=''
as $function$
  with rel as (
    select r.id as relationship_id,r.player_id,r.relationship_type,r.status,
           r.valid_from,r.valid_until,true as can_revoke
    from public.player360_subject_relationships r
    where r.user_id=auth.uid() and r.status='ACTIVE'
      and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
      and r.relationship_type in ('SELF','GUARDIAN')
    union all
    select null::uuid,up.linked_player_id,
           case when upper(coalesce(up.global_role,up.role,''))='JUGADOR' then 'SELF' else 'GUARDIAN' end,
           'ACTIVE',up.created_at,null::timestamptz,false
    from public.user_profiles up
    where up.id=auth.uid() and up.linked_player_id is not null
      and upper(coalesce(up.global_role,up.role,'')) in ('JUGADOR','FAMILIA_TUTOR')
      and not exists (
        select 1 from public.player360_subject_relationships r
        where r.user_id=up.id and r.player_id=up.linked_player_id
          and r.status='ACTIVE' and r.valid_from<=now()
          and (r.valid_until is null or r.valid_until>now())
      )
  ), dedup as (
    select distinct on (player_id) * from rel
    order by player_id,case relationship_type when 'SELF' then 0 else 1 end,valid_from desc
  )
  select case when auth.uid() is null or not public.iq_account_is_active() then '[]'::jsonb
  else coalesce(jsonb_agg(jsonb_build_object(
    'relationship_id',d.relationship_id,
    'relationship_type',d.relationship_type,
    'can_revoke',d.can_revoke,
    'player',jsonb_build_object(
      'id',p.id,'first_name',p.first_name,'last_name',p.last_name,
      'photo_url',p.photo_url,'primary_position',p.primary_position
    ),
    'latest_context',case when ctx.team_season_id is null then null else jsonb_build_object(
      'team_season_id',ctx.team_season_id,'team_id',ctx.team_id,
      'team_name',ctx.team_name,'club_name',ctx.club_name,
      'season_name',ctx.season_name,'season_start',ctx.start_date,'season_end',ctx.end_date,
      'jersey',ctx.jersey,'primary_position',ctx.primary_position
    ) end
  ) order by coalesce(ctx.end_date,ctx.start_date) desc nulls last),'[]'::jsonb) end
  from dedup d
  join public.players p on p.id=d.player_id
  left join lateral (
    select rm.team_season_id,ts.team_id,t.name as team_name,c.name as club_name,
           s.name as season_name,s.start_date,s.end_date,rm.jersey,rm.primary_position
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    join public.teams t on t.id=ts.team_id
    left join public.clubs c on c.id=t.club_id
    join public.seasons s on s.id=ts.season_id
    where rm.player_id=d.player_id
    order by coalesce(s.end_date,s.start_date) desc,rm.updated_at desc
    limit 1
  ) ctx on true;
$function$;
revoke all on function public.iq_v8_family_list_players() from public,anon,authenticated;
grant execute on function public.iq_v8_family_list_players() to authenticated;

create or replace function public.iq_v8_family_create_link_invitation(
  p_team_season_id uuid,
  p_player_id uuid,
  p_invite_email text,
  p_expires_hours integer default 168
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $function$
declare
  v_email text:=lower(trim(coalesce(p_invite_email,'')));
  v_code text:=gen_random_uuid()::text;
  v_hash text;
  v_id uuid;
  v_expires timestamptz;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not public.iq_v4e_can_admin_privacy(p_team_season_id) then
    raise exception 'FAMILY_LINK_MANAGE_DENIED' using errcode='42501';
  end if;
  if length(v_email)<5 or length(v_email)>320 or position('@' in v_email)<2 then
    raise exception 'FAMILY_LINK_EMAIL_INVALID';
  end if;
  if coalesce(p_expires_hours,0)<1 or p_expires_hours>720 then
    raise exception 'FAMILY_LINK_EXPIRY_INVALID';
  end if;
  if not exists (
    select 1 from public.roster_memberships rm
    where rm.team_season_id=p_team_season_id and rm.player_id=p_player_id
  ) then raise exception 'FAMILY_LINK_PLAYER_SCOPE_INVALID'; end if;

  if exists (
    select 1 from public.family_player_link_invitations i
    where i.player_id=p_player_id and lower(i.invite_email)=v_email
      and i.status='PENDING' and i.expires_at>now()
  ) then raise exception 'FAMILY_LINK_INVITATION_ALREADY_PENDING'; end if;

  update public.family_player_link_invitations
  set status='EXPIRED'
  where player_id=p_player_id and lower(invite_email)=v_email
    and status='PENDING' and expires_at<=now();

  v_hash:=encode(extensions.digest(v_code,'sha256'),'hex');
  v_expires:=now()+make_interval(hours=>p_expires_hours);
  insert into public.family_player_link_invitations(
    team_season_id,player_id,invite_email,token_hash,expires_at,created_by
  ) values (
    p_team_season_id,p_player_id,v_email,v_hash,v_expires,auth.uid()
  ) returning id into v_id;

  perform public.iq_v4e_log_privacy_event(
    'FAMILY_LINK_INVITATION_CREATED','FAMILY_LINK_INVITATION',v_id,
    p_player_id,p_team_season_id,'CREATE','FAMILY_SUPPORT','ALLOW','STAFF_INVITED',
    jsonb_build_object('invite_email',v_email,'expires_at',v_expires)
  );

  return jsonb_build_object(
    'invitation_id',v_id,'claim_code',v_code,'expires_at',v_expires,
    'invite_email',v_email,'relationship_type','GUARDIAN'
  );
end;
$function$;
revoke all on function public.iq_v8_family_create_link_invitation(uuid,uuid,text,integer)
  from public,anon,authenticated;
grant execute on function public.iq_v8_family_create_link_invitation(uuid,uuid,text,integer)
  to authenticated;

create or replace function public.iq_v8_family_claim_link(p_claim_code text)
returns jsonb language plpgsql volatile security definer set search_path=''
as $function$
declare
  v_hash text;
  v_inv public.family_player_link_invitations;
  v_email text;
  v_relation_id uuid;
  v_product jsonb;
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
    update public.family_player_link_invitations set status='EXPIRED' where id=v_inv.id;
    return jsonb_build_object('claimed',false,'reason_code','INVITATION_EXPIRED');
  end if;

  select lower(trim(coalesce(up.email,''))) into v_email
  from public.user_profiles up where up.id=auth.uid();
  if v_email='' or v_email<>lower(v_inv.invite_email) then
    raise exception 'FAMILY_LINK_EMAIL_MISMATCH' using errcode='42501';
  end if;

  select r.id into v_relation_id
  from public.player360_subject_relationships r
  where r.user_id=auth.uid() and r.player_id=v_inv.player_id
    and r.relationship_type='GUARDIAN' and r.status='ACTIVE'
    and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
  order by r.created_at desc limit 1;

  if v_relation_id is null then
    insert into public.player360_subject_relationships(
      user_id,player_id,relationship_type,status,verification_source,verified_by
    ) values (
      auth.uid(),v_inv.player_id,'GUARDIAN','ACTIVE','FAMILY_EMAIL_INVITATION',v_inv.created_by
    ) returning id into v_relation_id;
  end if;

  update public.family_player_link_invitations
  set status='CLAIMED',claimed_by=auth.uid(),claimed_at=now()
  where id=v_inv.id;

  v_product:=iq_private.family_bootstrap_free_account(auth.uid(),v_inv.player_id);

  perform public.iq_v4e_log_privacy_event(
    'FAMILY_LINK_INVITATION_CLAIMED','SUBJECT_RELATIONSHIP',v_relation_id,
    v_inv.player_id,v_inv.team_season_id,'CREATE','FAMILY_SUPPORT','ALLOW','EMAIL_INVITE_CLAIMED',
    jsonb_build_object('invitation_id',v_inv.id)
  );

  return jsonb_build_object(
    'claimed',true,'reason_code','FAMILY_LINK_ACTIVE',
    'relationship_id',v_relation_id,'player_id',v_inv.player_id,
    'product',v_product
  );
end;
$function$;
revoke all on function public.iq_v8_family_claim_link(text) from public,anon,authenticated;
grant execute on function public.iq_v8_family_claim_link(text) to authenticated;

create or replace function public.iq_v8_family_bootstrap_free(p_player_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=''
as $function$
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not iq_private.family_has_active_relation(auth.uid(),p_player_id) then
    raise exception 'FAMILY_RELATION_REQUIRED' using errcode='42501';
  end if;
  return iq_private.family_bootstrap_free_account(auth.uid(),p_player_id);
end;
$function$;
revoke all on function public.iq_v8_family_bootstrap_free(uuid) from public,anon,authenticated;
grant execute on function public.iq_v8_family_bootstrap_free(uuid) to authenticated;

create or replace function public.iq_v8_family_revoke_own_link(
  p_relationship_id uuid,
  p_reason text default null
)
returns boolean language plpgsql volatile security definer set search_path=''
as $function$
declare v_row public.player360_subject_relationships;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  select * into v_row from public.player360_subject_relationships
  where id=p_relationship_id and user_id=auth.uid()
    and relationship_type='GUARDIAN' and status='ACTIVE'
  for update;
  if v_row.id is null then raise exception 'FAMILY_LINK_NOT_REVOCABLE'; end if;

  update public.player360_subject_relationships
  set status='REVOKED',revoked_by=auth.uid(),revoked_at=now(),
      revocation_reason=nullif(trim(coalesce(p_reason,'')),'')
  where id=p_relationship_id;

  perform public.iq_v4e_log_privacy_event(
    'FAMILY_LINK_SELF_REVOKED','SUBJECT_RELATIONSHIP',p_relationship_id,
    v_row.player_id,null,'UPDATE','FAMILY_SUPPORT','ALLOW','GUARDIAN_SELF_REVOKED','{}'::jsonb
  );
  return true;
end;
$function$;
revoke all on function public.iq_v8_family_revoke_own_link(uuid,text)
  from public,anon,authenticated;
grant execute on function public.iq_v8_family_revoke_own_link(uuid,text) to authenticated;

create or replace function public.iq_v8_family_product_snapshot(p_player_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_account_id uuid;
  v_plan_code text;
  v_subscription_status text;
  v_subject_covered boolean:=false;
  v_entitlements jsonb:='{}'::jsonb;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not iq_private.family_can_view_player(auth.uid(),p_player_id) then
    raise exception 'FAMILY_PLAYER_ACCESS_DENIED' using errcode='42501';
  end if;

  select a.id,p.code,s.status
    into v_account_id,v_plan_code,v_subscription_status
  from public.saas_billing_accounts a
  join public.saas_billing_account_members m on m.billing_account_id=a.id
  left join public.saas_subscriptions s on s.billing_account_id=a.id
    and s.status in ('TRIAL','ACTIVE','PAST_DUE','GRACE','SUSPENDED')
  left join public.saas_plans p on p.id=s.plan_id
  where m.user_id=auth.uid() and m.status='ACTIVE' and a.account_type='FAMILY' and a.status='ACTIVE'
  order by case when a.owner_user_id=auth.uid() then 0 else 1 end,a.created_at asc
  limit 1;

  if v_account_id is not null then
    select exists(
      select 1 from public.saas_billing_subjects bs
      where bs.billing_account_id=v_account_id and bs.subject_type='PLAYER'
        and bs.player_id=p_player_id and bs.status='ACTIVE'
        and bs.valid_from<=now() and (bs.valid_until is null or bs.valid_until>now())
    ) into v_subject_covered;
  end if;

  select coalesce(jsonb_object_agg(x.code,
    public.iq_saas_entitlement_check('PLAYER',p_player_id,null,x.code,1)
  ),'{}'::jsonb) into v_entitlements
  from unnest(array[
    'PLAYER_PROFILE','GAME_HISTORY','BASIC_STATS','BASIC_TIMELINE',
    'ADVANCED_ANALYTICS','PLAYER360','PLAYER_GOALS','DEVELOPMENT_PLAN',
    'TECHNIFICATION','FAMILY_INSIGHTS','REPORT_EXPORT','WELLNESS',
    'NUTRITION_RECOVERY','PRIVACY_CENTER','AI_INSIGHTS','AI_WEEKLY_PLAN',
    'MAX_PLAYERS','AI_MONTHLY_UNITS','EXPORT_MONTHLY_UNITS'
  ]::text[]) x(code);

  return jsonb_build_object(
    'player_id',p_player_id,
    'billing_account_id',v_account_id,
    'plan_code',v_plan_code,
    'subscription_status',v_subscription_status,
    'subject_covered',v_subject_covered,
    'can_bootstrap_free',v_account_id is null or not v_subject_covered,
    'entitlements',v_entitlements
  );
end;
$function$;
revoke all on function public.iq_v8_family_product_snapshot(uuid)
  from public,anon,authenticated;
grant execute on function public.iq_v8_family_product_snapshot(uuid) to authenticated;

create or replace function public.iq_v8_family_player_passport(p_player_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_profile_gate jsonb;
  v_history_gate jsonb;
  v_stats_gate jsonb;
  v_timeline_gate jsonb;
  v_player jsonb;
  v_career jsonb:='[]'::jsonb;
  v_recent_games jsonb:='[]'::jsonb;
  v_timeline jsonb:='[]'::jsonb;
  v_totals jsonb:='{}'::jsonb;
  v_internal_preview boolean:=false;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not iq_private.family_can_view_player(auth.uid(),p_player_id) then
    raise exception 'FAMILY_PLAYER_ACCESS_DENIED' using errcode='42501';
  end if;
  v_internal_preview:=public.iq_v3_is_global_superadmin();

  v_profile_gate:=public.iq_saas_entitlement_check('PLAYER',p_player_id,null,'PLAYER_PROFILE',1);
  v_history_gate:=public.iq_saas_entitlement_check('PLAYER',p_player_id,null,'GAME_HISTORY',1);
  v_stats_gate:=public.iq_saas_entitlement_check('PLAYER',p_player_id,null,'BASIC_STATS',1);
  v_timeline_gate:=public.iq_saas_entitlement_check('PLAYER',p_player_id,null,'BASIC_TIMELINE',1);

  if not v_internal_preview and not coalesce((v_profile_gate->>'allowed')::boolean,false) then
    raise exception 'FAMILY_PRODUCT_PLAYER_PROFILE_REQUIRED' using errcode='42501';
  end if;

  select jsonb_build_object(
    'id',p.id,'first_name',p.first_name,'last_name',p.last_name,
    'photo_url',p.photo_url,'primary_position',p.primary_position,
    'secondary_positions',coalesce(to_jsonb(p.secondary_positions),'[]'::jsonb),
    'dominant_hand',p.dominant_hand,'height_cm',p.height_cm
  ) into v_player
  from public.players p where p.id=p_player_id;
  if v_player is null then raise exception 'FAMILY_PLAYER_NOT_FOUND'; end if;

  if v_internal_preview or coalesce((v_history_gate->>'allowed')::boolean,false) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'team_season_id',rm.team_season_id,'team_id',ts.team_id,
      'team_name',t.name,'club_name',c.name,'season_name',s.name,
      'season_start',s.start_date,'season_end',s.end_date,
      'membership_status',rm.status,'jersey',rm.jersey,
      'primary_position',rm.primary_position,
      'stints',coalesce(st.stints,'[]'::jsonb),
      'games',coalesce(gs.games,0),'minutes',coalesce(gs.minutes,0),
      'points',coalesce(gs.points,0),'rebounds',coalesce(gs.rebounds,0),
      'assists',coalesce(gs.assists,0),'steals',coalesce(gs.steals,0),
      'blocks',coalesce(gs.blocks,0),'turnovers',coalesce(gs.turnovers,0),
      'fg2_made',coalesce(gs.fg2_made,0),'fg2_attempted',coalesce(gs.fg2_attempted,0),
      'fg3_made',coalesce(gs.fg3_made,0),'fg3_attempted',coalesce(gs.fg3_attempted,0),
      'ft_made',coalesce(gs.ft_made,0),'ft_attempted',coalesce(gs.ft_attempted,0),
      'training_sessions',coalesce(tr.sessions,0),'training_minutes',coalesce(tr.minutes,0),
      'technification_sessions',coalesce(ed.sessions,0),'technification_minutes',coalesce(ed.minutes,0)
    ) order by coalesce(s.end_date,s.start_date) desc),'[]'::jsonb)
    into v_career
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    join public.teams t on t.id=ts.team_id
    left join public.clubs c on c.id=t.club_id
    join public.seasons s on s.id=ts.season_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'valid_from',rs.valid_from,'valid_until',rs.valid_until,'source',rs.source
      ) order by rs.valid_from) as stints
      from public.roster_membership_stints rs
      where rs.roster_membership_id=rm.id
    ) st on true
    left join lateral (
      select count(*)::integer games,
        coalesce(sum(pgs.minutes),0)::integer minutes,
        coalesce(sum(pgs.points),0)::integer points,
        coalesce(sum(coalesce(pgs.off_reb,pgs.rebounds_offensive,0)+coalesce(pgs.def_reb,pgs.rebounds_defensive,0)),0)::integer rebounds,
        coalesce(sum(pgs.assists),0)::integer assists,
        coalesce(sum(pgs.steals),0)::integer steals,
        coalesce(sum(coalesce(pgs.blocks,pgs.blocks_made,0)),0)::integer blocks,
        coalesce(sum(pgs.turnovers),0)::integer turnovers,
        coalesce(sum(pgs.fg2_made),0)::integer fg2_made,
        coalesce(sum(pgs.fg2_attempted),0)::integer fg2_attempted,
        coalesce(sum(pgs.fg3_made),0)::integer fg3_made,
        coalesce(sum(pgs.fg3_attempted),0)::integer fg3_attempted,
        coalesce(sum(pgs.ft_made),0)::integer ft_made,
        coalesce(sum(pgs.ft_attempted),0)::integer ft_attempted
      from public.player_game_stats pgs
      join public.games g on g.id=pgs.game_id
      where pgs.player_id=p_player_id and g.team_season_id=rm.team_season_id
    ) gs on true
    left join lateral (
      select count(*)::integer sessions,
             coalesce(sum(tp.participated_minutes),0)::integer minutes
      from public.training_participants tp
      where tp.player_id=p_player_id and tp.team_season_id=rm.team_season_id
    ) tr on true
    left join lateral (
      select count(*)::integer sessions,
             coalesce(sum(ed.duration_minutes),0)::integer minutes
      from public.external_development_sessions ed
      where ed.player_id=p_player_id and ed.team_season_id=rm.team_season_id
    ) ed on true
    where rm.player_id=p_player_id;
  end if;

  if v_internal_preview or coalesce((v_stats_gate->>'allowed')::boolean,false) then
    select jsonb_build_object(
      'games',count(*)::integer,
      'minutes',coalesce(sum(pgs.minutes),0)::integer,
      'points',coalesce(sum(pgs.points),0)::integer,
      'rebounds',coalesce(sum(coalesce(pgs.off_reb,pgs.rebounds_offensive,0)+coalesce(pgs.def_reb,pgs.rebounds_defensive,0)),0)::integer,
      'assists',coalesce(sum(pgs.assists),0)::integer,
      'steals',coalesce(sum(pgs.steals),0)::integer,
      'blocks',coalesce(sum(coalesce(pgs.blocks,pgs.blocks_made,0)),0)::integer,
      'turnovers',coalesce(sum(pgs.turnovers),0)::integer,
      'fg2_made',coalesce(sum(pgs.fg2_made),0)::integer,
      'fg2_attempted',coalesce(sum(pgs.fg2_attempted),0)::integer,
      'fg3_made',coalesce(sum(pgs.fg3_made),0)::integer,
      'fg3_attempted',coalesce(sum(pgs.fg3_attempted),0)::integer,
      'ft_made',coalesce(sum(pgs.ft_made),0)::integer,
      'ft_attempted',coalesce(sum(pgs.ft_attempted),0)::integer
    ) into v_totals
    from public.player_game_stats pgs where pgs.player_id=p_player_id;
  end if;

  if v_internal_preview or (
    coalesce((v_history_gate->>'allowed')::boolean,false)
    and coalesce((v_stats_gate->>'allowed')::boolean,false)
  ) then
    select coalesce(jsonb_agg(x.item order by x.game_date desc),'[]'::jsonb)
    into v_recent_games
    from (
      select coalesce(g.game_date,g.date) game_date,jsonb_build_object(
        'game_id',g.id,'team_season_id',g.team_season_id,
        'date',coalesce(g.game_date,g.date),'team_name',t.name,
        'opponent',g.opponent,'competition',g.competition,
        'team_score',coalesce(g.team_score,g.our_score),
        'opponent_score',coalesce(g.opponent_score,g.opp_score),
        'minutes',coalesce(pgs.minutes,0),'points',coalesce(pgs.points,0),
        'rebounds',coalesce(pgs.off_reb,pgs.rebounds_offensive,0)+coalesce(pgs.def_reb,pgs.rebounds_defensive,0),
        'assists',coalesce(pgs.assists,0),'steals',coalesce(pgs.steals,0),
        'blocks',coalesce(pgs.blocks,pgs.blocks_made,0),'turnovers',coalesce(pgs.turnovers,0),
        'fg3_made',coalesce(pgs.fg3_made,0),'fg3_attempted',coalesce(pgs.fg3_attempted,0)
      ) item
      from public.player_game_stats pgs
      join public.games g on g.id=pgs.game_id
      left join public.teams t on t.id=g.team_id
      where pgs.player_id=p_player_id
      order by coalesce(g.game_date,g.date) desc nulls last,g.created_at desc
      limit 12
    ) x;
  end if;

  if v_internal_preview or coalesce((v_timeline_gate->>'allowed')::boolean,false) then
    select coalesce(jsonb_agg(x.item order by x.event_date desc,x.sort_order),'[]'::jsonb)
    into v_timeline
    from (
      select * from (
        select coalesce(g.game_date,g.date) event_date,1 sort_order,jsonb_build_object(
          'type','GAME','date',coalesce(g.game_date,g.date),'team_season_id',g.team_season_id,
          'title',concat('vs ',coalesce(g.opponent,'Rival')),
          'detail',jsonb_build_object('points',coalesce(pgs.points,0),'minutes',coalesce(pgs.minutes,0))
        ) item
        from public.player_game_stats pgs join public.games g on g.id=pgs.game_id
        where pgs.player_id=p_player_id
        union all
        select ts.session_date,2,jsonb_build_object(
          'type','TRAINING','date',ts.session_date,'team_season_id',tp.team_season_id,
          'title',coalesce(ts.title,'Entrenamiento'),
          'detail',jsonb_build_object('minutes',coalesce(tp.participated_minutes,0),'attendance',tp.attendance_status)
        )
        from public.training_participants tp
        join public.training_sessions ts on ts.id=tp.training_session_id
        where tp.player_id=p_player_id
        union all
        select ed.activity_date,3,jsonb_build_object(
          'type','TECHNIFICATION','date',ed.activity_date,'team_season_id',ed.team_season_id,
          'title',coalesce(ed.title,'Tecnificacion'),
          'detail',jsonb_build_object('minutes',coalesce(ed.duration_minutes,0),'provider',ed.provider_name)
        )
        from public.external_development_sessions ed where ed.player_id=p_player_id
      ) u order by event_date desc nulls last,sort_order limit 30
    ) x;
  end if;

  return jsonb_build_object(
    'player',v_player,
    'career',v_career,
    'career_totals',v_totals,
    'recent_games',v_recent_games,
    'timeline',v_timeline,
    'internal_preview',v_internal_preview,
    'section_access',jsonb_build_object(
      'player_profile',v_internal_preview or coalesce((v_profile_gate->>'allowed')::boolean,false),
      'game_history',v_internal_preview or coalesce((v_history_gate->>'allowed')::boolean,false),
      'basic_stats',v_internal_preview or coalesce((v_stats_gate->>'allowed')::boolean,false),
      'basic_timeline',v_internal_preview or coalesce((v_timeline_gate->>'allowed')::boolean,false)
    )
  );
end;
$function$;
revoke all on function public.iq_v8_family_player_passport(uuid)
  from public,anon,authenticated;
grant execute on function public.iq_v8_family_player_passport(uuid) to authenticated;

create or replace function public.iq_v8_family_player360_snapshot(
  p_player_id uuid,
  p_team_season_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_team_season_id uuid:=p_team_season_id;
  v_gate jsonb;
  v_internal_preview boolean:=false;
  v_objective jsonb;
  v_evaluations jsonb:='[]'::jsonb;
  v_recent jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not iq_private.family_can_view_player(auth.uid(),p_player_id) then
    raise exception 'FAMILY_PLAYER_ACCESS_DENIED' using errcode='42501';
  end if;
  v_internal_preview:=public.iq_v3_is_global_superadmin();

  if v_team_season_id is null then
    select rm.team_season_id into v_team_season_id
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    join public.seasons s on s.id=ts.season_id
    where rm.player_id=p_player_id
    order by coalesce(s.end_date,s.start_date) desc,rm.updated_at desc
    limit 1;
  end if;
  if v_team_season_id is null then
    return jsonb_build_object('allowed',true,'reason_code','PLAYER360_NO_SEASON_DATA','player_id',p_player_id);
  end if;

  v_gate:=public.iq_saas_entitlement_check('PLAYER',p_player_id,v_team_season_id,'PLAYER360',1);
  if not v_internal_preview and not coalesce((v_gate->>'allowed')::boolean,false) then
    return jsonb_build_object(
      'allowed',false,'reason_code',coalesce(v_gate->>'reason_code','PLAYER360_NOT_INCLUDED'),
      'player_id',p_player_id,'team_season_id',v_team_season_id
    );
  end if;

  if not exists (
    select 1 from public.roster_memberships rm
    where rm.player_id=p_player_id and rm.team_season_id=v_team_season_id
  ) then raise exception 'FAMILY_PLAYER360_SCOPE_INVALID' using errcode='42501'; end if;

  if v_internal_preview or coalesce((public.iq_saas_entitlement_check(
    'PLAYER',p_player_id,v_team_season_id,'PLAYER_GOALS',1
  )->>'allowed')::boolean,false) then
    select jsonb_build_object(
      'id',op.id,'title',op.title,'rationale',op.rationale,
      'effective_date',op.effective_date,'target_date',op.target_date,
      'targets',coalesce(tg.targets,'[]'::jsonb)
    ) into v_objective
    from public.player_objective_profiles op
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'metric_code',ot.metric_code,'domain_code',ot.domain_code,
        'metric_name',ot.metric_name,'target_score',ot.target_score,
        'priority_weight',ot.priority_weight,'higher_is_better',ot.higher_is_better
      ) order by ot.priority_weight desc nulls last,ot.metric_name) targets
      from public.player_objective_targets ot where ot.profile_id=op.id
    ) tg on true
    where op.player_id=p_player_id and op.team_season_id=v_team_season_id
      and op.status='ACTIVE'
    order by op.effective_date desc,op.created_at desc limit 1;
  end if;

  select coalesce(jsonb_agg(x.item order by x.evaluation_date desc),'[]'::jsonb)
    into v_evaluations
  from (
    select e.evaluation_date,jsonb_build_object(
      'id',e.id,'date',e.evaluation_date,'title',e.title,
      'summary',e.summary,'strengths',e.strengths,
      'development_priorities',e.development_priorities,
      'evaluation_type',e.evaluation_type
    ) item
    from public.player_evaluations e
    where e.player_id=p_player_id and e.team_season_id=v_team_season_id
      and e.status='CURRENT' and not e.is_private and e.share_with_player
    order by e.evaluation_date desc,e.created_at desc limit 5
  ) x;

  select coalesce(jsonb_agg(x.item order by x.game_date desc),'[]'::jsonb)
    into v_recent
  from (
    select coalesce(g.game_date,g.date) game_date,jsonb_build_object(
      'date',coalesce(g.game_date,g.date),'game_id',g.id,'opponent',g.opponent,
      'minutes',coalesce(pgs.minutes,0),'points',coalesce(pgs.points,0),
      'rebounds',coalesce(pgs.off_reb,pgs.rebounds_offensive,0)+coalesce(pgs.def_reb,pgs.rebounds_defensive,0),
      'assists',coalesce(pgs.assists,0),'steals',coalesce(pgs.steals,0),
      'turnovers',coalesce(pgs.turnovers,0),
      'fg3_made',coalesce(pgs.fg3_made,0),'fg3_attempted',coalesce(pgs.fg3_attempted,0)
    ) item
    from public.player_game_stats pgs
    join public.games g on g.id=pgs.game_id
    where pgs.player_id=p_player_id
    order by coalesce(g.game_date,g.date) desc nulls last,g.created_at desc
    limit 10
  ) x;

  return jsonb_build_object(
    'allowed',true,'reason_code',case when v_internal_preview then 'INTERNAL_PREVIEW' else 'ENTITLED' end,
    'player_id',p_player_id,'team_season_id',v_team_season_id,
    'objective',v_objective,'shared_evaluations',v_evaluations,
    'recent_games',v_recent,
    'access',jsonb_build_object(
      'player360',true,
      'family_insights',v_internal_preview or coalesce((public.iq_saas_entitlement_check(
        'PLAYER',p_player_id,v_team_season_id,'FAMILY_INSIGHTS',1
      )->>'allowed')::boolean,false),
      'development_plan',v_internal_preview or coalesce((public.iq_saas_entitlement_check(
        'PLAYER',p_player_id,v_team_season_id,'DEVELOPMENT_PLAN',1
      )->>'allowed')::boolean,false)
    )
  );
end;
$function$;
revoke all on function public.iq_v8_family_player360_snapshot(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.iq_v8_family_player360_snapshot(uuid,uuid)
  to authenticated;

-- Final privilege and boundary assertions.
do $v8$
begin
  if not (
    select c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='family_player_link_invitations'
  ) then raise exception 'FAMILY_WORKSPACE_V1_INVITATION_RLS_REQUIRED'; end if;

  if has_table_privilege('authenticated','public.family_player_link_invitations','SELECT')
     or has_table_privilege('authenticated','public.family_player_link_invitations','INSERT')
     or has_table_privilege('authenticated','public.family_player_link_invitations','UPDATE')
     or has_table_privilege('authenticated','public.family_player_link_invitations','DELETE') then
    raise exception 'FAMILY_WORKSPACE_V1_DIRECT_INVITATION_ACCESS_OPEN';
  end if;

  if has_function_privilege('anon','public.iq_v8_family_list_players()','EXECUTE')
     or has_function_privilege('anon','public.iq_v8_family_claim_link(text)','EXECUTE')
     or has_function_privilege('anon','public.iq_v8_family_player_passport(uuid)','EXECUTE')
     or has_function_privilege('anon','public.iq_v8_family_player360_snapshot(uuid,uuid)','EXECUTE') then
    raise exception 'FAMILY_WORKSPACE_V1_ANON_RPC_OPEN';
  end if;
  if has_function_privilege('authenticated','iq_private.family_has_active_relation(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.family_can_view_player(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.family_bootstrap_free_account(uuid,uuid)','EXECUTE') then
    raise exception 'FAMILY_WORKSPACE_V1_INTERNAL_HELPER_EXPOSED';
  end if;

  if not has_function_privilege('authenticated','public.iq_v8_family_list_players()','EXECUTE')
     or not has_function_privilege('authenticated','public.iq_v8_family_claim_link(text)','EXECUTE')
     or not has_function_privilege('authenticated','public.iq_v8_family_product_snapshot(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.iq_v8_family_player_passport(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.iq_v8_family_player360_snapshot(uuid,uuid)','EXECUTE') then
    raise exception 'FAMILY_WORKSPACE_V1_REQUIRED_RPC_CLOSED';
  end if;
end
$v8$;

commit;

select
  'FAMILY_WORKSPACE_PRIORITY1_V1_APPLY' as section,
  to_regclass('public.family_player_link_invitations') is not null as invitations_ok,
  to_regprocedure('public.iq_v8_family_claim_link(text)') is not null as claim_ok,
  to_regprocedure('public.iq_v8_family_product_snapshot(uuid)') is not null as product_ok,
  to_regprocedure('public.iq_v8_family_player_passport(uuid)') is not null as passport_ok,
  to_regprocedure('public.iq_v8_family_player360_snapshot(uuid,uuid)') is not null as player360_ok;
