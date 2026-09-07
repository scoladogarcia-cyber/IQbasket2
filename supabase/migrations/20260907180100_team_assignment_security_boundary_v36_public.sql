-- =============================================================================
-- IQBasket V36 · User team-assignment security boundary · public wrapper
--
-- Preserves the browser-visible signature and moves privilege to the private
-- implementation. Anonymous execution remains denied.
-- =============================================================================

begin;

create or replace function public.iq_v7_set_user_team_assignments(
  p_user_id uuid,
  p_team_ids uuid[]
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select iq_v35_private.set_user_team_assignments(
    p_user_id,
    p_team_ids
  );
$function$;

revoke all on function public.iq_v7_set_user_team_assignments(uuid,uuid[])
  from public, anon, authenticated;
grant execute on function public.iq_v7_set_user_team_assignments(uuid,uuid[])
  to authenticated;

commit;
