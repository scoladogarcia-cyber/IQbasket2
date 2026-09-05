# Game Play State V2 · security notes

- UI permissions are preview/usability only; RPC authorization is authoritative.
- `PREPARE_GAME`, `START_GAME`, `FINISH_GAME` and `CANCEL_GAME` are independent RBAC actions.
- The transition RPC locks the target game row before validating/applying the transition.
- `edit_state=LOCKED` blocks every sporting-state transition.
- `READY` and `LIVE` cannot be individually locked as historical data.
- The audit table is RLS-enabled and has direct client privileges revoked.
- Public snapshot output does not expose `changed_by` UUIDs.
- SECURITY DEFINER functions pin `search_path=''`.
- Existing V5/V6 guards are suspended only for the one-time transactional backfill and verified enabled before commit.
- The legacy `status` field is a compatibility projection and cannot independently change the canonical `play_state` after V2 installation.
