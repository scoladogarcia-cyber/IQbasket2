-- IQBasket · Player Development Loop V2 · FK index hardening rollback

begin;

drop index if exists public.player_development_evidence_action_scope_fk_idx;
drop index if exists public.player_development_action_cycle_scope_fk_idx;

commit;
