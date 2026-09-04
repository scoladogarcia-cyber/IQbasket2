import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: se esperaba 1 ancla y se encontraron ${count}`);
  }
  return source.replace(before, after);
}

function update(path, transform) {
  const before = readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`${path}: integración sin cambios`);
  writeFileSync(path, after, "utf8");
  console.log(`UPDATED ${path}`);
}

update("index.js", source => {
  let next = replaceOnce(
    source,
    'import { Player360View } from "./views/Player360View.js";\n',
    'import { Player360View } from "./views/Player360View.js";\nimport { PrivacyCenterView } from "./views/PrivacyCenterView.js";\n',
    "index import"
  );
  next = replaceOnce(
    next,
    '      player360: new Player360View(supabase, this.authController),\n      settings:',
    '      player360: new Player360View(supabase, this.authController),\n      privacy: new PrivacyCenterView(supabase, this.authController),\n      settings:',
    "index view registry"
  );
  next = replaceOnce(
    next,
    '      case "settings":\n',
    '      case "privacy":\n      case "privacy-center":\n      case "privacidad":\n        if (this.views.privacy) await this.views.privacy.render(contentArea);\n        break;\n\n      case "settings":\n',
    "index route"
  );
  return next;
});

update("app.js", source => {
  let next = replaceOnce(
    source,
    'import { Player360View } from "./views/Player360View.js";\n',
    'import { Player360View } from "./views/Player360View.js";\nimport { PrivacyCenterView } from "./views/PrivacyCenterView.js";\n',
    "app import"
  );
  next = replaceOnce(
    next,
    '      case "settings":\n',
    '      case "privacy":\n      case "privacy-center":\n      case "privacidad":\n        this.currentView = new PrivacyCenterView(this.supabase, this.authController);\n        await this.currentView.render(contentAreaId);\n        break;\n\n      case "settings":\n',
    "app route"
  );
  return next;
});

update("security/permissions.js", source => replaceOnce(
  source,
  '  bandeja: Permission.VIEW_APPROVAL_CENTER,\n  team:',
  '  bandeja: Permission.VIEW_APPROVAL_CENTER,\n  privacy: Permission.VIEW_PRIVACY_AUTHORIZATIONS,\n  "privacy-center": Permission.VIEW_PRIVACY_AUTHORIZATIONS,\n  privacidad: Permission.VIEW_PRIVACY_AUTHORIZATIONS,\n  team:',
  "route permissions"
));

update("views/LayoutView.js", source => {
  let next = replaceOnce(
    source,
    "    if (['settings', 'configuracion', 'translations'].includes(r)) return 'settings';\n",
    "    if (['privacy', 'privacy-center', 'privacidad', 'autorizaciones'].includes(r)) return 'privacy';\n    if (['settings', 'configuracion', 'translations'].includes(r)) return 'settings';\n",
    "layout normalize"
  );
  next = replaceOnce(
    next,
    '    const isNutritionRestricted = !hasRolePermission(Permission.VIEW_NUTRITION);\n',
    '    const isNutritionRestricted = !hasRolePermission(Permission.VIEW_NUTRITION);\n    const canViewPrivacy = hasRolePermission(Permission.VIEW_PRIVACY_AUTHORIZATIONS);\n',
    "layout privacy capability"
  );
  next = replaceOnce(
    next,
    '          { key: "settings", labelKey: "settings", fallback: "Configuración", route: "settings", svg:',
    '          ...(canViewPrivacy ? [{ key: "privacy", labelKey: "privacy_center", fallback: "Privacidad y accesos", route: "privacy", svg: \'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path>\' }] : []),\n          { key: "settings", labelKey: "settings", fallback: "Configuración", route: "settings", svg:',
    "layout desktop privacy item"
  );
  next = replaceOnce(
    next,
    '              <a href="#/profile" class="drawer-item">\n',
    '              ${canViewPrivacy ? `\n              <a href="#/privacy" class="drawer-item" data-route-key="privacy">\n                <span class="drawer-icon">🛡️</span>\n                <span>${LayoutView.t("privacy_center", "Privacidad y accesos")}</span>\n              </a>` : ""}\n              <a href="#/profile" class="drawer-item">\n',
    "layout mobile privacy item"
  );
  next = replaceOnce(
    next,
    '        settings: "settings"\n',
    '        settings: "settings",\n        privacy: "privacy_center"\n',
    "layout i18n keys"
  );
  return next;
});

update("services/TranslationStore.js", source => {
  let next = replaceOnce(
    source,
    '      settings: "Configuración",\n      approval_center: "Solicitudes",',
    '      settings: "Configuración",\n      privacy_center: "Privacidad y accesos",\n      privacy_governance: "Gobierno",\n      approval_center: "Solicitudes",',
    "translations es"
  );
  next = replaceOnce(
    next,
    '      settings: "Configuració",\n      approval_center: "Sol·licituds",',
    '      settings: "Configuració",\n      privacy_center: "Privacitat i accessos",\n      privacy_governance: "Governança",\n      approval_center: "Sol·licituds",',
    "translations ca"
  );
  next = replaceOnce(
    next,
    '      settings: "Settings",\n      approval_center: "Requests",',
    '      settings: "Settings",\n      privacy_center: "Privacy & access",\n      privacy_governance: "Governance",\n      approval_center: "Requests",',
    "translations en"
  );
  next = replaceOnce(
    next,
    '      settings: "Paramètres",\n      approval_center: "Demandes",',
    '      settings: "Paramètres",\n      privacy_center: "Confidentialité et accès",\n      privacy_governance: "Gouvernance",\n      approval_center: "Demandes",',
    "translations fr"
  );
  return next;
});

console.log("PRIVACY_CENTER_V1_INTEGRATION_OK");
