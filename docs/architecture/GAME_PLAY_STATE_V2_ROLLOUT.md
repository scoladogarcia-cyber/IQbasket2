# Game Play State V2 · rollout

1. Merge only with CI + Global UI QA green.
2. Execute transactional SQL dry-run ending in ROLLBACK.
3. Apply migration through Supabase migration tooling.
4. Run security/performance advisors.
5. Smoke SCHEDULED -> READY -> LIVE -> FINISHED + OPEN.
6. Correct acta, then lock independently.
7. Confirm READY/LIVE lock rejection and V6 freeze compatibility.
