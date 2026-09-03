import assert from "node:assert/strict";
import fs from "node:fs";

const service = fs.readFileSync(
  new URL("../services/ApprovalCenterService.js", import.meta.url),
  "utf8"
);
const view = fs.readFileSync(
  new URL("../views/ApprovalCenterView.js", import.meta.url),
  "utf8"
);
const settings = fs.readFileSync(
  new URL("../views/TranslationsView.js", import.meta.url),
  "utf8"
);
const transferService = fs.readFileSync(
  new URL("../services/transfers/TransferRequestService.js", import.meta.url),
  "utf8"
);
const translations = fs.readFileSync(
  new URL("../services/TranslationStore.js", import.meta.url),
  "utf8"
);

assert.match(service, /TransferRequestService/);
assert.match(service, /RequestType\.TRANSFER/);
assert.match(service, /scopeTeamSeasonId:\s*activeTeamSeasonId/);
assert.match(service, /Permission\.REVIEW_TRANSFER_SOURCE/);
assert.match(service, /Permission\.REVIEW_TRANSFER_DESTINATION/);
assert.match(service, /Permission\.FINALIZE_TRANSFER/);
assert.match(service, /async reviewTransfer\(/);
assert.match(service, /async finalizeTransfer\(/);

assert.match(view, /transfer-review-date/);
assert.match(view, /transfer-review-reason/);
assert.match(view, /btn-transfer-review/);
assert.match(view, /btn-transfer-finalize/);
assert.match(view, /data-side="\$\{side\}"/);
assert.match(view, /this\.service\.reviewTransfer\(/);
assert.match(view, /this\.service\.finalizeTransfer\(/);
assert.match(
  view,
  /min-height:44px/,
  "Los controles duales deben mantener targets táctiles aptos para móvil."
);
assert.doesNotMatch(
  view.match(/this\.container\?\.querySelectorAll\("\.btn-transfer-review"\)[\s\S]*?this\.container\?\.querySelectorAll\("\.btn-transfer-finalize"\)/)?.[0] || "",
  /prompt\(/,
  "La revisión dual no debe depender de prompt() en móvil."
);

assert.match(settings, /id="market-transfer-start-date"/);
assert.match(settings, /firstDateTo\s*=\s*normalizeIsoDate/);
assert.match(settings, /requestTransfer\([\s\S]*firstDateTo/);
assert.match(settings, /dualPendingTransfersList/);
assert.match(settings, /legacyPendingTransfersList/);
assert.match(
  settings,
  /if \(transferObj\.dualWorkflow\)[\s\S]*Bandeja de Solicitudes/,
  "Configuración no debe intentar aprobar V2 mediante el handler legacy."
);
assert.match(
  transferService,
  /iq_v4_request_transfer/,
  "Mercado debe poder crear solicitudes V4."
);

assert.equal(
  (translations.match(/"approvals\.type_transfer":/g) || []).length,
  4,
  "Traspaso debe tener fallback ES/CA/EN/FR."
);
assert.equal(
  (translations.match(/"approvals\.transfer_finalize":/g) || []).length,
  4,
  "La finalización debe tener fallback ES/CA/EN/FR."
);

console.log("DUAL_TRANSFER_UI_INTEGRATION_OK");
