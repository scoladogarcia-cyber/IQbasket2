begin read only;

with defs as (
  select
    pg_get_functiondef('iq_private.iq_v14_can_review_player_submission(uuid,uuid,text,jsonb)'::regprocedure) as review_scope,
    pg_get_functiondef('public.iq_v18_review_player_submission(uuid,text,text)'::regprocedure) as review_rpc,
    pg_get_functiondef('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)'::regprocedure) as sensitive_wrapper,
    pg_get_functiondef('iq_private.sync_game_play_state_legacy_status_v2()'::regprocedure) as game_trigger
)
select
  'UAT_HOTFIX_V22_VERIFY' as section,
  to_regprocedure('iq_private.iq_v22_submission_materialization_allowed(uuid,uuid,text,text,text)') is not null
  and position('iq_v4e_can_access_sensitive_resource' in review_scope)=0
  and position('nutrition' in review_scope)>0
  and position('ENTRENADOR' in review_scope)>0
  and position('iqbasket.player_submission_review_id' in review_rpc)>0
  and position('iq_v7_unchecked_v4e_can_access_sensitive_resource' in sensitive_wrapper)>0
  and position('iq_v22_submission_materialization_allowed' in sensitive_wrapper)>0
  and position('SECURITY DEFINER' in upper(game_trigger))>0
  and not has_function_privilege(
    'authenticated',
    'iq_private.iq_v22_submission_materialization_allowed(uuid,uuid,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'iq_private.sync_game_play_state_legacy_status_v2()',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.iq_v18_review_player_submission(uuid,text,text)',
    'EXECUTE'
  ) as installed_ok
from defs;

rollback;
