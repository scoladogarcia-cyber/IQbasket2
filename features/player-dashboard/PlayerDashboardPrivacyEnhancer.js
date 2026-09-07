/**
 * @fileoverview Progressive JUGADOR teammate identity presentation policy.
 * @description The V34 backend defines the maximum teammate identity visible to
 * a player. The player may locally choose an even stricter positions-only mode.
 * This module changes presentation only and never grants sporting access.
 */
import { DataStore } from "../../services/DataStore.js";
import { supabase } from "../../config/database.config.js";
import { PlayerIdentityPreferenceService } from "../../services/player/PlayerIdentityPreferenceService.js";

const MODE_IDENTIFIED = "IDENTIFIED";
const MODE_POSITIONS = "POSITIONS_ONLY";
const STORAGE_PREFIX = "iq_player_dashboard_peer_identity_v1";
const service = new PlayerIdentityPreferenceService(supabase);
let policyState = { key: "", loading: false, loaded: false, showNames: true, showJerseys: true };

function app() {
  return window.iqApp || null;
}

function controller() {
  return app()?.permissionService || app()?.authController || null;
}

function isPlayerRole() {
  return String(controller()?.getAuthenticatedRole?.() || "").toUpperCase() === "JUGADOR";
}

function currentUser() {
  return controller()?.getCurrentUser?.() || null;
}

function currentTeamSeasonId() {
  const teamId = DataStore.getActiveTeamId?.() || null;
  return teamId
    ? (DataStore.getActiveTeamSeasonId?.(teamId) || null)
    : null;
}

function ownPlayerId() {
  const user = currentUser();
  return String(user?.playerId || user?.player_id || user?.linked_player_id || user?.linkedPlayerIds?.[0] || "");
}

function ownPlayer() {
  const id = ownPlayerId();
  return id ? DataStore.getPlayerById?.(id) || null : null;
}

