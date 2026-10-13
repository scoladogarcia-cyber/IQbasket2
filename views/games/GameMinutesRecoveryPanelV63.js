/**
 * @fileoverview Safe minutes-only recovery UI for an existing game.
 * @description Mounted from BoxScore. It never edits normal statistics or PBP.
 * Direct mode validates the team-minute invariant; lineup mode reconstructs
 * minutes from complete five-player stints before calling the isolated V63 RPC.
 */
import { GameMinutesRecoveryService } from "../../services/games/GameMinutesRecoveryService.js";
import {
  actualPeriodCount,
  buildMinutesFromSegments,
  expectedTeamMinutes,
  formatClock,
  periodDurationSeconds,
  validateDirectMinutes
} from "../../domain/games/GameMinutesRecovery.js";

const esc = value => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const playerName = player => {
  const jersey = player.jersey ?? player.number;
  const name = [player.first_name ?? player.firstName, player.last_name ?? player.lastName].filter(Boolean).join(" ");
  return `${jersey !== undefined && jersey !== null ? `#${jersey} · ` : ""}${name || "Jugador"}`;
};

const parseStarterIds = game => {
  let ids = game?.starter_ids ?? game?.starterIds ?? [];
  if (typeof ids === "string") {
    try { ids = JSON.parse(ids); } catch { ids = []; }
  }
  return Array.isArray(ids) ? ids.map(String) : [];
};

export class GameMinutesRecoveryPanelV63 {
  constructor({ supabase, game, players = [], stats = [], onSaved = null, generalSaveButton = null } = {}) {
    this.game = game || {};
    this.players = players || [];
    this.stats = stats || [];
    this.service = new GameMinutesRecoveryService(supabase);
    this.onSaved = onSaved;
    this.generalSaveButton = generalSaveButton;
    this.mode = "DIRECT";
    this.segments = [];
    this.host = null;
  }

  mount(anchor) {
    if (!anchor || !this.game?.id) return;
    anchor.querySelector("[data-minutes-recovery-v63]")?.remove();

    const wrapper = document.createElement("section");
    wrapper.dataset.minutesRecoveryV63 = "true";
    wrapper.style.cssText = "margin:12px 0 18px;border:1px solid #fed7aa;background:#fff7ed;border-radius:12px;overflow:hidden";
    wrapper.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:14px 16px">
        <div>
          <div style="font-weight:900;color:#9a3412">⏱ Recuperación de minutaje</div>
          <div style="font-size:12px;color:#7c2d12;margin-top:2px">
            Corrige sólo los minutos. No modifica puntos, tiros, rebotes, faltas, marcador ni jugadas.
          </div>
        </div>
        <button type="button" data-open-minutes-recovery
          style="min-height:44px;padding:10px 16px;border:0;border-radius:9px;background:#c2410c;color:white;font-weight:800;cursor:pointer">
          Reconstruir / editar minutaje
        </button>
      </div>
      <div data-minutes-recovery-body hidden></div>
    `;
    anchor.prepend(wrapper);
    this.host = wrapper;
    wrapper.querySelector("[data-open-minutes-recovery]")?.addEventListener("click", () => this._open());
  }

  _statFor(playerId) {
    return this.stats.find(row => String(row.player_id ?? row.playerId) === String(playerId)) || {};
  }

  _lockGeneralSave() {
    const button = this.generalSaveButton;
    if (!button) return;
    if (!button.dataset.minutesRecoveryOriginalText) {
      button.dataset.minutesRecoveryOriginalText = button.textContent || "";
      button.dataset.minutesRecoveryWasDisabled = button.disabled ? "1" : "0";
    }
    button.disabled = true;
    button.textContent = "⏱ Guarda el minutaje en el panel abierto";
    button.title = "El minutaje usa un guardado aislado para no modificar otras estadísticas.";
    button.style.opacity = "0.55";
  }

  _unlockGeneralSave() {
    const button = this.generalSaveButton;
    if (!button) return;
    const original = button.dataset.minutesRecoveryOriginalText;
    if (original) button.textContent = original;
    button.disabled = button.dataset.minutesRecoveryWasDisabled === "1";
    button.title = "Este botón guarda el resto del BoxScore. MIN se gestiona desde Recuperación de minutaje.";
    button.style.opacity = "";
    delete button.dataset.minutesRecoveryOriginalText;
    delete button.dataset.minutesRecoveryWasDisabled;
  }

  _open() {
    const body = this.host?.querySelector("[data-minutes-recovery-body]");
    if (!body) return;
    this._lockGeneralSave();
    body.hidden = false;
    this._renderBody();
    body.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  _close() {
    const body = this.host?.querySelector("[data-minutes-recovery-body]");
    if (body) body.hidden = true;
    this._unlockGeneralSave();
  }

  _modeButton(mode, label) {
    const active = this.mode === mode;
    return `<button type="button" data-recovery-mode="${mode}" style="min-height:42px;padding:8px 12px;border-radius:8px;border:1px solid ${active ? "#c2410c" : "#cbd5e1"};background:${active ? "#ffedd5" : "#fff"};color:#7c2d12;font-weight:800;cursor:pointer">${label}</button>`;
  }

