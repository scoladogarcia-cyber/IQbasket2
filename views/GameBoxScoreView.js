/**
 * @fileoverview Vista de Presentación: Box Score Completo del Partido (GameBoxScoreView.js).
 * @description Muestra el acta completa del partido, la tabla de parciales por cuarto/prórroga
 * y la comparativa estadística detallada de cada jugador.
 */

import { i18n } from "../core-modules/i18n/I18nEngine.js";

export class GameBoxScoreView {
  /**
   * Renderiza el Box Score del partido.
   * 
   * @param {Object} gameInstance - Entidad Game con marcadores y lista de periodos.
   * @param {Array<Object>} playersStatsList - Lista de estadísticas player_game_stats procesadas.
   * @returns {string} Markup HTML.
   */
  render(gameInstance, playersStatsList = []) {
    // 1. Dibuja los encabezados y puntuaciones parciales por cuarto/prórroga
    let periodHeaders = "";
    let teamScores = "";
    let oppScores = "";

    if (gameInstance && gameInstance.periods) {
      gameInstance.periods.forEach((p) => {
        const label = p.isOvertime ? 
          i18n.t("overtime_short", { number: p.overtimeNumber }) : 
          i18n.t("quarter_short", { number: p.period });

        periodHeaders += `<th>${label}</th>`;
        teamScores += `<td>${p.teamScore}</td>`;
        oppScores += `<td>${p.opponentScore}</td>`;
      });
    }

    // 2. Dibuja las filas del acta individual de jugadores
    let playersRows = "";
    playersStatsList.forEach((s) => {
      playersRows += `
        <tr>
          <td class="text-left">${s.starter ? "★ " : ""}${s.player_name || s.player_id}</td>
          <td>${s.minutes || 0}</td>
          <td><b>${s.points || 0}</b></td>
          <td>${s.fg2_made || 0}/${s.fg2_attempted || 0}</td>
          <td>${s.fg3_made || 0}/${s.fg3_attempted || 0}</td>
          <td>${s.ft_made || 0}/${s.ft_attempted || 0}</td>
          <td>${s.off_reb || 0}</td>
          <td>${s.def_reb || 0}</td>
          <td>${(s.off_reb || 0) + (s.def_reb || 0)}</td>
          <td>${s.assists || 0}</td>
          <td>${s.steals || 0}</td>
          <td>${s.blocks_made || 0}</td>
          <td>${s.turnovers || 0}</td>
          <td>${s.fouls_committed || 0}</td>
          <td><b>${s.evaluation || 0}</b></td>
          <td>${s.plus_minus > 0 ? "+" + s.plus_minus : (s.plus_minus || 0)}</td>
        </tr>
      `;
    });

    return `
      <div class="game-boxscore-view">
        <!-- Marcador Global -->
        <header class="scoreboard">
          <div class="score-team">
            <h2>Mi Equipo</h2>
            <span class="big-score">${gameInstance ? gameInstance.teamScore : 0}</span>
          </div>
          <div class="status-badge">${gameInstance ? gameInstance.status : "Finalizado"}</div>
          <div class="score-team">
            <h2>${gameInstance ? gameInstance.opponent : "Rival"}</h2>
            <span class="big-score">${gameInstance ? gameInstance.opponentScore : 0}</span>
          </div>
        </header>

        <!-- Tabla de Parciales (Cuartos y Prórrogas Ilimitadas) -->
        <section class="period-scores-wrapper">
          <h3>Parciales por Periodo</h3>
          <table class="period-table">
            <thead><tr><th>Equipo</th>${periodHeaders}</tr></thead>
            <tbody>
              <tr><td>Mi Equipo</td>${teamScores}</tr>
              <tr><td>${gameInstance ? gameInstance.opponent : "Rival"}</td>${oppScores}</tr>
            </tbody>
          </table>
        </section>

        <!-- Box Score Individual de Jugadores -->
        <section class="box-score-table-wrapper">
          <h3>Box Score Individual</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>${i18n.t("player")}</th>
                <th>MIN</th>
                <th>PTS</th>
                <th>2PM/A</th>
                <th>3PM/A</th>
                <th>FTM/A</th>
                <th>OREB</th>
                <th>DREB</th>
                <th>REB</th>
                <th>AST</th>
                <th>STL</th>
                <th>BLK</th>
                <th>TOV</th>
                <th>PF</th>
                <th>PIR</th>
                <th>+/-</th>
              </tr>
            </thead>
            <tbody>
              ${playersRows || `<tr><td colspan="16">${i18n.t("no_data")}</td></tr>`}
            </tbody>
          </table>
        </section>
      </div>
    `;
  }
}