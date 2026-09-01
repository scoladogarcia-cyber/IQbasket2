-- IQBasket v3 PHASE 2 ROLLBACK
-- Removes only the access workflow functions created in Phase 2.

begin;

drop function if exists public.iq_v3_review_team_access(uuid, boolean);
drop function if exists public.iq_v3_request_team_access(uuid, text);
drop function if exists public.iq_v3_can_manage_team_season(uuid);

commit;