function normalize(value = "") {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function preferenceKey() {
  const user = currentUser();
  const teamId = DataStore.getActiveTeamId?.() || "team";
  const teamSeasonId = currentTeamSeasonId() || DataStore.getActiveSeason?.() || "season";
  return `${STORAGE_PREFIX}:${user?.id || user?.email || "player"}:${teamId}:${teamSeasonId}`;
}

function getMode() {
  return localStorage.getItem(preferenceKey()) === MODE_POSITIONS ? MODE_POSITIONS : MODE_IDENTIFIED;
}

function setMode(mode) {
  localStorage.setItem(preferenceKey(), mode === MODE_POSITIONS ? MODE_POSITIONS : MODE_IDENTIFIED);
}

function policyKey() {
  return `${currentUser()?.id || currentUser()?.email || "player"}:${currentTeamSeasonId() || "none"}`;
}

async function ensurePolicy() {
  if (!isPlayerRole()) return;
  const key = policyKey();
  if (policyState.key === key && (policyState.loaded || policyState.loading)) return;
  policyState = { key, loading: true, loaded: false, showNames: true, showJerseys: true };
  try {
    const config = await service.getMyConfig({ teamSeasonId: currentTeamSeasonId() });
    policyState = {
      key,
      loading: false,
      loaded: true,
      showNames: config.showOtherPlayerNames,
      showJerseys: config.showOtherPlayerJerseys
    };
  } catch (error) {
    // Backward-compatible rollout: missing V34 leaves the pre-V34 identified mode.
    policyState = { key, loading: false, loaded: true, showNames: true, showJerseys: true };
    const message = String(error?.message || "");
    if (!message.includes("iq_v34_") && error?.code !== "PGRST202") {
      console.warn("[PlayerDashboardPrivacyEnhancer]", error);
    }
  }
  scan();
}

function effectivePolicy() {
  if (getMode() === MODE_POSITIONS) return { showNames: false, showJerseys: false };
  return { showNames: policyState.showNames !== false, showJerseys: policyState.showJerseys !== false };
}

function ownIdentityTokens() {
  const player = ownPlayer();
  if (!player) return [];
  const fullName = [player.first_name || player.firstName, player.last_name || player.lastName].filter(Boolean).join(" ");
  return [fullName].map(normalize).filter(Boolean);
}

function isOwnLeader(nameText, tokens) {
  const text = normalize(nameText);
  return tokens.some(token => token && text.includes(token));
}

function jerseyToken(text = "") {
  return String(text).match(/#\s*\d+/)?.[0]?.replace(/\s+/g, "") || "#-";
}

function withoutJersey(text = "") {
  return String(text).replace(/^\s*#\s*\d+\s*[·\-]?\s*/u, "").trim();
}

function remember(node, key, value = null) {
  if (!node) return;
  const datasetKey = `peerOriginal${key}`;
  if (node.dataset[datasetKey] === undefined) node.dataset[datasetKey] = value ?? node.textContent ?? "";
}

function applyLeaderPolicy(root) {
  const ownTokens = ownIdentityTokens();
  const policy = effectivePolicy();
  root.querySelectorAll(".purple-leader-col").forEach(column => {
    const name = column.querySelector(".leader-player-name");
    const meta = column.querySelector(".leader-player-meta");
    if (!name || !meta) return;
    remember(name, "Name");
    remember(meta, "Meta");
    const originalName = name.dataset.peerOriginalName || "";
    const originalMeta = meta.dataset.peerOriginalMeta || "";
    name.textContent = originalName;
    meta.textContent = originalMeta;
    if (isOwnLeader(originalName, ownTokens)) return;

    const position = String(originalMeta).split("·")[0]?.trim() || "Posición";
    const remainder = String(originalMeta).split("·").slice(1).join("·").trim();
    if (policy.showNames && policy.showJerseys) return;
    if (policy.showNames) name.textContent = withoutJersey(originalName) || "Compañero";
    else if (policy.showJerseys) name.textContent = jerseyToken(originalName);
    else name.textContent = position;
    meta.textContent = remainder || position;
  });
}

function playerIdFromOnclick(node) {
  const raw = node?.dataset.peerOriginalOnclick ?? node?.getAttribute?.("onclick") ?? "";
  return String(raw).match(/#\/player\/([^'"\s)]+)/)?.[1] || "";
}

function rememberOnclick(node) {
  if (!node || node.dataset.peerOriginalOnclick !== undefined) return;
  node.dataset.peerOriginalOnclick = node.getAttribute("onclick") || "";
}

function setNavigation(node, enabled) {
  rememberOnclick(node);
  if (enabled && node.dataset.peerOriginalOnclick) node.setAttribute("onclick", node.dataset.peerOriginalOnclick);
  else node.removeAttribute("onclick");
  node.style.cursor = enabled ? "pointer" : "default";
}

function applyDesktopRosterRow(row, policy) {
  const playerId = playerIdFromOnclick(row);
  if (!playerId || playerId === ownPlayerId()) return;
  const cells = row.querySelectorAll("td");
  if (cells.length < 3) return;
  const jerseyCell = cells[0];
  const nameCell = cells[1];
  const position = String(cells[2]?.textContent || "Posición").trim();
  const name = nameCell.querySelector("span") || nameCell;
  const avatar = nameCell.querySelector("img") || nameCell.querySelector("div");
  remember(jerseyCell, "Jersey");
  remember(name, "Name");
  remember(avatar, "Avatar");

  jerseyCell.textContent = policy.showJerseys ? jerseyCell.dataset.peerOriginalJersey : "#-";
  name.textContent = policy.showNames ? name.dataset.peerOriginalName : position;
  if (avatar) {
    if (avatar.tagName === "IMG") avatar.style.visibility = policy.showNames ? "visible" : "hidden";
    else avatar.textContent = policy.showJerseys ? (avatar.dataset.peerOriginalAvatar || "#-") : "#-";
  }
  setNavigation(row, policy.showNames && policy.showJerseys);
}

function applyMobileRosterCard(card, policy) {
  const playerId = playerIdFromOnclick(card);
  if (!playerId || playerId === ownPlayerId()) return;
  const name = card.querySelector("strong");
  const meta = name?.parentElement?.querySelector("span");
  const avatar = card.querySelector("img") || card.querySelector(":scope > div > div");
  if (!name || !meta) return;
  remember(name, "Name");
  remember(meta, "Meta");
  remember(avatar, "Avatar");
  const originalMeta = meta.dataset.peerOriginalMeta || "";
  const parts = originalMeta.split("·");
  const originalJersey = parts[0]?.trim() || "#-";
  const position = parts.slice(1).join("·").trim() || "Posición";

  name.textContent = policy.showNames ? name.dataset.peerOriginalName : position;
  meta.textContent = `${policy.showJerseys ? originalJersey : "#-"} · ${position}`;
  if (avatar) {
    if (avatar.tagName === "IMG") avatar.style.visibility = policy.showNames ? "visible" : "hidden";
    else avatar.textContent = policy.showJerseys ? (avatar.dataset.peerOriginalAvatar || originalJersey) : "#-";
  }
  setNavigation(card, policy.showNames && policy.showJerseys);
}

function applyTeamRosterPolicy() {
  const policy = effectivePolicy();
  document.querySelectorAll("#roster-table-body tr").forEach(row => applyDesktopRosterRow(row, policy));
  document.querySelectorAll(".team-player-mobile-card").forEach(card => applyMobileRosterCard(card, policy));
}

function button(label, mode, active, disabled = false) {
  return `<button type="button" data-peer-mode="${mode}" aria-pressed="${active ? "true" : "false"}" ${disabled ? "disabled" : ""} style="min-height:38px;border:1px solid ${active ? "#2563eb" : "#cbd5e1"};border-radius:8px;background:${active ? "#eff6ff" : "#fff"};color:${active ? "#1d4ed8" : "#475569"};padding:7px 10px;font-size:11px;font-weight:800;cursor:${disabled ? "not-allowed" : "pointer"};opacity:${disabled ? ".55" : "1"};">${label}</button>`;
}

function enhanceDashboard(root) {
  if (!isPlayerRole()) return;
  let panel = root.querySelector(":scope > .player-peer-identity-control");
  const top = root.querySelector(".dash-top-bar") || root.firstElementChild;
  if (!top) return;
  if (!panel) {
    panel = document.createElement("section");
    panel.className = "player-peer-identity-control";
    panel.setAttribute("aria-label", "Visibilidad de compañeros en Dashboard");
    panel.style.cssText = "width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;margin:0 0 14px;border:1px solid #dbeafe;border-radius:11px;background:#f8fbff;box-sizing:border-box;";
    top.insertAdjacentElement("afterend", panel);
  }

  const localMode = getMode();
  const adminRestricted = policyState.showNames === false || policyState.showJerseys === false;
  panel.innerHTML = `<div><strong style="display:block;color:#0f172a;font-size:12px;">🏀 Visión global del equipo</strong><span style="display:block;margin-top:2px;color:#64748b;font-size:10px;line-height:1.35;">Tu identidad siempre permanece visible. Puedes ocultar más información, pero nunca superar la visibilidad definida por el club.${adminRestricted ? " El club ha limitado parte de la identidad de tus compañeros." : ""}</span></div><div style="display:flex;gap:6px;flex-wrap:wrap;">${button("Máxima permitida", MODE_IDENTIFIED, localMode === MODE_IDENTIFIED)}${button("Solo posiciones", MODE_POSITIONS, localMode === MODE_POSITIONS)}</div>`;
  panel.querySelectorAll("[data-peer-mode]").forEach(control => {
    control.addEventListener("click", () => {
      setMode(control.dataset.peerMode);
      scan();
    });
  });
  applyLeaderPolicy(root);
}

function scan() {
  if (!isPlayerRole()) return;
  void ensurePolicy();
  document.querySelectorAll(".clean-dashboard-wrapper").forEach(enhanceDashboard);
  applyTeamRosterPolicy();
}

const observer = new MutationObserver(() => queueMicrotask(scan));
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", scan, { once: true });
scan();
