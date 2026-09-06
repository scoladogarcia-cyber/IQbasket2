begin;

drop function if exists public.iq_v16_family_development_cycle(uuid,uuid);
drop function if exists public.iq_v16_review_development_cycle(uuid,text,text);
drop function if exists public.iq_v16_link_development_evidence(uuid,text,uuid,text);
drop function if exists public.iq_v16_set_development_action_state(uuid,text,text);
drop function if exists public.iq_v16_start_development_cycle(uuid,uuid,uuid,jsonb);
drop function if exists public.iq_v16_development_cycle_snapshot(uuid,uuid);
drop function if exists public.iq_v16_development_cycle_capabilities(uuid,uuid);

drop function if exists iq_private.development_cycle_evidence_snapshot(uuid,uuid);
drop function if exists iq_private.development_cycle_can_manage(uuid,uuid);
drop function if exists iq_private.development_cycle_can_view(uuid,uuid);
drop function if exists iq_private.development_cycle_is_self(uuid);

drop table if exists public.player_development_action_evidence;
drop table if exists public.player_development_actions;
drop table if exists public.player_development_cycles;

commit;
