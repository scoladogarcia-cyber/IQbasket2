# Game Play State V2 · test matrix

- Domain transition policy: SCHEDULED/READY/LIVE/FINISHED.
- Composite lifecycle: play_state vs edit_state.
- RBAC action matrix: PREPARE/START/FINISH/CANCEL.
- SQL security-definer search_path guards.
- Audit table direct-access denial.
- V5/V6 temporary backfill guard suspension + restoration.
- Legacy status projection consistency.
- READY/LIVE lock rejection.
- Thin RPC client boundary.
- Idempotent/coalesced progressive UI observer.
- Existing game-locking SQL regression.
- Existing game-locking UI/RBAC regression.
- Existing team-season-freeze SQL regression.