  _renderBody() {
    const body = this.host?.querySelector("[data-minutes-recovery-body]");
    if (!body) return;
    const expected = expectedTeamMinutes(this.game);

    body.innerHTML = `
      <div style="border-top:1px solid #fed7aa;background:#fff;padding:16px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <strong style="color:#0f172a">Minutos de equipo esperados: ${expected}</strong>
            <div style="font-size:12px;color:#64748b;margin-top:3px">
              ${this.game.periods_count ?? 4} periodos × ${this.game.period_minutes ?? 10} min × 5 jugadores${Number(this.game.overtime_count || 0) ? ` + ${this.game.overtime_count} prórroga(s)` : ""}.
            </div>
          </div>
          <button type="button" data-close-minutes-recovery style="border:0;background:#f1f5f9;border-radius:8px;padding:8px 12px;font-weight:800;cursor:pointer">Cerrar</button>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">
          ${this._modeButton("DIRECT","Minutos directos")}
          ${this._modeButton("LINEUPS","Quintetos por tramos")}
        </div>

        <div data-recovery-content></div>

        <label style="display:block;margin-top:14px;font-size:12px;font-weight:800;color:#334155">
          Nota de auditoría (opcional)
          <input data-recovery-note maxlength="500" placeholder="Ej.: reconstrucción del partido tras incidencia de sincronización"
            style="display:block;width:100%;box-sizing:border-box;margin-top:5px;min-height:42px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px">
        </label>
        <div data-recovery-error role="alert" style="display:none;margin-top:12px;padding:10px 12px;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:12px;font-weight:700"></div>
      </div>
    `;

    body.querySelector("[data-close-minutes-recovery]")?.addEventListener("click", () => this._close());
    body.querySelectorAll("[data-recovery-mode]").forEach(button => {
      button.addEventListener("click", () => {
        this.mode = button.dataset.recoveryMode;
        this._renderBody();
      });
    });

    if (this.mode === "DIRECT") this._renderDirect();
    else this._renderLineups();
  }

  _content() {
    return this.host?.querySelector("[data-recovery-content]");
  }

  _showError(error) {
    const box = this.host?.querySelector("[data-recovery-error]");
    if (!box) return;
    box.textContent = String(error?.message || error || "");
    box.style.display = box.textContent ? "block" : "none";
  }

  _renderDirect() {
    const content = this._content();
    if (!content) return;
    const rows = this.players.map(player => {
      const stats = this._statFor(player.id);
      const value = Math.max(0, Number(stats.minutes || 0));
      return `
        <tr data-minute-player="${esc(player.id)}">
          <td style="padding:8px 10px;font-weight:700;white-space:nowrap">${esc(playerName(player))}</td>
          <td style="padding:8px 10px;text-align:center">
            <input type="number" min="0" step="1" inputmode="numeric" data-minute-input value="${value}"
              style="width:72px;min-height:40px;text-align:center;border:1px solid #cbd5e1;border-radius:7px;font-weight:800">
          </td>
        </tr>
      `;
    }).join("");

    content.innerHTML = `
      <div style="padding:9px 11px;margin:0 0 10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;font-size:12px;font-weight:800">
        Importante: para guardar MIN usa exclusivamente el botón verde de este panel. El botón general del BoxScore queda bloqueado mientras esta herramienta está abierta.
      </div>
      <p style="font-size:12px;color:#475569;margin:0 0 10px">
        Introduce los minutos finales de cada jugador. El sistema sólo permitirá guardar cuando la suma sea exactamente la reglamentaria.
      </p>
      <div style="overflow-x:auto">
        <table style="border-collapse:collapse;min-width:360px">
          <thead><tr><th style="text-align:left;padding:8px 10px">Jugador</th><th style="padding:8px 10px">MIN</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div data-minute-total style="margin-top:10px;font-weight:900"></div>
      <button type="button" data-save-direct style="margin-top:12px;min-height:44px;padding:10px 16px;border:0;border-radius:9px;background:#15803d;color:white;font-weight:900;cursor:pointer">
        Guardar sólo minutaje
      </button>
    `;

    const update = () => {
      const result = this._directEntries(false);
      const badge = content.querySelector("[data-minute-total]");
      if (!badge) return;
      const diff = result.expected - result.total;
      badge.textContent = result.valid
        ? `✓ Total ${result.total}/${result.expected} min`
        : `Total ${result.total}/${result.expected} min · ${diff > 0 ? "faltan" : "sobran"} ${Math.abs(diff)}`;
      badge.style.color = result.valid ? "#166534" : "#b45309";
    };
    content.querySelectorAll("[data-minute-input]").forEach(input => input.addEventListener("input", update));
    update();

    content.querySelector("[data-save-direct]")?.addEventListener("click", async event => {
      try {
        this._showError("");
        const validation = this._directEntries(true);
        if (!validation.valid) throw new Error(`La suma debe ser exactamente ${validation.expected} minutos.`);
        if (!window.confirm("Se actualizará únicamente el campo MIN de este partido. Las jugadas y el resto del BoxScore no se modificarán. ¿Continuar?")) return;
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = "Guardando minutaje…";
        const note = this.host.querySelector("[data-recovery-note]")?.value || "";
        const saved = await this.service.saveDirect({ game: this.game, entries: validation.entries, note });
        if (Number(saved?.actual_team_minutes) !== Number(validation.expected)) {
          throw new Error("El servidor no confirmó el total reglamentario del minutaje.");
        }
        window.alert(`✅ Minutaje guardado: ${validation.expected} minutos de equipo.`);
        this._unlockGeneralSave();
        await this.onSaved?.();
      } catch (error) {
        this._showError(error);
        event.currentTarget.disabled = false;
        event.currentTarget.textContent = "Guardar sólo minutaje";
      }
    });
  }

