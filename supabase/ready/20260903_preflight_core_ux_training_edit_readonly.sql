-- Core UX training edit preflight · READ ONLY
select
  'CORE_UX_TRAINING_EDIT_PREFLIGHT' as section,
  to_regclass('public.training_sessions') is not null as sessions_ok,
  to_regclass('public.training_blocks') is not null as blocks_ok,
  to_regclass('public.training_participants') is not null as participants_ok,
  to_regclass('public.external_development_sessions') is not null as external_ok,
  to_regprocedure('public.iq_v4_can_manage_training(uuid)') is not null as manage_helper_ok,
  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null as eligibility_ok;

select
  'CORE_UX_TRAINING_EDIT_BASELINE' as section,
  (select count(*) from public.training_sessions) as sessions,
  (select count(*) from public.training_blocks) as blocks,
  (select count(*) from public.training_participants) as participants,
  (select count(*) from public.external_development_sessions) as external_sessions;
