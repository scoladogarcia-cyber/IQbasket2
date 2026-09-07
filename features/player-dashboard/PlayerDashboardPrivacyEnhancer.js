/**
 * @fileoverview Progressive UX policy for JUGADOR dashboard teammate identity.
 * @description The player already has team-read permission. This module only
 * changes presentation: identified teammates vs positions-only. It never grants
 * access, changes backend data, or alters Family's server-side privacy policy.
 */
import { DataStore } from "../../services/DataStore.js";

const MODE_IDENTIFIED = "IDENTIFIED";
const MODE_POSITIONS = "POSITIONS_ONLY";
const STORAGE_PREFIX = "iq_player_dashboard_peer_identity_v1";

function app() {
  return window.iqApp || null;
}

function isPlayerRole() {
  const controller = app()?.permissionService || app()?.authController || null;
  return String(controller?.getAuthenticatedRole?.() || "").toUpperCase() === "JUGADOR";
}

function currentUser() {
  const controller = app()?.permissionService || app()?.authController || null;
  return controller?.getCurrentUser?.() || null;
}

function ownPlayer() {
  const user = currentUser();
  const id = user?.playerId || user?.player_id || user?.linked_player_id || user?.linkedPlayerIds?.[0] || null;
  return id ? DataStore.getPlayerById?.(id) || null : null;
}

function normalize(value = "") {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function preferenceKey() {
  const user = currentUser();
  const teamId = DataStore.getActiveTeamId?.() || "team";
  const teamSeasonId = DataStore.getActiveTeamSeasonId?.(teamId) || DataStore.getActiveSeason?.() || "season";
  return `${STORAGE_PREFIX}:${user?.id || user?.email || "player"}:${teamId}:${teamSeasonId}`;
}

function getMode() {
  return localStorage.getItem(preferenceKey()) === MODE_POSITIONS ? MODE_POSITIONS : MODE_IDENTIFIED;
}

function setMode(mode) {
  localStorage.setItem(preferenceKey(), mode === MODE_POSITIONS ? MODE_POSITIONS : MODE_IDENTIFIED);
}

function ownIdentityTokens() {
  const player = ownPlayer();
  if (!player) return [];
  const fullName = [player.first_name || player.firstName, player.last_name || player.lastName].filter(Boolean).join(" ");
  const jersey = player.jersey ?? player.number ?? null;
  return [fullName, jersey !== null ? `#${jersey}` : ""].map(normalize).filter(Boolean);
}

function isOwnLeader(nameText, tokens) {
  const text = normalize(nameText);
  const nameToken = tokens.find(token => token && !token.startsWith("#"));
  return Boolean(nameToken && text.includes(nameToken));
}

function restoreLeader(column) {
  const name = column.querySelector(".leader-player-name");
  const meta = column.querySelector(".leader-player-meta");
  if (name?.dataset.peerOriginalName !== undefined) name.textContent = name.dataset.peerOriginalName;
  if (meta?.dataset.peerOriginalMeta !== undefined) meta.textContent = meta.dataset.peerOriginalMeta;
}

function applyIdentityMode(root, mode) {
  const ownTokens = ownIdentityTokens();
  root.querySelectorAll(".purple-leader-col").forEach(column => {
    const name = column.querySelector(".leader-player-name");
    const meta = column.querySelector(".leader-player-meta");
    if (!name || !meta) return;

    if (name.dataset.peerOriginalName === undefined) name.dataset.peerOriginalName = name.textContent || "";
    if (meta.dataset.peerOriginalMeta === undefined) meta.dataset.peerOriginalMeta = meta.textContent || "";

    restoreLeader(column);
    if (mode !== MODE_POSITIONS || isOwnLeader(name.dataset.peerOriginalName, ownTokens)) return;

    const originalMeta = String(meta.dataset.peerOriginalMeta || "");
    const [positionRaw, ...rest] = originalMeta.split("·");
    const position = positionRaw.trim() || "Posición";
    name.textContent = position;
    meta.textContent = rest.join("·").trim() || "Compañero";
  });
}

function button(label, mode, active) {
  return `<button type="button" data-peer-mode="${mode}" aria-pressed="${active ? "true" : "false"}" style="min-height:38px;border:1px solid ${active ? "#2563eb" : "#cbd5e1"};border-radius:8px;background:${active ? "#eff6ff" : "#fff"};color:${active ? "#1d4ed8" : "#475569"};padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer;">${label}</button>`;
}

function enhanceDashboard(root) {
  if (!isPlayerRole() || root.dataset.playerPeerPrivacyReady === "true") return;
  root.dataset.playerPeerPrivacyReady = "true";

  const top = root.querySelector(".dash-top-bar") || root.firstElementChild;
  if (!top) return;

  const panel = document.createElement("section");
  panel.className = "player-peer-identity-control";
  panel.setAttribute("aria-label", "Visibilidad de compañeros en Dashboard");
  panel.style.cssText = "width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;margin:0 0 14px;border:1px solid #dbeafe;border-radius:11px;background:#f8fbff;box-sizing:border-box;";

  const renderControl = () => {
    const mode = getMode();
    panel.innerHTML = `<div><strong style="display:block;color:#0f172a;font-size:12px;">🏀 Visión global del equipo</strong><span style="display:block;margin-top:2px;color:#64748b;font-size:10px;line-height:1.35;">Elige cómo quieres identificar al resto de compañeros en este Dashboard. Tu propio jugador permanece identificado.</span></div><div style="display:flex;gap:6px;flex-wrap:wrap;">${button("Nombres y dorsales", MODE_IDENTIFIED, mode === MODE_IDENTIFIED)}${button("Solo posiciones", MODE_POSITIONS, mode === MODE_POSITIONS)}</div>`;
    applyIdentityMode(root, mode);
    panel.querySelectorAll("[data-peer-mode]").forEach(control => {
      control.addEventListener("click", () => {
        setMode(control.dataset.peerMode);
        renderControl();
      });
    });
  };

  top.insertAdjacentElement("afterend", panel);
  renderControl();
}

function scan() {
  if (!isPlayerRole()) return;
  document.querySelectorAll(".clean-dashboard-wrapper").forEach(enhanceDashboard);
}

const observer = new MutationObserver(() => queueMicrotask(scan));
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", scan, { once: true });
scan();
