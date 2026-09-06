import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.GLOBAL_UI_QA_BASE_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await installBrowserNetworkStubs(page);
await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

const result = await page.evaluate(async () => {
  const { FamilyWorkspaceView } = await import("/views/family/FamilyWorkspaceView.js");
  const PLAYER_A = "11111111-1111-4111-8111-111111111111";
  const PLAYER_B = "22222222-2222-4222-8222-222222222222";
  const TEAM_SEASON_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const TEAM_SEASON_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const auth = { canPreview: () => true };
  const view = new FamilyWorkspaceView({ rpc: async () => ({ data: null, error: null }) }, auth);
  let saved = null;
  let submitted = null;

  view.service.listPlayers = async () => [
    { player_id: PLAYER_A, first_name: "Alex", last_name: "Uno", team_id: "team-a", team_season_id: TEAM_SEASON_A, team_name: "U16", season_name: "2025/2026" },
    { player_id: PLAYER_B, first_name: "Sam", last_name: "Dos", team_id: "team-b", team_season_id: TEAM_SEASON_B, team_name: "U14", season_name: "2025/2026" }
  ];
  view.service.bootstrapFree = async () => ({ plan_code: "FAMILY" });
  view.service.getProductSnapshot = async () => ({ plan_code: "FAMILY", subject_covered: true });
  view.service.getPassport = async playerId => ({
    player: playerId === PLAYER_B
      ? { id: PLAYER_B, first_name: "Sam", last_name: "Dos" }
      : { id: PLAYER_A, first_name: "Alex", last_name: "Uno" },
    career_totals: { games: 10, minutes: 200 },
    recent_games: [],
    career: []
  });
  view.service.getPlayer360Snapshot = async playerId => ({ allowed: false, player_id: playerId, team_season_id: playerId === PLAYER_B ? TEAM_SEASON_B : TEAM_SEASON_A });
  view.service.getDevelopmentContext = async playerId => ({ allowed: false, player_id: playerId, team_season_id: playerId === PLAYER_B ? TEAM_SEASON_B : TEAM_SEASON_A });
  view.service.getDevelopmentCycle = async playerId => ({ allowed: false, player_id: playerId, team_season_id: playerId === PLAYER_B ? TEAM_SEASON_B : TEAM_SEASON_A, current_cycle: null });
  view.contributionPanel.service.listMine = async () => [];
  view.contributionPanel.service.saveDraft = async args => { saved = args; return "33333333-3333-4333-8333-333333333333"; };
  view.contributionPanel.service.submit = async id => { submitted = id; return true; };
  view.analytics.trackSafely = async () => null;
  view.analytics.trackOncePerSession = async () => null;

  const host = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(host);
  await view.render(host, { id: PLAYER_B });

  const contribution = host.querySelector("[data-family-contributions]");
  const support = host.querySelector("[data-family-support-guide]");
  const relation = contribution?.querySelector("[data-psub-actor-relation]")?.getAttribute("data-psub-actor-relation") || "";
  const wellnessHref = contribution?.querySelector(".family-wellness-link")?.getAttribute("href") || "";
  const selected = host.querySelector('.family-player-chip[aria-current="true"]')?.getAttribute("data-family-player-link") || "";
  const followsSupport = Boolean(support && contribution && (support.compareDocumentPosition(contribution) & Node.DOCUMENT_POSITION_FOLLOWING));

  const form = contribution?.querySelector("#psub-training-form");
  form.querySelector("#psub-title").value = "Tecnificación familiar";
  form.querySelector("#psub-duration").value = "60";
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 30));

  return {
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    relation,
    wellnessHref,
    selected,
    followsSupport,
    savedPlayerId: saved?.playerId || null,
    savedTeamSeasonId: saved?.teamSeasonId || null,
    providerType: saved?.payload?.provider_type || null,
    submitted,
    heading: contribution?.textContent || ""
  };
});

if (result.overflowX) throw new Error(`Guardian contributions desborda en móvil: ${JSON.stringify(result)}`);
if (result.relation !== "GUARDIAN") throw new Error(`La UI debe marcar procedencia GUARDIAN: ${JSON.stringify(result)}`);
if (!result.wellnessHref.includes("#/player360/22222222-2222-4222-8222-222222222222")) throw new Error(`Wellness debe abrir el jugador seleccionado: ${JSON.stringify(result)}`);
if (result.selected !== "22222222-2222-4222-8222-222222222222") throw new Error(`Debe mantener seleccionado el segundo jugador: ${JSON.stringify(result)}`);
if (!result.followsSupport) throw new Error(`Aportar contexto debe ir después de Cómo puedo ayudar: ${JSON.stringify(result)}`);
if (result.savedPlayerId !== result.selected || result.savedTeamSeasonId !== "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb") throw new Error(`La aportación debe quedar scoped al jugador seleccionado: ${JSON.stringify(result)}`);
if (result.providerType !== "GUARDIAN_REPORTED") throw new Error(`Provider/provenance de familia incorrecta: ${JSON.stringify(result)}`);
if (!result.submitted) throw new Error(`La aportación debe enviarse a validación: ${JSON.stringify(result)}`);
if (!result.heading.includes("Aportaciones de familia")) throw new Error(`Falta copy explícito de familia: ${JSON.stringify(result)}`);

console.log(JSON.stringify({ result: "FAMILY_GUARDIAN_SUBMISSIONS_UI_OK", ...result }));
await browser.close();
