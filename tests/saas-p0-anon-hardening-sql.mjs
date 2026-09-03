import assert from "node:assert/strict";
import fs from "node:fs";

const apply = fs.readFileSync(
  new URL("../supabase/ready/20260903_apply_saas_p0_revoke_anon_mutations.sql", import.meta.url),
  "utf8"
);
const verify = fs.readFileSync(
  new URL("../supabase/ready/20260903_verify_saas_p0_revoke_anon_mutations.sql", import.meta.url),
  "utf8"
);

assert.match(apply, /pg_tables[\s\S]*schemaname='public'/i);
assert.match(apply, /revoke insert, update, delete, truncate, references, trigger/i);
assert.match(apply, /from anon/i);
assert.doesNotMatch(apply, /update public\.|delete from public\.|insert into public\./i);
assert.match(verify, /no_anon_mutation_grants/i);
assert.match(verify, /remaining_mutation_grants/i);

console.log("SAAS_P0_ANON_HARDENING_SQL_OK");
