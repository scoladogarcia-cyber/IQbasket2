/**
 * @fileoverview Player-only micro-challenge and process gamification surface.
 * @description Renders only on the authenticated JUGADOR's own player profile.
 * All state comes from action-specific backend RPCs through PlayerJourneyService.
 */

import { DataStore } from "../../services/DataStore.js";
import { supabase } from "../../config/database.config.js";
import { UserRole } from "../../security/roles.js";
import { PlayerJourneyService } from "../../services/player360/PlayerJourneyService.js";
import { PLAYER_JOURNEY_STAGE_LABEL } from "../../config/player-journey.config.js";

const ROOT_ID = "player-journey-v1";
const service = new PlayerJourneyService(supabase);
let pendingKey = "";

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function routePlayerId() {
  const match = String(window.location.hash || "").match(/^#\/(?:player|jugador)\/([0-9a-f-]{36})(?:$|[/?])/i);
  return match?.[1] || null;
}

function playerSelfContext() {
  const permissions = DataStore.permissionService;
  const user = permissions?.getCurrentUser?.() || null;
  if (!user || permissions?.getAuthenticatedRole?.() !== UserRole.JUGADOR) return null;

  const playerId = routePlayerId();
  if (!playerId || String(user.playerId || "") !== String(playerId)) return null;

  const teamId = DataStore.getActiveTeamId?.() || null;
  const teamSeasonId = DataStore.getActiveTeamSeasonId?.(teamId) || null;
  if (!teamId || !teamSeasonId) return null;
  return { playerId, teamId, teamSeasonId };
}

function safeVibrate(pattern = 10) {
  try {
    if (typeof navigator?.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    // Optional enhancement only.
  }
}

function badgeMarkup(badges = []) {
  if (!badges.length) {
    return '<p class="player-journey-muted">Tus hitos aparecerán aquí a medida que completes ciclos semanales. No hay rankings ni comparación con otros jugadores.</p>';
  }
  return `<div class="player-journey-badges">${badges.map(badge => `
    <article class="player-journey-badge">
      <span aria-hidden="true">◆</span>
      <div><strong>${escapeHtml(badge.label)}</strong><small>${escapeHtml(badge.description)}</small></div>
    </article>
  `).join("")}</div>`;
}

function activeMarkup(active) {
  if (!active) return "";
  return `
    <article class="player-journey-active">
      <div class="player-journey-active-head">
        <div><span>Micro-reto de la semana</span><h3>${escapeHtml(active.title)}</h3></div>
        <span class="player-journey-week">hasta ${escapeHtml(active.ends_on)}</span>
      </div>
      <p>${escapeHtml(active.description)}</p>
      <div class="player-journey-criterion"><strong>Para cerrarlo</strong><span>${escapeHtml(active.success_criterion)}</span></div>
      <button type="button" class="player-journey-complete" data-player-journey-complete="${escapeHtml(active.id)}">✓ Marcar reflexión completada</button>
      <small>Completar un reto registra tu proceso; no significa que una habilidad esté dominada.</small>
    </article>
  `;
}

function catalogMarkup(catalog = []) {
  if (!catalog.length) return '<p class="player-journey-muted">No hay micro-retos disponibles ahora mismo.</p>';
  return `
    <div class="player-journey-catalog" role="list">
      ${catalog.map(item => `
        <article class="player-journey-choice" role="listitem">
          <div><span>${item.category === "TACTICAL" ? "Lectura de juego" : "Técnica"}</span><h3>${escapeHtml(item.title)}</h3></div>
          <p>${escapeHtml(item.description)}</p>
          <small>${escapeHtml(item.success_criterion)}</small>
          <button type="button" data-player-journey-start="${escapeHtml(item.code)}">Elegir este reto</button>
        </article>
      `).join("")}
    </div>
  `;
}

function historyMarkup(history = []) {
  if (!history.length) return "";
  return `
    <details class="player-journey-history">
      <summary>Retos anteriores (${history.length})</summary>
      <div>${history.map(item => `
        <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(String(item.completed_at || "").slice(0,10))}</small></span>
      `).join("")}</div>
    </details>
  `;
}

function renderPanel(snapshot = {}) {
  const active = snapshot.active_challenge || null;
  const stage = PLAYER_JOURNEY_STAGE_LABEL[snapshot.stage] || "Tu proceso de mejora";
  return `
    <section id="${ROOT_ID}" class="player-journey" aria-labelledby="player-journey-title">
      <header class="player-journey-hero">
        <div>
          <p>MI CAMINO · SOLO PARA TI</p>
          <h2 id="player-journey-title">${escapeHtml(stage)}</h2>
          <span>${Number(snapshot.completed_count || 0)} micro-retos completados</span>
        </div>
        <div class="player-journey-safety" title="Sin rankings, rachas de login ni datos de salud">Progreso personal</div>
      </header>

      ${active ? activeMarkup(active) : `
        <article class="player-journey-intro">
          <div><strong>Elige un único foco para esta semana</strong><p>Un reto pequeño, observable y conectado con situaciones reales de baloncesto.</p></div>
          <span>1 por semana</span>
        </article>
        ${catalogMarkup(snapshot.catalog || [])}
      `}

      <section class="player-journey-milestones" aria-label="Hitos personales">
        <div class="player-journey-section-title"><strong>Hitos de proceso</strong><span>Sin puntos ni clasificación</span></div>
        ${badgeMarkup(snapshot.badges || [])}
      </section>

      ${historyMarkup(snapshot.history || [])}
      <p class="player-journey-disclaimer">Este espacio reconoce constancia y reflexión. No usa Wellness, datos de salud, comparaciones sociales ni afirma dominio técnico por completar un reto.</p>
    </section>
  `;
}

function setStatus(root, message, type = "info") {
  let status = root.querySelector("[data-player-journey-status]");
  if (!status) {
    status = document.createElement("div");
    status.dataset.playerJourneyStatus = "true";
    status.className = "player-journey-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    root.prepend(status);
  }
  status.dataset.type = type;
  status.textContent = message;
}

async function refresh(context, { force = false } = {}) {
  const host = document.getElementById("dashboard-content-area");
  if (!host?.isConnected) return;
  const key = `${context.teamSeasonId}:${context.playerId}`;
  if (!force && (pendingKey === key || document.getElementById(ROOT_ID))) return;
  pendingKey = key;

  try {
    const snapshot = await service.snapshot(context);
    document.getElementById(ROOT_ID)?.remove();
    host.insertAdjacentHTML("beforeend", renderPanel(snapshot));
    bindPanel(context);
  } catch (error) {
    // Before the migration is deployed or when the backend denies access, the
    // base player profile must remain fully usable and leak no backend detail.
    console.debug("[PlayerJourney] Surface unavailable:", error?.message || error);
  } finally {
    pendingKey = "";
  }
}

function bindPanel(context) {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  root.querySelectorAll("[data-player-journey-start]").forEach(button => {
    button.addEventListener("click", async () => {
      const code = button.dataset.playerJourneyStart;
      if (!confirm("Este será tu único micro-reto nuevo de esta semana. ¿Quieres empezar con este foco?")) return;
      button.disabled = true;
      setStatus(root, "Guardando tu reto…");
      try {
        await service.start({ ...context, challengeCode: code });
        safeVibrate([10,20,10]);
        root.remove();
        await refresh(context, { force: true });
      } catch (error) {
        setStatus(root, error?.message || "No se ha podido iniciar el reto.", "error");
        button.disabled = false;
      }
    });
  });

  root.querySelector("[data-player-journey-complete]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    if (!confirm("¿Has realizado la observación y reflexión que propone el reto?")) return;
    button.disabled = true;
    setStatus(root, "Registrando el reto como completado…");
    try {
      await service.complete(button.dataset.playerJourneyComplete);
      safeVibrate([15,25,15]);
      root.remove();
      await refresh(context, { force: true });
    } catch (error) {
      setStatus(root, error?.message || "No se ha podido completar el reto.", "error");
      button.disabled = false;
    }
  });
}

function enhancePlayerProfile() {
  const context = playerSelfContext();
  if (!context) {
    document.getElementById(ROOT_ID)?.remove();
    return;
  }
  void refresh(context);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("hashchange", () => queueMicrotask(enhancePlayerProfile));
  const start = () => {
    enhancePlayerProfile();
    const observer = new MutationObserver(() => enhancePlayerProfile());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
}

export { playerSelfContext, renderPanel, enhancePlayerProfile };
