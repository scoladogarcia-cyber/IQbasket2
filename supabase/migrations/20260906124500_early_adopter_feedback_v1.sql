-- IQBasket V19 - Early Adopter Feedback V1
-- Authenticated, RPC-only tester feedback boundary.
begin;

create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  role_snapshot text not null default 'AUTHENTICATED',
  category text not null,
  severity text not null,
  message text not null,
  route text,
  release_code text,
  client_context jsonb not null default '{}'::jsonb,
  status text not null default 'NEW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_feedback_category_ck check (category in ('BUG','UX','IDEA','OTHER')),
  constraint product_feedback_severity_ck check (severity in ('BLOCKER','IMPORTANT','MINOR','SUGGESTION')),
  constraint product_feedback_status_ck check (status in ('NEW','REVIEWING','PLANNED','RESOLVED','DISMISSED')),
  constraint product_feedback_message_ck check (char_length(btrim(message)) between 3 and 4000),
  constraint product_feedback_route_ck check (route is null or char_length(route) <= 200),
  constraint product_feedback_release_ck check (release_code is null or char_length(release_code) <= 120)
);

create index if not exists product_feedback_created_at_idx on public.product_feedback(created_at desc);
create index if not exists product_feedback_status_created_at_idx on public.product_feedback(status, created_at desc);
create index if not exists product_feedback_user_id_idx on public.product_feedback(user_id);

alter table public.product_feedback enable row level security;
revoke all on table public.product_feedback from public, anon, authenticated;

drop policy if exists product_feedback_deny_anon on public.product_feedback;
create policy product_feedback_deny_anon on public.product_feedback
  for all to anon using (false) with check (false);

drop policy if exists product_feedback_deny_authenticated on public.product_feedback;
create policy product_feedback_deny_authenticated on public.product_feedback
  for all to authenticated using (false) with check (false);

create or replace function iq_private.iq_v19_submit_product_feedback(
  p_category text,
  p_severity text,
  p_message text,
  p_route text default null,
  p_release_code text default null,
  p_client_context jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := 'AUTHENTICATED';
  v_id uuid;
  v_category text := upper(btrim(coalesce(p_category,'')));
  v_severity text := upper(btrim(coalesce(p_severity,'')));
  v_message text := btrim(coalesce(p_message,''));
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if v_category not in ('BUG','UX','IDEA','OTHER') then
    raise exception 'FEEDBACK_CATEGORY_INVALID' using errcode='22023';
  end if;
  if v_severity not in ('BLOCKER','IMPORTANT','MINOR','SUGGESTION') then
    raise exception 'FEEDBACK_SEVERITY_INVALID' using errcode='22023';
  end if;
  if char_length(v_message) < 3 or char_length(v_message) > 4000 then
    raise exception 'FEEDBACK_MESSAGE_INVALID' using errcode='22023';
  end if;

  select coalesce(
      nullif(upper(btrim(up.global_role)),''),
      nullif(upper(btrim(up.role)),''),
      'AUTHENTICATED'
    )
    into v_role
  from public.user_profiles up
  where up.id = v_user_id;
  v_role := coalesce(v_role,'AUTHENTICATED');

  insert into public.product_feedback(
    user_id, role_snapshot, category, severity, message, route, release_code, client_context
  ) values (
    v_user_id, v_role, v_category, v_severity, v_message,
    nullif(left(btrim(coalesce(p_route,'')),200),''),
    nullif(left(btrim(coalesce(p_release_code,'')),120),''),
    case when jsonb_typeof(coalesce(p_client_context,'{}'::jsonb))='object'
      then coalesce(p_client_context,'{}'::jsonb) else '{}'::jsonb end
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function iq_private.iq_v19_submit_product_feedback(text,text,text,text,text,jsonb) from public, anon, authenticated;

create or replace function public.iq_v19_submit_product_feedback(
  p_category text,
  p_severity text,
  p_message text,
  p_route text default null,
  p_release_code text default null,
  p_client_context jsonb default '{}'::jsonb
) returns uuid
language sql
security definer
set search_path = ''
as $$
  select iq_private.iq_v19_submit_product_feedback(
    p_category,p_severity,p_message,p_route,p_release_code,p_client_context
  );
$$;

revoke all on function public.iq_v19_submit_product_feedback(text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.iq_v19_submit_product_feedback(text,text,text,text,text,jsonb) to authenticated;

commit;
