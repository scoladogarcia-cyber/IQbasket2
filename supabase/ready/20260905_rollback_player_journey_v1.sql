-- IQBasket · Player Journey V1 rollback
-- Refuses destructive rollback once real player challenge history exists.
begin;

do $journey_rollback_guard$
begin
  if to_regclass('public.player_micro_challenges') is not null
     and exists(select 1 from public.player_micro_challenges limit 1) then
    raise exception 'PLAYER_JOURNEY_ROLLBACK_REFUSED_HISTORY_EXISTS';
  end if;
end
$journey_rollback_guard$;

drop function if exists public.iq_v12_player_journey_complete(uuid);
drop function if exists public.iq_v12_player_journey_start(uuid,uuid,text);
drop function if exists public.iq_v12_player_journey_snapshot(uuid,uuid);
drop function if exists iq_private.player_journey_can_start(uuid,uuid,date);
drop function if exists iq_private.player_journey_is_self(uuid);
drop table if exists public.player_micro_challenges;
drop table if exists public.player_micro_challenge_catalog;

commit;
