import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sqlPath = path.join(
  root,
  "supabase/ready/20260904_apply_v7_security_perimeter_hardening.sql"
);
const sql = fs.readFileSync(sqlPath, "utf8");
const triggerSql = fs.readFileSync(path.join(root, "supabase/ready/20260904_apply_v7_internal_trigger_rpc_hardening.sql"), "utf8");

const checks = {
  internalAccountHelper: /iq_private\.account_is_active\(p_user_id uuid\)/i.test(sql),
  publicHelperInvoker: /public\.iq_account_is_active\(\)[\s\S]*security invoker/i.test(sql),
  anonDefinerRevoked: /where n\.nspname='public' and p\.prosecdef[\s\S]*revoke execute on function/i.test(sql),
  insecureMetadataPoliciesDropped: [
    "Permitir actualizacion solo a roles autorizados",
    "Permitir borrado solo a roles autorizados",
    "Permitir insercion solo a roles autorizados"
  ].every((name) => sql.includes(`drop policy if exists \"${name}\"`)),
  privateLifecyclePolicies: /iq_v7_no_client_account_controls/i.test(sql)
    && /iq_v7_no_client_account_history/i.test(sql),
  safeLegacySignupRole: /v_role text := case[\s\S]*else 'INVITADO'/i.test(sql),
  invariantNoMetadataPolicy: /V7_USER_METADATA_POLICY_REMAINS/.test(sql),
  invariantNoAnonDefiner: /V7_ANON_SECURITY_DEFINER_REMAINS/.test(sql),
  internalTriggerRpcClosed: /pg_get_function_result\(p\.oid\) in \('trigger','event_trigger'\)/i.test(triggerSql)
    && /V7_TRIGGER_RPC_EXECUTE_REMAINS/.test(triggerSql)
};const failed = Object.entries(checks)
  .filter(([, ok]) => !ok)
  .map(([name]) => name);

if (failed.length) {
  console.error(JSON.stringify({ ...checks, failed, result: "FAIL" }));
  process.exit(1);
}

console.log(JSON.stringify({ ...checks, result: "PASS" }));
console.log("SECURITY_PERIMETER_HARDENING_SQL_OK");