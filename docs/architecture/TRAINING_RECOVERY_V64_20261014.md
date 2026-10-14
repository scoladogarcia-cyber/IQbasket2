# Training recovery and V64 rollout (2026-10-14)

## Live recovery snapshot
Supabase project: IqBasketV2 (project ref ssmljysecerbcvgjadks).
Private schema: iqbasket_recovery_20261014, created before the V64 changes.

| Table | Snapshot rows |
| --- | ---: |
| training_sessions | 35 |
| training_participants | 342 |
| training_blocks | 84 |
| external_development_sessions | 25 |

Also captured training_block_participation (count to be verified separately).
DO NOT delete this recovery schema before an external backup is confirmed.

## Classification
35 existing sessions assigned a provisional session_kind in metadata; all have
session_kind_review=PENDING and may be corrected with iq_v64_correct_training_kind.
No existing titles, times, or attendance records were rewritten by classification.

## Authoritative player minutes
public.iq_training_player_hours_v64 is a SECURITY INVOKER view relying on source RLS;
only COMPLETED sessions + PRESENT/PARTIAL attendance count.
Changing historic attendance or minutes recalculates read results rather than
appending to a counter. 2026-10-14 check: TEAM 34 sessions / 22,800 player minutes,
TECHNIFICATION 1 session / 0 player minutes. These are player-minutes SUM,
not clock hours of all sessions. External-development records excluded to prevent
accidental double counting pending source reconciliation.

## Known open work BEFORE merging draft PR
- Complete input integration for default/overridden participant minutes on create/edit.
- Save classification of NEW sessions atomically; today initial type remains provisional.
- Historical external-development reconciliation, deduplication and passbook integration.
- Browser, permission-negative, regression and deployment tests.
- Stable player-centric navigation UX (separate training page).
- Investigate a reliable automated external full backup for disaster recovery.

Existing season/team foreign keys are retained *only* as authorization context;
this is not a claim that a training belongs exclusively to that roster.

## Rollback
Restore snapshots with a reviewed, targeted recovery migration only. Never wholesale
overwrite data created after the snapshot. View/function can be dropped separately
without affecting primary records.
