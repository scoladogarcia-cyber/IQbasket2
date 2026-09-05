# Game Play State V2 · key decisions

- `play_state` is canonical; `edit_state` remains independent.
- Keep legacy `status` as a synchronized projection during migration.
- Preserve V6 ability to lock scheduled games during season freeze.
- Reject individual locking only for operational READY/LIVE states.
- Keep FINISHED/CANCELLED terminal in V2; privileged sporting reopen is deferred.
- Keep raw transition actor IDs server-side only.
