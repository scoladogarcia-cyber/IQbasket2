/**
 * @fileoverview Progressive, accessible editor for a single active roster stint.
 * Keeps the large settings view unchanged; backend permission and history checks
 * remain authoritative in iq_v3_update_roster_start.
 */
import { DataStore } from "../../services/DataStore.js";
import { supabase } from "../../config/database.config.js";
import { Permission } from "../../security/PermissionService.js";
import { RosterEligibilityDateService } from "../../services/roster/RosterEligibilityDateService.js";

const service = new RosterEligibilityDateService(supabase);
const dateOnly = value => String(value || "").slice(0, 10);

/** Decorate only the active, season-scoped roster cards when write access exists. */
export function enhanceRosterEligibilityDates(root = document) {
  const buttons = root.querySelectorAll(".btn-edit-player-modal[data-id]");
  if (!buttons.length) return;
  const teamId = DataStore.getActiveTeamId?.();
  const teamSeasonId = DataStore.getActiveTeamSeasonId?.(teamId);
  const season = DataStore.getActiveSeasonContext?.(teamId);
  if (!teamId || !teamSeasonId || !season) return;
  if (!DataStore.permissionService?.can?.(Permission.MANAGE_ROSTER, {
    teamId, teamSeasonId
  })) return;

  buttons.forEach(editButton => {
    const actions = editButton.parentElement;
    const card = editButton.closest(".player-card");
    const playerId = editButton.getAttribute("data-id");
    if (!actions || !card || !playerId || card.dataset.eligibilityEditorAttached === "true") return;
    const membership = (DataStore.rosterMemberships || []).find(row =>
      String(row.player_id || row.playerId) === String(playerId)
      && String(row.team_season_id || row.teamSeasonId) === String(teamSeasonId)
    );
    if (!membership || !["ACTIVE", "ACTIVO"].includes(String(membership.status).toUpperCase())) return;
    const stints = (DataStore.rosterStints || []).filter(row =>
      String(row.roster_membership_id || row.rosterMembershipId) === String(membership.id)
    );
    if (stints.length !== 1 || stints[0].valid_until) return;
    card.dataset.eligibilityEditorAttached = "true";

    const changeButton = document.createElement("button");
    changeButton.type = "button";
    changeButton.className = "btn-outline-sm";
    changeButton.textContent = "📅 Cambiar fecha";
    changeButton.setAttribute("aria-label", "Modificar el primer día elegible en la temporada activa");
    actions.insertBefore(changeButton, editButton.nextSibling);

    changeButton.addEventListener("click", () => {
      const prior = root.querySelector("[data-roster-date-editor]");
      if (prior) prior.remove();
      const form = document.createElement("form");
      form.dataset.rosterDateEditor = "true";
      form.style.cssText = "display:flex;flex-wrap:wrap;align-items:end;gap:8px;flex:1 0 100%;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;box-sizing:border-box;";
      const field = document.createElement("label");
      field.style.cssText = "display:flex;flex-direction:column;gap:4px;flex:1 1 170px;font-size:12px;font-weight:700;color:#334155;";
      field.textContent = "Primer día elegible en esta temporada";
      const input = document.createElement("input");
      input.type = "date";
      input.required = true;
      input.value = dateOnly(stints[0].valid_from);
      const start = dateOnly(season.start_date || season.startDate);
      const end = dateOnly(season.end_date || season.endDate);
      if (start) input.min = start;
      if (end) input.max = end;
      input.style.cssText = "min-height:44px;min-width:0;padding:8px;border:1px solid #94a3b8;border-radius:6px;box-sizing:border-box;";
      field.appendChild(input);
      const save = document.createElement("button");
      save.type = "submit";
      save.className = "btn-primary";
      save.textContent = "Guardar fecha";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn-outline-sm";
      cancel.textContent = "Cancelar";
      cancel.addEventListener("click", () => form.remove());
      const feedback = document.createElement("div");
      feedback.setAttribute("role", "alert");
      feedback.style.cssText = "flex:1 0 100%;font-size:12px;color:#b91c1c;";
      form.append(field, save, cancel, feedback);
      card.appendChild(form);
      input.focus();

      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!input.reportValidity()) return;
        save.disabled = true;
        feedback.textContent = "";
        try {
          // The server checks RBAC, freeze state, bounds and historic participation.
          await service.updateStart({ teamSeasonId, playerId, newStart: input.value });
          feedback.style.color = "#166534";
          feedback.textContent = "Fecha guardada. Actualizando plantilla…";
          window.location.reload();
        } catch (error) {
          feedback.textContent = `No se pudo cambiar la fecha: ${error?.message || "Error de servidor"}`;
          save.disabled = false;
        }
      });
    });
  });
}

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      enhanceRosterEligibilityDates();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  enhanceRosterEligibilityDates();
}
