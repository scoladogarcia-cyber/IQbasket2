/**
 * @fileoverview Minimal landing for resource-scoped game delegations.
 * @description Reads only the V21 "my delegations" RPC and never widens access
 * to the surrounding team, season, roster or linked-player resources.
 */

import { Permission } from "../../security/permissions.js";
import { GameCaptureDelegationService } from "../../services/games/GameCaptureDelegationService.js";

const CAPABILITY_LABELS = Object.freeze({
  [Permission.RECORD_LIVE_GAME]: "Anotación en vivo",
  [Permission.EDIT_BOXSCORE]: "Editar BoxScore",
  [Permission.PREPARE_GAME]: "Preparar partido",
  [Permission.START_GAME]: "Iniciar partido",
  [Permission.FINISH_GAME]: "Finalizar partido"
});

function esc(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function capabilitiesOf(row = {}) {
  return Array.isArray(row.capabilities)
    ? row.capabilities.map(value => String(value || "").toUpperCase())
    : [];
}

function formatDate(value) {
  if (!value) return "Fecha pendiente";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function playStateOf(row = {}) {
  return String(row.play_state || row.playState || "SCHEDULED").trim().toUpperCase();
}

function statusPresentation({ locked = false, playState = "SCHEDULED" } = {}) {
  if (locked) return { label: "Cerrado", className: "locked" };
  if (playState === "FINISHED") return { label: "Finalizado", className: "finished" };
  if (playState === "LIVE") return { label: "En juego", className: "live" };
  if (playState === "READY") return { label: "Preparado", className: "ready" };
  return { label: "Programado", className: "open" };
}

export class DelegatedGamesView {
  constructor(supabaseClient = null, authController = null) {
    this.auth = authController;
    this.service = new GameCaptureDelegationService(supabaseClient);
    this.delegations = [];
  }

  async load() {
    this.delegations = await this.service.getMyDelegations();
    return this.delegations;
  }

  _card(row = {}) {
    const capabilities = capabilitiesOf(row);
    const gameId = String(row.game_id || row.gameId || "");
    const locked = String(row.edit_state || row.editState || "OPEN").toUpperCase() === "LOCKED";
    const playState = playStateOf(row);
    const captureStateAllowed = ["READY", "LIVE"].includes(playState);
    const canCapture = capabilities.includes(Permission.RECORD_LIVE_GAME) && !locked && captureStateAllowed;
    const canBoxScore = capabilities.includes(Permission.EDIT_BOXSCORE);
    const status = statusPresentation({ locked, playState });
    const labels = capabilities
      .map(capability => CAPABILITY_LABELS[capability] || capability)
      .map(label => `<span class="dg-cap">${esc(label)}</span>`)
      .join("");

    const captureNotice = capabilities.includes(Permission.RECORD_LIVE_GAME) && !canCapture
      ? `<span class="dg-no-action">${playState === "FINISHED"
        ? "La anotación en vivo ya no está disponible porque el partido está finalizado."
        : locked
          ? "La anotación está bloqueada porque el partido está cerrado."
          : "La captura se habilitará cuando el partido esté preparado o en juego."}</span>`
      : "";

    return `
      <article class="dg-card" data-delegated-game-id="${esc(gameId)}">
        <div class="dg-card-top">
          <div>
            <span class="dg-eyebrow">PARTIDO ASIGNADO</span>
            <h2>vs ${esc(row.opponent || "Rival")}</h2>
            <p>${esc(formatDate(row.date))}${row.time ? ` · ${esc(row.time)}` : ""}${row.venue ? ` · ${esc(row.venue)}` : ""}</p>
          </div>
          <span class="dg-status ${status.className}">${esc(status.label)}</span>
        </div>
        <div class="dg-caps">${labels}</div>
        <div class="dg-actions">
          ${canCapture ? `<a href="#/live/${encodeURIComponent(gameId)}" class="dg-primary">⚡ Abrir captura</a>` : ""}
          ${canBoxScore ? `<a href="#/boxscore/${encodeURIComponent(gameId)}" class="dg-secondary">📋 ${locked ? "Ver" : "Editar"} BoxScore</a>` : ""}
          ${captureNotice}
          ${!canCapture && !canBoxScore && !captureNotice ? `<span class="dg-no-action">Las acciones delegadas estarán disponibles dentro del flujo autorizado del partido.</span>` : ""}
        </div>
        ${row.valid_until ? `<small class="dg-expiry">Acceso temporal hasta ${esc(new Date(row.valid_until).toLocaleString())}</small>` : ""}
      </article>`;
  }

  async render(containerId = "dashboard-content-area", preloaded = null) {
    const container = typeof containerId === "string"
      ? document.getElementById(containerId)
      : containerId;
    if (!container) return;

    try {
      this.delegations = Array.isArray(preloaded) ? preloaded : await this.load();
    } catch (error) {
      container.innerHTML = `<section class="delegated-games"><div class="dg-error">No se pudieron cargar tus partidos asignados: ${esc(error.message || error)}</div></section>`;
      return;
    }

    container.innerHTML = `
      <section class="delegated-games">
        <style>
          .delegated-games{max-width:980px;margin:0 auto;padding:18px;display:grid;gap:14px;font-family:var(--font-family-base,system-ui,-apple-system,sans-serif);color:#0f172a;box-sizing:border-box}
          .delegated-games *{box-sizing:border-box}.dg-hero,.dg-card,.dg-empty,.dg-error{background:#fff;border:1px solid #dbe3ee;border-radius:16px;padding:18px}
          .dg-hero{background:linear-gradient(135deg,#1e3a8a,#4338ca);color:#fff;border:0}.dg-hero h1{margin:0 0 6px;font-size:clamp(22px,5vw,30px);color:#fff!important}.dg-hero p{margin:0;line-height:1.5;color:#e0e7ff}
          .dg-info{margin-top:10px;padding:10px 12px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.24);border-radius:10px;font-size:12px;line-height:1.45}
          .dg-list{display:grid;gap:12px}.dg-card-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.dg-eyebrow{font-size:10px;font-weight:900;letter-spacing:.08em;color:#6366f1}.dg-card h2{margin:4px 0;font-size:19px}.dg-card p{margin:0;color:#64748b;font-size:12px}
          .dg-status{border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;white-space:nowrap}.dg-status.open{background:#eef2ff;color:#3730a3}.dg-status.ready{background:#e0f2fe;color:#075985}.dg-status.live{background:#dcfce7;color:#166534}.dg-status.finished{background:#f3f4f6;color:#4b5563}.dg-status.locked{background:#f1f5f9;color:#64748b}
          .dg-caps{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.dg-cap{border-radius:999px;padding:5px 8px;background:#eef2ff;color:#3730a3;font-size:10px;font-weight:800}
          .dg-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;align-items:center}.dg-actions a{min-height:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:9px;padding:9px 13px;text-decoration:none;font-size:12px;font-weight:900}.dg-primary{background:#1e3a8a;color:#fff}.dg-secondary{background:#f8fafc;color:#0f172a;border:1px solid #cbd5e1}.dg-no-action{color:#64748b;font-size:12px;line-height:1.45}
          .dg-expiry{display:block;margin-top:10px;color:#64748b}.dg-empty{color:#64748b;text-align:center;line-height:1.5}.dg-error{border-color:#fecaca;background:#fef2f2;color:#991b1b}
          @media(max-width:640px){.delegated-games{padding:12px;padding-bottom:calc(110px + env(safe-area-inset-bottom,0px))}.dg-card-top{display:grid}.dg-actions{display:grid}.dg-actions a{width:100%}}
        </style>
        <header class="dg-hero">
          <h1>🏀 Mis partidos asignados</h1>
          <p>Aquí sólo aparecen los partidos a los que te han dado acceso temporal.</p>
          <div class="dg-info">La delegación de un partido no vincula jugadores ni abre el equipo completo. Son permisos independientes para proteger los datos de cada jugador.</div>
        </header>
        ${this.delegations.length
          ? `<div class="dg-list">${this.delegations.map(row => this._card(row)).join("")}</div>`
          : `<div class="dg-empty">Ahora mismo no tienes ningún partido delegado activo.</div>`}
      </section>`;
  }
}

export default DelegatedGamesView;