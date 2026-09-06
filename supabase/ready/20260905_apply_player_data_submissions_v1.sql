begin;

create schema if not exists iq_private;

create table if not exists public.player_data_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  submission_type text not null check (submission_type in ('WELLNESS_CHECKIN','EXTERNAL_TRAINING')),
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','RETURNED','APPROVED','REJECTED','CANCELLED')),
  payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  materialized_resource_type text,
  materialized_resource_id uuid,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_data_submissions enable row level security;
revoke all on public.player_data_submissions from anon, authenticated;
create index if not exists player_data_submissions_owner_idx
  on public.player_data_submissions(submitted_by, status, created_at desc);
create index if not exists player_data_submissions_review_idx
  on public.player_data_submissions(team_season_id, status, submitted_at desc);
create index if not exists player_data_submissions_player_idx
  on public.player_data_submissions(player_id, team_season_id, created_at desc);
create or replace function iq_private.iq_v14_player_submission_is_self(
  p_player_id uuid,
  p_team_season_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.iq_account_is_active()
    and auth.uid() is not null
    and (
      exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid()
          and up.linked_player_id = p_player_id
          and upper(coalesce(up.role,'USER')) = 'JUGADOR'
      )
      or exists (
        select 1 from public.user_player_links upl
        where upl.user_id = auth.uid()
          and upl.player_id = p_player_id
          and upper(upl.relation_type) = 'SELF'
          and upper(coalesce(upl.status,'ACTIVE')) = 'ACTIVE'
          and (upl.valid_from is null or upl.valid_from <= now())
          and (upl.valid_until is null or upl.valid_until > now())
      )
    )
    and exists (
      select 1 from public.team_season_memberships m
      where m.user_id = auth.uid()
        and m.team_season_id = p_team_season_id
        and upper(coalesce(m.status,'ACTIVE')) = 'ACTIVE'
        and upper(m.function_role) = 'JUGADOR'
        and (m.valid_from is null or m.valid_from <= now())
        and (m.valid_until is null or m.valid_until > now())
    );
$$;
revoke all on function iq_private.iq_v14_player_submission_is_self(uuid,uuid) from public, anon, authenticated;
create or replace function iq_private.iq_v14_can_review_player_submission(
  p_team_season_id uuid,
  p_player_id uuid,
  p_submission_type text,
  p_payload jsonb default '{}'::jsonb
) returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_module text;
  v_role_ok boolean := false;
begin
  if not public.iq_account_is_active() or auth.uid() is null then return false; end if;

  select ts.team_id into v_team_id
  from public.team_seasons ts
  where ts.id = p_team_season_id;
  if v_team_id is null then return false; end if;

  v_role_ok := public.iq_v3_is_global_superadmin()
    or exists (
      select 1 from public.team_season_memberships m
      where m.user_id = auth.uid()
        and m.team_season_id = p_team_season_id
        and upper(coalesce(m.status,'ACTIVE')) = 'ACTIVE'
        and upper(m.function_role) in ('ADMIN','ENTRENADOR')
        and (m.valid_from is null or m.valid_from <= now())
        and (m.valid_until is null or m.valid_until > now())
    )
    or exists (
      select 1
      from public.club_season_memberships cm
      join public.team_seasons ts on ts.id=p_team_season_id
      join public.teams t on t.id=ts.team_id
      where cm.user_id=auth.uid()
        and cm.club_id=t.club_id
        and cm.season_id=ts.season_id
        and upper(coalesce(cm.status,'ACTIVE'))='ACTIVE'
        and upper(cm.function_role)='ADMIN'
        and (cm.valid_from is null or cm.valid_from <= now())
        and (cm.valid_until is null or cm.valid_until > now())
    )    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and upper(coalesce(up.global_role,up.role,'USER')) = 'ADMIN'
        and v_team_id = any(coalesce(up.assigned_team_ids,'{}'::uuid[]))
    );

  if not v_role_ok then return false; end if;

  if upper(coalesce(p_submission_type,'')) = 'WELLNESS_CHECKIN' then
    v_module := lower(trim(coalesce(p_payload->>'module','')));
    if v_module not in ('nutrition','recovery') then return false; end if;
    return public.iq_v4e_can_access_sensitive_resource(
      p_player_id,p_team_season_id,v_module,'READ','SPORT_PERFORMANCE'
    );
  end if;

  return upper(coalesce(p_submission_type,'')) = 'EXTERNAL_TRAINING';
