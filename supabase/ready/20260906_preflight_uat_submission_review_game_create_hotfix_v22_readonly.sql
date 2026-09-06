begin read only;

select
  'UAT_HOTFIX_V22_PREFLIGHT' as section,
  to_regclass('public.player_data_submissions') is not null
  and to_regclass('public.games') is not null
  and to_regprocedure('public.iq_v18_review_player_submission(uuid,text,text)') is not null
  and to_regprocedure('iq_private.iq_v14_can_review_player_submission(uuid,uuid,text,jsonb)') is not null
  and to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is not null
  and to_regprocedure('public.iq_v7_unchecked_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is not null
  and to_regprocedure('iq_private.sync_game_play_state_legacy_status_v2()') is not null
  and to_regprocedure('iq_private.game_legacy_status_for_play_state(text)') is not null
  and not has_function_privilege(
    'authenticated',
    'iq_private.game_legacy_status_for_play_state(text)',
    'EXECUTE'
  ) as ready;

rollback;
