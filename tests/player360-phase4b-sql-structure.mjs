import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = [
  "supabase/ready/20260903_apply_v4_phase4b_training_external.sql",
  "supabase/drafts/20260903_rehearse_v4_phase4b_training_external_rollback.sql"
];

for (const file of files) {
  const source = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  const lines = source.split(/\r?\n/);
  const invalidDollarLines = lines
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(item => ["as $", "$;", "$"].includes(item.text));

  assert.deepEqual(
    invalidDollarLines,
    [],
    `${file} contiene delimitadores PL/pgSQL inválidos`
  );

  const opens = (source.match(/\bas \$\$/g) || []).length;
  const closes = (source.match(/\$\$;/g) || []).length;
  assert.equal(opens, closes, `${file} tiene cuerpos SQL desbalanceados`);
}

const rehearsal = readFileSync(
  new URL("../supabase/drafts/20260903_rehearse_v4_phase4b_training_external_rollback.sql", import.meta.url),
  "utf8"
);

assert.equal((rehearsal.match(/^\s*begin;\s*$/gmi) || []).length, 1);
assert.equal((rehearsal.match(/^\s*commit;\s*$/gmi) || []).length, 0);
assert.equal((rehearsal.match(/^\s*rollback;\s*$/gmi) || []).length, 1);
assert.match(rehearsal, /PLAYER360_PHASE4B_REHEARSAL_OK/);
assert.match(rehearsal, /TRAINING_ACTIVITY_TYPE_SCOPE_MISMATCH/);

console.log("PLAYER360_PHASE4B_SQL_STRUCTURE_OK");
