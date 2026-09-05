-- =============================================================================
-- IQBasket · Player Journey V1
-- Date: 2026-09-05
-- Purpose:
--   * one safe sporting micro-challenge per player/week;
--   * player-self progress only, without social ranking or streak pressure;
--   * keep private evaluations/objectives and Wellness completely outside V1;
--   * expose all client interaction through action-specific RPCs.
-- =============================================================================

begin;

do $journey_prereq$
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.players') is null
     or to_regclass('public.team_seasons') is null
     or to_regprocedure('public.iq_account_is_active()') is null
     or to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null
     or to_regprocedure('public.iq_v4_touch_updated_at()') is null then
    raise exception 'PLAYER_JOURNEY_V1_PREREQUISITES_MISSING';
  end if;

  if to_regclass('public.player_micro_challenge_catalog') is not null
     or to_regclass('public.player_micro_challenges') is not null then
    raise exception 'PLAYER_JOURNEY_V1_ALREADY_INSTALLED';
  end if;
end
$journey_prereq$;

-- -----------------------------------------------------------------------------
-- 1. Configurable sporting challenge catalog
-- -----------------------------------------------------------------------------
create table public.player_micro_challenge_catalog (
  code text primary key,
  category text not null,
  title text not null,
  description text not null,
  success_criterion text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_micro_challenge_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint player_micro_challenge_category_check check (category in ('TECHNICAL','TACTICAL')),
  constraint player_micro_challenge_title_check check (length(trim(title)) between 3 and 140),
  constraint player_micro_challenge_description_check check (length(trim(description)) between 10 and 800),
  constraint player_micro_challenge_criterion_check check (length(trim(success_criterion)) between 10 and 800)
);

create trigger player_micro_challenge_catalog_touch
before update on public.player_micro_challenge_catalog
for each row execute function public.iq_v4_touch_updated_at();

insert into public.player_micro_challenge_catalog(
  code,category,title,description,success_criterion,sort_order
) values
('WEAK_HAND_INTENT','TECHNICAL','Mano no dominante con intención','Busca durante tu próxima sesión tres situaciones reales en las que puedas usar tu mano no dominante con una intención clara.','Al terminar, identifica una situación que hayas resuelto mejor y coméntala con tu entrenador.',10),
('BALL_PROTECTION','TECHNICAL','Protege mejor el balón','Pon atención a tres situaciones con presión defensiva y observa cómo usas cuerpo, distancia y bote para proteger el balón.','Elige una situación en la que hayas mantenido mejor el control y explica qué hiciste.',20),
('FINISHING_CHOICE','TECHNICAL','Elige mejor cerca del aro','Observa tres finalizaciones y céntrate en reconocer por qué elegiste ese recurso y no otro.','Identifica una buena elección y una alternativa que quieras probar en otra ocasión.',30),
('SHOT_SELECTION','TECHNICAL','Mejor selección de tiro','En la próxima sesión, identifica tres tiros y valora si estabas equilibrado, con espacio y dentro de una buena decisión de juego.','Escoge el tiro mejor seleccionado y explica qué condiciones lo hicieron bueno.',40),
('PASSING_WINDOW','TACTICAL','Ve la ventana de pase','Detecta tres momentos en los que aparezca una ventaja de pase, incluso si finalmente no recibes o no pasas el balón.','Recuerda una ventana de pase y comenta qué señal del juego te permitió verla.',50),
('DECISION_SPEED','TACTICAL','Decide con claridad','Identifica tres recepciones y observa cuánto tardas en leer si debes tirar, pasar o atacar.','Elige una decisión clara y explica qué información viste antes de actuar.',60),
('DEFENSIVE_FOOTWORK','TACTICAL','Primero los pies en defensa','Observa tres acciones defensivas y céntrate en tu colocación y desplazamiento antes de intentar recuperar el balón.','Identifica una acción en la que tu posición te ayudó a defender mejor.',70),
('COURT_COMMUNICATION','TACTICAL','Haz visible tu comunicación','Busca tres situaciones en las que una comunicación breve pueda ayudar a un compañero antes o durante la acción.','Recuerda una comunicación útil y qué cambió o pudo cambiar gracias a ella.',80);

