/**
 * @fileoverview Progressive admin controls for JUGADOR teammate identity.
 * @description Keeps TranslationsView decoupled: the modal is enhanced only for
 * JUGADOR profiles and all reads/writes are validated by the V34 backend.
 */
import { DataStore } from "../../services/DataStore.js";
import { supabase } from "../../config/database.config.js";
import { PlayerIdentityPreferenceService } from "../../services/player/PlayerIdentityPreferenceService.js";

const service = new PlayerIdentityPreferenceService(supabase);
const busy = new WeakSet();

function activeTeamSeasonId() {
  const teamId = DataStore.getActiveTeamId?.() || null;
  return teamId ? (DataStore.getActiveTeamSeasonId?.(teamId) || null) : null;
}

function targetEmail(root) {
  return [...root.querySelectorAll("p")]
    .map(node => String(node.textContent || "").trim())
    .find(text => text.includes("@")) || "";
}

function isPlayerCard(root) {
  return String(root.querySelector(".badge-active-team")?.textContent || "").trim().toUpperCase() === "JUGADOR";
}

function styles() {
  return `<style>
    .player-profile-privacy-v34{background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:14px;display:grid;gap:10px;color:#334155}
    .player-profile-privacy-v34 h5{margin:0;color:#1e3a8a;font-size:13px}.player-profile-privacy-v34 p{margin:2px 0 0;color:#64748b;font-size:11px;line-height:1.4}
    .player-profile-privacy-toggle{display:flex;align-items:flex-start;gap:9px;font-size:12px;font-weight:750}.player-profile-privacy-toggle input{width:19px;height:19px;flex:0 0 auto}
    .player-profile-privacy-toggle small{display:block;color:#64748b;font-weight:500;margin-top:2px}.player-profile-privacy-actions{display:flex;justify-content:flex-end}
    .player-profile-privacy-save{min-height:44px;border:0;border-radius:9px;background:#1e3a8a;color:white;font-weight:900;padding:9px 14px}.player-profile-privacy-save:disabled{opacity:.55}
    .player-profile-privacy-status{min-height:16px;font-size:11px}.player-profile-privacy-status.ok{color:#166534}.player-profile-privacy-status.error{color:#991b1b}
    @media(max-width:640px){.player-profile-privacy-actions{display:grid}.player-profile-privacy-save{width:100%}}
  </style>`;
}

async function enhance(root) {
  if (!root || root.dataset.playerPrivacyV34 === "ready" || busy.has(root) || !isPlayerCard(root)) return;
  const email = targetEmail(root);
  const teamSeasonId = activeTeamSeasonId();
  if (!email || !teamSeasonId) return;

  busy.add(root);
  try {
    const config = await service.getAdminConfig({ email, teamSeasonId });
    if (!root.isConnected || !isPlayerCard(root) || targetEmail(root) !== email) return;

    root.dataset.playerPrivacyV34 = "ready";
    const section = document.createElement("section");
    section.className = "player-profile-privacy-v34";
    section.setAttribute("data-player-profile-privacy-v34", "");
    section.innerHTML = `${styles()}
      <div><h5>👤 VISIBILIDAD DE COMPAÑEROS · JUGADOR</h5>
        <p>Define el máximo de identidad que este jugador puede ver. Su propia identidad siempre permanece visible.</p></div>
      <label class="player-profile-privacy-toggle">
        <input type="checkbox" data-player-show-names ${config.showOtherPlayerNames ? "checked" : ""}>
        <span>Mostrar nombres de otros jugadores<small>Si se desactiva, los compañeros se presentan por posición.</small></span>
      </label>
      <label class="player-profile-privacy-toggle">
        <input type="checkbox" data-player-show-jerseys ${config.showOtherPlayerJerseys ? "checked" : ""}>
        <span>Mostrar dorsales de otros jugadores<small>El jugador puede ocultar todavía más desde su vista, pero nunca superar este límite.</small></span>
      </label>
      <div class="player-profile-privacy-status" role="status" aria-live="polite"></div>
      <div class="player-profile-privacy-actions"><button type="button" class="player-profile-privacy-save">💾 Guardar privacidad Jugador</button></div>`;

    const firstCard = root.firstElementChild;
    firstCard?.insertAdjacentElement("afterend", section);

    const button = section.querySelector(".player-profile-privacy-save");
    const status = section.querySelector(".player-profile-privacy-status");
    button?.addEventListener("click", async () => {
      button.disabled = true;
      status.className = "player-profile-privacy-status";
      status.textContent = "Guardando…";
      try {
        await service.saveAdminConfig({
          email,
          teamSeasonId,
          showOtherPlayerNames: Boolean(section.querySelector("[data-player-show-names]")?.checked),
          showOtherPlayerJerseys: Boolean(section.querySelector("[data-player-show-jerseys]")?.checked)
        });
        status.className = "player-profile-privacy-status ok";
        status.textContent = "✅ Privacidad de Jugador actualizada.";
      } catch (error) {
        status.className = "player-profile-privacy-status error";
        status.textContent = `❌ ${error?.message || error}`;
      } finally {
        button.disabled = false;
      }
    });
  } catch (error) {
    // Progressive enhancement: do not break the existing user-card modal if the
    // V34 backend has not reached this environment yet.
    if (!String(error?.message || "").includes("iq_v34_")) {
      console.warn("[PlayerProfilePrivacyAdminEnhancer]", error);
    }
  } finally {
    busy.delete(root);
  }
}

function scan() {
  const modal = document.getElementById("modal-user-card");
  if (!modal || getComputedStyle(modal).display === "none") return;
  const root = modal.querySelector("#user-card-modal-content");
  if (root) void enhance(root);
}

const observer = new MutationObserver(() => queueMicrotask(scan));
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
document.addEventListener("DOMContentLoaded", scan, { once: true });
scan();
