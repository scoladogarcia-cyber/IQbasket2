/**
 * @fileoverview Mobile-first setup for a brand-new live game.
 * @description Replaces the legacy in-memory HUD launch. A game is persisted,
 * prepared and started before the scorer opens, guaranteeing a stable gameId,
 * writer lease, live sync and follower Game Center from the first possession.
 */

import { DataStore } from "../../services/DataStore.js";
import { Permission } from "../../security/PermissionService.js";
import { LiveGameLaunchService } from "../../services/games/LiveGameLaunchService.js";

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function localTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export class LiveGameSetupV39View {
  constructor(supabaseClient = null, authController = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.launchService = new LiveGameLaunchService(this.supabase, this.auth);
    this.selectedStarterIds = new Set();
    this.teamId = null;
    this.container = null;
  }

  _context() {
    return {
      teamId: this.teamId,
      seasonId: DataStore.getActiveSeasonId?.(this.teamId) || null,
      teamSeasonId: DataStore.getActiveTeamSeasonId?.(this.teamId) || null
    };
  }

  _can(permission) {
    return Boolean(this.auth?.can?.(permission, this._context()));
  }

  _playerName(player = {}) {
    return player.name
      || `${player.first_name || player.firstName || ""} ${player.last_name || player.lastName || ""}`.trim()
      || "Jugador";
  }

  render(containerId = "dashboard-content-area", teamId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    this.container = container;
    this.teamId = teamId || DataStore.getActiveTeamId?.() || null;
    this.selectedStarterIds.clear();

    const context = this._context();
    const allowed = this._can(Permission.CREATE_GAME)
      && this._can(Permission.RECORD_LIVE_GAME)
      && this._can(Permission.PREPARE_GAME)
      && this._can(Permission.START_GAME);
    const team = DataStore.getTeamById?.(this.teamId) || {};
    const date = localDate();
    const players = DataStore.getPlayersEligibleOnDate?.(this.teamId, date) || [];

    if (!allowed) {
      container.innerHTML = `
        <section class="v39-live-setup-card" style="max-width:720px;margin:0 auto;">
          <h1>No puedes iniciar un partido nuevo</h1>
          <p>Crear e iniciar un partido requiere permisos de creación, preparación, inicio y anotación en vivo. Un usuario delegado puede anotar un partido ya creado sin recibir permisos generales adicionales.</p>
          <button type="button" data-live-setup-back>Volver a Partidos</button>
        </section>`;
      container.querySelector("[data-live-setup-back]")?.addEventListener("click", () => {
        window.location.hash = "#/partidos";
      });
      return;
    }

    container.innerHTML = `
      <div class="v39-live-setup-root">
        <header class="v39-live-setup-head">
          <button type="button" data-live-setup-back aria-label="Volver">←</button>
          <div>
            <span>NUEVO PARTIDO EN VIVO</span>
            <h1>${escapeHtml(team.name || "Equipo")}</h1>
          </div>
        </header>

        <form id="v39-live-setup-form" class="v39-live-setup-form" novalidate>
          <section class="v39-live-setup-card">
            <label class="v39-live-field v39-live-field-wide">
              <span>Rival</span>
              <input name="opponent" type="text" autocomplete="off" required maxlength="100" placeholder="Nombre del equipo rival" />
            </label>
            <div class="v39-live-two-col">
              <label class="v39-live-field">
                <span>Fecha</span>
                <input name="date" type="date" value="${date}" required />
              </label>
              <label class="v39-live-field">
                <span>Hora</span>
                <input name="time" type="time" value="${localTime()}" required />
              </label>
            </div>
            <fieldset class="v39-live-venue">
              <legend>Condición</legend>
              <label><input type="radio" name="venue" value="Local" checked><span>🏠 Local</span></label>
              <label><input type="radio" name="venue" value="Visitante"><span>🚌 Visitante</span></label>
            </fieldset>
            <div class="v39-live-two-col">
              <label class="v39-live-field">
                <span>Competición</span>
                <input name="competition" type="text" maxlength="100" value="${escapeHtml(team.competition || "Liga")}" />
              </label>
              <label class="v39-live-field">
                <span>Pabellón <small>(opcional)</small></span>
                <input name="venueName" type="text" maxlength="120" />
              </label>
            </div>
          </section>

          <section class="v39-live-setup-card">
            <div class="v39-live-starters-head">
              <div><strong>Quinteto inicial</strong><span>Selecciona exactamente 5</span></div>
              <output id="v39-starter-count">0/5</output>
            </div>
            <div class="v39-live-starters-grid">
              ${players.map(player => `
                <button type="button" class="v39-live-starter" data-starter-id="${escapeHtml(player.id)}" aria-pressed="false">
                  <strong>#${escapeHtml(player.jersey ?? player.number ?? "-")}</strong>
                  <span>${escapeHtml(this._playerName(player))}</span>
                </button>
              `).join("") || '<p class="v39-live-empty">No hay jugadoras elegibles para esta fecha.</p>'}
            </div>
          </section>

          <div id="v39-live-setup-feedback" class="v39-live-setup-feedback" role="status" aria-live="polite"></div>
          <button type="submit" id="v39-live-create-start" class="v39-live-create-start">
            🏀 Crear e iniciar partido
            <small>Se guardará antes de abrir la anotación</small>
          </button>
        </form>
      </div>`;

    this._bind();
  }

  _bind() {
    this.container.querySelector("[data-live-setup-back]")?.addEventListener("click", () => {
      window.location.hash = "#/partidos";
    });

    this.container.querySelectorAll("[data-starter-id]").forEach(button => {
      button.addEventListener("click", () => {
        const id = String(button.dataset.starterId || "");
        if (!id) return;
        if (this.selectedStarterIds.has(id)) this.selectedStarterIds.delete(id);
        else if (this.selectedStarterIds.size < 5) this.selectedStarterIds.add(id);
        else {
          this._feedback("Ya hay 5 jugadoras seleccionadas. Quita una antes de añadir otra.", "warn");
          return;
        }
        this._renderStarterState();
      });
    });

    this.container.querySelector("#v39-live-setup-form")?.addEventListener("submit", event => {
      event.preventDefault();
      this._submit(event.currentTarget).catch(() => {});
    });
  }

  _renderStarterState() {
    this.container.querySelectorAll("[data-starter-id]").forEach(button => {
      const selected = this.selectedStarterIds.has(String(button.dataset.starterId || ""));
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const count = this.container.querySelector("#v39-starter-count");
    if (count) count.textContent = `${this.selectedStarterIds.size}/5`;
    if (this.selectedStarterIds.size === 5) this._feedback("Quinteto listo. Puedes iniciar el partido.", "ok");
  }

  _feedback(message = "", type = "info") {
    const node = this.container?.querySelector?.("#v39-live-setup-feedback");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = type;
  }

  async _submit(form) {
    const submit = this.container.querySelector("#v39-live-create-start");
    if (this.selectedStarterIds.size !== 5) {
      this._feedback("Selecciona exactamente 5 jugadoras para empezar.", "error");
      return;
    }
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
    this._feedback("Creando el partido y preparando la anotación…");

    try {
      const result = await this.launchService.createAndStart({
        teamId: this.teamId,
        opponent: data.get("opponent"),
        date: data.get("date"),
        time: data.get("time"),
        venue: data.get("venue"),
        competition: data.get("competition"),
        venueName: data.get("venueName"),
        starterIds: [...this.selectedStarterIds]
      });
      window.location.hash = `#/live/${encodeURIComponent(result.gameId)}`;
    } catch (error) {
      const suffix = error?.gameId ? " El partido ha quedado guardado y podrás retomarlo desde Partidos." : "";
      this._feedback(`${error?.message || "No se pudo iniciar el partido."}${suffix}`, "error");
      submit.disabled = false;
      submit.removeAttribute("aria-busy");
    }
  }
}

if (typeof document !== "undefined" && !document.getElementById("iqbasket-v39-live-setup-styles")) {
  const style = document.createElement("style");
  style.id = "iqbasket-v39-live-setup-styles";
  style.textContent = `
    .v39-live-setup-root{max-width:760px;margin:0 auto;padding:0 0 110px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a}
    .v39-live-setup-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}.v39-live-setup-head>button{width:44px;height:44px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;font-size:22px}.v39-live-setup-head span{display:block;color:#f97316;font-size:10px;font-weight:900;letter-spacing:.08em}.v39-live-setup-head h1{font-size:21px;margin:2px 0 0}
    .v39-live-setup-form{display:grid;gap:12px}.v39-live-setup-card{background:#fff;border:1px solid #dbe2ea;border-radius:16px;padding:14px;box-shadow:0 4px 16px rgba(15,23,42,.04)}.v39-live-two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.v39-live-field{display:grid;gap:5px}.v39-live-field>span,.v39-live-venue legend{font-size:11px;font-weight:900;color:#475569}.v39-live-field input{width:100%;min-height:46px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;background:#fff;color:#0f172a;font-size:15px;font-weight:700;-webkit-text-fill-color:#0f172a}.v39-live-field small{font-weight:600;color:#94a3b8}
    .v39-live-venue{border:0;padding:0;margin:11px 0 0}.v39-live-venue>div{display:flex}.v39-live-venue label{display:inline-flex;margin:5px 7px 0 0}.v39-live-venue input{position:absolute;opacity:0}.v39-live-venue span{display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 15px;border:1px solid #cbd5e1;border-radius:10px;font-size:13px;font-weight:850;background:#f8fafc}.v39-live-venue input:checked+span{border-color:#f97316;background:#fff7ed;color:#c2410c}
    .v39-live-starters-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.v39-live-starters-head>div{display:grid}.v39-live-starters-head strong{font-size:14px}.v39-live-starters-head span{font-size:10px;color:#64748b}.v39-live-starters-head output{font-size:16px;font-weight:950;color:#1d4ed8;background:#eff6ff;border-radius:999px;padding:5px 10px}.v39-live-starters-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.v39-live-starter{min-height:52px;border:1.5px solid #cbd5e1;border-radius:11px;background:#fff;color:#0f172a;display:flex;align-items:center;gap:8px;text-align:left;padding:8px 10px}.v39-live-starter strong{color:#1d4ed8;font-size:16px}.v39-live-starter span{font-size:12px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v39-live-starter.is-selected{border-color:#2563eb;background:#eff6ff;box-shadow:inset 0 0 0 1px #2563eb}.v39-live-empty{grid-column:1/-1;color:#991b1b;font-size:12px}
    .v39-live-setup-feedback{min-height:18px;padding:0 4px;font-size:11px;font-weight:750;color:#475569}.v39-live-setup-feedback[data-type="error"]{color:#b91c1c}.v39-live-setup-feedback[data-type="warn"]{color:#92400e}.v39-live-setup-feedback[data-type="ok"]{color:#166534}.v39-live-create-start{position:sticky;bottom:calc(82px + env(safe-area-inset-bottom));z-index:6;width:100%;min-height:62px;border:0;border-radius:14px;background:#f97316;color:#fff;box-shadow:0 10px 30px rgba(249,115,22,.28);font-size:16px;font-weight:950;display:grid;place-items:center;padding:9px 14px}.v39-live-create-start small{font-size:9px;font-weight:650;opacity:.9}.v39-live-create-start:disabled{opacity:.55}
    @media(max-width:520px){.v39-live-setup-root{padding-left:2px;padding-right:2px}.v39-live-two-col{grid-template-columns:1fr 1fr}.v39-live-setup-card{padding:12px}.v39-live-starters-grid{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);
}

export default LiveGameSetupV39View;