end;
$$;
revoke all on function iq_private.iq_v14_can_review_player_submission(uuid,uuid,text,jsonb)
  from public, anon, authenticated;
create or replace function public.iq_v14_save_player_submission_draft(
  p_submission_id uuid,
  p_team_season_id uuid,
  p_player_id uuid,
  p_submission_type text,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_type text := upper(trim(coalesce(p_submission_type,'')));
  v_status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not iq_private.iq_v14_player_submission_is_self(p_player_id,p_team_season_id) then
    raise exception 'PLAYER_SUBMISSION_SELF_DENIED';
  end if;
  if v_type not in ('WELLNESS_CHECKIN','EXTERNAL_TRAINING') then
    raise exception 'PLAYER_SUBMISSION_TYPE_INVALID';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'PLAYER_SUBMISSION_PAYLOAD_INVALID';
  end if;

  if v_type='WELLNESS_CHECKIN' then
    if lower(coalesce(p_payload->>'module','')) not in ('nutrition','recovery')
       or coalesce(p_payload->>'entry_date','') !~ '^\d{4}-\d{2}-\d{2}$'
       or jsonb_typeof(p_payload->'values') <> 'array'
       or jsonb_array_length(p_payload->'values') not between 1 and 20 then
      raise exception 'PLAYER_SUBMISSION_WELLNESS_INVALID';
    end if;
  else
    if coalesce(trim(p_payload->>'title'),'') = ''
       or coalesce(p_payload->>'activity_date','') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'PLAYER_SUBMISSION_TRAINING_INVALID';
    end if;
  end if;
  if p_submission_id is null then
    insert into public.player_data_submissions(
      submitted_by,player_id,team_season_id,submission_type,status,payload
    ) values (
      auth.uid(),p_player_id,p_team_season_id,v_type,'DRAFT',p_payload
    ) returning id into v_id;
  else
    select s.status into v_status
    from public.player_data_submissions s
    where s.id=p_submission_id
      and s.submitted_by=auth.uid()
      and s.player_id=p_player_id
      and s.team_season_id=p_team_season_id
      and s.submission_type=v_type
    for update;
    if v_status is null then raise exception 'PLAYER_SUBMISSION_NOT_FOUND'; end if;
    if v_status not in ('DRAFT','RETURNED') then
      raise exception 'PLAYER_SUBMISSION_NOT_EDITABLE';
    end if;

    update public.player_data_submissions
    set payload=p_payload,
        status='DRAFT',
        submitted_at=null,
        reviewed_by=null,
        reviewed_at=null,
        review_note=null,
        version=version+1,
        updated_at=now()
    where id=p_submission_id
    returning id into v_id;
  end if;

  return v_id;
end;
$$;
revoke all on function public.iq_v14_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)
  from public, anon;
grant execute on function public.iq_v14_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)
  to authenticated;

