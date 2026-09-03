-- =============================================================================
-- IQBasket v4 · Rollback · SUPERADMIN Nutrition/Recovery operational hotfix
-- Restores the strict Phase 4E access helper.
-- =============================================================================

begin;

create or replace function public.iq_v4e_can_access_sensitive_resource(
  p_player_id uuid,
  p_team_season_id uuid,
  p_module text,
  p_action text,
  p_purpose text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $iq4e$
declare
  v_module text := lower(trim(coalesce(p_module,'')));
  v_action text := upper(trim(coalesce(p_action,'')));
  v_purpose text := upper(trim(coalesce(p_purpose,'')));
  v_relation text;
  v_representative_ok boolean := false;
  v_staff_context boolean := false;
begin
  if auth.uid() is null then return false; end if;
  if v_module not in ('nutrition','recovery','neuro_cognitive') then return false; end if;
  if v_action not in ('READ','CREATE','UPDATE','DELETE','EXPORT','AI_PROCESS') then return false; end if;
  if v_purpose not in (
    'SPORT_PERFORMANCE','PLAYER_SELF_SERVICE','FAMILY_SUPPORT','OPERATIONS'
  ) then return false; end if;

  if not exists (
    select 1 from public.roster_memberships rm
    where rm.player_id = p_player_id
      and rm.team_season_id = p_team_season_id
  ) then
    return false;
  end if;

  if not public.iq_v4e_has_processing_authorization(
    p_player_id, p_team_season_id, v_module, v_action, v_purpose
  ) then
    return false;
  end if;

  v_relation := public.iq_v4e_subject_relation(p_player_id);

  if v_action in ('EXPORT','AI_PROCESS') then
    return public.iq_v4e_has_sensitive_grant(
      auth.uid(), p_player_id, p_team_season_id, v_module, v_action, v_purpose
    );
  end if;

  if v_relation = 'SELF' then
    return v_purpose = 'PLAYER_SELF_SERVICE'
      and v_action in ('READ','CREATE','UPDATE');
  end if;

  if v_relation = 'GUARDIAN' then
    select exists (
      select 1
      from public.player360_processing_authorizations a
      where a.player_id = p_player_id
        and a.team_season_id = p_team_season_id
        and a.status = 'ACTIVE'
        and a.valid_from <= now()
        and (a.valid_until is null or a.valid_until > now())
        and v_module = any(a.modules)
        and v_purpose = any(a.purposes)
        and (a.representative_user_id is null or a.representative_user_id = auth.uid())
    ) into v_representative_ok;

    return v_purpose = 'FAMILY_SUPPORT'
      and v_action in ('READ','CREATE','UPDATE')
      and v_representative_ok;
  end if;

  v_staff_context := public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA','PREPARADOR_FISICO'],
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ANALISTA'],
    array['ADMIN','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']
  );

  if not v_staff_context then return false; end if;
  if v_purpose not in ('SPORT_PERFORMANCE','OPERATIONS') then return false; end if;

  return public.iq_v4e_has_sensitive_grant(
    auth.uid(), p_player_id, p_team_season_id, v_module, v_action, v_purpose
  );
end;
$iq4e$;

commit;
