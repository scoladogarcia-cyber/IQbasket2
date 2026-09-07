-- =============================================================================
-- IQBasket V29 · Family Delegation & Onboarding V1
-- Purpose:
--   * allow a team-season coach to issue a player-scoped Family claim code;
--   * keep direct Family/player assignment restricted to V26 privacy admins;
--   * expose a minimal admin lookup for an existing Family profile;
--   * prevent an empty newly-created game shell from being persisted as FINISHED
--     by the legacy status compatibility bridge.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Preconditions
-- -----------------------------------------------------------------------------
do $v29_prereq$
begin
  if to_regclass('public.games') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.family_player_link_invitations') is null
     or to_regclass('public.user_profiles') is null
     or to_regprocedure('public.iq_account_is_active()') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null
     or to_regprocedure('public.iq_v6_role_for_team_season(uuid)') is null
     or to_regprocedure('iq_private.v26_can_manage_family_profile(uuid)') is null
     or to_regprocedure('public.iq_v8_family_claim_link(text)') is null
     or to_regprocedure('public.iq_v4e_log_privacy_event(text,text,uuid,uuid,uuid,text,text,text,text,jsonb)') is null
     or to_regprocedure('extensions.digest(text,text)') is null
     or to_regprocedure('iq_private.game_legacy_status_for_play_state(text)') is null then
    raise exception 'FAMILY_DELEGATION_ONBOARDING_V1_PREREQUISITES_MISSING';
  end if;
end
$v29_prereq$;

create schema if not exists iq_v29_private;
revoke all on schema iq_v29_private from public,anon,authenticated;
grant usage on schema iq_v29_private to authenticated;