create or replace function public.iq_v14_submit_player_submission(p_submission_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.player_data_submissions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.player_data_submissions
  where id=p_submission_id and submitted_by=auth.uid() for update;
  if v_row.id is null then raise exception 'PLAYER_SUBMISSION_NOT_FOUND'; end if;
  if v_row.status not in ('DRAFT','RETURNED') then raise exception 'PLAYER_SUBMISSION_NOT_SUBMITTABLE'; end if;
  if not iq_private.iq_v14_player_submission_is_self(v_row.player_id,v_row.team_season_id) then
    raise exception 'PLAYER_SUBMISSION_SELF_DENIED';
  end if;
  update public.player_data_submissions
  set status='SUBMITTED',submitted_at=now(),updated_at=now()
  where id=p_submission_id;
  return true;
end;
$$;
revoke all on function public.iq_v14_submit_player_submission(uuid) from public, anon;
grant execute on function public.iq_v14_submit_player_submission(uuid) to authenticated;
create or replace function public.iq_v14_list_my_player_submissions(
  p_team_season_id uuid default null,
  p_limit integer default 100
) returns setof public.player_data_submissions
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
  from public.player_data_submissions s
  where s.submitted_by=auth.uid()
    and (p_team_season_id is null or s.team_season_id=p_team_season_id)
    and iq_private.iq_v14_player_submission_is_self(s.player_id,s.team_season_id)
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit,100),1),300);
$$;
revoke all on function public.iq_v14_list_my_player_submissions(uuid,integer) from public, anon;
grant execute on function public.iq_v14_list_my_player_submissions(uuid,integer) to authenticated;

