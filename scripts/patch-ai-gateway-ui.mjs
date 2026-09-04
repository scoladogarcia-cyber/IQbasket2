import fs from "node:fs";

function replaceOnce(source, matcher, replacement, label) {
  if (source.includes(replacement)) return source;
  const next = source.replace(matcher, replacement);
  if (next === source) throw new Error(`AI UI patch anchor not found: ${label}`);
  return next;
}

// -----------------------------------------------------------------------------
// Player360View: inject the browser-to-Edge gateway boundary.
// -----------------------------------------------------------------------------
const viewPath = "views/Player360View.js";
let view = fs.readFileSync(viewPath, "utf8");

const gatewayImport = 'import { Player360AiGatewayService } from "../services/player360/Player360AiGatewayService.js";';
if (!view.includes(gatewayImport)) {
  view = replaceOnce(
    view,
    /import \{ LongitudinalAnalyticsService \} from "\.\.\/services\/player360\/LongitudinalAnalyticsService\.js";/,
    '$&\n' + gatewayImport,
    "gateway import"
  );
}

const gatewayCtor = "    this.aiGatewayService = new Player360AiGatewayService(this.supabase);";
if (!view.includes(gatewayCtor)) {
  view = replaceOnce(
    view,
    /    this\.analyticsService = new LongitudinalAnalyticsService\(this\.supabase\);/,
    '$&\n' + gatewayCtor,
    "gateway constructor"
  );
}

if (!view.includes("aiGatewayService: this.aiGatewayService")) {
  view = replaceOnce(
    view,
    /(    this\.analyticsPanel = new LongitudinalAnalyticsPanel\(\{\n[\s\S]*?      orchestrator: this\.analyticsOrchestrator,\n)/,
    '$1      aiGatewayService: this.aiGatewayService,\n',
    "analytics panel dependency"
  );
}

fs.writeFileSync(viewPath, view);

// -----------------------------------------------------------------------------
// LongitudinalAnalyticsPanel: expose generation only when BOTH deployment
// config and gateway service are enabled. Gate A keeps both false by default.
// -----------------------------------------------------------------------------
const panelPath = "views/player360/LongitudinalAnalyticsPanel.js";
let panel = fs.readFileSync(panelPath, "utf8");

if (!panel.includes("constructor({ analyticsService, orchestrator, aiGatewayService, can } = {})")) {
  panel = replaceOnce(
    panel,
    /constructor\(\{ analyticsService, orchestrator, can \} = \{\}\) \{\n    this\.analyticsService = analyticsService;\n    this\.orchestrator = orchestrator;\n/,
    "constructor({ analyticsService, orchestrator, aiGatewayService, can } = {}) {\n    this.analyticsService = analyticsService;\n    this.orchestrator = orchestrator;\n    this.aiGatewayService = aiGatewayService;\n",
    "panel constructor"
  );
}

if (!panel.includes("const generationControl = canGenerateAi")) {
  panel = replaceOnce(
    panel,
    /    const generationNote = this\._can\(Permission\.GENERATE_AI_INSIGHTS\) && !PLAYER360_AI_UI_CONFIG\.generationEnabled\n      \? '<div class="p360d-note">[\s\S]*?<\/div>'\n      : "";/,
    `    const canGenerateAi = this._can(Permission.GENERATE_AI_INSIGHTS);\n    const gatewayEnabled = Boolean(\n      PLAYER360_AI_UI_CONFIG.generationEnabled\n      && this.aiGatewayService?.isEnabled?.()\n    );\n    const generationControl = canGenerateAi\n      ? gatewayEnabled\n        ? '<div class="p360d-review-actions"><button type="button" id="p360d-generate-ai" class="p360d-primary">Generar interpretación IA</button></div>' +\n          '<div class="p360d-note">La IA recibe únicamente evidencia longitudinal autorizada y guarda siempre un borrador sujeto a revisión humana.</div>'\n        : '<div class="p360d-note">La pasarela IA está preparada pero permanece desactivada hasta validar backend, secretos y cuotas. El navegador nunca llama directamente al proveedor.</div>'\n      : "";`,
    "generation control"
  );
}

panel = panel.replace("      generationNote + list +", "      generationControl + list +");

if (!panel.includes('querySelector("#p360d-generate-ai")')) {
  const bindBlock = `    container.querySelector("#p360d-generate-ai")?.addEventListener("click", async event => {\n      const button = event.currentTarget;\n      if (!this.selectedSnapshotId) return;\n      if (!confirm("¿Generar una interpretación IA? Esta acción puede consumir cuota de la licencia y el resultado se guardará como borrador.")) return;\n\n      button.disabled = true;\n      try {\n        await this.aiGatewayService.generateInsight({\n          snapshotId: this.selectedSnapshotId,\n          audience: "STAFF",\n          locale: "es"\n        });\n        await this.load(this.context);\n        await refresh();\n      } catch (error) {\n        console.error("[LongitudinalAnalyticsPanel] Error generando insight IA:", error);\n        alert("❌ " + (error.message || error));\n        button.disabled = false;\n      }\n    });\n\n`;

  panel = replaceOnce(
    panel,
    /    container\.querySelectorAll\("\.p360d-review-insight"\)\.forEach\(button => \{/,
    bindBlock + '$&',
    "generation bind"
  );
}

fs.writeFileSync(panelPath, panel);

console.log("AI Gateway UI patch: OK");
