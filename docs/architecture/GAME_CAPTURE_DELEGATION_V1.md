# Game Capture Delegation V1 (V21)

## Objective
Allow a trusted authenticated user to capture one specific game without granting a broad sporting role or access to the rest of the team/season.

This is the first IQBasket authorization flow that treats `game_id` as a first-class ABAC resource. It extends the existing RBAC model; it does not replace it.

## Security model
A delegation is bounded by:
- `game_id`
- `delegate_user_id`
- one explicit capability
- `valid_from` / `valid_until`
- grant/revoke audit metadata

Delegable capabilities in V1:
- `RECORD_LIVE_GAME`
- `EDIT_BOXSCORE`
- `PREPARE_GAME`
- `START_GAME`
- `FINISH_GAME`

Deliberately **not** delegable:
- create/delete games
- edit administrative game metadata
- `CANCEL_GAME`
- lock/reopen games
- roster/team/season administration
- user/role administration

The normal game lock and team-season freeze remain authoritative. A delegation never bypasses them.

## Database boundary
New public tables:
- `game_capture_delegations`
- `game_capture_delegation_events`
- `game_capture_write_audit`

All three have RLS enabled and direct `anon`/`authenticated` table privileges revoked. The browser never reads or mutates them directly.

Privileged implementation lives in the isolated, non-exposed `iq_v21_private` schema. Public Data API functions are `SECURITY INVOKER` wrappers only. Private privileged functions use `SECURITY DEFINER`, `search_path=''`, schema-qualified relations and explicit `auth.uid()` / account / resource authorization checks.

## RPC boundary
Public authenticated RPCs:
- `iq_v21_my_game_capture_delegations()`
- `iq_v21_list_game_capture_delegations(uuid)`
- `iq_v21_grant_game_capture_delegation(...)`
- `iq_v21_revoke_game_capture_delegation(uuid,text)`
- `iq_v21_game_capture_snapshot(uuid)`
- `iq_v21_save_game_capture(...)`

The snapshot exposes only data required to capture the delegated game: minimal game identity/state, eligible roster, base boxscore, periods and capture events. It does not expose player wellness, private notes, contact data or unrelated season data.

## Scoped write model
`iq_v21_save_game_capture` can update sporting capture data only:
- score
- starter IDs
- base player game stats
- period scores
- game events

It cannot edit opponent identity, game date/time, competition, venue metadata, notes, video, team, season, lock state or administrative fields.

This separates capture from the legacy broad `saveGameAndStats()` path, which requires `EDIT_GAME` and is intentionally not used as the delegated write boundary.

## Lifecycle integration
The existing `iq_private.game_play_state_actor_allowed` remains the lifecycle authority. V21 only adds resource-scoped capability checks for PREPARE/START/FINISH.

`CANCEL_GAME` continues to require the normal staff role and can never be obtained through V21 delegation.

## Product/UX contract
A manager grants access from the context of a game, selecting user, capabilities and expiry. A delegated user sees only their active delegated games and can enter the game directly.

A delegated user does **not** become an ENTRENADOR/ANALISTA in the UI or backend. Outside the delegated `game_id`, their original role and permissions remain unchanged.

## Operational rollout
Production apply is gated by:
1. static V21 contract
2. read-only preflight
3. migration apply
4. read-only installed verification
5. transactional grant/snapshot/write/lifecycle/revoke smoke
6. sporting row-count integrity check
7. emergency rollback for a fresh failed install

Rollback is fail-closed once real delegation or V21 write-audit history exists.
