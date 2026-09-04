import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const index = read("index.js");
const app = read("app.js");
const permissions = read("security/permissions.js");
const layout = read("views/LayoutView.js");
const translations = read("services/TranslationStore.js");
const service = read("services/player360/PrivacyGovernanceService.js");
const lazyViews = read("services/LazyViewRegistry.js");

assert.match(index, /case\s+["']privacy["']\s*:/, "index.js debe enrutar #/privacy.");
assert.match(index, /case "privacy"[\s\S]{0,500}lazyViews\.get\("privacy"\)/,
  "index.js debe cargar privacidad bajo demanda.");
assert.match(lazyViews, /import\("\.\.\/views\/PrivacyCenterView\.js"\)/,
  "El registro lazy debe cargar PrivacyCenterView.");
assert.match(lazyViews, /new PrivacyCenterView\(supabase, authController\)/,
  "El registro lazy debe conservar las dependencias de PrivacyCenterView.");
assert.match(app, /import\s+\{\s*PrivacyCenterView\s*\}/,
  "app.js legacy debe conservar PrivacyCenterView.");
assert.match(app, /case\s+["']privacy["']\s*:/, "app.js debe enrutar #/privacy.");
assert.match(app, /new\s+PrivacyCenterView\(/, "app.js debe construir PrivacyCenterView.");

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
