/**
 * @fileoverview Team entry point for the non-clinical Nutrition module.
 * @description Keeps Nutrition discoverable at team level while delegating all
 * sensitive reads/writes to the existing WellnessService + backend ABAC layer.
 * No nutrition data is duplicated in this view.
 */

import { DataStore } from "../services/DataStore.js";
import { WellnessService } from "../services/player360/WellnessService.js";
import { WellnessSupportPanel } from "./player360/WellnessSupportPanel.js";
import { Permission } from "../security/PermissionService.js";

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function playerName(player = {}) {
  return (
    player.name
    || [player.first_name, player.last_name].filter(Boolean).join(" ")
    || [player.firstName, player.lastName].filter(Boolean).join(" ")
    || "Jugador"
  );
}

function isoDate(value = "") {
  return String(value || "").slice(0, 10);
}

export class NutritionView {
  constructor(supabaseClient = null, authController = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.service = new WellnessService(this.supabase);

    this.containerId = "dashboard-content-area";
    this.teamId = null;
    this.teamSeasonId = null;
    this.playerId = null;
    this.players = [];

    this.panel = new WellnessSupportPanel({
      service: this.service,
      can: permission => this._can(permission),
      modules: ["nutrition"]
    });
    this.panel.activeModule = "nutrition";
  }

  _context() {
    return {
      teamId: this.teamId,
      teamSeasonId: this.teamSeasonId,
      playerId: this.playerId,
      playerTeamId: this.teamId
    };
  }

  _can(permission) {
    if (!permission) return false;
    if (typeof this.auth?.canPreview === "function") {
      return Boolean(this.auth.canPreview(permission, this._context()));
    }
    if (typeof this.auth?.can === "function") {
      return Boolean(this.auth.can(permission, this._context()));
    }
    return false;
  }

  _seasonContext() {
    return DataStore.getActiveSeasonContext?.(this.teamId) || null;
  }

  _dateBounds() {
    const context = this._seasonContext();
    return {
      min: isoDate(context?.start_date || context?.startDate),
      max: isoDate(context?.end_date || context?.endDate)
    };
  }

  _resolvePlayers() {
    return DataStore.getSeasonParticipantPlayers?.(this.teamId)
      || DataStore.getPlayersForActiveSeason?.(this.teamId)
      || DataStore.getTeamPlayers?.(this.teamId)
      || [];
  }

  _selectedPlayer() {
    return this.players.find(player => String(player.id) === String(this.playerId))
      || this.players[0]
      || null;
  }

  _renderStyles() {
    return `
      <style>
        .nutrition-view {
          width:100%;
          max-width:1180px;
          margin:0 auto;
          padding:18px;
          display:grid;
          gap:16px;
          color:#0f172a;
          font-family:var(--font-family-base,system-ui,-apple-system,sans-serif);
          box-sizing:border-box;
        }
        .nutrition-view *{box-sizing:border-box}
        .nutrition-hero{
          padding:20px;
          border-radius:16px;
          background:linear-gradient(135deg,#14532d,#0f766e);
          color:#fff;
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:16px;
        }
        .nutrition-hero h1{margin:0 0 6px;font-size:clamp(22px,4vw,30px)}
        .nutrition-hero p{margin:0;color:#d1fae5;line-height:1.5;max-width:760px}
        .nutrition-context{
          border:1px solid rgba(255,255,255,.28);
          border-radius:999px;
          padding:7px 11px;
          font-size:11px;
          font-weight:900;
          white-space:nowrap;
        }
        .nutrition-selector{
          background:#fff;
          border:1px solid #dbe3ee;
          border-radius:14px;
          padding:14px;
          display:grid;
          grid-template-columns:minmax(0,1fr) auto;
          gap:12px;
          align-items:end;
        }
        .nutrition-selector label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#334155}
        .nutrition-selector select{
          width:100%;
          min-height:44px;
          border:1px solid #cbd5e1;
          border-radius:9px;
          padding:9px 10px;
          background:#fff;
          color:#0f172a;
          font:inherit;
        }
        .nutrition-player360{
          min-height:44px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding:9px 13px;
          border-radius:9px;
          background:#f8fafc;
          border:1px solid #cbd5e1;
          color:#334155;
          text-decoration:none;
          font-size:12px;
          font-weight:800;
        }
        .nutrition-empty,.nutrition-error{
          border-radius:12px;
          padding:16px;
          background:#fff;
          line-height:1.5;
          font-size:13px;
        }
        .nutrition-empty{border:1px dashed #cbd5e1;color:#64748b}
        .nutrition-error{border:1px solid #fecaca;color:#991b1b;background:#fef2f2}
        @media(max-width:640px){
          .nutrition-view{padding:12px;padding-bottom:calc(104px + env(safe-area-inset-bottom,0px))}
          .nutrition-hero{display:grid;border-radius:12px}
          .nutrition-context{justify-self:start;white-space:normal}
          .nutrition-selector{grid-template-columns:1fr}
          .nutrition-player360{width:100%}
        }
      </style>
    `;
  }

