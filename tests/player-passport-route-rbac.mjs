import assert from "node:assert/strict";
import fs from "node:fs";

const permissions = fs.readFileSync(new URL("../security/permissions.js", import.meta.url), "utf8");
const entitlements = fs.readFileSync(new URL("../security/entitlements.js", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../views/LayoutView.js", import.meta.url), "utf8");
const router = fs.readFileSync(new URL("../index.js", import.meta.url), "utf8");
const lazy = fs.readFileSync(new URL("../services/LazyViewRegistry.js", import.meta.url), "utf8");
const view = fs.readFileSync(new URL("../views/player360/passport/PlayerPassportView.js", import.meta.url), "utf8");

assert.match(permissions,/VIEW_PLAYER_PASSPORT/);
assert.match(permissions,/passport:\s*Permission\.VIEW_PLAYER_PASSPORT/);
assert.match(entitlements,/PLAYER_PASSPORT/);
assert.match(layout,/key:\s*"passport"/);
assert.match(layout,/Pasaporte del jugador/);
assert.match(layout,/data-route-key="passport"/);
assert.match(router,/case "passport"/);
assert.match(router,/lazyViews\.get\("passport"\)/);
assert.match(lazy,/PlayerPassportView/);
assert.match(view,/No existe un OVR único/);
assert.match(view,/@media\(max-width:430px\)/);
assert.match(view,/min-height:44px/);
console.log("player-passport-route-rbac OK");
