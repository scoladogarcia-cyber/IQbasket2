-- IQBasket V29 · rollback
begin;

drop trigger if exists trg_iq_v29_normalize_new_game_shell on public.games;

revoke all on function public.iq_v29_create_family_link_invitation(uuid,uuid,text,integer)
  from public,anon,authenticated;
revoke all on function public.iq_v29_find_family_profile(uuid,text)
  from public,anon,authenticated;

drop function if exists public.iq_v29_create_family_link_invitation(uuid,uuid,text,integer);
drop function if exists public.iq_v29_find_family_profile(uuid,text);

drop schema if exists iq_v29_private cascade;

-- Restore the legacy default only; existing rows are not rewritten by rollback.
alter table public.games alter column status set default 'Finalizado';

commit;