-- -----------------------------------------------------------------------------
-- Narrow staff permission: Family invitation only.
-- This deliberately does NOT widen iq_v4e_can_admin_privacy() for coaches.
-- -----------------------------------------------------------------------------
create or replace function iq_v29_private.can_invite_family(p_team_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and public.iq_account_is_active()
    and exists (
      select 1
      from public.team_seasons ts
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

create or replace function iq_v29_private.create_family_link_invitation(
  p_team_season_id uuid,
  p_player_id uuid,
  p_invite_email text,
  p_expires_hours integer default 168
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_email text:=lower(trim(coalesce(p_invite_email,'')));
  v_code text:=gen_random_uuid()::text;
  v_hash text;
  v_id uuid;
  v_expires timestamptz;
begin
  if not iq_v29_private.can_invite_family(p_team_season_id) then
    raise exception 'FAMILY_LINK_INVITE_DENIED' using errcode='42501';
  end if;
  if length(v_email)<5 or length(v_email)>320 or position('@' in v_email)<2 then
    raise exception 'FAMILY_LINK_EMAIL_INVALID';
  end if;
  if coalesce(p_expires_hours,0)<1 or p_expires_hours>720 then
    raise exception 'FAMILY_LINK_EXPIRY_INVALID';
  end if;
  if not exists (
    select 1
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    where rm.team_season_id=p_team_season_id
      and rm.player_id=p_player_id
      and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
      and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
      and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
  ) then
    raise exception 'FAMILY_LINK_PLAYER_SCOPE_INVALID';
  end if;

  -- Expired invites are closed and an existing pending invite is explicitly
  -- revoked before reissuing because the plaintext claim code is never stored.
  update public.family_player_link_invitations
     set status='EXPIRED',updated_at=now()
   where player_id=p_player_id
     and lower(invite_email)=v_email
     and status='PENDING'
     and expires_at<=now();

  update public.family_player_link_invitations
     set status='REVOKED',revoked_at=now(),revoked_by=auth.uid(),updated_at=now()
   where player_id=p_player_id
     and lower(invite_email)=v_email
     and status='PENDING'
     and expires_at>now();

  v_hash:=encode(extensions.digest(v_code,'sha256'),'hex');
  v_expires:=now()+make_interval(hours=>p_expires_hours);

  insert into public.family_player_link_invitations(
    team_season_id,player_id,invite_email,token_hash,expires_at,created_by
  ) values (
    p_team_season_id,p_player_id,v_email,v_hash,v_expires,auth.uid()
  ) returning id into v_id;

  perform public.iq_v4e_log_privacy_event(
    'FAMILY_LINK_INVITATION_CREATED','FAMILY_LINK_INVITATION',v_id,
    p_player_id,p_team_season_id,'CREATE','FAMILY_SUPPORT','ALLOW','STAFF_INVITED_V29',
    jsonb_build_object('invite_email',v_email,'expires_at',v_expires)
  );

  return jsonb_build_object(
    'invitation_id',v_id,
    'claim_code',v_code,
    'expires_at',v_expires,
    'invite_email',v_email,
    'relationship_type','GUARDIAN'
  );
end
$function$;

-- Admin/Superadmin lookup used only to feed the existing audited V26 controls.
create or replace function iq_v29_private.find_family_profile(
  p_team_season_id uuid,
  p_email text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_profile public.user_profiles%rowtype;
begin
  if auth.uid() is null or not iq_private.v26_can_manage_family_profile(p_team_season_id) then
    raise exception 'FAMILY_PROFILE_SCOPE_DENIED' using errcode='42501';
  end if;
  if length(v_email)<5 or length(v_email)>320 or position('@' in v_email)<2 then
    raise exception 'FAMILY_LINK_EMAIL_INVALID';
  end if;

  select * into v_profile
  from public.user_profiles p
  where lower(p.email)=v_email
    and upper(coalesce(p.role,'')) in ('FAMILIA_TUTOR','FAMILY','FAMILIA','TUTOR')
    and upper(coalesce(p.status,'APPROVED')) in ('APPROVED','ACTIVE')
  limit 1;

  if v_profile.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id',v_profile.id,
    'email',v_profile.email,
    'first_name',v_profile.first_name,
    'last_name',v_profile.last_name,
    'role',v_profile.role
  );
end
$function$;

-- -----------------------------------------------------------------------------
-- Public SECURITY INVOKER RPC boundary.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v29_create_family_link_invitation(
  p_team_season_id uuid,
  p_player_id uuid,
  p_invite_email text,
  p_expires_hours integer default 168
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v29_private.create_family_link_invitation(
    p_team_season_id,p_player_id,p_invite_email,p_expires_hours
  );
$function$;

create or replace function public.iq_v29_find_family_profile(
  p_team_season_id uuid,
  p_email text
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select iq_v29_private.find_family_profile(p_team_season_id,p_email);
$function$;

revoke all on all functions in schema iq_v29_private from public,anon,authenticated;
grant execute on function iq_v29_private.can_invite_family(uuid) to authenticated;
grant execute on function iq_v29_private.create_family_link_invitation(uuid,uuid,text,integer) to authenticated;
grant execute on function iq_v29_private.find_family_profile(uuid,text) to authenticated;

revoke all on function public.iq_v29_create_family_link_invitation(uuid,uuid,text,integer)
  from public,anon,authenticated;
revoke all on function public.iq_v29_find_family_profile(uuid,text)
  from public,anon,authenticated;
grant execute on function public.iq_v29_create_family_link_invitation(uuid,uuid,text,integer)
  to authenticated;
grant execute on function public.iq_v29_find_family_profile(uuid,text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- New-game shell compatibility guard.
-- GameLiveEditor legacy clients still submit status='Finalizado' for an empty
-- newly-created shell. V13 interprets that legacy value as FINISHED. This later
-- BEFORE INSERT trigger restores SCHEDULED only for an unmistakably empty shell.
-- -----------------------------------------------------------------------------
alter table public.games alter column status set default 'Programado';

create or replace function iq_v29_private.normalize_new_game_shell()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if upper(coalesce(new.play_state,''))='FINISHED'
     and lower(coalesce(new.status,'')) like '%final%'
     and coalesce(new.team_score,0)=0
     and coalesce(new.opponent_score,0)=0
     and coalesce(jsonb_array_length(coalesce(new.events,'[]'::jsonb)),0)=0
     and coalesce(jsonb_array_length(coalesce(new.starter_ids,'[]'::jsonb)),0)=0 then
    new.play_state:='SCHEDULED';
    new.status:=iq_private.game_legacy_status_for_play_state('SCHEDULED');
  end if;
  return new;
end
$function$;

revoke all on function iq_v29_private.normalize_new_game_shell()
  from public,anon,authenticated;

drop trigger if exists trg_iq_v29_normalize_new_game_shell on public.games;
create trigger trg_iq_v29_normalize_new_game_shell
before insert on public.games
for each row execute function iq_v29_private.normalize_new_game_shell();

commit;