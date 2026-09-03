import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../views/LayoutView.js", import.meta.url), "utf8");
const permissions = fs.readFileSync(new URL("../security/permissions.js", import.meta.url), "utf8");

assert.match(
  app,
  /import\s+\{\s*TrainingView\s*\}\s+from\s+["']\.\/views\/TrainingView\.js["']/,
  "app.js debe importar TrainingView"
);

assert.match(
  app,
  /case\s+["']training["'][\s\S]{0,500}new\s+TrainingView\(/,
  "La ruta #/training debe instanciar TrainingView"
);

assert.match(
  layout,
  /data-route-key=["']training["'][\s\S]{0,300}#\/training|#\/training[\s\S]{0,300}data-route-key=["']training["']/,
  "LayoutView debe enlazar Entrenamientos con #/training"
);

assert.match(
  permissions,
  /training:\s*Permission\.VIEW_TRAINING/,
  "La ruta training debe conservar gate RBAC"
);

console.log("PLAYER360_PHASE4B_ROUTE_INTEGRATION_OK");
