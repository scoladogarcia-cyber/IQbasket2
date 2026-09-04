import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const index = read("index.js");
const app = read("app.js");
const permissions = read("security/permissions.js");
const layout = read("views/LayoutView.js");
const translations = read("services/TranslationStore.js");
const service = read("services/player360/PrivacyGovernanceService.js");

for (const [name, source] of [["index.js", index], ["app.js", app]]) {
  assert.match(
    source,
    /import\s+\{\s*PrivacyCenterView\s*\}\s+from\s+["']\.\/views\/PrivacyCenterView\.js["']/,
    `${name} debe importar PrivacyCenterView.`
  );
  assert.match(source, /case\s+["']privacy["']\s*:/, `${name} debe enrutar #/privacy.`);
  assert.match(source, /new\s+PrivacyCenterView\(/, `${name} debe construir PrivacyCenterView.`);
}

assert.match(
  permissions,
  /privacy:\s*Permission\.VIEW_PRIVACY_AUTHORIZATIONS/,
  "La ruta privacy debe estar protegida por permiso específico."
);
assert.match(
  permissions,
  /["']privacy-center["']:\s*Permission\.VIEW_PRIVACY_AUTHORIZATIONS/,
  "El alias privacy-center debe mantener la misma protección."
);
assert.match(
  layout,
  /canViewPrivacy\s*=\s*hasRolePermission\(Permission\.VIEW_PRIVACY_AUTHORIZATIONS\)/,
  "El shell debe ocultar el Centro de Privacidad a roles sin permiso."
);
assert.match(layout, /data-route-key=["']privacy["']/, "Debe existir acceso móvil contextual a privacidad.");
assert.match(layout, /key:\s*["']privacy["']/, "Debe existir acceso desktop contextual a privacidad.");
assert.match(layout, /return\s+["']privacy["']/, "Layout debe normalizar la ruta de privacidad.");

assert.equal(
  (translations.match(/privacy_center:\s*"/g) || []).length,
  4,
  "El acceso al Centro de Privacidad debe tener fallback ES/CA/EN/FR."
);

assert.doesNotMatch(
  service,
  /\.from\s*\(/,
  "PrivacyGovernanceService no puede consultar tablas sensibles directamente."
);
for (const rpc of [
  "iq_v4f_privacy_center_snapshot",
  "iq_v4f_list_privacy_authorizations",
  "iq_v4f_list_sensitive_access",
  "iq_v4f_list_privacy_audit",
  "iq_v4e_record_processing_authorization",
  "iq_v4e_grant_sensitive_access"
]) {
  assert.match(service, new RegExp(rpc), `Falta el RPC ${rpc} en el servicio.`);
}

console.log("PRIVACY_CENTER_ROUTE_INTEGRATION_OK");