create or replace function public.iq_v14_list_player_submission_reviews(
  p_team_season_id uuid default null,
  p_include_resolved boolean default false,
  p_limit integer default 100
) returns table(
  id uuid, player_id uuid, player_name text, team_season_id uuid,
  submission_type text, status text, payload jsonb,
  submitted_at timestamptz, reviewed_at timestamptz,
  review_note text, materialized_resource_id uuid, submitted_by uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,s.player_id,
    trim(concat_ws(' ',p.first_name,p.last_name)) as player_name,
    s.team_season_id,s.submission_type,s.status,s.payload,
    s.submitted_at,s.reviewed_at,s.review_note,
    s.materialized_resource_id,s.submitted_by
  from public.player_data_submissions s
  join public.players p on p.id=s.player_id
  where (p_team_season_id is null or s.team_season_id=p_team_season_id)
    and (p_include_resolved or s.status='SUBMITTED')
    and iq_private.iq_v14_can_review_player_submission(
      s.team_season_id,s.player_id,s.submission_type,s.payload
    )
  order by coalesce(s.submitted_at,s.created_at) desc
  limit least(greatest(coalesce(p_limit,100),1),300);
$$;
revoke all on function public.iq_v14_list_player_submission_reviews(uuid,boolean,integer)
  from public, anon;
grant execute on function public.iq_v14_list_player_submission_reviews(uuid,boolean,integer)
  to authenticated;
create or replace function public.iq_v14_review_player_submission(
  p_submission_id uuid,
  p_decision text,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.player_data_submissions;
  v_decision text := upper(trim(coalesce(p_decision,'')));
  v_resource_id uuid;
  v_module text;
  v_provenance jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_decision not in ('APPROVED','RETURNED','REJECTED') then
    raise exception 'PLAYER_SUBMISSION_DECISION_INVALID';
  end if;

  select * into v_row
  from public.player_data_submissions
  where id=p_submission_id
  for update;
  if v_row.id is null then raise exception 'PLAYER_SUBMISSION_NOT_FOUND'; end if;
  if v_row.status <> 'SUBMITTED' then raise exception 'PLAYER_SUBMISSION_NOT_REVIEWABLE'; end if;
  if not iq_private.iq_v14_can_review_player_submission(
    v_row.team_season_id,v_row.player_id,v_row.submission_type,v_row.payload
  ) then raise exception 'PLAYER_SUBMISSION_REVIEW_DENIED'; end if;

  if v_decision in ('RETURNED','REJECTED') and coalesce(trim(p_note),'')='' then
    raise exception 'PLAYER_SUBMISSION_REVIEW_NOTE_REQUIRED';
  end if;

  if v_decision='APPROVED' and v_row.submission_type='WELLNESS_CHECKIN' then
    v_module:=lower(v_row.payload->>'module');
    if not public.iq_v4e_can_access_sensitive_resource(
      v_row.player_id,v_row.team_season_id,v_module,'CREATE','SPORT_PERFORMANCE'
    ) then raise exception 'PLAYER_SUBMISSION_WELLNESS_APPROVE_DENIED'; end if;

    v_resource_id:=public.iq_v4e2_save_manual_wellness_entry(
      null,v_row.team_season_id,v_row.player_id,v_module,
      (v_row.payload->>'entry_date')::date,'SPORT_PERFORMANCE',v_row.payload->'values'
    );

    update public.player360_wellness_entries
    set source_type='PLAYER_SELF_REPORT',
        captured_by=v_row.submitted_by,
        purpose='PLAYER_SELF_SERVICE',
        updated_by=auth.uid(),updated_at=now()
    where id=v_resource_id;
  end if;
  if v_decision='APPROVED' and v_row.submission_type='EXTERNAL_TRAINING' then
    v_provenance:=jsonb_build_object(
      'source','PLAYER_SELF_REPORT',
      'submission_id',v_row.id,
      'submitted_by',v_row.submitted_by,
      'validated_by',auth.uid(),
      'validated_at',now()
    );

    v_resource_id:=public.iq_v4_create_external_development(
      v_row.team_season_id,
      v_row.player_id,
      (v_row.payload->>'activity_date')::date,
      v_row.payload->>'title',
      nullif(v_row.payload->>'activity_code',''),
      nullif(v_row.payload->>'activity_type_id','')::uuid,
      nullif(v_row.payload->>'provider_type',''),
      nullif(v_row.payload->>'provider_name',''),
      nullif(v_row.payload->>'objective',''),
      nullif(v_row.payload->>'duration_minutes','')::integer,
      nullif(v_row.payload->>'intensity','')::numeric,
      nullif(v_row.payload->>'rpe','')::numeric,
      'PLAYER_SELF_REPORT',
      nullif(v_row.payload->>'notes',''),
      v_provenance,
      jsonb_build_object('validation_status','APPROVED','player_submission_id',v_row.id)
    );
  end if;

  update public.player_data_submissions
  set status=v_decision,
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      review_note=nullif(trim(coalesce(p_note,'')),''),
      materialized_resource_type=case
        when v_decision<>'APPROVED' then null
        when submission_type='WELLNESS_CHECKIN' then 'WELLNESS_ENTRY'
        else 'EXTERNAL_DEVELOPMENT_SESSION'
      end,
      materialized_resource_id=case when v_decision='APPROVED' then v_resource_id else null end,
      updated_at=now()
  where id=p_submission_id;

  return v_resource_id;
end;
$$;
revoke all on function public.iq_v14_review_player_submission(uuid,text,text) from public, anon;
grant execute on function public.iq_v14_review_player_submission(uuid,text,text) to authenticated;
create or replace function iq_private.iq_v14_guard_validated_wellness_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.source_type='PLAYER_SELF_REPORT'
     and new.captured_by=auth.uid() then
    raise exception 'PLAYER360_WELLNESS_SELF_SUBMISSION_REQUIRED';
  end if;
  return new;
end;
$$;
revoke all on function iq_private.iq_v14_guard_validated_wellness_history()
  from public, anon, authenticated;

drop trigger if exists trg_iq_v14_guard_validated_wellness_history
  on public.player360_wellness_entries;
create trigger trg_iq_v14_guard_validated_wellness_history
before insert or update on public.player360_wellness_entries
for each row execute function iq_private.iq_v14_guard_validated_wellness_history();

comment on table public.player_data_submissions is
  'Temporary player self-reports. Only APPROVED rows are materialized into canonical history.';
comment on column public.player_data_submissions.payload is
  'Unvalidated player-declared payload; excluded from canonical analytics until approval.';

commit;

