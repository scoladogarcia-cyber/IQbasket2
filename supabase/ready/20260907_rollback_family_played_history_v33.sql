-- IQBasket V33 · rollback.
-- The browser falls back progressively to V32 if this function is absent.
begin;
drop function if exists public.iq_v33_family_player_passport(uuid);
commit;