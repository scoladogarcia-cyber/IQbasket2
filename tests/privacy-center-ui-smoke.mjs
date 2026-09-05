import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL = process.env.PRIVACY_CENTER_BASE_URL || "http://127.0.0.1:4173/";
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYER_ID = "10000000-0000-4000-8000-000000000001";
const REQUEST_ID = "20000000-0000-4000-8000-000000000001";

function assertCondition(condition, viewport, message, detail = null) {
  if (!condition) throw new Error(`[${viewport}] ${message}${detail ? ` · ${JSON.stringify(detail)}` : ""}`);
}

async function installFixture(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.iqApp), null, { timeout: 20000 });

  await page.evaluate(async ({ TEAM_ID, TEAM_SEASON_ID, PLAYER_ID, REQUEST_ID }) => {
    const { DataStore } = await import("/services/DataStore.js");
    const { PrivacyCenterView } = await import("/views/PrivacyCenterView.js");

    DataStore.getActiveTeamId = () => TEAM_ID;
    DataStore.getActiveTeamSeasonId = () => TEAM_SEASON_ID;
    DataStore.getPlayerById = id => String(id) === String(PLAYER_ID)
      ? { id: PLAYER_ID, first_name: "Anna", last_name: "Cordero", birth_date: "2012-04-15" }
      : null;

    const calls = [];
    const now = new Date().toISOString();
    const mock = {
      rpc: async (name, params = {}) => {
        calls.push({ name, params });
        if (name === "iq_v4e_privacy_capabilities") {
          return { data: { ready: true, can_admin_privacy: true }, error: null };
        }
        if (name === "iq_v4f_privacy_center_snapshot") {
          return { data: {
            counts: { relationships: 1, authorizations: 1, active_grants: 1, pending_requests: 1 },
            players: [{
              player_id: PLAYER_ID,
              first_name: "Anna",
              last_name: "Cordero",
              jersey: 5,
              active_authorizations: 1,
              active_grants: 1,
              pending_requests: 1
            }],
            relationships: [{
              id: "30000000-0000-4000-8000-000000000001",
              user_id: "40000000-0000-4000-8000-000000000001",
              player_id: PLAYER_ID,
              relationship_type: "GUARDIAN",
              status: "ACTIVE",
              valid_until: null,
              verification_source: "CLUB_VERIFIED",
              user: { first_name: "Tutor", last_name: "Demo", email: "tutor@example.test" }
            }]
          }, error: null };
        }
        if (name === "iq_v4f_list_privacy_authorizations") {
          return { data: [{
            id: "50000000-0000-4000-8000-000000000001",
            player_id: PLAYER_ID,
            player: { first_name: "Anna", last_name: "Cordero", jersey: 5 },
            modules: ["nutrition", "recovery"],
            purposes: ["SPORT_PERFORMANCE"],
            authorization_type: "GUARDIAN_CONSENT",
            representative_user_id: "40000000-0000-4000-8000-000000000001",
            legal_basis_code: "POLICY-01",
            special_category_condition_code: "SPECIAL-01",
            ai_processing_allowed: false,
            evidence_reference: "DOC-01",
            status: "ACTIVE",
            valid_until: "2027-06-30T23:59:59Z",
            created_at: now
          }], error: null };
        }
        if (name === "iq_v4f_list_sensitive_access") {
          return { data: {
            requests: [{
              id: REQUEST_ID,
              requested_by: "60000000-0000-4000-8000-000000000001",
              requester: { first_name: "Coach", last_name: "Demo", email: "coach@example.test" },
              player_id: PLAYER_ID,
              player: { first_name: "Anna", last_name: "Cordero", jersey: 5 },
              modules: ["nutrition"],
              actions: ["READ"],
              purposes: ["SPORT_PERFORMANCE"],
              justification: "Seguimiento deportivo",
              status: "PENDING",
              created_at: now
            }],
            grants: [{
              id: "70000000-0000-4000-8000-000000000001",
              user_id: "80000000-0000-4000-8000-000000000001",
              user: { first_name: "Analista", last_name: "Demo", email: "analyst@example.test" },
              player_id: PLAYER_ID,
              player: { first_name: "Anna", last_name: "Cordero", jersey: 5 },
              modules: ["recovery"], actions: ["READ"], purposes: ["SPORT_PERFORMANCE"],
              status: "ACTIVE", valid_until: "2027-01-01T23:59:59Z", grant_reason: "Seguimiento", created_at: now
            }]
          }, error: null };
        }
        if (name === "iq_v4f_list_privacy_audit") {
          return { data: [{
            id: "90000000-0000-4000-8000-000000000001",
            actor: { first_name: "Admin", last_name: "Demo", email: "admin@example.test" },
            event_type: "SENSITIVE_ACCESS_GRANTED",
            module: "nutrition", action: "CREATE", purpose: "SPORT_PERFORMANCE",
            decision: "ALLOW", reason_code: "ADMIN_GRANTED", occurred_at: now
          }], error: null };
        }
        if ([
          "iq_v4e_record_processing_authorization",
          "iq_v4e_grant_sensitive_access",
          "iq_v4e_revoke_processing_authorization",
          "iq_v4e_revoke_sensitive_access_grant",
          "iq_v4e_revoke_subject_relationship"
        ].includes(name)) {
          return { data: name.includes("revoke") ? true : "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", error: null };
        }
        return { data: null, error: new Error(`RPC inesperado: ${name}`) };
      }
    };

    const auth = { canPreview: () => true, can: () => true };
    document.getElementById("app").innerHTML = '<main id="dashboard-content-area"></main>';
    const view = new PrivacyCenterView(mock, auth);
    window.__privacyView = view;
    window.__privacyCalls = calls;
    await view.render("dashboard-content-area");
  }, { TEAM_ID, TEAM_SEASON_ID, PLAYER_ID, REQUEST_ID });
}

