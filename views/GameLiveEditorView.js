/**
 * @fileoverview Vista de Presentación: Anotación en Vivo y Edición de Partido (GameLiveEditorView.js).
 * @description Permite registrar acciones punto a punto durante el partido y añadir prórrogas dinámicas.
 */

import { i18n } from "../core-modules/i18n/I18nEngine.js";

export class GameLiveEditorView {
  /**
   * @param {Object} gameController - Instancia del GameController de tu app.
   */
  constructor(gameController) {
    this.controller = gameController;
    this.supabase = gameController?.syncEngine?.supabase || window.supabase;
  }

  _fetchSupabaseClient() {
    if (this.supabase) return this.supabase;
    if (window.supabase) return window.supabase;
    return null;
  }

  /**
   * Carga el partido activo de Supabase o devuelve una entidad por defecto.
   */
  async _fetchActiveGame(gameId) {
    const client = this._fetchSupabaseClient();
    if (!client) return null;

    try {
      let query = client.from("games").select("*");
      if (gameId) {
        query = query.eq("id", gameId);
      } else {
        // Si no hay ID de partido, busca el último partido en progreso o programado
        query = query.order("created_at", { ascending: false }).limit(1);
      }

      const { data } = await query.maybeSingle();
      
      if (!data) return null;

      // Estructurar periodos si vienen en JSON o como campos sueltos
      const periods = data.periods || [
        { period: 1, teamScore: data.q1_us || 0, opponentScore: data.q1_them || 0, isOvertime: false },
        { period: 2, teamScore: data.q2_us || 0, opponentScore: data.q2_them || 0, isOvertime: false },
        { period: 3, teamScore: data.q3_us || 0, opponentScore: data.q3_them || 0, isOvertime: false },
        { period: 4, teamScore: data.q4_us || 0, opponentScore: data.q4_them || 0, isOvertime: false }
      ];

      return {
        id: data.id,
        teamScore: data.team_score ?? data.our_score ?? 0,
        opponent: data.opponent || "Rival",
        opponentScore: data.opponent_score ?? data.opp_score ?? 0,
        periods
      };
    } catch (err) {
      console.error("Error cargando partido activo en GameLiveEditorView:", err);
      return null;
    }
  }

  /**
   * Genera el HTML manteniendo tu marcado original.
   */
  _buildMarkup(gameInstance) {
    let periodsHeader = "";
    let teamScoresRow = "";
    let oppScoresRow = "";

    const translate = (key, params) => {
      return (typeof i18n !== "undefined" && i18n?.t) 
        ? i18n.t(key, params) 
        : (key === "overtime_short" ? `PR${params?.number || 1}` : `Q${params?.number || 1}`);
    };

    if (gameInstance && gameInstance.periods) {
      gameInstance.periods.forEach((p) => {
        const periodLabel = p.isOvertime ? 
          translate("overtime_short", { number: p.overtimeNumber || 1 }) : 
          translate("quarter_short", { number: p.period });

        periodsHeader += `<th>${periodLabel}</th>`;
        teamScoresRow += `<td>${p.teamScore}</td>`;
        oppScoresRow += `<td>${p.opponentScore}</td>`;
      });
    }

    const otNumber = Math.max(1, (gameInstance?.periods?.length || 4) - 3);
    const otLabel = translate("overtime", { number: otNumber });

    return `
      <div class="game-live-editor-view" style="padding: 24px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; font-family: system-ui, sans-serif;">
        <header class="game-live-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
          <div class="team-block" style="text-align: center;">
            <h3 style="margin: 0 0 8px 0; color: #0f172a;">Mi Equipo</h3>
            <span class="total-score" style="font-size: 36px; font-weight: 900; color: #1e3a8a;">${gameInstance ? gameInstance.teamScore : 0}</span>
          </div>
          <div class="vs" style="font-weight: 800; color: #94a3b8; font-size: 18px;">VS</div>
          <div class="team-block" style="text-align: center;">
            <h3 style="margin: 0 0 8px 0; color: #0f172a;">${gameInstance ? gameInstance.opponent : "Rival"}</h3>
            <span class="total-score" style="font-size: 36px; font-weight: 900; color: #f97316;">${gameInstance ? gameInstance.opponentScore : 0}</span>
          </div>
        </header>

        <!-- Marcador Parcial (Soporta N Prórrogas) -->
        <table class="period-scores-table" style="width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f8fafc; font-size: 12px; color: #64748b; text-transform: uppercase;">${periodsHeader}</tr>
          </thead>
          <tbody>
            <tr style="font-weight: 700; color: #1e3a8a; font-size: 16px;">${teamScoresRow}</tr>
            <tr style="font-weight: 700; color: #f97316; font-size: 16px;">${oppScoresRow}</tr>
          </tbody>
        </table>

        <!-- Control para Añadir Prórroga -->
        <div class="live-controls" style="display: flex; justify-content: flex-end; gap: 12px;">
          <button id="btnAddOvertime" class="btn-secondary" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; padding: 10px 16px; border-radius: 8px; font-weight: 700; cursor: pointer;">
            + ${otLabel}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Conecta los botones visuales con GameController
   */
  _attachEventListeners(container, gameInstance) {
    const btnAddOvertime = container.querySelector("#btnAddOvertime");
    if (btnAddOvertime) {
      btnAddOvertime.addEventListener("click", async () => {
        if (!gameInstance?.id) {
          alert("No hay un partido activo para añadir prórroga.");
          return;
        }

        try {
          if (this.controller && typeof this.controller.addPeriodResult === "function") {
            // Llama a tu GameController real
            await this.controller.addPeriodResult(gameInstance.id, 0, 0);
            alert("Prórroga añadida correctamente.");
            // Re-renderizar para actualizar la tabla
            this.render(container, gameInstance.id);
          } else {
            console.warn("GameController no conectado aún.");
          }
        } catch (err) {
          alert(`Error al añadir prórroga: ${err.message}`);
        }
      });
    }
  }

  /**
   * Render adaptativo para el router de IQBasketApp
   */
  async render(param1 = "main-content", param2) {
    let container = typeof param1 === "string" ? document.getElementById(param1) : param1;
    if (!container) container = document.querySelector(".main-content") || document.body;

    let gameInstance = null;

    // Si el parámetro ya es un objeto GameInstance, usarlo directo; si es un ID/String, buscarlo en Supabase
    if (param1 && typeof param1 === "object" && param1.teamScore !== undefined) {
      gameInstance = param1;
    } else {
      const gameId = typeof param2 === "string" ? param2 : (typeof param1 === "string" && param1 !== "main-content" ? param1 : null);
      gameInstance = await this._fetchActiveGame(gameId);
    }

    const htmlContent = this._buildMarkup(gameInstance);
    container.innerHTML = htmlContent;

    this._attachEventListeners(container, gameInstance);
    return htmlContent;
  }
}