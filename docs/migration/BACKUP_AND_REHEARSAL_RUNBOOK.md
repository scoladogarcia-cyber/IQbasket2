# IQBasket v3 – backup and rehearsal runbook

Status: preparation only. No production database changes have been made.

## Safety layers

The migration uses three independent protections:

1. **External backup** – authoritative recovery copy outside Supabase.
2. **Internal PostgreSQL snapshot** – temporary copy of current IQBasket tables in
   a separate schema immediately before the committed migration.
3. **Integrity fingerprints** – hashes and row counts proving that source tables
   were not altered during the additive migration.

The internal snapshot is additive and temporary. It does not replace the external backup.

## Files

- `supabase/audit/10_pre_migration_snapshot.sql` – read-only counts, FKs and legacy mapping.
- `supabase/audit/20_integrity_fingerprints.sql` – read-only source-table hashes.
- `supabase/drafts/20260901_backup_snapshot_same_db.sql` – internal backup rehearsal; ends in ROLLBACK.
- `supabase/drafts/20260901_data_model_v3.sql` – additive v3 structure; ends in ROLLBACK.
- `supabase/drafts/20260901_backfill_v3_current_data.sql` – maps current data; ends in ROLLBACK.
- `supabase/drafts/20260901_access_workflow_v3.sql` – atomic access workflow; ends in ROLLBACK.
- `supabase/drafts/20260901_rls_v3.sql` – RLS model; ends in ROLLBACK.
- `supabase/drafts/20260901_full_rehearsal_v3.sql` – single SQL Editor rehearsal; ends in ROLLBACK.

## Required order before the first COMMIT

1. Stop production writes briefly.
2. Run and save `10_pre_migration_snapshot.sql`.
3. Run and save `20_integrity_fingerprints.sql`.
4. Create an external database backup and store a copy outside Supabase (Dropbox is an appropriate destination).
5. Create the internal snapshot in a separate schema.
6. Run the full rehearsal with ROLLBACK.
7. Review every validation result.
8. Test application build and role matrix.
9. Only then prepare a production migration with COMMIT.
10. Re-run counts/fingerprints immediately after migration and compare with the saved baseline.

## Non-negotiable migration constraints

The first committed v3 migration must NOT:

- delete current rows;
- change existing player IDs;
- change existing game IDs;
- rewrite historical stats;
- drop legacy tables;
- drop legacy columns;
- merge players by name;
- infer family relationships from names;
- turn an access request into access using separate non-atomic writes.

Legacy fields remain available until the v3 application has been validated against
real historical data.

## Recovery rule

If any source-table count/fingerprint changes unexpectedly, or any FK/integrity
check fails, the deployment is stopped. The legacy app/data remains the source of
truth and the v3 changes are not promoted.
