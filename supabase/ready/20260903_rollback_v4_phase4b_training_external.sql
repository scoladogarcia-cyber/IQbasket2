-- =============================================================================
-- IQBasket v4 · Phase 4B Rollback · Training Core + External Development
-- Date: 2026-09-03
--
-- Removes only Phase 4B objects. Does not modify v3 sporting data.
-- =============================================================================

begin;

drop function if exists public.iq_v4_create_external_development(
  uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb
);
drop function if exists public.iq_v4_archive_training_session(uuid);
drop function if exists public.iq_v4_set_training_participant(
  uuid,uuid,text,integer,numeric,text
);
drop function if exists public.iq_v4_create_training_session(
  uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb
);
drop function if exists public.iq_v4_training_capabilities();

drop table if exists public.external_development_sessions;
drop table if exists public.training_participants;
drop table if exists public.training_blocks;
drop table if exists public.training_sessions;
drop table if exists public.player360_activity_types;

drop function if exists public.iq_v4_validate_external_development();
drop function if exists public.iq_v4_validate_training_participant();
drop function if exists public.iq_v4_validate_training_block();
drop function if exists public.iq_v4_validate_session_date();
drop function if exists public.iq_v4_touch_updated_at();

drop function if exists public.iq_v4_can_manage_training(uuid);
drop function if exists public.iq_v4_can_view_player360_team_season(uuid);

commit;

select
  'PLAYER360_PHASE4B_ROLLBACK' as section,
  to_regclass('public.training_sessions') is null as training_sessions_removed,
  to_regclass('public.training_blocks') is null as training_blocks_removed,
  to_regclass('public.training_participants') is null as training_participants_removed,
  to_regclass('public.external_development_sessions') is null as external_development_removed,
  to_regclass('public.player360_activity_types') is null as activity_catalog_removed,
  to_regprocedure('public.iq_v4_can_manage_training(uuid)') is null as helper_removed;