-- -----------------------------------------------------------------------------
-- 2. Player-owned weekly challenge instances
-- -----------------------------------------------------------------------------
create table public.player_micro_challenges (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  challenge_code text not null references public.player_micro_challenge_catalog(code) on delete restrict,
  week_start date not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'ACTIVE',
  title_snapshot text not null,
  description_snapshot text not null,
  success_criterion_snapshot text not null,
  source_type text not null default 'SELF_SELECTED',
  source_reference_id uuid null,
  completed_at timestamptz null,
  completed_by uuid null references public.user_profiles(id) on delete set null,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_micro_challenge_status_check check (status in ('ACTIVE','COMPLETED','ARCHIVED')),
  constraint player_micro_challenge_source_check check (source_type in ('SELF_SELECTED','STAFF_ASSIGNED','SHARED_OBJECTIVE')),
  constraint player_micro_challenge_dates_check check (ends_on >= starts_on and starts_on >= week_start and ends_on <= week_start + 6),
  constraint player_micro_challenge_completion_check check (
    (status='COMPLETED' and completed_at is not null)
    or (status<>'COMPLETED' and completed_at is null)
  )
);

-- Journey is longitudinal to the player, not to a roster spell. A transfer or
-- team-season switch must never allow a second challenge in the same ISO week.
create unique index player_micro_challenge_one_week_uq
  on public.player_micro_challenges(player_id,week_start);
create unique index player_micro_challenge_one_active_uq
  on public.player_micro_challenges(player_id)
  where status='ACTIVE';
create index player_micro_challenge_player_history_idx
  on public.player_micro_challenges(player_id,team_season_id,created_at desc);
create index player_micro_challenge_code_fk_idx
  on public.player_micro_challenges(challenge_code);
create index player_micro_challenge_created_by_fk_idx
  on public.player_micro_challenges(created_by);
create index player_micro_challenge_completed_by_fk_idx
  on public.player_micro_challenges(completed_by);

create trigger player_micro_challenges_touch
before update on public.player_micro_challenges
for each row execute function public.iq_v4_touch_updated_at();

alter table public.player_micro_challenge_catalog enable row level security;
alter table public.player_micro_challenges enable row level security;
revoke all on table public.player_micro_challenge_catalog from public,anon,authenticated;
revoke all on table public.player_micro_challenges from public,anon,authenticated;

create policy iq_player_micro_challenge_catalog_no_direct_client_access
  on public.player_micro_challenge_catalog for all to anon,authenticated
  using (false) with check (false);
create policy iq_player_micro_challenges_no_direct_client_access
  on public.player_micro_challenges for all to anon,authenticated
  using (false) with check (false);

-- -----------------------------------------------------------------------------
-- 3. Player-self authorization boundary
-- -----------------------------------------------------------------------------
create or replace function iq_private.player_journey_is_self(
  p_player_id uuid
)
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
      from public.user_profiles up
      where up.id=auth.uid()
        and up.linked_player_id=p_player_id
        and upper(coalesce(up.global_role,up.role,''))='JUGADOR'
    );
$function$;
revoke all on function iq_private.player_journey_is_self(uuid) from public,anon,authenticated;

