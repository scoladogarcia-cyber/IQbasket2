/**
 * @fileoverview Vista de Presentación: Ficha de Jugador (PlayerStatsView.js).
 * @description Muestra el perfil y métricas acumuladas. Aplica la regla de privacidad para el rol JUGADOR.
 */

import { i18n } from "../core-modules/i18n/I18nEngine.js";

export class PlayerStatsView {
  /**
   * @param {Object} authController - Instancia de AuthController.
   */
  constructor(authController) {
    this.auth = authController;
  }

  /**
   * Renderiza la ficha del jugador con restricción de privacidad.
   * 
   * @param {Object} playerInstance - Entidad Player.
   * @param {Array<Object>} playerGameStatsList - Historial de estadísticas del jugador.
   * @returns {string} Markup HTML.
   */
  render(playerInstance, playerGameStatsList = []) {
    // Regla de Seguridad y Privacidad: Un JUGADOR solo ve su propio perfil
    if (this.auth.hasRole("JUGADOR")) {
      const currentUserId = this.auth.getCurrentUser()?.id;
      if (String(playerInstance.id) !== String(currentUserId)) {
        return `<div class="error-msg">${i18n.t("permission_denied")}</div>`;
      }
    }

    const gp = playerGameStatsList.length || 1;
    let totalPts = 0, totalReb = 0, totalAst = 0, totalPir = 0, totalMin = 0;

    playerGameStatsList.forEach((s) => {
      totalPts += Number(s.points || 0);
      totalReb += Number(s.off_reb || 0) + Number(s.def_reb || 0);
      totalAst += Number(s.assists || 0);
      totalPir += Number(s.evaluation || 0);
      totalMin += Number(s.minutes || 0);
    });

    const ppg = (totalPts / gp).toFixed(1);
    const rpg = (totalReb / gp).toFixed(1);
    const apg = (totalAst / gp).toFixed(1);
    const pirG = (totalPir / gp).toFixed(1);
    const mpg = (totalMin / gp).toFixed(1);

    let historyRowsHtml = "";
    playerGameStatsList.forEach((s) => {
      historyRowsHtml += `
        <tr>
          <td>${s.game_date || "-"}</td>
          <td>${s.minutes}</td>
          <td><b>${s.points}</b></td>
          <td>${s.fg2_made}/${s.fg2_attempted}</td>
          <td>${s.fg3_made}/${s.fg3_attempted}</td>
          <td>${s.ft_made}/${s.ft_attempted}</td>
          <td>${(s.off_reb || 0) + (s.def_reb || 0)}</td>
          <td>${s.assists}</td>
          <td>${s.steals}</td>
          <td>${s.turnovers}</td>
          <td><b>${s.evaluation}</b></td>
          <td>${s.plus_minus > 0 ? "+" + s.plus_minus : s.plus_minus}</td>
        </tr>
      `;
    });

    return `
      <div class="player-stats-view">
        <header class="player-profile-card">
          <div class="avatar-box">
            ${playerInstance.photoUrl ? `<img src="${playerInstance.photoUrl}" alt="${playerInstance.fullName}"/>` : `<div class="jersey-badge">#${playerInstance.jersey}</div>`}
          </div>
          <div class="player-meta">
            <h2>#${playerInstance.jersey} ${playerInstance.fullName}</h2>
            <p><b>${i18n.t("position")}:</b> ${playerInstance.primaryPosition} | <b>Mano:</b> ${playerInstance.dominantHand}</p>
            <p><b>Notas:</b> ${playerInstance.notes || "Sin observaciones"}</p>
          </div>
        </header>

        <section class="kpi-grid">
          <div class="kpi-card"><span class="kpi-val">${ppg}</span><span class="kpi-lbl">${i18n.t("points")} / G</span></div>
          <div class="kpi-card"><span class="kpi-val">${rpg}</span><span class="kpi-lbl">${i18n.t("rebounds")} / G</span></div>
          <div class="kpi-card"><span class="kpi-val">${apg}</span><span class="kpi-lbl">${i18n.t("assists")} / G</span></div>
          <div class="kpi-card"><span class="kpi-val">${pirG}</span><span class="kpi-lbl">${i18n.t("pir")} / G</span></div>
          <div class="kpi-card"><span class="kpi-val">${mpg}</span><span class="kpi-lbl">${i18n.t("minutes_played")} / G</span></div>
        </section>

        <section class="table-container">
          <h3>Historial por Partido</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>MIN</th>
                <th>PTS</th>
                <th>2PM/A</th>
                <th>3PM/A</th>
                <th>FTM/A</th>
                <th>REB</th>
                <th>AST</th>
                <th>STL</th>
                <th>TOV</th>
                <th>PIR</th>
                <th>+/-</th>
              </tr>
            </thead>
            <tbody>
              ${historyRowsHtml || `<tr><td colspan="12">${i18n.t("no_data")}</td></tr>`}
            </tbody>
          </table>
        </section>
      </div>
    `;
  }
}