  _directEntries(strict = false) {
    const entries = [...(this.host?.querySelectorAll("[data-minute-player]") || [])].map(row => ({
      player_id: row.dataset.minutePlayer,
      minutes: Number(row.querySelector("[data-minute-input]")?.value || 0)
    }));
    if (strict) return validateDirectMinutes(entries, this.game);
    const total = entries.reduce((sum, row) => sum + (Number.isFinite(row.minutes) ? row.minutes : 0), 0);
    const expected = expectedTeamMinutes(this.game);
    return { entries, total, expected, valid: total === expected };
  }

  _initialSegments() {
    const result = [];
    for (let period = 1; period <= actualPeriodCount(this.game); period += 1) {
      const start = periodDurationSeconds(this.game, period);
      result.push({ period, start_clock: formatClock(start), end_clock: "00:00", on_court: ["","","","",""] });
    }
    return result;
  }

  _renderLineups() {
    if (!this.segments.length) this.segments = this._initialSegments();
    const content = this._content();
    if (!content) return;
    const playerOptions = selected => `
      <option value="">— jugador —</option>
      ${this.players.map(player => `<option value="${esc(player.id)}" ${String(selected) === String(player.id) ? "selected" : ""}>${esc(playerName(player))}</option>`).join("")}
    `;
    const periods = Array.from({ length: actualPeriodCount(this.game) }, (_, index) => index + 1);
    const segmentRows = this.segments.map((segment, index) => `
      <tr data-segment-row="${index}">
        <td style="padding:6px"><select data-segment-period style="min-height:40px">${periods.map(period => `<option value="${period}" ${Number(segment.period) === period ? "selected" : ""}>Q${period}</option>`).join("")}</select></td>
        <td style="padding:6px"><input data-segment-start value="${esc(segment.start_clock)}" placeholder="10:00" style="width:70px;min-height:38px"></td>
        <td style="padding:6px"><input data-segment-end value="${esc(segment.end_clock)}" placeholder="00:00" style="width:70px;min-height:38px"></td>
        ${[0,1,2,3,4].map(slot => `<td style="padding:4px"><select data-lineup-slot="${slot}" style="min-width:125px;min-height:40px">${playerOptions(segment.on_court?.[slot])}</select></td>`).join("")}
        <td style="padding:6px"><button type="button" data-remove-segment="${index}" style="min-height:38px;border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:7px;cursor:pointer">Eliminar</button></td>
      </tr>
    `).join("");

    content.innerHTML = `
      <p style="font-size:12px;color:#475569;margin:0 0 8px">
        Cada fila representa un quinteto desde un tiempo de reloj hasta el siguiente. Debes cubrir cada cuarto completo sin huecos ni solapes.
        El sistema calculará y redondeará los minutos manteniendo exactamente ${expectedTeamMinutes(this.game)} minutos de equipo.
      </p>
      <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:9px">
        <table style="border-collapse:collapse;min-width:1100px;width:100%">
          <thead><tr style="background:#f8fafc"><th>Periodo</th><th>Desde</th><th>Hasta</th><th>Jugador 1</th><th>Jugador 2</th><th>Jugador 3</th><th>Jugador 4</th><th>Jugador 5</th><th></th></tr></thead>
          <tbody>${segmentRows}</tbody>
        </table>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button type="button" data-add-segment style="min-height:42px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 12px;font-weight:800;cursor:pointer">+ Añadir tramo</button>
        <button type="button" data-preview-lineups style="min-height:42px;border:1px solid #1d4ed8;background:#eff6ff;color:#1d4ed8;border-radius:8px;padding:8px 12px;font-weight:800;cursor:pointer">Calcular minutos</button>
      </div>
      <div data-lineup-preview style="margin-top:12px"></div>
      <button type="button" data-save-lineups style="display:none;margin-top:12px;min-height:44px;padding:10px 16px;border:0;border-radius:9px;background:#15803d;color:white;font-weight:900;cursor:pointer">
        Guardar quintetos y minutaje
      </button>
    `;

    content.querySelectorAll("[data-remove-segment]").forEach(button => button.addEventListener("click", () => {
      this._readSegmentsFromDom();
      this.segments.splice(Number(button.dataset.removeSegment), 1);
      this._renderLineups();
    }));
    content.querySelector("[data-add-segment]")?.addEventListener("click", () => {
      this._readSegmentsFromDom();
      const last = this.segments.at(-1) || this._initialSegments()[0];
      this.segments.push({ period:last.period, start_clock:last.end_clock || "10:00", end_clock:"00:00", on_court:["","","","",""] });
      this._renderLineups();
    });
    content.querySelector("[data-preview-lineups]")?.addEventListener("click", () => this._previewLineups());
    content.querySelector("[data-save-lineups]")?.addEventListener("click", event => this._saveLineups(event));
  }

