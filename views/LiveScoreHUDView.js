/**
 * @fileoverview HUD Central de Anotación y Registro en Vivo: LiveScoreHUDView.js
 * @description Flujo de partido, panel de sustituciones táctil, play-by-play y acta oficial con balance de minutos.
 */

import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";

export class LiveScoreHUDView {
  constructor(authController = null, gameId = null) {
    this.auth = authController;
    this.gameId = gameId;

    this.currentStep = 1;

    this.config = {
      gameType: "Oficial",
      format: "4x10",
      periodSeconds: 600,
      overtimeSeconds: 300,
      season: "2026",
      date: new Date().toISOString().split("T")[0],
      opponent: "",
      venue: "Local"
    };

    this.roster = [];
    this.onCourtPlayerIds = [];

    this.currentPeriod = "Q1";
    this.periodsList = ["Q1", "Q2", "Q3", "Q4"];
    this.teamScore = 0;
    this.opponentScore = 0;

    this.playByPlayEvents = [];
    this.undoneEventsStack = [];

    this.timeRemaining = 600;
    this.pendingSubOnCourt = [];
    this.subEvents = [];

    this.activeModal = null;
    this.pendingAction = null;
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  _getActionLabelSpanish(actionKey) {
    const dict = {
      fg2_made: "Canasta de 2 Puntos (+2)",
      fg2_attempted: "Tiro de 2 Fallado",
      fg3_made: "Triple Convertido (+3)",
      fg3_attempted: "Triple Fallado",
      ft_made: "Tiro Libre Anotado (+1)",
      ft_attempted: "Tiro Libre Fallado",
      off_reb: "Rebote Ofensivo",
      def_reb: "Rebote Defensivo",
      assists: "Asistencia",
      steals: "Robo de Balón",
      blocks_made: "Tapón a Favor",
      blocks_received: "Tapón Recibido",
      turnovers: "Pérdida de Balón",
      fouls_committed: "Falta Personal Cometida",
      fouls_drawn: "Falta Personal Recibida",
      opp_pts: "Puntos Rival",
      opp_tov: "Pérdida de Balón Rival",
      opp_oreb: "Rebote Ofensivo Rival",
      opp_dreb: "Rebote Defensivo Rival"
    };
    return dict[actionKey] || String(actionKey).replace(/_/g, " ").toUpperCase();
  }

  _getPeriodDuration(periodName) {
    return periodName.startsWith("OT") ? this.config.overtimeSeconds : this.config.periodSeconds;
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;
    this.container = container;

    const activeTeamId = DataStore.getActiveTeamId ? DataStore.getActiveTeamId() : null;
    const allPlayers = (DataStore.getPlayers ? (DataStore.getPlayers(activeTeamId) || DataStore.getPlayers()) : []) || [];

    if (this.roster.length === 0 && allPlayers.length > 0) {
      this.roster = allPlayers.map((p, idx) => ({
        id: String(p.id),
        name: `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim() || p.name || 'Jugador',
        jersey: String(p.jersey ?? p.number ?? idx + 4),
        isConvoked: true,
        isStarter: idx < 5
      }));
      this._syncOnCourtFromStarters();
    }

    if (this.currentStep === 1) {
      this._renderPreGameConfig();
    } else if (this.currentStep === 2) {
      this._renderHUD();
    } else if (this.currentStep === 4) {
      this._renderPostGameActa();
    }
  }

  _syncOnCourtFromStarters() {
    this.onCourtPlayerIds = this.roster.filter(p => p.isConvoked && p.isStarter).map(p => p.id).slice(0, 5);
    if (this.onCourtPlayerIds.length < 5) {
      const convoked = this.roster.filter(p => p.isConvoked).map(p => p.id);
      this.onCourtPlayerIds = convoked.slice(0, 5);
    }
  }

  _renderPreGameConfig() {
    this._closeModalLayer();
    const convokedCount = this.roster.filter(p => p.isConvoked).length;
    const startersCount = this.roster.filter(p => p.isConvoked && p.isStarter).length;

    const rosterRows = this.roster.map(p => `
      <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
        <td style="padding: 10px; text-align: center;">
          <input type="checkbox" class="chk-convoke" data-id="${p.id}" ${p.isConvoked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
        </td>
        <td style="padding: 10px; text-align: center;">
          <button type="button" class="btn-star-starter ${p.isStarter ? 'is-starter' : ''}" data-id="${p.id}" style="background: none; border: none; font-size: 20px; cursor: pointer; color: ${p.isStarter ? '#f97316' : '#cbd5e1'};">
            ${p.isStarter ? '★' : '☆'}
          </button>
        </td>
        <td style="padding: 10px; text-align: center;">
          <input type="text" class="input-jersey" data-id="${p.id}" value="${p.jersey}" style="width: 48px; height: 32px; text-align: center; font-weight: 800; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a; background: #ffffff;" />
        </td>
        <td style="padding: 10px 14px; font-weight: 700; color: #0f172a;">
          ${p.name}
        </td>
      </tr>
    `).join("");

    this.container.innerHTML = `
      <div style="max-width: 1000px; margin: 0 auto; font-family: system-ui, sans-serif; padding-bottom: 90px; box-sizing: border-box;">
        <div style="margin-bottom: 20px;">
          <h1 style="font-size: 24px; font-weight: 900; color: #0f172a; margin: 0;">🏀 Configuración Pre-Partido & Convocatoria</h1>
          <span style="font-size: 13px; color: #64748b;">Ajusta los datos del encuentro y define el quinteto inicial.</span>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;">
            <div>
              <label class="hud-label">TIPO DE PARTIDO</label>
              <select id="cfg-game-type" class="hud-select">
                <option value="Oficial" ${this.config.gameType === 'Oficial' ? 'selected' : ''}>Oficial</option>
                <option value="Amistoso" ${this.config.gameType === 'Amistoso' ? 'selected' : ''}>Amistoso</option>
                <option value="Torneo" ${this.config.gameType === 'Torneo' ? 'selected' : ''}>Torneo</option>
              </select>
            </div>

            <div>
              <label class="hud-label">FORMATO DE TIEMPO</label>
              <select id="cfg-format" class="hud-select">
                <option value="4x10" ${this.config.format === '4x10' ? 'selected' : ''}>4 x 10 min (FIBA)</option>
                <option value="4x12" ${this.config.format === '4x12' ? 'selected' : ''}>4 x 12 min (NBA)</option>
                <option value="4x8" ${this.config.format === '4x8' ? 'selected' : ''}>4 x 8 min (Cadete/Inf.)</option>
                <option value="minibasket" ${this.config.format === 'minibasket' ? 'selected' : ''}>Minibasket (6 x 8 min)</option>
              </select>
            </div>

            <div>
              <label class="hud-label">FECHA</label>
              <input type="date" id="cfg-date" value="${this.config.date}" class="hud-input" />
            </div>

            <div>
              <label class="hud-label">RIVAL *</label>
              <input type="text" id="cfg-opponent" placeholder="Ej: CB Sant Gabriel" value="${this.config.opponent}" class="hud-input" />
            </div>

            <div>
              <label class="hud-label">CONDICIÓN</label>
              <select id="cfg-venue" class="hud-select">
                <option value="Local" ${this.config.venue === 'Local' ? 'selected' : ''}>Local</option>
                <option value="Visitante" ${this.config.venue === 'Visitante' ? 'selected' : ''}>Visitante</option>
              </select>
            </div>
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
            <h3 style="margin: 0; font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
              📋 PLANTILLA Y CONVOCATORIA (${convokedCount} convocados · ${startersCount}/5 titulares)
            </h3>
            <span style="font-size: 11px; font-weight: 800; color: ${startersCount === 5 ? '#16a34a' : '#dc2626'};">
              ${startersCount === 5 ? '✔ Quinteto Inicial Completo' : '⚠️ Debes seleccionar exactamente 5 titulares (★)'}
            </span>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                <th style="padding: 10px; text-align: center; width: 60px;">CONV.</th>
                <th style="padding: 10px; text-align: center; width: 60px;">TITULAR</th>
                <th style="padding: 10px; text-align: center; width: 80px;">DORSAL</th>
                <th style="padding: 10px 14px;">JUGADOR</th>
              </tr>
            </thead>
            <tbody>${rosterRows}</tbody>
          </table>
        </div>

        <!-- BOTÓN DE INICIO VISIBLE EN MÓVIL Y DESKTOP SIN TAPARSE -->
        <div style="display: flex; justify-content: center; width: 100%; margin-top: 10px; margin-bottom: 40px;">
          <button type="button" id="btn-start-scoring" style="background: #f97316; color: #ffffff; border: none; padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 900; cursor: pointer; min-height: 52px; width: 100%; max-width: 480px; box-shadow: 0 4px 14px rgba(249,115,22,0.4); text-align: center;">
            ⚡ COMENZAR ANOTACIÓN
          </button>
        </div>

      </div>
    `;

    this._bindPreGameEvents();
  }

  _bindPreGameEvents() {
    this.container.querySelectorAll(".chk-convoke").forEach(chk => {
      chk.addEventListener("change", () => {
        const p = this.roster.find(r => r.id === chk.getAttribute("data-id"));
        if (p) {
          p.isConvoked = chk.checked;
          if (!chk.checked) p.isStarter = false;
          this._renderPreGameConfig();
        }
      });
    });

    this.container.querySelectorAll(".btn-star-starter").forEach(btn => {
      btn.addEventListener("click", () => {
        const p = this.roster.find(r => r.id === btn.getAttribute("data-id"));
        if (!p || !p.isConvoked) return;

        const currentStarters = this.roster.filter(r => r.isConvoked && r.isStarter).length;
        if (!p.isStarter && currentStarters >= 5) {
          alert("Ya has seleccionado los 5 titulares. Desmarca una estrella primero.");
          return;
        }
        p.isStarter = !p.isStarter;
        this._renderPreGameConfig();
      });
    });

    this.container.querySelectorAll(".input-jersey").forEach(inp => {
      inp.addEventListener("change", () => {
        const p = this.roster.find(r => r.id === inp.getAttribute("data-id"));
        if (p) p.jersey = inp.value;
      });
    });

    this.container.querySelector("#btn-start-scoring")?.addEventListener("click", () => {
      const opp = this.container.querySelector("#cfg-opponent")?.value.trim();
      if (!opp) return alert("Introduce el nombre del equipo rival.");

      const starters = this.roster.filter(r => r.isConvoked && r.isStarter);
      if (starters.length !== 5) return alert(`Debes seleccionar exactamente 5 titulares con la estrella (seleccionados: ${starters.length}/5).`);

      this.config.opponent = opp;
      this.config.gameType = this.container.querySelector("#cfg-game-type")?.value || "Oficial";
      this.config.format = this.container.querySelector("#cfg-format")?.value || "4x10";
      this.config.date = this.container.querySelector("#cfg-date")?.value || this.config.date;
      this.config.venue = this.container.querySelector("#cfg-venue")?.value || "Local";

      if (this.config.format === "4x12") this.config.periodSeconds = 720;
      else if (this.config.format === "4x8" || this.config.format === "minibasket") this.config.periodSeconds = 480;
      else this.config.periodSeconds = 600;

      if (this.config.format === "minibasket") {
        this.periodsList = ["P1", "P2", "P3", "P4", "P5", "P6"];
        this.currentPeriod = "P1";
      }

      this.timeRemaining = this.config.periodSeconds;
      this._syncOnCourtFromStarters();

      this.subEvents = [{
        id: `sub-init-${Date.now()}`,
        type: 'SUBSTITUTION',
        period: this.currentPeriod,
        timeRemaining: this.timeRemaining,
        playersIn: [...this.onCourtPlayerIds],
        playersOut: [],
        onCourt: [...this.onCourtPlayerIds]
      }];

      this.currentStep = 2;
      this.render();
    });
  }

  _renderHUD() {
    const onCourtPlayers = this.roster.filter(p => this.onCourtPlayerIds.includes(p.id));
    const isHome = this.config.venue === "Local";
    const myTeamLabel = isHome ? "JMJ Manyanet" : (this.config.opponent || "Rival");
    const oppTeamLabel = isHome ? (this.config.opponent || "Rival") : "JMJ Manyanet";

    const minutes = Math.floor(this.timeRemaining / 60);
    const seconds = this.timeRemaining % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    this.container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: system-ui, sans-serif; padding-bottom: 40px; box-sizing: border-box;">
        <header style="background: #0f172a; color: #ffffff; border-radius: 12px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 13px; font-weight: 800; color: #38bdf8;">${myTeamLabel.toUpperCase()}</span>
            <div style="background: #1e293b; padding: 6px 18px; border-radius: 8px; font-size: 26px; font-weight: 900; border: 1px solid #334155;">
              <span style="color: #38bdf8;">${this.teamScore}</span>
              <span style="color: #64748b; margin: 0 4px;">-</span>
              <span style="color: #f97316;">${this.opponentScore}</span>
            </div>
            <span style="font-size: 13px; font-weight: 800; color: #f97316;">${oppTeamLabel.toUpperCase()}</span>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; background: #1e293b; padding: 4px; border-radius: 8px;">
            ${this.periodsList.map(p => {
              const isOT = p.startsWith("OT");
              return `
                <div style="display: inline-flex; align-items: center; background: ${this.currentPeriod === p ? '#f97316' : 'transparent'}; border-radius: 6px; padding-right: ${isOT ? '4px' : '0'};">
                  <button type="button" class="btn-period-hud" data-period="${p}" style="background: transparent; color: #ffffff; border: none; padding: 6px ${isOT ? '6px' : '10px'}; font-weight: 800; font-size: 12px; cursor: pointer;">
                    ${p}
                  </button>
                  ${isOT ? `
                    <button type="button" class="btn-remove-ot" data-period="${p}" style="background: rgba(0,0,0,0.3); color: #fca5a5; border: none; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Eliminar ${p}">✕</button>
                  ` : ''}
                </div>
              `;
            }).join("")}
            <button type="button" id="btn-add-ot" style="background: #334155; color: #38bdf8; border: none; padding: 6px 10px; border-radius: 6px; font-weight: 900; font-size: 12px; cursor: pointer;">
              +PR
            </button>
          </div>

          <div style="display: flex; gap: 6px;">
            <button type="button" id="btn-hud-undo" style="background: #334155; color: #ffffff; border: none; padding: 8px 12px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;">
              ↩ Deshacer
            </button>
            <button type="button" id="btn-hud-redo" style="background: #334155; color: #ffffff; border: none; padding: 8px 12px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;">
              ↪ Rehacer
            </button>
            <button type="button" id="btn-hud-subs" style="background: #0284c7; color: #ffffff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;">
              🔄 Cambios (${timeStr})
            </button>
            <button type="button" id="btn-hud-pbp" style="background: #1e3a8a; color: #ffffff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;">
              📋 Jugadas (${this.playByPlayEvents.length})
            </button>
          </div>
        </header>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">5 EN PISTA:</span>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${onCourtPlayers.map(p => `
              <div style="background: #eff6ff; border: 1.5px solid #3b82f6; border-radius: 8px; padding: 6px 14px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px; font-weight: 900; color: #1e40af;">#${p.jersey}</span>
                <span style="font-size: 12px; font-weight: 700; color: #0f172a;">${p.name}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px;">
          <div class="hud-action-card">
            <span class="hud-card-title" style="color: #16a34a;">🎯 TIROS DE CAMPO Y LIBRES</span>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <button type="button" class="btn-action-shot" data-action="T2" data-made="true" style="background: #22c55e;">+2 Tiro 2 (In)</button>
              <button type="button" class="btn-action-shot" data-action="T2" data-made="false" style="background: #ef4444;">Tiro 2 Fallo (Out)</button>
              <button type="button" class="btn-action-shot" data-action="T3" data-made="true" style="background: #16a34a;">+3 Triple (In)</button>
              <button type="button" class="btn-action-shot" data-action="T3" data-made="false" style="background: #dc2626;">Triple Fallo (Out)</button>
              <button type="button" class="btn-action-direct" data-action="ft_made" data-pts="1" style="background: #84cc16;">+1 TL Anotado</button>
              <button type="button" class="btn-action-direct" data-action="ft_attempted" data-pts="0" style="background: #f87171;">Fallo TL</button>
            </div>
          </div>

          <div class="hud-action-card">
            <span class="hud-card-title" style="color: #0284c7;">🏀 REBOTES Y CIRCULACIÓN</span>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <button type="button" class="btn-action-direct" data-action="off_reb" data-pts="0" style="background: #0284c7;">Rebote Ofensivo</button>
              <button type="button" class="btn-action-direct" data-action="def_reb" data-pts="0" style="background: #38bdf8; color: #0f172a;">Rebote Defensivo</button>
              <button type="button" class="btn-action-direct" data-action="assists" data-pts="0" style="background: #6366f1;">Asistencia (AST)</button>
              <button type="button" class="btn-action-direct" data-action="steals" data-pts="0" style="background: #8b5cf6;">Robo de Balón</button>
              <button type="button" class="btn-action-direct" data-action="turnovers" data-pts="0" style="background: #ea580c; grid-column: span 2;">Pérdida de Balón (TOV)</button>
            </div>
          </div>

          <div class="hud-action-card">
            <span class="hud-card-title" style="color: #d97706;">🛡️ DEFENSA Y FALTAS</span>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <button type="button" class="btn-action-direct" data-action="blocks_made" data-pts="0" style="background: #a855f7;">Tapón a Favor</button>
              <button type="button" class="btn-action-direct" data-action="blocks_received" data-pts="0" style="background: #d946ef;">Tapón Recibido</button>
              <button type="button" class="btn-action-direct" data-action="fouls_committed" data-pts="0" style="background: #f59e0b;">Falta Cometida (PF)</button>
              <button type="button" class="btn-action-direct" data-action="fouls_drawn" data-pts="0" style="background: #fbbf24; color: #78350f;">Falta Recibida (PFD)</button>
            </div>
          </div>

          <div class="hud-action-card" style="background: #fff7ed; border-color: #fed7aa;">
            <span class="hud-card-title" style="color: #c2410c;">🔴 ACCIÓN DIRECTA RIVAL</span>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
              <button type="button" class="btn-opp-action" data-type="pts" data-val="1" style="background: #f97316;">+1 TL Riv</button>
              <button type="button" class="btn-opp-action" data-type="pts" data-val="2" style="background: #ea580c;">+2 Canasta</button>
              <button type="button" class="btn-opp-action" data-type="pts" data-val="3" style="background: #c2410c;">+3 Triple</button>
              <button type="button" class="btn-opp-action" data-type="dreb" data-val="0" style="background: #fed7aa; color: #9a3412;">Reb Def Riv</button>
              <button type="button" class="btn-opp-action" data-type="oreb" data-val="0" style="background: #fed7aa; color: #9a3412;">Reb Of Riv</button>
              <button type="button" class="btn-opp-action" data-type="tov" data-val="0" style="background: #fed7aa; color: #9a3412;">Pérdida</button>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <span style="font-size: 12px; color: #64748b;">Periodo actual: <strong>${this.currentPeriod}</strong></span>
          <button type="button" id="btn-hud-finish" style="background: #0f172a; color: #ffffff; border: none; padding: 12px 28px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer;">
            🏁 FINALIZAR PARTIDO & VALIDAR ACTA
          </button>
        </div>
      </div>
    `;

    this._bindHUDEvents();
    this._renderModalLayer();
  }

  _closeModalLayer() {
    this.activeModal = null;
    const existing = document.getElementById("hud-dynamic-modal-portal");
    if (existing) existing.remove();
  }

  _renderModalLayer() {
    const existing = document.getElementById("hud-dynamic-modal-portal");
    if (existing) existing.remove();

    if (!this.activeModal) return;

    const portal = document.createElement("div");
    portal.id = "hud-dynamic-modal-portal";
    portal.innerHTML = this._getModalContent();
    document.body.appendChild(portal);
    this._bindModalDynamicEvents();
  }

  _getModalContent() {
    if (this.activeModal === "court_shot") {
      const onCourtPlayers = this.roster.filter(p => this.onCourtPlayerIds.includes(p.id));
      return `
        <div class="hud-modal-overlay">
          <div class="hud-modal-content" style="max-width: 500px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <strong style="font-size: 14px; color: #0f172a;">📍 Paso 1: Toca el punto del tiro en la pista</strong>
              <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
            </div>

            <div style="position: relative; width: 100%; aspect-ratio: 50/47; background: #d97736; border: 2px solid #ffffff; border-radius: 8px; overflow: hidden; cursor: crosshair;" id="modal-court-clickarea">
              <svg viewBox="0 0 500 470" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none;">
                <rect x="0" y="0" width="500" height="470" fill="none" stroke="#fff" stroke-width="4"/>
                <rect x="170" y="0" width="160" height="190" fill="rgba(255,255,255,0.15)" stroke="#fff" stroke-width="3"/>
                <circle cx="250" cy="52" r="15" fill="none" stroke="#ff5722" stroke-width="4"/>
                <path d="M 30 140 A 235 235 0 0 0 470 140" fill="none" stroke="#fff" stroke-width="3"/>
              </svg>
            </div>

            <div id="shot-player-picker" style="display: none; margin-top: 14px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <span style="font-size: 11px; font-weight: 800; color: #64748b; display: block; margin-bottom: 8px;">Paso 2: ¿Quién lanzó?</span>
              <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
                ${onCourtPlayers.map(p => `
                  <button type="button" class="btn-select-shot-player" data-id="${p.id}" data-name="${p.name}" style="background: #1e3a8a !important; color: #ffffff !important; border: none; padding: 8px 2px; border-radius: 6px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
                    <span style="font-weight: 900; font-size: 15px; color: #ffffff !important;">#${p.jersey}</span>
                    <span style="font-size: 10px; font-weight: 700; color: #ffffff !important; opacity: 0.95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px;">${p.name.split(' ')[0]}</span>
                  </button>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeModal === "player_select") {
      const onCourtPlayers = this.roster.filter(p => this.onCourtPlayerIds.includes(p.id));
      return `
        <div class="hud-modal-overlay">
          <div class="hud-modal-content" style="max-width: 440px; text-align: center;">
            <strong style="font-size: 15px; color: #0f172a; display: block; margin-bottom: 12px;">¿A qué jugador asignar la acción?</strong>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px;">
              ${onCourtPlayers.map(p => `
                <button type="button" class="btn-direct-player-choice" data-id="${p.id}" data-name="${p.name}" style="background: #1e3a8a !important; color: #ffffff !important; border: none; padding: 10px 2px; border-radius: 8px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
                  <span style="font-weight: 900; font-size: 16px; color: #ffffff !important;">#${p.jersey}</span>
                  <span style="font-size: 10px; font-weight: 700; color: #ffffff !important; opacity: 0.95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px;">${p.name.split(' ')[0]}</span>
                </button>
              `).join("")}
            </div>
            <button type="button" class="btn-close-modal" style="background: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; color: #64748b; cursor: pointer;">Cancelar</button>
          </div>
        </div>
      `;
    }

    if (this.activeModal === "substitutions") {
      const convoked = this.roster.filter(p => p.isConvoked);
      const selectedCount = this.pendingSubOnCourt.length;
      const isValid = selectedCount === 5;

      const mins = Math.floor(this.timeRemaining / 60);
      const s1 = Math.floor((this.timeRemaining % 60) / 10);
      const s2 = (this.timeRemaining % 60) % 10;

      return `
        <div class="hud-modal-overlay">
          <div class="hud-modal-content" style="max-width: 550px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <strong style="font-size: 16px; font-weight: 900; color: #0f172a;">🔄 Panel de Sustituciones (${this.currentPeriod})</strong>
              <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
            </div>

            <div style="background: #0f172a; color: #ffffff; border-radius: 10px; padding: 14px; display: flex; justify-content: center; align-items: center; gap: 16px; margin-bottom: 16px;">
              <div style="text-align: center;">
                <button type="button" class="btn-clock-adj" data-unit="min" data-val="1">▲</button>
                <div style="font-size: 32px; font-weight: 900; font-family: monospace; color: #38bdf8;">${String(mins).padStart(2, '0')}</div>
                <button type="button" class="btn-clock-adj" data-unit="min" data-val="-1">▼</button>
              </div>

              <span style="font-size: 32px; font-weight: 900; color: #64748b;">:</span>

              <div style="text-align: center;">
                <button type="button" class="btn-clock-adj" data-unit="s1" data-val="1">▲</button>
                <div style="font-size: 32px; font-weight: 900; font-family: monospace; color: #f97316;">${s1}</div>
                <button type="button" class="btn-clock-adj" data-unit="s1" data-val="-1">▼</button>
              </div>

              <div style="text-align: center;">
                <button type="button" class="btn-clock-adj" data-unit="s2" data-val="1">▲</button>
                <div style="font-size: 32px; font-weight: 900; font-family: monospace; color: #f97316;">${s2}</div>
                <button type="button" class="btn-clock-adj" data-unit="s2" data-val="-1">▼</button>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; margin-bottom: 8px;">
              <span>SELECCIÓN DE QUINTETO:</span>
              <span style="color: ${isValid ? '#16a34a' : '#dc2626'};">${selectedCount} / 5 Seleccionados</span>
            </div>

            ${!isValid ? `
              <div style="background: #fee2e2; color: #b91c1c; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; margin-bottom: 10px; text-align: center;">
                ${selectedCount < 5 ? `Faltan jugadores en campo (${selectedCount}/5)` : `Sobran jugadores en campo (${selectedCount}/5)`}
              </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; max-height: 220px; overflow-y: auto; margin-bottom: 16px;">
              ${convoked.map(p => {
                const isOnCourt = this.pendingSubOnCourt.includes(p.id);
                return `
                  <button type="button" class="btn-sub-toggle-player ${isOnCourt ? 'active' : ''}" data-id="${p.id}" style="padding: 10px; border-radius: 8px; border: 2px solid ${isOnCourt ? '#16a34a' : '#cbd5e1'}; background: ${isOnCourt ? '#f0fdf4' : '#ffffff'}; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 2px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <strong style="font-size: 14px; color: #0f172a;">#${p.jersey}</strong>
                      <span style="font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${isOnCourt ? '#dcfce7' : '#f1f5f9'}; color: ${isOnCourt ? '#15803d' : '#64748b'};">
                        ${isOnCourt ? 'EN PISTA' : 'BANQUILLO'}
                      </span>
                    </div>
                    <span style="font-size: 11px; font-weight: 700; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</span>
                  </button>
                `;
              }).join("")}
            </div>

            <button type="button" id="btn-confirm-substitution" ${isValid ? '' : 'disabled'} style="width: 100%; background: ${isValid ? '#16a34a' : '#cbd5e1'}; color: #ffffff; border: none; padding: 12px; border-radius: 8px; font-weight: 900; font-size: 14px; cursor: ${isValid ? 'pointer' : 'not-allowed'};">
              CONFIRMAR SUSTITUCIÓN (${mins}:${String(this.timeRemaining % 60).padStart(2, '0')})
            </button>
          </div>
        </div>
      `;
    }

    if (this.activeModal === "play_by_play") {
      return `
        <div class="hud-modal-overlay">
          <div class="hud-modal-content" style="max-width: 650px; max-height: 85vh; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <strong style="font-size: 16px; font-weight: 900; color: #0f172a;">📋 Historial de Jugadas (Play-by-Play)</strong>
              <button type="button" class="btn-close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
            </div>

            <div style="overflow-y: auto; flex: 1; border: 1px solid #e2e8f0; border-radius: 8px;">
              ${this.playByPlayEvents.length === 0 ? `
                <div style="padding: 30px; text-align: center; color: #94a3b8;">No hay jugadas registradas aún.</div>
              ` : `
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                  <thead style="background: #f8fafc; color: #475569; position: sticky; top: 0;">
                    <tr style="border-bottom: 2px solid #e2e8f0;">
                      <th style="padding: 8px;">PER</th>
                      <th style="padding: 8px;">MARCADOR</th>
                      <th style="padding: 8px;">ACCIÓN</th>
                      <th style="padding: 8px;">JUGADOR</th>
                      <th style="padding: 8px; text-align: right;">BORRAR</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${[...this.playByPlayEvents].reverse().map((ev) => `
                      <tr style="border-bottom: 1px solid #f1f5f9; background: ${ev.isOpponent ? '#fff7ed' : '#ffffff'};">
                        <td style="padding: 8px; font-weight: 800;">${ev.period}</td>
                        <td style="padding: 8px; font-weight: 900; color: #0f172a;">${ev.teamScore} - ${ev.opponentScore}</td>
                        <td style="padding: 8px; font-weight: 700; color: #334155;">${ev.actionLabel}</td>
                        <td style="padding: 8px; font-weight: 700;">${ev.playerName}</td>
                        <td style="padding: 8px; text-align: right;">
                          <button type="button" class="btn-del-pbp-event" data-id="${ev.id}" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; border-radius: 4px; padding: 4px 8px; font-weight: 800; cursor: pointer;">🗑️</button>
                        </td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              `}
            </div>
          </div>
        </div>
      `;
    }

    return "";
  }

  _bindHUDEvents() {
    this.container.querySelectorAll(".btn-period-hud").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const nextPeriod = btn.getAttribute("data-period");
        if (this.currentPeriod === nextPeriod) return;

        this.subEvents.push({
          id: `sub-close-${Date.now()}`,
          type: 'SUBSTITUTION',
          period: this.currentPeriod,
          timeRemaining: 0,
          playersIn: [],
          playersOut: [...this.onCourtPlayerIds],
          onCourt: [...this.onCourtPlayerIds]
        });

        this.currentPeriod = nextPeriod;
        this.timeRemaining = this._getPeriodDuration(nextPeriod);
        this.pendingSubOnCourt = [...this.onCourtPlayerIds];
        this.activeModal = "substitutions";
        this._renderHUD();
      };
    });

    this.container.querySelectorAll(".btn-remove-ot").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const otPeriod = btn.getAttribute("data-period");
        if (confirm(`¿Deseas eliminar la prórroga ${otPeriod}?`)) {
          this.periodsList = this.periodsList.filter(p => p !== otPeriod);
          if (this.currentPeriod === otPeriod) {
            this.currentPeriod = this.periodsList[this.periodsList.length - 1];
            this.timeRemaining = this._getPeriodDuration(this.currentPeriod);
          }
          this._renderHUD();
        }
      };
    });

    const btnAddOt = this.container.querySelector("#btn-add-ot");
    if (btnAddOt) {
      btnAddOt.onclick = (e) => {
        e.preventDefault();
        const otNum = this.periodsList.filter(p => p.startsWith("OT")).length + 1;
        const otName = `OT${otNum}`;
        this.periodsList.push(otName);
        this.currentPeriod = otName;
        this.timeRemaining = this.config.overtimeSeconds;
        this.pendingSubOnCourt = [...this.onCourtPlayerIds];
        this.activeModal = "substitutions";
        this._renderHUD();
      };
    }

    const btnSubs = this.container.querySelector("#btn-hud-subs");
    if (btnSubs) {
      btnSubs.onclick = (e) => {
        e.preventDefault();
        this.pendingSubOnCourt = [...this.onCourtPlayerIds];
        this.activeModal = "substitutions";
        this._renderHUD();
      };
    }

    const btnPbp = this.container.querySelector("#btn-hud-pbp");
    if (btnPbp) {
      btnPbp.onclick = (e) => {
        e.preventDefault();
        this.activeModal = "play_by_play";
        this._renderHUD();
      };
    }

    const btnUndo = this.container.querySelector("#btn-hud-undo");
    if (btnUndo) {
      btnUndo.onclick = (e) => {
        e.preventDefault();
        if (this.playByPlayEvents.length === 0) return;
        const last = this.playByPlayEvents.pop();
        this.undoneEventsStack.push(last);
        this._recalculateScoreFromEvents();
        this._renderHUD();
      };
    }

    const btnRedo = this.container.querySelector("#btn-hud-redo");
    if (btnRedo) {
      btnRedo.onclick = (e) => {
        e.preventDefault();
        if (this.undoneEventsStack.length === 0) return;
        const restored = this.undoneEventsStack.pop();
        this.playByPlayEvents.push(restored);
        this._recalculateScoreFromEvents();
        this._renderHUD();
      };
    }

    this.container.querySelectorAll(".btn-action-shot").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const actionType = btn.getAttribute("data-action");
        const made = btn.getAttribute("data-made") === "true";
        this.pendingAction = {
          type: "shot",
          shotType: actionType,
          made,
          points: made ? (actionType === "T3" ? 3 : 2) : 0
        };
        this.activeModal = "court_shot";
        this._renderHUD();
      };
    });

    this.container.querySelectorAll(".btn-action-direct").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const action = btn.getAttribute("data-action");
        const points = Number(btn.getAttribute("data-pts") || 0);
        this.pendingAction = {
          type: "direct",
          action,
          points
        };
        this.activeModal = "player_select";
        this._renderHUD();
      };
    });

    this.container.querySelectorAll(".btn-opp-action").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const type = btn.getAttribute("data-type");
        const val = Number(btn.getAttribute("data-val") || 0);

        let label = `Rival: +${val} Pts`;
        if (type === "oreb") label = "Rebote Ofensivo Rival";
        if (type === "dreb") label = "Rebote Defensivo Rival";
        if (type === "tov") label = "Pérdida de Balón Rival";

        if (type === "pts") {
          this.opponentScore += val;
        }

        const maxPeriodSec = this._getPeriodDuration(this.currentPeriod);
        const elapsedSec = Math.max(0, maxPeriodSec - this.timeRemaining);
        const minute = Math.floor(elapsedSec / 60) + 1;

        const ev = {
          id: `ev-${Date.now()}`,
          isOpponent: true,
          period: this.currentPeriod,
          timeRemaining: this.timeRemaining,
          minute: minute,
          action: `opp_${type}`,
          action_type: `opp_${type}`,
          event_type: `opp_${type}`,
          actionLabel: label,
          points: type === "pts" ? val : 0,
          teamScore: this.teamScore,
          opponentScore: this.opponentScore,
          playerName: "Rival",
          player_id: null,
          onCourt: [...this.onCourtPlayerIds]
        };

        this.playByPlayEvents.push(ev);
        this.undoneEventsStack = [];
        this._renderHUD();
      };
    });

    const btnFinish = this.container.querySelector("#btn-hud-finish");
    if (btnFinish) {
      btnFinish.onclick = (e) => {
        e.preventDefault();
        this._closeModalLayer();
        this.currentStep = 4;
        this.render();
      };
    }
  }

  _bindModalDynamicEvents() {
    const portal = document.getElementById("hud-dynamic-modal-portal");
    if (!portal) return;

    portal.querySelectorAll(".btn-close-modal").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        this._closeModalLayer();
      };
    });

    const courtArea = portal.querySelector("#modal-court-clickarea");
    if (courtArea) {
      courtArea.onclick = (e) => {
        const rect = courtArea.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        if (this.pendingAction) {
          this.pendingAction.coord_x = parseFloat(x.toFixed(1));
          this.pendingAction.coord_y = parseFloat(y.toFixed(1));
        }

        const picker = portal.querySelector("#shot-player-picker");
        if (picker) picker.style.display = "block";
      };
    }

    portal.querySelectorAll(".btn-select-shot-player").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const playerId = btn.getAttribute("data-id");
        const playerName = btn.getAttribute("data-name");

        if (this.pendingAction?.points > 0) {
          this.teamScore += this.pendingAction.points;
        }

        const actionKey = this.pendingAction.shotType === "T3"
          ? (this.pendingAction.made ? "fg3_made" : "fg3_attempted")
          : (this.pendingAction.made ? "fg2_made" : "fg2_attempted");

        const maxPeriodSec = this._getPeriodDuration(this.currentPeriod);
        const elapsedSec = Math.max(0, maxPeriodSec - this.timeRemaining);
        const minute = Math.floor(elapsedSec / 60) + 1;

        const ev = {
          id: `ev-${Date.now()}`,
          isOpponent: false,
          period: this.currentPeriod,
          timeRemaining: this.timeRemaining,
          minute: minute,
          action: actionKey,
          action_type: actionKey,
          event_type: actionKey,
          actionLabel: this._getActionLabelSpanish(actionKey),
          points: this.pendingAction.points,
          teamScore: this.teamScore,
          opponentScore: this.opponentScore,
          playerId,
          player_id: playerId,
          playerName,
          coord_x: this.pendingAction.coord_x ?? 50,
          coord_y: this.pendingAction.coord_y ?? 50,
          made: this.pendingAction.made,
          onCourt: [...this.onCourtPlayerIds]
        };

        this.playByPlayEvents.push(ev);
        this.undoneEventsStack = [];
        this._closeModalLayer();
        this._renderHUD();
      };
    });

    portal.querySelectorAll(".btn-direct-player-choice").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const playerId = btn.getAttribute("data-id");
        const playerName = btn.getAttribute("data-name");

        if (this.pendingAction?.points > 0) {
          this.teamScore += this.pendingAction.points;
        }

        const actionKey = this.pendingAction.action;
        const maxPeriodSec = this._getPeriodDuration(this.currentPeriod);
        const elapsedSec = Math.max(0, maxPeriodSec - this.timeRemaining);
        const minute = Math.floor(elapsedSec / 60) + 1;

        const isMade = String(actionKey).endsWith("_made") || String(actionKey).includes("made");

        const ev = {
          id: `ev-${Date.now()}`,
          isOpponent: false,
          period: this.currentPeriod,
          timeRemaining: this.timeRemaining,
          minute: minute,
          action: actionKey,
          action_type: actionKey,
          event_type: actionKey,
          actionLabel: this._getActionLabelSpanish(actionKey),
          points: this.pendingAction.points,
          teamScore: this.teamScore,
          opponentScore: this.opponentScore,
          playerId,
          player_id: playerId,
          playerName,
          made: isMade,
          onCourt: [...this.onCourtPlayerIds]
        };

        this.playByPlayEvents.push(ev);
        this.undoneEventsStack = [];
        this._closeModalLayer();
        this._renderHUD();
      };
    });

    portal.querySelectorAll(".btn-clock-adj").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const unit = btn.getAttribute("data-unit");
        const val = Number(btn.getAttribute("data-val"));
        const maxPeriodSec = this._getPeriodDuration(this.currentPeriod);

        let m = Math.floor(this.timeRemaining / 60);
        let s = this.timeRemaining % 60;

        if (unit === "min") m = Math.max(0, Math.min(Math.floor(maxPeriodSec / 60), m + val));
        if (unit === "s1") s = Math.max(0, Math.min(59, s + (val * 10)));
        if (unit === "s2") s = Math.max(0, Math.min(59, s + val));

        this.timeRemaining = Math.min(maxPeriodSec, (m * 60) + s);
        this._renderModalLayer();
      };
    });

    portal.querySelectorAll(".btn-sub-toggle-player").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const pId = btn.getAttribute("data-id");
        if (this.pendingSubOnCourt.includes(pId)) {
          this.pendingSubOnCourt = this.pendingSubOnCourt.filter(id => id !== pId);
        } else {
          if (this.pendingSubOnCourt.length >= 5) {
            alert("Ya hay 5 jugadores seleccionados para estar en pista.");
            return;
          }
          this.pendingSubOnCourt.push(pId);
        }
        this._renderModalLayer();
      };
    });

    const btnConfirmSub = portal.querySelector("#btn-confirm-substitution");
    if (btnConfirmSub) {
      btnConfirmSub.onclick = (e) => {
        e.preventDefault();
        if (this.pendingSubOnCourt.length !== 5) return;

        const playersOut = this.onCourtPlayerIds.filter(id => !this.pendingSubOnCourt.includes(id));
        const playersIn = this.pendingSubOnCourt.filter(id => !this.onCourtPlayerIds.includes(id));

        this.onCourtPlayerIds = [...this.pendingSubOnCourt];

        this.subEvents.push({
          id: `sub-${Date.now()}`,
          type: 'SUBSTITUTION',
          period: this.currentPeriod,
          timeRemaining: this.timeRemaining,
          playersIn,
          playersOut,
          onCourt: [...this.onCourtPlayerIds]
        });

        this._closeModalLayer();
        this._renderHUD();
      };
    }

    portal.querySelectorAll(".btn-del-pbp-event").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-id");
        this.playByPlayEvents = this.playByPlayEvents.filter(ev => ev.id !== id);
        this._recalculateScoreFromEvents();
        this._renderModalLayer();
        this._renderHUD();
      };
    });
  }

  _recalculateScoreFromEvents() {
    let t = 0, opp = 0;
    this.playByPlayEvents.forEach(ev => {
      if (ev.isOpponent) {
        opp += ev.points || 0;
      } else {
        t += ev.points || 0;
      }
    });
    this.teamScore = t;
    this.opponentScore = opp;
  }

  _renderPostGameActa() {
    this._closeModalLayer();
    const convoked = this.roster.filter(p => p.isConvoked);
    
    let totalGameSeconds = 0;
    this.periodsList.forEach(p => {
      totalGameSeconds += this._getPeriodDuration(p);
    });

    const totalGameMinutes = Math.round(totalGameSeconds / 60);
    const expectedSumMinutes = totalGameMinutes * 5;

    const calculatedMinutesMap = new Map();
    convoked.forEach(p => calculatedMinutesMap.set(p.id, 0));

    if (this.subEvents.length > 0) {
      this.periodsList.forEach(periodName => {
        const periodSec = this._getPeriodDuration(periodName);
        const pSubs = this.subEvents.filter(s => s.period === periodName);
        
        if (pSubs.length === 0) return;

        let lastTime = periodSec;
        let currentFive = pSubs[0].onCourt;

        pSubs.forEach(sub => {
          const duration = Math.max(0, lastTime - sub.timeRemaining);
          currentFive.forEach(pId => {
            calculatedMinutesMap.set(pId, (calculatedMinutesMap.get(pId) || 0) + (duration / 60));
          });
          lastTime = sub.timeRemaining;
          currentFive = sub.onCourt;
        });

        currentFive.forEach(pId => {
          calculatedMinutesMap.set(pId, (calculatedMinutesMap.get(pId) || 0) + (lastTime / 60));
        });
      });
    } else {
      const startersIds = this.roster.filter(p => p.isStarter).map(p => p.id).slice(0, 5);
      startersIds.forEach(pId => {
        calculatedMinutesMap.set(pId, totalGameMinutes);
      });
    }

    const playerStatsMap = new Map();
    convoked.forEach(p => {
      const autoMin = Math.round(calculatedMinutesMap.get(p.id) || 0);
      playerStatsMap.set(p.id, {
        id: p.id,
        name: p.name,
        jersey: p.jersey,
        min: autoMin,
        pts: 0, t2m: 0, t2a: 0, t3m: 0, t3a: 0, ftm: 0, fta: 0,
        reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fouls: 0, foulsDrawn: 0
      });
    });

    this.playByPlayEvents.forEach(ev => {
      const pId = ev.player_id || ev.playerId;
      if (!ev.isOpponent && pId && playerStatsMap.has(pId)) {
        const st = playerStatsMap.get(pId);
        if (ev.action === "fg2_made") { st.t2m++; st.t2a++; st.pts += 2; }
        else if (ev.action === "fg2_attempted") { st.t2a++; }
        else if (ev.action === "fg3_made") { st.t3m++; st.t3a++; st.pts += 3; }
        else if (ev.action === "fg3_attempted") { st.t3a++; }
        else if (ev.action === "ft_made") { st.ftm++; st.fta++; st.pts += 1; }
        else if (ev.action === "ft_attempted") { st.fta++; }
        else if (ev.action === "off_reb") { st.reb++; st.oreb++; }
        else if (ev.action === "def_reb") { st.reb++; st.dreb++; }
        else if (ev.action === "assists") { st.ast++; }
        else if (ev.action === "steals") { st.stl++; }
        else if (ev.action === "blocks_made") { st.blk++; }
        else if (ev.action === "turnovers") { st.tov++; }
        else if (ev.action === "fouls_committed") { st.fouls++; }
        else if (ev.action === "fouls_drawn") { st.foulsDrawn++; }
      }
    });

    let currentSumMin = 0;
    let sumPts = 0, sumT2m = 0, sumT2a = 0, sumT3m = 0, sumT3a = 0, sumFtm = 0, sumFta = 0, sumReb = 0, sumAst = 0, sumFouls = 0, sumPir = 0;

    const rowsMarkup = convoked.map(p => {
      const st = playerStatsMap.get(p.id);
      currentSumMin += st.min;
      sumPts += st.pts;
      sumT2m += st.t2m;
      sumT2a += st.t2a;
      sumT3m += st.t3m;
      sumT3a += st.t3a;
      sumFtm += st.ftm;
      sumFta += st.fta;
      sumReb += st.reb;
      sumAst += st.ast;
      sumFouls += st.fouls;

      const pir = BoxScoreCalculator ? (BoxScoreCalculator.calculatePlayerBoxScore({
        points: st.pts, fg2_made: st.t2m, fg2_attempted: st.t2a,
        fg3_made: st.t3m, fg3_attempted: st.t3a, ft_made: st.ftm, ft_attempted: st.fta,
        off_reb: st.oreb, def_reb: st.dreb, assists: st.ast, steals: st.stl,
        blocks: st.blk, turnovers: st.tov, fouls_committed: st.fouls, fouls_drawn: st.foulsDrawn
      }).pir || 0) : (st.pts + st.reb + st.ast + st.stl + st.blk + st.foulsDrawn - (st.t2a - st.t2m) - (st.t3a - st.t3m) - (st.fta - st.ftm) - st.tov - st.fouls);

      sumPir += pir;

      return `
        <tr data-player-id="${p.id}" style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 10px; font-weight: 800; color: #0f172a;">#${st.jersey} ${st.name}</td>
          <td style="padding: 6px; text-align: center;">
            <input type="number" class="input-acta-min" data-id="${p.id}" value="${st.min}" style="width: 58px; height: 34px; text-align: center; font-weight: 900; font-size: 14px; border: 1.5px solid #cbd5e1; border-radius: 6px; color: #0f172a !important; background: #ffffff !important; padding: 2px 4px; box-sizing: border-box;" />
          </td>
          <td style="padding: 6px; text-align: center; font-weight: 900; color: #1e3a8a;">${st.pts}</td>
          <td style="padding: 6px; text-align: center;">${st.t2m}/${st.t2a}</td>
          <td style="padding: 6px; text-align: center;">${st.t3m}/${st.t3a}</td>
          <td style="padding: 6px; text-align: center;">${st.ftm}/${st.fta}</td>
          <td style="padding: 6px; text-align: center;">${st.reb}</td>
          <td style="padding: 6px; text-align: center;">${st.ast}</td>
          <td style="padding: 6px; text-align: center; color: #ef4444;">${st.fouls}</td>
          <td style="padding: 6px; text-align: center; font-weight: 900; color: #a855f7;">${pir}</td>
        </tr>
      `;
    }).join("");

    const isSumValid = currentSumMin === expectedSumMinutes;

    this.container.innerHTML = `
      <div style="max-width: 1100px; margin: 0 auto; font-family: system-ui, sans-serif; padding-bottom: 60px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 900; color: #0f172a; margin: 0;">📋 Acta Oficial & Cierre de Partido</h1>
            <span style="font-size: 13px; color: #64748b;">Resultado Final: <strong>${this.teamScore} - ${this.opponentScore}</strong> vs ${this.config.opponent || 'Rival'}</span>
          </div>
          <button type="button" id="btn-back-to-hud" style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 10px 18px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer;">
            ← Volver al HUD en Vivo
          </button>
        </div>

        <div id="banner-sum-status" style="background: ${isSumValid ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isSumValid ? '#bbf7d0' : '#fecaca'}; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong id="lbl-sum-title" style="font-size: 13px; color: ${isSumValid ? '#15803d' : '#991b1b'}; display: block;">
              ${isSumValid ? '✅ Cuadre de Minutos Perfecto' : '⚠️ Descuadre en Suma Total de Minutos'}
            </strong>
            <span id="lbl-sum-desc" style="font-size: 12px; color: ${isSumValid ? '#166534' : '#7f1d1d'};">
              Suma actual: <strong id="lbl-sum-min">${currentSumMin} min</strong> (Esperado: ${expectedSumMinutes} min para ${totalGameMinutes} min de partido).
            </span>
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow-x: auto; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
                <th style="padding: 10px;">JUGADOR</th>
                <th style="padding: 10px; text-align: center;">MIN</th>
                <th style="padding: 10px; text-align: center; color: #1e3a8a;">PTS</th>
                <th style="padding: 10px; text-align: center;">T2</th>
                <th style="padding: 10px; text-align: center;">T3</th>
                <th style="padding: 10px; text-align: center;">TL</th>
                <th style="padding: 10px; text-align: center;">REB</th>
                <th style="padding: 10px; text-align: center;">AST</th>
                <th style="padding: 10px; text-align: center; color: #ef4444;">FALTAS</th>
                <th style="padding: 10px; text-align: center; color: #a855f7;">VAL FIBA</th>
              </tr>
            </thead>
            <tbody>${rowsMarkup}</tbody>
            <tfoot style="background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 900; font-size: 12px; color: #0f172a;">
              <tr>
                <td style="padding: 12px 10px;">TOTALES EQUIPO</td>
                <td id="tot-min" style="padding: 12px 6px; text-align: center; color: ${isSumValid ? '#15803d' : '#dc2626'};">${currentSumMin}</td>
                <td style="padding: 12px 6px; text-align: center; color: #1e3a8a;">${sumPts}</td>
                <td style="padding: 12px 6px; text-align: center;">${sumT2m}/${sumT2a}</td>
                <td style="padding: 12px 6px; text-align: center;">${sumT3m}/${sumT3a}</td>
                <td style="padding: 12px 6px; text-align: center;">${sumFtm}/${sumFta}</td>
                <td style="padding: 12px 6px; text-align: center;">${sumReb}</td>
                <td style="padding: 12px 6px; text-align: center;">${sumAst}</td>
                <td style="padding: 12px 6px; text-align: center; color: #ef4444;">${sumFouls}</td>
                <td style="padding: 12px 6px; text-align: center; color: #a855f7;">${sumPir}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <button type="button" id="btn-save-final-game" style="width: 100%; background: #f97316; color: #ffffff; border: none; padding: 14px; border-radius: 10px; font-weight: 900; font-size: 15px; cursor: pointer; box-shadow: 0 4px 12px rgba(249,115,22,0.35);">
          💾 GUARDAR PARTIDO Y GENERAR INFORMES
        </button>
      </div>
    `;

    this._bindActaEvents(playerStatsMap, expectedSumMinutes, totalGameMinutes);
  }

  _bindActaEvents(playerStatsMap, expectedSumMinutes, totalGameMinutes) {
    const btnBack = this.container.querySelector("#btn-back-to-hud");
    if (btnBack) {
      btnBack.onclick = (e) => {
        e.preventDefault();
        this.currentStep = 2;
        this.render();
      };
    }

    this.container.querySelectorAll(".input-acta-min").forEach(inp => {
      inp.addEventListener("input", () => {
        let total = 0;
        this.container.querySelectorAll(".input-acta-min").forEach(i => {
          total += Number(i.value || 0);
        });

        const lbl = this.container.querySelector("#lbl-sum-min");
        const totMinCell = this.container.querySelector("#tot-min");
        const banner = this.container.querySelector("#banner-sum-status");
        const lblTitle = this.container.querySelector("#lbl-sum-title");
        const lblDesc = this.container.querySelector("#lbl-sum-desc");

        if (lbl) lbl.textContent = `${total} min`;
        if (totMinCell) {
          totMinCell.textContent = total;
          totMinCell.style.color = total === expectedSumMinutes ? '#15803d' : '#dc2626';
        }

        if (banner && lblTitle && lblDesc) {
          const isValid = total === expectedSumMinutes;
          banner.style.background = isValid ? '#f0fdf4' : '#fef2f2';
          banner.style.borderColor = isValid ? '#bbf7d0' : '#fecaca';
          lblTitle.style.color = isValid ? '#15803d' : '#991b1b';
          lblTitle.textContent = isValid ? '✅ Cuadre de Minutos Perfecto' : '⚠️ Descuadre en Suma Total de Minutos';
          lblDesc.style.color = isValid ? '#166534' : '#7f1d1d';
          lblDesc.innerHTML = `Suma actual: <strong id="lbl-sum-min">${total} min</strong> (Esperado: ${expectedSumMinutes} min para ${totalGameMinutes} min de partido).`;
        }
      });
    });

    const btnSave = this.container.querySelector("#btn-save-final-game");
    if (btnSave) {
      btnSave.onclick = async (e) => {
        e.preventDefault();
        btnSave.disabled = true;
        btnSave.textContent = "⏳ Guardando partido y parciales...";

        const activeTeamId = DataStore.getActiveTeamId ? DataStore.getActiveTeamId() : null;
        const seasonId = DataStore.getActiveSeasonId ? DataStore.getActiveSeasonId() : null;

        const gameData = {
          team_id: activeTeamId,
          season_id: seasonId,
          date: this.config.date,
          time: "18:00",
          opponent: this.config.opponent,
          competition: "Liga",
          venue: this.config.venue,
          status: "Finalizado",
          team_score: this.teamScore,
          opponent_score: this.opponentScore,
          starter_ids: this.roster.filter(p => p.isConvoked && p.isStarter).map(p => p.id)
        };

        const statsList = [];
        this.container.querySelectorAll("tr[data-player-id]").forEach(tr => {
          const pId = tr.getAttribute("data-player-id");
          const st = playerStatsMap.get(pId);
          const mins = Number(tr.querySelector(".input-acta-min")?.value || 0);

          statsList.push({
            player_id: pId,
            starter: Boolean(this.roster.find(r => r.id === pId)?.isStarter),
            minutes: mins,
            points: st.pts,
            fg2_made: st.t2m,
            fg2_attempted: st.t2a,
            fg3_made: st.t3m,
            fg3_attempted: st.t3a,
            ft_made: st.ftm,
            ft_attempted: st.fta,
            off_reb: st.oreb,
            def_reb: st.dreb,
            rebounds: st.reb,
            assists: st.ast,
            steals: st.stl,
            blocks: st.blk,
            blocks_made: st.blk,
            blocks_received: 0,
            turnovers: st.tov,
            fouls_committed: st.fouls,
            fouls_drawn: st.foulsDrawn,
            plus_minus: 0
          });
        });

        // 🌟 CÁLCULO PRECISO DE PUNTOS POR CUARTO Y PRÓRROGA
        const computedPeriodScores = this.periodsList.map((pName) => {
          const isOt = pName.startsWith("OT");
          const pNum = parseInt(pName.replace(/[^\d]/g, ""), 10) || 1;
          const tScore = this.playByPlayEvents
            .filter(ev => ev.period === pName && !ev.isOpponent)
            .reduce((acc, ev) => acc + (Number(ev.points) || 0), 0);
          const oScore = this.playByPlayEvents
            .filter(ev => ev.period === pName && ev.isOpponent)
            .reduce((acc, ev) => acc + (Number(ev.points) || 0), 0);

          return {
            period_type: isOt ? "overtime" : "quarter",
            period_number: pNum,
            team_score: tScore,
            opponent_score: oScore,
            is_overtime: isOt
          };
        });

        const formattedEvents = this.playByPlayEvents.map((ev, index) => {
          const pId = ev.player_id || ev.playerId || null;
          const actionName = ev.action_type || ev.action || ev.event_type;
          const pNum = parseInt(String(ev.period || '1').replace(/[^\d]/g, ""), 10) || 1;

          return {
            id: ev.id || `ev-${Date.now()}-${index}`,
            player_id: pId,
            playerId: pId,
            playerName: ev.playerName || '',
            period: pNum,
            game_clock: String(ev.game_clock || '10:00'),
            action_type: actionName,
            action: actionName,
            event_type: actionName,
            points: Number(ev.points || 0),
            is_opponent: Boolean(ev.isOpponent),
            isOpponent: Boolean(ev.isOpponent),
            made: Boolean(ev.made),
            coord_x: ev.coord_x !== undefined && ev.coord_x !== null ? parseFloat(Number(ev.coord_x).toFixed(2)) : null,
            coord_y: ev.coord_y !== undefined && ev.coord_y !== null ? parseFloat(Number(ev.coord_y).toFixed(2)) : null
          };
        });

        try {
          await DataStore.saveGameAndStats(gameData, statsList, computedPeriodScores, formattedEvents);
          await DataStore.init(activeTeamId, true);

          alert("✅ Partido, cuartos y jugadas registradas con éxito.");
          
          if (window.location.hash === "#/games") {
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          } else {
            window.location.hash = "#/games";
          }
        } catch (err) {
          console.error("Error guardando partido:", err);
          alert(`❌ Error al guardar: ${err.message || err}`);
          btnSave.disabled = false;
          btnSave.textContent = "💾 GUARDAR PARTIDO Y GENERAR INFORMES";
        }
      };
    }
  }
}

if (!document.getElementById("livescore-hud-custom-styles")) {
  const styleEl = document.createElement("style");
  styleEl.id = "livescore-hud-custom-styles";
  styleEl.textContent = `
    .hud-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; }
    .hud-input, .hud-select { width: 100%; height: 38px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; padding: 4px 8px; color: #0f172a; background: #ffffff; box-sizing: border-box; }
    .hud-action-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
    .hud-card-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; }
    .btn-action-shot, .btn-action-direct, .btn-opp-action { border: none; color: #ffffff; padding: 12px 6px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; min-height: 48px; display: flex; align-items: center; justify-content: center; text-align: center; }
    .hud-modal-overlay {
      position: fixed !important; inset: 0 !important; background: rgba(15, 23, 42, 0.8) !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
      z-index: 999999 !important; padding: 16px !important; box-sizing: border-box !important;
    }
    .hud-modal-content {
      background: #ffffff !important; border-radius: 14px !important; padding: 20px !important;
      width: 100% !important; box-shadow: 0 10px 30px rgba(0,0,0,0.4) !important;
      box-sizing: border-box !important; max-height: 90vh !important; overflow-y: auto !important;
    }
    .btn-clock-adj {
      background: #1e293b; color: #38bdf8; border: 1px solid #334155;
      padding: 4px 10px; border-radius: 4px; font-weight: 900; cursor: pointer;
    }
  `;
  document.head.appendChild(styleEl);
}

export default LiveScoreHUDView;