async function runViewport(browser, viewportName, viewport) {
  const page = await browser.newPage({ viewport });
  await installBrowserNetworkStubs(page);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await installFixture(page);

  await page.waitForSelector("#privacy-center-title", { state: "visible" });
  const initial = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    title: document.querySelector("#privacy-center-title")?.textContent || "",
    kpis: document.querySelectorAll(".privacy-kpi").length,
    playerOptions: document.querySelectorAll("#privacy-player-filter option").length,
    calls: window.__privacyCalls.map(item => item.name)
  }));
  assertCondition(!initial.overflow, viewportName, "Privacy Center tiene overflow horizontal", initial);
  assertCondition(initial.title.includes("Centro de Privacidad"), viewportName, "Falta el título principal");
  assertCondition(initial.kpis === 4, viewportName, "Resumen incompleto", initial);
  assertCondition(initial.playerOptions === 2, viewportName, "Filtro de jugador incorrecto", initial);
  for (const rpc of [
    "iq_v4e_privacy_capabilities",
    "iq_v4f_privacy_center_snapshot",
    "iq_v4f_list_privacy_authorizations",
    "iq_v4f_list_sensitive_access",
    "iq_v4f_list_privacy_audit"
  ]) assertCondition(initial.calls.includes(rpc), viewportName, `No se consumió ${rpc}`);

  await page.click("[data-open-family-invite]");
  await page.waitForSelector('[data-family-invite-form]', { state: "visible" });
  const inviteModal = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    closeButtons: document.querySelectorAll('[data-modal-close]').length
  }));
  assertCondition(!inviteModal.overflow, viewportName, "Modal familiar genera overflow", inviteModal);
  assertCondition(inviteModal.closeButtons >= 1, viewportName, "Modal familiar no expone cierre accesible", inviteModal);
  await page.click('[data-modal-close]');
  await page.waitForFunction(() => !document.querySelector('[data-family-invite-form]'));

  await page.click('[data-privacy-tab="authorizations"]');
  await page.waitForSelector(".privacy-data-card", { state: "visible" });
  await page.click("[data-open-authorization]");
  await page.waitForSelector("#privacy-authorization-form", { state: "visible" });
  const modalGeometry = await page.evaluate(() => {
    const modal = document.querySelector(".privacy-modal");
    const rect = modal.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, width: rect.width, innerHeight: window.innerHeight, innerWidth: window.innerWidth };
  });
  assertCondition(modalGeometry.top >= -1 && modalGeometry.bottom <= modalGeometry.innerHeight + 1, viewportName, "Modal de autorización fuera del viewport", modalGeometry);
  assertCondition(modalGeometry.width <= modalGeometry.innerWidth + 1, viewportName, "Modal de autorización demasiado ancho", modalGeometry);
  const readiness = await page.evaluate(() => ({
    ageBand: document.querySelector('[data-privacy-age-readiness]')?.dataset.ageBand || null,
    types: [...document.querySelectorAll('select[name="authorizationType"] option')].map(option => option.value),
    aiChecked: Boolean(document.querySelector('input[name="aiProcessingAllowed"]')?.checked)
  }));
  assertCondition(readiness.ageBand === "MINOR", viewportName, "No se informa la minoría de edad", readiness);
  assertCondition(JSON.stringify(readiness.types) === JSON.stringify(["", "CONSENT", "GUARDIAN_CONSENT", "OTHER_DOCUMENTED_BASIS"]), viewportName, "Tipos de autorización no coinciden con backend", readiness);
  assertCondition(!readiness.aiChecked, viewportName, "IA no puede venir preautorizada", readiness);
  await page.selectOption('select[name="authorizationType"]', "GUARDIAN_CONSENT");
  await page.waitForFunction(() => !document.querySelector('[data-guardian-representative]').hidden);
  const guardianOption = await page.locator('select[name="representativeUserId"] option[value="40000000-0000-4000-8000-000000000001"]').count();
  assertCondition(guardianOption === 1, viewportName, "Tutor activo no disponible como representante");
  await page.selectOption('select[name="representativeUserId"]', "40000000-0000-4000-8000-000000000001");

  await page.fill('input[name="legalBasisCode"]', "POLICY-QA");
  await page.fill('input[name="specialCategoryConditionCode"]', "SPECIAL-QA");
  await page.fill('input[name="evidenceReference"]', "EVIDENCE-QA");
  await page.click('#privacy-authorization-form button[type="submit"]');
  await page.waitForTimeout(100);
  const authorizationCall = await page.evaluate(() => window.__privacyCalls.find(item => item.name === "iq_v4e_record_processing_authorization"));
  assertCondition(Boolean(authorizationCall), viewportName, "Guardar autorización no llama al RPC controlado");
  assertCondition(authorizationCall.params.p_player_id === PLAYER_ID, viewportName, "Autorización pierde player scope", authorizationCall);
  assertCondition(authorizationCall.params.p_modules.includes("nutrition"), viewportName, "Autorización pierde módulos", authorizationCall);
  assertCondition(authorizationCall.params.p_authorization_type === "GUARDIAN_CONSENT", viewportName, "Tipo de autorización inválido", authorizationCall);
  assertCondition(authorizationCall.params.p_representative_user_id === "40000000-0000-4000-8000-000000000001", viewportName, "Consentimiento de tutor pierde representante", authorizationCall);
  assertCondition(authorizationCall.params.p_ai_processing_allowed === false, viewportName, "IA se autorizó sin opt-in", authorizationCall);

  await page.click('[data-privacy-tab="access"]');
  await page.waitForSelector(`[data-grant-request="${REQUEST_ID}"]`, { state: "visible" });
  await page.click(`[data-grant-request="${REQUEST_ID}"]`);
  await page.fill('#privacy-grant-form input[name="validUntil"]', "2027-02-01");
  await page.fill('#privacy-grant-form textarea[name="reason"]', "Aprobado en QA");
  await page.click('#privacy-grant-form button[type="submit"]');
  await page.waitForTimeout(100);
  const grantCall = await page.evaluate(() => window.__privacyCalls.find(item => item.name === "iq_v4e_grant_sensitive_access"));
  assertCondition(Boolean(grantCall), viewportName, "Conceder solicitud no usa el RPC de grant");
  assertCondition(grantCall.params.p_request_id === REQUEST_ID, viewportName, "Grant pierde la solicitud origen", grantCall);
  assertCondition(grantCall.params.p_actions.length === 1 && grantCall.params.p_actions[0] === "READ", viewportName, "Grant amplía acciones solicitadas", grantCall);

  await page.click('[data-privacy-tab="audit"]');
  await page.waitForSelector(".privacy-audit-row", { state: "visible" });
  assertCondition(pageErrors.length === 0, viewportName, "pageerror en Privacy Center", pageErrors);

  console.log(JSON.stringify({ viewport: viewportName, result: "PASS" }));
  await page.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, "desktop-1440x900", { width: 1440, height: 900 });
  await runViewport(browser, "compact-320x568", { width: 320, height: 568 });
  await runViewport(browser, "iphone-390x844", { width: 390, height: 844 });
  await runViewport(browser, "landscape-844x390", { width: 844, height: 390 });
  console.log("PRIVACY_CENTER_UI_OK");
} finally {
  await browser.close();
}