  _readSegmentsFromDom() {
    this.segments = [...(this.host?.querySelectorAll("[data-segment-row]") || [])].map(row => ({
      period: Number(row.querySelector("[data-segment-period]")?.value || 0),
      start_clock: row.querySelector("[data-segment-start]")?.value || "",
      end_clock: row.querySelector("[data-segment-end]")?.value || "",
      on_court: [...row.querySelectorAll("[data-lineup-slot]")].map(select => select.value)
    }));
    return this.segments;
  }

  _previewLineups() {
    try {
      this._showError("");
      const segments = this._readSegmentsFromDom();
      const recovery = buildMinutesFromSegments({
        segments,
        playerIds: this.players.map(player => String(player.id)),
        game: this.game
      });
      const names = new Map(this.players.map(player => [String(player.id), playerName(player)]));
      const preview = this.host.querySelector("[data-lineup-preview]");
      preview.innerHTML = `
        <div style="padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#166534;font-weight:800">
          ✓ Reconstrucción válida · ${recovery.expected} minutos de equipo.
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;margin-top:8px">
          ${recovery.minutes.map(row => `<div style="padding:7px 9px;background:#f8fafc;border-radius:7px"><strong>${esc(names.get(row.player_id) || "Jugador")}</strong>: ${row.minutes} min</div>`).join("")}
        </div>
      `;
      this._lastRecovery = recovery;
      const save = this.host.querySelector("[data-save-lineups]");
      if (save) save.style.display = "inline-block";
    } catch (error) {
      this._lastRecovery = null;
      this._showError(error);
      const save = this.host.querySelector("[data-save-lineups]");
      if (save) save.style.display = "none";
    }
  }

  async _saveLineups(event) {
    try {
      this._previewLineups();
      if (!this._lastRecovery) return;
      if (!window.confirm("Se guardará únicamente el timeline de quintetos y MIN. No se modificarán las jugadas ni ninguna otra estadística. ¿Continuar?")) return;
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Guardando reconstrucción…";
      const note = this.host.querySelector("[data-recovery-note]")?.value || "";
      const saved = await this.service.saveSegments({
        game: this.game,
        segments: this.segments,
        playerIds: this.players.map(player => String(player.id)),
        note
      });
      if (Number(saved?.actual_team_minutes) !== Number(this._lastRecovery.expected)) {
        throw new Error("El servidor no confirmó el total reglamentario del minutaje.");
      }
      window.alert(`✅ Quintetos y minutaje guardados: ${this._lastRecovery.expected} minutos de equipo.`);
      this._unlockGeneralSave();
      await this.onSaved?.();
    } catch (error) {
      this._showError(error);
      event.currentTarget.disabled = false;
      event.currentTarget.textContent = "Guardar quintetos y minutaje";
    }
  }
}

export default GameMinutesRecoveryPanelV63;