create or replace function iq_private.player_journey_can_start(
  p_team_season_id uuid,
  p_player_id uuid,
  p_effective_date date
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select iq_private.player_journey_is_self(p_player_id)
    and public.iq_v3_player_eligible_on_date(p_player_id,p_team_season_id,p_effective_date);
$function$;
revoke all on function iq_private.player_journey_can_start(uuid,uuid,date) from public,anon,authenticated;

-- -----------------------------------------------------------------------------
-- 4. Player-only read projection
-- No evaluation/objective/wellness table is queried here by design.
-- Active challenge is longitudinal so it survives a mid-week team transfer.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v12_player_journey_snapshot(
  p_team_season_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_catalog jsonb:='[]'::jsonb;
  v_active jsonb:=null;
  v_history jsonb:='[]'::jsonb;
  v_completed integer:=0;
  v_stage text:='EXPLORING';
  v_badges jsonb:='[]'::jsonb;
begin
  if not iq_private.player_journey_is_self(p_player_id) then
    raise exception 'PLAYER_JOURNEY_SELF_ACCESS_REQUIRED' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code',c.code,
    'category',c.category,
    'title',c.title,
    'description',c.description,
    'success_criterion',c.success_criterion
  ) order by c.sort_order,c.code),'[]'::jsonb)
  into v_catalog
  from public.player_micro_challenge_catalog c
  where c.is_active;

  select jsonb_build_object(
    'id',mc.id,
    'challenge_code',mc.challenge_code,
    'title',mc.title_snapshot,
    'description',mc.description_snapshot,
    'success_criterion',mc.success_criterion_snapshot,
    'week_start',mc.week_start,
    'starts_on',mc.starts_on,
    'ends_on',mc.ends_on,
    'status',mc.status
  )
  into v_active
  from public.player_micro_challenges mc
  where mc.player_id=p_player_id
    and mc.status='ACTIVE'
    and mc.ends_on>=current_date
  order by mc.created_at desc
  limit 1;

  select count(*) into v_completed
  from public.player_micro_challenges mc
  where mc.player_id=p_player_id and mc.status='COMPLETED';

  select coalesce(jsonb_agg(item order by completed_at desc),'[]'::jsonb)
  into v_history
  from (
    select jsonb_build_object(
      'id',mc.id,
      'title',mc.title_snapshot,
      'week_start',mc.week_start,
      'status',mc.status,
      'completed_at',mc.completed_at
    ) item, mc.completed_at
    from public.player_micro_challenges mc
    where mc.player_id=p_player_id and mc.status='COMPLETED'
    order by mc.completed_at desc
    limit 8
  ) h;

  v_stage:=case
    when v_completed>=6 then 'OWNING_PROCESS'
    when v_completed>=3 then 'CONSOLIDATING'
    when v_completed>=1 then 'BUILDING'
    else 'EXPLORING'
  end;

  if v_completed>=1 then
    v_badges:=v_badges || jsonb_build_array(jsonb_build_object(
      'code','FIRST_STEP','label','Primer reto completado','description','Empezaste a convertir un foco en una acción concreta.'
    ));
  end if;
  if v_completed>=3 then
    v_badges:=v_badges || jsonb_build_array(jsonb_build_object(
      'code','PROCESS_3','label','Proceso en marcha','description','Has completado tres micro-retos en semanas diferentes.'
    ));
  end if;
  if v_completed>=6 then
    v_badges:=v_badges || jsonb_build_array(jsonb_build_object(
      'code','PROCESS_6','label','Lideras tu desarrollo','description','Has sostenido seis ciclos semanales de foco y reflexión.'
    ));
  end if;

  return jsonb_build_object(
    'version','PLAYER_JOURNEY_V1',
    'player_id',p_player_id,
    'team_season_id',p_team_season_id,
    'active_challenge',v_active,
    'catalog',v_catalog,
    'completed_count',v_completed,
    'stage',v_stage,
    'badges',v_badges,
    'history',v_history,
    'leaderboard_enabled',false,
    'login_streak_enabled',false,
    'wellness_used',false,
    'health_used',false,
    'mastery_claimed',false
  );