  async render(containerId = "dashboard-content-area", playerId = null, teamId = null) {
    this.containerId = containerId;
    this.teamId = teamId || DataStore.getActiveTeamId?.() || null;
    this.teamSeasonId = DataStore.getActiveTeamSeasonId?.(this.teamId) || null;
    this.players = this._resolvePlayers();

    const requestedPlayer = this.players.find(player => String(player.id) === String(playerId));
    this.playerId = requestedPlayer?.id || this.players[0]?.id || null;

    const container = document.getElementById(containerId);
    if (!container) return;

    if (!this.teamSeasonId) {
      container.innerHTML = `
        <section class="nutrition-view">
          ${this._renderStyles()}
          <div class="nutrition-error">Selecciona una temporada activa antes de abrir Nutrición.</div>
        </section>
      `;
      return;
    }

    if (!this.players.length) {
      container.innerHTML = `
        <section class="nutrition-view">
          ${this._renderStyles()}
          <div class="nutrition-empty">No hay jugadores disponibles en la plantilla de esta temporada.</div>
        </section>
      `;
      return;
    }

    const selectedPlayer = this._selectedPlayer();
    this.playerId = selectedPlayer?.id || null;

    if (!this._can(Permission.VIEW_NUTRITION)) {
      container.innerHTML = `
        <section class="nutrition-view">
          ${this._renderStyles()}
          <div class="nutrition-error">Tu perfil no dispone de acceso a datos de nutrición.</div>
        </section>
      `;
      return;
    }

    await this.panel.load({
      teamId: this.teamId,
      teamSeasonId: this.teamSeasonId,
      playerId: this.playerId,
      dateBounds: this._dateBounds()
    });

    const team = DataStore.getTeamById?.(this.teamId) || {};
    const season = DataStore.getActiveSeasonDisplayName?.(this.teamId)
      || this._seasonContext()?.name
      || "";

    container.innerHTML = `
      <section class="nutrition-view">
        ${this._renderStyles()}
        <header class="nutrition-hero">
          <div>
            <h1>🥤 Nutrición</h1>
            <p>
              Seguimiento deportivo no clínico por jugador, integrado con Player 360 y protegido
              mediante permisos RBAC + autorización contextual ABAC.
            </p>
          </div>
          <span class="nutrition-context">
            ${escapeHtml(team.name || "Equipo")}${season ? ` · ${escapeHtml(season)}` : ""}
          </span>
        </header>

        <div class="nutrition-selector">
          <label>
            <span>Jugador</span>
            <select id="nutrition-player-select">
              ${this.players.map(player => `
                <option value="${escapeHtml(player.id)}" ${String(player.id) === String(this.playerId) ? "selected" : ""}>
                  #${escapeHtml(player.jersey ?? player.number ?? "—")} · ${escapeHtml(playerName(player))}
                </option>
              `).join("")}
            </select>
          </label>
          <a class="nutrition-player360" href="#/player360/${encodeURIComponent(String(this.playerId))}">
            Abrir Player 360
          </a>
        </div>

        ${this.panel.isAvailable()
          ? this.panel.render()
          : `<div class="nutrition-error">El servicio de Nutrición no está disponible para este contexto.</div>`}
      </section>
    `;

    container.querySelector("#nutrition-player-select")?.addEventListener("change", event => {
      const nextPlayerId = event.target.value;
      window.location.hash = `#/nutrition/${encodeURIComponent(String(nextPlayerId))}`;
    });

    await this.panel.bind(container, {
      onChanged: async () => {
        await this.render(this.containerId, this.playerId, this.teamId);
      }
    });
  }
}

export default NutritionView;
