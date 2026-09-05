import fs from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const viewSource = fs.readFileSync(new URL("../views/PrivacyCenterView.js", import.meta.url), "utf8");
const permissionSource = fs.readFileSync(new URL("../security/permissions.js", import.meta.url), "utf8");

assert(permissionSource.includes('REVOKE_FAMILY_LINK: "REVOKE_FAMILY_LINK"'), "Falta permiso REVOKE_FAMILY_LINK");
assert(permissionSource.includes('REVOKE_PRIVACY_AUTHORIZATION: "REVOKE_PRIVACY_AUTHORIZATION"'), "Falta permiso REVOKE_PRIVACY_AUTHORIZATION");

const relationshipButton = /Permission\.REVOKE_FAMILY_LINK[\s\S]{0,180}data-revoke-relationship/.test(viewSource);
const authorizationButton = /Permission\.REVOKE_PRIVACY_AUTHORIZATION[\s\S]{0,220}data-revoke-authorization/.test(viewSource);
assert(relationshipButton, "La revocación de vínculo familiar no usa REVOKE_FAMILY_LINK");
assert(authorizationButton, "La revocación de autorización no usa REVOKE_PRIVACY_AUTHORIZATION");
const relationshipMethod = /async _revokeRelationship\(id\)[\s\S]{0,140}Permission\.REVOKE_FAMILY_LINK/.test(viewSource);
const authorizationMethod = /async _revokeAuthorization\(id\)[\s\S]{0,140}Permission\.REVOKE_PRIVACY_AUTHORIZATION/.test(viewSource);
assert(relationshipMethod, "_revokeRelationship no valida REVOKE_FAMILY_LINK");
assert(authorizationMethod, "_revokeAuthorization no valida REVOKE_PRIVACY_AUTHORIZATION");

const badAuthorizationBinding = /Permission\.REVOKE_FAMILY_LINK[\s\S]{0,220}data-revoke-authorization/.test(viewSource);
assert(!badAuthorizationBinding, "REVOKE_FAMILY_LINK no puede habilitar revocación de autorizaciones");

console.log("PRIVACY_PERMISSION_SEPARATION_OK");