end;
$function$;
revoke all on function public.iq_v12_player_journey_snapshot(uuid,uuid) from public,anon;
grant execute on function public.iq_v12_player_journey_snapshot(uuid,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Start exactly one new challenge per ISO week, longitudinally per player
-- -----------------------------------------------------------------------------
create or replace function public.iq_v12_player_journey_start(
  p_team_season_id uuid,
  p_player_id uuid,
  p_challenge_code text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_code text:=upper(trim(coalesce(p_challenge_code,'')));
  v_week_start date:=current_date-(extract(isodow from current_date)::integer-1);
  v_catalog public.player_micro_challenge_catalog%rowtype;
  v_id uuid;
begin
  if not iq_private.player_journey_can_start(p_team_season_id,p_player_id,current_date) then
    raise exception 'PLAYER_JOURNEY_START_DENIED' using errcode='42501';
  end if;

  select * into v_catalog
  from public.player_micro_challenge_catalog c
  where c.code=v_code and c.is_active;
  if v_catalog.code is null then
    raise exception 'PLAYER_JOURNEY_CHALLENGE_UNKNOWN';
  end if;

  update public.player_micro_challenges
  set status='ARCHIVED'
  where player_id=p_player_id
    and status='ACTIVE'
    and ends_on<current_date;

  if exists (
    select 1 from public.player_micro_challenges mc
    where mc.player_id=p_player_id
      and mc.status='ACTIVE'
      and mc.ends_on>=current_date
  ) then
    raise exception 'PLAYER_JOURNEY_ACTIVE_CHALLENGE_EXISTS';
  end if;

  if exists (
    select 1 from public.player_micro_challenges mc
    where mc.player_id=p_player_id
      and mc.week_start=v_week_start
  ) then
    raise exception 'PLAYER_JOURNEY_WEEK_ALREADY_USED';
  end if;

  insert into public.player_micro_challenges(
    team_season_id,player_id,challenge_code,week_start,starts_on,ends_on,status,
    title_snapshot,description_snapshot,success_criterion_snapshot,
    source_type,created_by,metadata
  ) values (
    p_team_season_id,p_player_id,v_catalog.code,v_week_start,current_date,v_week_start+6,'ACTIVE',
    v_catalog.title,v_catalog.description,v_catalog.success_criterion,
    'SELF_SELECTED',auth.uid(),jsonb_build_object('version','PLAYER_JOURNEY_V1')
  ) returning id into v_id;

  return jsonb_build_object('success',true,'challenge_id',v_id,'week_start',v_week_start,'ends_on',v_week_start+6);
end;
$function$;
revoke all on function public.iq_v12_player_journey_start(uuid,uuid,text) from public,anon;
grant execute on function public.iq_v12_player_journey_start(uuid,uuid,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Self-completion records process only; it never means skill mastery.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v12_player_journey_complete(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_row public.player_micro_challenges%rowtype;
begin
  select * into v_row
  from public.player_micro_challenges mc
  where mc.id=p_challenge_id
  for update;

  if v_row.id is null then
    raise exception 'PLAYER_JOURNEY_CHALLENGE_NOT_FOUND';
  end if;
  if not iq_private.player_journey_is_self(v_row.player_id) then
    raise exception 'PLAYER_JOURNEY_COMPLETE_DENIED' using errcode='42501';
  end if;
  if v_row.status<>'ACTIVE' then
    raise exception 'PLAYER_JOURNEY_CHALLENGE_NOT_ACTIVE';
  end if;
  if v_row.ends_on<current_date then
    raise exception 'PLAYER_JOURNEY_CHALLENGE_EXPIRED';
  end if;

  update public.player_micro_challenges
  set status='COMPLETED',completed_at=now(),completed_by=auth.uid()
  where id=v_row.id;

  return jsonb_build_object(
    'success',true,
    'challenge_id',v_row.id,
    'completed_at',now(),
    'mastery_claimed',false
  );
end;
$function$;
revoke all on function public.iq_v12_player_journey_complete(uuid) from public,anon;
grant execute on function public.iq_v12_player_journey_complete(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Security invariants
-- -----------------------------------------------------------------------------
do $journey_verify$
begin
  if not (select relrowsecurity from pg_class where oid='public.player_micro_challenges'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.player_micro_challenge_catalog'::regclass) then
    raise exception 'PLAYER_JOURNEY_RLS_NOT_ENABLED';
  end if;

  if has_table_privilege('authenticated','public.player_micro_challenges','SELECT')
     or has_table_privilege('authenticated','public.player_micro_challenges','INSERT')
     or has_table_privilege('authenticated','public.player_micro_challenges','UPDATE')
     or has_table_privilege('authenticated','public.player_micro_challenge_catalog','SELECT') then
    raise exception 'PLAYER_JOURNEY_DIRECT_CLIENT_ACCESS_OPEN';
  end if;

  if has_function_privilege('authenticated','iq_private.player_journey_is_self(uuid)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.player_journey_can_start(uuid,uuid,date)','EXECUTE') then
    raise exception 'PLAYER_JOURNEY_PRIVATE_HELPER_EXPOSED';
  end if;
end
$journey_verify$;

commit;

select
  'PLAYER_JOURNEY_V1' section,
  to_regclass('public.player_micro_challenge_catalog') is not null catalog_ok,
  to_regclass('public.player_micro_challenges') is not null challenges_ok,
  to_regprocedure('public.iq_v12_player_journey_snapshot(uuid,uuid)') is not null snapshot_ok;
