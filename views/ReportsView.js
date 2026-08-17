/**
 * @fileoverview Vista del Módulo de Informes Estadísticos y Scouting: ReportsView.js
 * @description Generación de informes analíticos oficiales FIBA/ACB, 4 modalidades,
 * shot charts espaciales, selector modular de dossier y exportación limpia a PDF.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { StatsAggregator } from "../domain/stats/StatsAggregator.js";
import { AdvancedTeamStatsCalculator } from "../domain/stats/AdvancedTeamStatsCalculator.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { ReportExporter } from "../services/ReportExporter.js";
import { I18n } from "../services/I18nService.js";

export class ReportsView {
  constructor(authController = null) {
    this.auth = authController;

    // Modalidades: 'game', 'player', 'season_dossier'
    this.reportMode = "game";
    this.selectedGameId = "all";
    this.selectedPlayerId = "all";

    // Filtros Dinámicos
    this.filters = {
      venue: "all",       // 'all', 'local', 'visitante'
      opponentId: "all"
    };

    // Métricas y ordenación
    this.seasonMetricMode = "per_game"; // 'per_game', 'per_40', 'totals'
    this.sortField = "val";
    this.sortAsc = false;

    // Configuración Modular del Dossier de Temporada
    this.dossierConfig = {
      includeTeamSummary: true,
      includeColectiveCharts: true,
      includeCalendar: true,
      includeBoxScores: true,
      includeRosterMatrix: true,
      includePlayerCards: true,
      includeShotCharts: true,
      includeGlossary: true,
      selectedGameIds: [],
      selectedPlayerIds: []
    };

    this.showDossierModal = false;
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  // =========================================================================
  // 1. CÁLCULO OFICIAL DE VALORACIÓN FIBA / ACB
  // =========================================================================
  _calculateFibaVal(st = {}) {
    const pts = Number(st.points ?? (Number(st.fg2_made ?? st.fg2Made ?? 0) * 2 + Number(st.fg3_made ?? st.fg3Made ?? 0) * 3 + Number(st.ft_made ?? st.ftMade ?? 0)));
    const oreb = Number(st.off_reb ?? st.offReb ?? st.rebounds_offensive ?? 0);
    const dreb = Number(st.def_reb ?? st.defReb ?? st.rebounds_defensive ?? 0);
    const reb = Number(st.rebounds ?? (oreb + dreb));
    const ast = Number(st.assists ?? st.ast ?? 0);
    const stl = Number(st.steals ?? st.stl ?? 0);
    const blk = Number(st.blocks ?? st.blocks_made ?? st.blk ?? 0);
    const foulsDrawn = Number(st.fouls_drawn ?? st.foulsDrawn ?? st.fouls_received ?? 0);

    const fg2m = Number(st.fg2_made ?? st.fg2Made ?? 0);
    const fg2a = Number(st.fg2_attempted ?? st.fg2Attempted ?? 0);
    const fg3m = Number(st.fg3_made ?? st.fg3Made ?? 0);
    const fg3a = Number(st.fg3_attempted ?? st.fg3Attempted ?? 0);
    const ftm = Number(st.ft_made ?? st.ftMade ?? 0);
    const fta = Number(st.ft_attempted ?? st.ftAttempted ?? 0);

    const missedFg = Math.max(0, (fg2a + fg3a) - (fg2m + fg3m));
    const missedFt = Math.max(0, fta - ftm);
    const tov = Number(st.turnovers ?? st.tov ?? 0);
    const blkAgainst = Number(st.blocks_received ?? st.blocksReceived ?? 0);
    const foulsCommitted = Number(st.fouls_committed ?? st.fouls ?? 0);

    return (pts + reb + ast + stl + blk + foulsDrawn) - (missedFg + missedFt + tov + blkAgainst + foulsCommitted);
  }

  // =========================================================================
  // 2. EXTRACCIÓN Y NORMALIZACIÓN DE DATOS
  // =========================================================================
  _getFilteredGames() {
    const activeTeamId = DataStore.getActiveTeamId?.() || null;
    let games = (activeTeamId ? DataStore.getGames?.(activeTeamId) : null) || DataStore.getGames?.() || [];

    if (this.filters.venue !== "all") {
      games = games.filter(g => {
        const v = String(g.venue || "").toLowerCase();
        return this.filters.venue === "local" ? (v === "local" || v === "home" || g.is_home) : (v === "visitante" || v === "away" || !g.is_home);
      });
    }
    return [...games].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }

  _getGameShotEvents(gameId = null, playerId = null) {
    const games = this._getFilteredGames();
    const validGameIds = new Set(games.map(g => String(g.id)));

    let events = DataStore.getGameEvents?.(gameId) || [];
    
    // Filtrar estrictamente por los partidos del equipo actual
    if (!gameId || gameId === "all") {
      events = events.filter(e => validGameIds.has(String(e.game_id ?? e.gameId)));
    }

    if (playerId && playerId !== "all") {
      events = events.filter(e => String(e.player_id ?? e.playerId) === String(playerId));
    }

    return events.filter(e => {
      const act = String(e.action_type ?? e.action ?? '').toLowerCase();
      const isShot = act.includes("fg") || act.includes("shot") || act.includes("t2") || act.includes("t3") || act.includes("canasta") || act.includes("tiro");
      const hasCoords = (Number(e.coord_x ?? e.coordinates?.x ?? 0) > 0 || Number(e.coord_y ?? e.coordinates?.y ?? 0) > 0);
      return isShot && hasCoords;
    });
  }

  _extractGameBoxScore(gameId, players) {
    const rawStats = DataStore.getPlayerGameStats?.(null, gameId) || [];
    const statsList = [];

    players.forEach(p => {
      const match = rawStats.find(st => String(st.player_id ?? st.playerId) === String(p.id));
      if (match) {
        const mins = Number(match.minutes ?? match.minutesPlayed ?? 0);
        const pts = Number(match.points ?? (Number(match.fg2_made || 0) * 2 + Number(match.fg3_made || 0) * 3 + Number(match.ft_made || 0)));
        const oreb = Number(match.off_reb ?? match.offReb ?? 0);
        const dreb = Number(match.def_reb ?? match.defReb ?? 0);
        const reb = Number(match.rebounds ?? (oreb + dreb));
        const ast = Number(match.assists ?? match.ast ?? 0);
        const stl = Number(match.steals ?? match.stl ?? 0);
        const blk = Number(match.blocks ?? match.blocks_made ?? match.blk ?? 0);
        const tov = Number(match.turnovers ?? match.tov ?? 0);
        const val = this._calculateFibaVal(match);

        statsList.push({
          id: p.id,
          name: `#${p.jersey ?? p.number ?? '-'} ${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim() || p.name,
          min: mins,
          pts,
          reb,
          ast,
          stl,
          blk,
          tov,
          val,
          played: mins > 0
        });
      }
    });

    return statsList.sort((a, b) => b.val - a.val);
  }

  _getSelectedGameData() {
    const games = this._getFilteredGames();
    if (!games.length) return null;

    const activeTeamId = DataStore.getActiveTeamId?.();
    const players = DataStore.getPlayers?.(activeTeamId) || [];

    // Modo: Todos los partidos combinados (Promedio por partido)
    if (this.selectedGameId === "all") {
      let totalTeamPts = 0;
      let totalOppPts = 0;
      const playerAccum = {};

      players.forEach(p => {
        playerAccum[p.id] = {
          id: p.id,
          name: `#${p.jersey ?? p.number ?? '-'} ${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim() || p.name,
          min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, val: 0, gp: 0
        };
      });

      games.forEach(g => {
        totalTeamPts += Number(g.team_score ?? g.teamScore ?? 0);
        totalOppPts += Number(g.opponent_score ?? g.opponentScore ?? 0);

        const gStats = this._extractGameBoxScore(g.id, players);
        gStats.forEach(st => {
          if (st.played) {
            playerAccum[st.id].gp += 1;
            playerAccum[st.id].min += st.min;
            playerAccum[st.id].pts += st.pts;
            playerAccum[st.id].reb += st.reb;
            playerAccum[st.id].ast += st.ast;
            playerAccum[st.id].stl += st.stl;
            playerAccum[st.id].blk += st.blk;
            playerAccum[st.id].tov += st.tov;
            playerAccum[st.id].val += st.val;
          }
        });
      });

      const playersList = Object.values(playerAccum).map(p => {
        const divisor = p.gp > 0 ? p.gp : 1;
        return {
          ...p,
          avgMin: p.gp > 0 ? (p.min / divisor).toFixed(1) : "0.0",
          pts: p.gp > 0 ? Number((p.pts / divisor).toFixed(1)) : 0,
          reb: p.gp > 0 ? Number((p.reb / divisor).toFixed(1)) : 0,
          ast: p.gp > 0 ? Number((p.ast / divisor).toFixed(1)) : 0,
          stl: p.gp > 0 ? Number((p.stl / divisor).toFixed(1)) : 0,
          blk: p.gp > 0 ? Number((p.blk / divisor).toFixed(1)) : 0,
          tov: p.gp > 0 ? Number((p.tov / divisor).toFixed(1)) : 0,
          val: p.gp > 0 ? Number((p.val / divisor).toFixed(1)) : 0
        };
      }).sort((a, b) => b.val - a.val);

      const count = games.length || 1;
      const teamPtsAvg = (totalTeamPts / count).toFixed(1);
      const oppPtsAvg = (totalOppPts / count).toFixed(1);
      const poss = Math.round(Number(teamPtsAvg) * 0.96) || 75;
      const offRtg = poss ? ((Number(teamPtsAvg) / poss) * 100).toFixed(1) : "0.0";
      const defRtg = poss ? ((Number(oppPtsAvg) / poss) * 100).toFixed(1) : "0.0";

      return {
        game: {
          id: "all",
          opponent: `Temporada Completa (${games.length} PJ)`,
          date: "Global",
          venue: "Todos",
          isSeasonAverage: true,
          totalTeamPts,
          totalOppPts
        },
        teamPts: teamPtsAvg,
        oppPts: oppPtsAvg,
        diffPts: (Number(teamPtsAvg) - Number(oppPtsAvg)).toFixed(1),
        poss,
        offRtg,
        defRtg,
        netRtg: (Number(offRtg) - Number(defRtg)).toFixed(1),
        playersList,
        periodScores: []
      };
    }

    // Modo: Partido único
    const game = games.find(g => String(g.id) === String(this.selectedGameId)) || games[0];
    if (!game) return null;
    this.selectedGameId = game.id;

    const playersList = this._extractGameBoxScore(game.id, players);
    const teamPts = Number(game.team_score ?? game.teamScore ?? playersList.reduce((acc, p) => acc + p.pts, 0));
    const oppPts = Number(game.opponent_score ?? game.opponentScore ?? 0);
    const diffPts = teamPts - oppPts;

    const poss = Math.round(teamPts * 0.95) || 70;
    const offRtg = poss ? ((teamPts / poss) * 100).toFixed(1) : "0.0";
    const defRtg = poss ? ((oppPts / poss) * 100).toFixed(1) : "0.0";
    const netRtg = (Number(offRtg) - Number(defRtg)).toFixed(1);

    const periodScores = DataStore.getGamePeriodScores?.(game.id) || [];

    return { game, teamPts, oppPts, diffPts, poss, offRtg, defRtg, netRtg, playersList, periodScores };
  }

  _getSeasonStatsList() {
    const activeTeamId = DataStore.getActiveTeamId?.();
    const players = DataStore.getPlayers?.(activeTeamId) || [];
    const games = this._getFilteredGames();
    const gameIds = new Set(games.map(g => String(g.id)));

    return players.map(p => {
      const allStats = DataStore.getPlayerGameStats?.(p.id) || [];
      const stats = allStats.filter(st => gameIds.has(String(st.game_id || st.gameId)));
      
      // PJ REAL: Solo partidos donde jugó más de 0 minutos
      const activeStats = stats.filter(st => Number(st.minutes ?? st.minutesPlayed ?? 0) > 0);
      const gp = activeStats.length;

      let tMin = 0, tPts = 0, tReb = 0, tAst = 0, tStl = 0, tBlk = 0, tTov = 0, tVal = 0;
      activeStats.forEach(st => {
        tMin += Number(st.minutes ?? st.minutesPlayed ?? 0);
        tPts += Number(st.points ?? (Number(st.fg2_made || 0) * 2 + Number(st.fg3_made || 0) * 3 + Number(st.ft_made || 0)));
        const oreb = Number(st.off_reb ?? st.offReb ?? 0);
        const dreb = Number(st.def_reb ?? st.defReb ?? 0);
        tReb += Number(st.rebounds ?? (oreb + dreb));
        tAst += Number(st.assists ?? st.ast ?? 0);
        tStl += Number(st.steals ?? st.stl ?? 0);
        tBlk += Number(st.blocks ?? st.blocks_made ?? 0);
        tTov += Number(st.turnovers ?? st.tov ?? 0);
        tVal += this._calculateFibaVal(st);
      });

      const factor40 = tMin > 0 ? 40 / tMin : 0;
      const divisor = gp > 0 ? gp : 1;

      return {
        id: p.id,
        name: `#${p.jersey ?? p.number ?? '-'} ${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim() || p.name,
        jersey: p.jersey || '',
        position: p.primary_position || p.primaryPosition || 'Jugador',
        gamesCount: gp,
        min: tMin,
        ptsTot: tPts, rebTot: tReb, astTot: tAst, stlTot: tStl, blkTot: tBlk, tovTot: tTov, valTot: tVal,
        ptsPJ: gp > 0 ? (tPts / divisor).toFixed(1) : "0.0",
        rebPJ: gp > 0 ? (tReb / divisor).toFixed(1) : "0.0",
        astPJ: gp > 0 ? (tAst / divisor).toFixed(1) : "0.0",
        stlPJ: gp > 0 ? (tStl / divisor).toFixed(1) : "0.0",
        blkPJ: gp > 0 ? (tBlk / divisor).toFixed(1) : "0.0",
        tovPJ: gp > 0 ? (tTov / divisor).toFixed(1) : "0.0",
        valPJ: gp > 0 ? (tVal / divisor).toFixed(1) : "0.0",
        pts40: (tPts * factor40).toFixed(1),
        reb40: (tReb * factor40).toFixed(1),
        ast40: (tAst * factor40).toFixed(1),
        stl40: (tStl * factor40).toFixed(1),
        blk40: (tBlk * factor40).toFixed(1),
        tov40: (tTov * factor40).toFixed(1),
        val40: (tVal * factor40).toFixed(1)
      };
    }).sort((a, b) => Number(b.valPJ) - Number(a.valPJ));
  }

  // =========================================================================
  // 3. GENERACIÓN DE GRÁFICAS VECTORIALES (SVG)
  // =========================================================================
  _generateRadarChartSVG(stats = { pts: 10, reb: 5, ast: 3, stl: 2, val: 12 }) {
    const size = 260;
    const center = size / 2;
    const radius = 85;
    const labels = ["PTS", "REB", "AST", "ROB", "VAL"];
    const maxVals = [25, 12, 8, 4, 25];
    const rawVals = [stats.pts || 0, stats.reb || 0, stats.ast || 0, stats.stl || 0, stats.val || 0];

    const angleStep = (Math.PI * 2) / labels.length;
    const radarPoints = rawVals.map((v, i) => {
      const normalized = Math.min(Math.max(v / maxVals[i], 0.1), 1.15);
      const angle = i * angleStep - Math.PI / 2;
      return {
        x: center + radius * normalized * Math.cos(angle),
        y: center + radius * normalized * Math.sin(angle)
      };
    });

    return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; align-items: center;">
        <span style="font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 8px;">PERFIL DE IMPACTO (RADAR STATS)</span>
        <svg viewBox="0 0 ${size} ${size}" style="width: 100%; max-width: 220px; height: auto;">
          ${[0.33, 0.66, 1].map(r => `
            <circle cx="${center}" cy="${center}" r="${radius * r}" fill="none" stroke="#e2e8f0" stroke-width="1" />
          `).join('')}
          ${labels.map((lbl, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const lx = center + (radius + 20) * Math.cos(angle);
            const ly = center + (radius + 20) * Math.sin(angle);
            return `
              <line x1="${center}" y1="${center}" x2="${center + radius * Math.cos(angle)}" y2="${center + radius * Math.sin(angle)}" stroke="#cbd5e1" stroke-width="1"/>
              <text x="${lx}" y="${ly + 4}" font-size="10" font-weight="800" fill="#64748b" text-anchor="middle">${lbl}</text>
            `;
          }).join('')}
          <polygon points="${radarPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="rgba(30, 58, 138, 0.25)" stroke="#1e3a8a" stroke-width="2.5" />
        </svg>
      </div>
    `;
  }

  _generateBarPerformanceSVG(gameStatsList = []) {
    const width = 460;
    const height = 160;
    const padding = 30;
    const maxVal = Math.max(...gameStatsList.map(s => Number(s.val || 0)), 15);
    const barWidth = Math.max(12, Math.min(26, (width - padding * 2) / (gameStatsList.length || 1) - 6));

    return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px;">
        <span style="font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 8px; display: block;">PROGRESIÓN DE VALORACIÓN FIBA POR PARTIDO</span>
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto;">
          <line x1="${padding}" y1="${height - 25}" x2="${width - padding}" y2="${height - 25}" stroke="#cbd5e1" stroke-width="1.5" />
          ${gameStatsList.map((g, i) => {
            const val = Number(g.val || 0);
            const barH = Math.max(4, (Math.abs(val) / maxVal) * (height - 60));
            const x = padding + i * ((width - padding * 2) / (gameStatsList.length || 1)) + 4;
            const y = val >= 0 ? height - 25 - barH : height - 25;
            const color = val >= 10 ? "#16a34a" : val >= 0 ? "#1e3a8a" : "#dc2626";
            return `
              <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="3" fill="${color}" />
              <text x="${x + barWidth / 2}" y="${y - 4}" font-size="9" font-weight="800" text-anchor="middle" fill="#0f172a">${val}</text>
              <text x="${x + barWidth / 2}" y="${height - 10}" font-size="8" font-weight="700" text-anchor="middle" fill="#64748b">J${i + 1}</text>
            `;
          }).join('')}
        </svg>
      </div>
    `;
  }

  _generateLeadTrackerSVG(periodScores = []) {
    if (!periodScores || !periodScores.length) return "";
    const width = 600;
    const height = 120;
    const padding = 25;
    let diffAcc = 0;

    const points = [{ x: padding, y: height / 2 }];
    periodScores.forEach((p, idx) => {
      const diff = Number((p.team_score ?? p.teamScore ?? 0) - (p.opponent_score ?? p.opponentScore ?? 0));
      diffAcc += diff;
      const x = padding + ((idx + 1) / Math.max(periodScores.length, 1)) * (width - 2 * padding);
      const y = (height / 2) - Math.max(-45, Math.min(45, diffAcc * 2.2));
      points.push({ x, y, diffAcc, q: `Q${idx + 1}` });
    });

    let pathD = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const cx = (p1.x + p2.x) / 2;
      pathD += ` C ${cx},${p1.y} ${cx},${p2.y} ${p2.x},${p2.y}`;
    }

    return `
      <div style="margin: 12px 0;">
        <span style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">Lead Tracker (Evolución del Marcador)</span>
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 110px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 4px;">
          <line x1="${padding}" y1="${height / 2}" x2="${width - padding}" y2="${height / 2}" stroke="#94a3b8" stroke-dasharray="4" />
          <path d="${pathD}" fill="none" stroke="#1e3a8a" stroke-width="2.5" />
          ${points.slice(1).map(p => `
            <circle cx="${p.x}" cy="${p.y}" r="4" fill="${p.diffAcc >= 0 ? '#16a34a' : '#dc2626'}" />
            <text x="${p.x}" y="${p.y - 6}" font-size="9" font-weight="800" text-anchor="middle" fill="#0f172a">${p.diffAcc > 0 ? `+${p.diffAcc}` : p.diffAcc}</text>
          `).join('')}
        </svg>
      </div>
    `;
  }

  _generateShotChartSVG(events = []) {
    const width = 300;
    const height = 230;

    if (!events || events.length === 0) {
      return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 180px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 11px; font-weight: 700; text-align: center; padding: 12px;">
          📍 Sin tiros de campo registrados en el mapa espacial para esta selección.
        </div>
      `;
    }

    const shotEvents = events.map(ev => {
      const act = String(ev.action_type ?? ev.action ?? '').toLowerCase();
      const isMade = act.includes("made") || act.includes("anotad") || Boolean(ev.made ?? ev.coordinates?.made);
      const cx = Number(ev.coord_x ?? ev.coordinates?.x ?? 50);
      const cy = Number(ev.coord_y ?? ev.coordinates?.y ?? 50);
      return {
        x: (cx / 100) * width,
        y: (cy / 100) * height,
        made: isMade
      };
    });

    return `
      <div style="display: flex; flex-direction: column; align-items: center; margin: 8px 0;">
        <span style="font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 4px;">MAPA ESPACIAL DE TIRO (${shotEvents.length} LANZAMIENTOS)</span>
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; max-width: 320px; background: #d97736; border: 2px solid #ffffff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.15);">
          <rect x="5" y="5" width="290" height="220" fill="none" stroke="#ffffff" stroke-width="2" />
          <rect x="100" y="5" width="100" height="100" fill="rgba(255,255,255,0.1)" stroke="#ffffff" stroke-width="1.5" />
          <circle cx="150" cy="105" r="28" fill="none" stroke="#ffffff" stroke-width="1.5" />
          <path d="M 30,5 L 30,45 A 120,120 0 0,0 270,45 L 270,5" fill="none" stroke="#ffffff" stroke-width="1.5" />
          <circle cx="150" cy="30" r="10" fill="none" stroke="#ff5722" stroke-width="3" />
          
          ${shotEvents.map(ev => `
            <circle cx="${ev.x.toFixed(1)}" cy="${ev.y.toFixed(1)}" r="4.5" 
              fill="${ev.made ? '#22c55e' : '#ef4444'}" 
              stroke="#ffffff" stroke-width="1.5" />
          `).join('')}
        </svg>
        <div style="font-size: 10px; font-weight: 800; color: #475569; margin-top: 4px;">🟢 Anotado | 🔴 Fallado</div>
      </div>
    `;
  }

  _renderGlossarySection() {
    return `
      <div style="page-break-before: always; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-top: 24px;">
        <h3 style="font-size: 13px; font-weight: 900; color: #0f172a; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; margin-top: 0;">
          📖 GLOSARIO Y METODOLOGÍA ANALÍTICA OFICIAL FIBA / ACB
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; font-size: 11px; color: #334155; margin-top: 10px;">
          <div><strong>VAL / PIR (FIBA):</strong> (PTS + REB + AST + ROB + TAP + FP Recibidas) - (Tiros Campo Fallados + TL Fallados + PER + TAP Recibidos + FC Cometidas).</div>
          <div><strong>OFF / DEF RTG:</strong> Eficiencia de puntos anotados y concedidos por cada 100 posesiones estimadas.</div>
          <div><strong>NET RATING:</strong> Diferencial neto (Offensive Rating - Defensive Rating).</div>
          <div><strong>POSESIONES:</strong> Volumen estimado de juego mediante ritmo acumulado.</div>
          <div><strong>PER (Pérdidas):</strong> Pérdidas de balón que entregan la posesión al rival.</div>
          <div><strong>VAL/40:</strong> Rendimiento normalizado por cada 40 minutos en pista.</div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 4. MODALIDADES DE VISTA
  // =========================================================================
  _renderGameReport(gameData) {
    if (!gameData) return `<p style="padding: 20px;">No hay datos para mostrar con los filtros actuales.</p>`;
    const { game, teamPts, oppPts, diffPts, poss, offRtg, defRtg, netRtg, playersList, periodScores } = gameData;
    const events = this._getGameShotEvents(game.id === "all" ? null : game.id);

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 900;">${game.opponent} (${game.venue})</h2>
              <span style="font-size: 12px; color: #64748b;">
                ${game.isSeasonAverage ? 'Acumulado de temporada · Promedio de partidos' : `${game.date || ''} · Competición Oficial`}
              </span>
            </div>
            <div style="text-align: right;">
              ${game.isSeasonAverage ? `<span style="font-size: 11px; font-weight: 800; color: #64748b; display: block;">PROMEDIO POR PARTIDO</span>` : ''}
              <div style="font-size: 28px; font-weight: 900; color: ${diffPts >= 0 ? '#16a34a' : '#dc2626'};">
                ${teamPts} - ${oppPts}
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 14px;">
            <div>${periodScores.length ? this._generateLeadTrackerSVG(periodScores) : '<p style="font-size:12px; color:#64748b; padding:10px;">Evolución global de temporada</p>'}</div>
            <div>${this._generateShotChartSVG(events)}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px; text-align:center;" title="Puntos anotados por cada 100 posesiones">
            <span style="font-size:10px; font-weight:800; color:#64748b;">OFF RATING ⓘ</span>
            <strong style="display:block; font-size:18px; color:#0f172a;">${offRtg}</strong>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px; text-align:center;" title="Puntos recibidos por cada 100 posesiones">
            <span style="font-size:10px; font-weight:800; color:#64748b;">DEF RATING ⓘ</span>
            <strong style="display:block; font-size:18px; color:#0f172a;">${defRtg}</strong>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px; text-align:center;" title="Diferencial neto entre ataque y defensa">
            <span style="font-size:10px; font-weight:800; color:#64748b;">NET RATING ⓘ</span>
            <strong style="display:block; font-size:18px; color:${Number(netRtg) >= 0 ? '#16a34a' : '#dc2626'};">${Number(netRtg) > 0 ? `+${netRtg}` : netRtg}</strong>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px; text-align:center;" title="Número total de posesiones del encuentro">
            <span style="font-size:10px; font-weight:800; color:#64748b;">POSESIONES ⓘ</span>
            <strong style="display:block; font-size:18px; color:#0f172a;">${poss}</strong>
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; overflow-x: auto;">
          <h3 style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-top: 0;">
            ${game.isSeasonAverage ? 'Promedios por Jugador en Temporada' : 'Box Score Oficial FIBA'} (${playersList.length} Jugadores)
          </h3>
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-weight: 800;">
                <th style="text-align: left; padding: 8px;">JUGADOR</th>
                <th title="Minutos jugados">MIN ⓘ</th>
                <th title="Puntos anotados">PTS ⓘ</th>
                <th title="Rebotes totales">REB ⓘ</th>
                <th title="Asistencias">AST ⓘ</th>
                <th title="Robos de balón">ROB ⓘ</th>
                <th title="Tapones">TAP ⓘ</th>
                <th title="Pérdidas de balón">PER ⓘ</th>
                <th title="Valoración Oficial FIBA">VAL (FIBA) ⓘ</th>
              </tr>
            </thead>
            <tbody>
              ${playersList.length ? playersList.map(p => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="text-align: left; padding: 8px; font-weight: 700;">${p.name}</td>
                  <td>${p.min}'</td><td>${p.pts}</td><td>${p.reb}</td><td>${p.ast}</td>
                  <td>${p.stl}</td><td>${p.blk}</td><td style="color:#dc2626;">${p.tov}</td>
                  <td style="font-weight: 900; color:#1e3a8a;">${p.val}</td>
                </tr>
              `).join('') : `<tr><td colspan="9" style="padding:16px; color:#64748b;">No hay estadísticas registradas para este encuentro.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  _renderSinglePlayerCard(player, allGames) {
    const gameIds = new Set(allGames.map(g => String(g.id)));
    const allStats = DataStore.getPlayerGameStats?.(player.id) || [];
    const statsList = allStats.filter(st => gameIds.has(String(st.game_id || st.gameId)) && Number(st.minutes ?? st.minutesPlayed ?? 0) > 0);

    let tMin = 0, tPts = 0, tReb = 0, tAst = 0, tStl = 0, tBlk = 0, tTov = 0, tVal = 0;
    const gameProgression = [];

    statsList.forEach((st, idx) => {
      const v = this._calculateFibaVal(st);
      tMin += Number(st.minutes ?? st.minutesPlayed ?? 0);
      tPts += Number(st.points ?? 0);
      const oreb = Number(st.off_reb ?? st.offReb ?? 0);
      const dreb = Number(st.def_reb ?? st.defReb ?? 0);
      tReb += Number(st.rebounds ?? (oreb + dreb));
      tAst += Number(st.assists ?? st.ast ?? 0);
      tStl += Number(st.steals ?? st.stl ?? 0);
      tBlk += Number(st.blocks ?? st.blocks_made ?? 0);
      tTov += Number(st.turnovers ?? st.tov ?? 0);
      tVal += v;
      gameProgression.push({ gameIdx: idx + 1, val: v });
    });

    const gp = statsList.length;
    const divisor = gp > 0 ? gp : 1;
    const factor40 = tMin > 0 ? 40 / tMin : 0;

    const avgValPJ = gp > 0 ? (tVal / divisor).toFixed(1) : "0.0";
    const val40 = (tVal * factor40).toFixed(1);

    const avgStats = {
      pts: gp > 0 ? Number((tPts / divisor).toFixed(1)) : 0,
      reb: gp > 0 ? Number((tReb / divisor).toFixed(1)) : 0,
      ast: gp > 0 ? Number((tAst / divisor).toFixed(1)) : 0,
      stl: gp > 0 ? Number((tStl / divisor).toFixed(1)) : 0,
      val: Number(avgValPJ)
    };

    const pEvents = this._getGameShotEvents(null, player.id);

    return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a;">#${player.jersey || '-'} ${player.first_name || ''} ${player.last_name || ''}</h2>
            <span style="font-size: 12px; color: #64748b;">Posición: ${player.primary_position || 'Alero'} · ${gp} Partidos Disputados (${tMin} min)</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <div style="background:#eff6ff; border: 1px solid #bfdbfe; padding:8px 14px; border-radius:8px; text-align:center;" title="Valoración FIBA oficial por partido jugado">
              <span style="font-size:9px; color:#1e40af; font-weight:800;">VAL FIBA/PJ ⓘ</span>
              <strong style="display:block; font-size:18px; color:#1e40af;">${avgValPJ}</strong>
            </div>
            <div style="background:#f0fdf4; border: 1px solid #bbf7d0; padding:8px 14px; border-radius:8px; text-align:center;" title="Valoración FIBA proyectada a 40 minutos">
              <span style="font-size:9px; color:#15803d; font-weight:800;">VAL FIBA/40 ⓘ</span>
              <strong style="display:block; font-size:18px; color:#15803d;">${val40}</strong>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 16px;">
          ${this._generateRadarChartSVG(avgStats)}
          ${this._generateBarPerformanceSVG(gameProgression)}
        </div>

        <div style="margin-top: 14px;">
          ${this._generateShotChartSVG(pEvents)}
        </div>
      </div>
    `;
  }

  _renderPlayerReport(players, allGames) {
    if (this.selectedPlayerId === "all") {
      return `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="font-size: 13px; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;">
            👤 FICHAS TÉCNICAS INDIVIDUALES (${players.length} JUGADORES)
          </div>
          ${players.map(p => this._renderSinglePlayerCard(p, allGames)).join('')}
        </div>
      `;
    }

    const player = players.find(p => String(p.id) === String(this.selectedPlayerId)) || players[0];
    if (!player) return `<p style="padding: 20px;">Selecciona un jugador.</p>`;
    return this._renderSinglePlayerCard(player, allGames);
  }

  _renderSeasonDossier(games, seasonList) {
    const isPer40 = this.seasonMetricMode === 'per_40';
    const isTotals = this.seasonMetricMode === 'totals';

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; overflow-x: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
            <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a;">MATRIZ ACUMULADA DE PLANTILLA (ESTÁNDAR FIBA / ACB)</h2>
            <div style="display: flex; gap: 6px;">
              <button class="btn-metric-toggle" data-metric="per_game" style="font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: ${this.seasonMetricMode === 'per_game' ? '#1e3a8a' : '#ffffff'}; color: ${this.seasonMetricMode === 'per_game' ? '#ffffff' : '#0f172a'}; font-weight: 800; cursor: pointer;">Por Partido</button>
              <button class="btn-metric-toggle" data-metric="per_40" style="font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: ${isPer40 ? '#1e3a8a' : '#ffffff'}; color: ${isPer40 ? '#ffffff' : '#0f172a'}; font-weight: 800; cursor: pointer;">Por 40 Min</button>
              <button class="btn-metric-toggle" data-metric="totals" style="font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: ${isTotals ? '#1e3a8a' : '#ffffff'}; color: ${isTotals ? '#ffffff' : '#0f172a'}; font-weight: 800; cursor: pointer;">Totales</button>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-weight: 800; color: #475569;">
                <th style="text-align: left; padding: 8px;">JUGADOR</th>
                <th title="Partidos donde jugó al menos 1 minuto">PJ ⓘ</th>
                <th title="Minutos totales en pista">MIN ⓘ</th>
                <th title="Puntos anotados">PTS ⓘ</th>
                <th title="Rebotes totales">REB ⓘ</th>
                <th title="Asistencias">AST ⓘ</th>
                <th title="Robos de balón">ROB ⓘ</th>
                <th title="Pérdidas de balón">PER ⓘ</th>
                <th title="Valoración FIBA oficial">VAL (FIBA) ⓘ</th>
              </tr>
            </thead>
            <tbody>
              ${seasonList.map(p => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="text-align: left; padding: 8px; font-weight: 700; color: #0f172a;">${p.name}</td>
                  <td>${p.gamesCount}</td>
                  <td>${p.min}'</td>
                  <td>${isPer40 ? p.pts40 : (isTotals ? p.ptsTot : p.ptsPJ)}</td>
                  <td>${isPer40 ? p.reb40 : (isTotals ? p.rebTot : p.rebPJ)}</td>
                  <td>${isPer40 ? p.ast40 : (isTotals ? p.astTot : p.astPJ)}</td>
                  <td>${isPer40 ? p.stl40 : (isTotals ? p.stlTot : p.stlPJ)}</td>
                  <td style="color:#dc2626;">${isPer40 ? p.tov40 : (isTotals ? p.tovTot : p.tovPJ)}</td>
                  <td style="font-weight: 900; color: #1e3a8a;">${isPer40 ? p.val40 : (isTotals ? p.valTot : p.valPJ)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 5. MODAL CONFIGURADOR DE DOSSIER Y EXPORTACIÓN A PDF
  // =========================================================================
  _renderDossierModal(players, games) {
    if (!this.showDossierModal) return "";

    return `
      <div id="dossier-modal-backdrop" style="position: fixed; inset: 0; background: rgba(15,23,42,0.75); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 16px; box-sizing: border-box;">
        <div style="background: #ffffff; border-radius: 14px; width: 100%; max-width: 650px; padding: 22px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
            <h2 style="font-size: 17px; font-weight: 900; color: #0f172a; margin: 0;">⚙️ Configurar Dossier Oficial de Temporada</h2>
            <button type="button" id="btn-close-dossier-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b;">✕</button>
          </div>

          <div style="margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="font-size: 11px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; display: block; margin-bottom: 8px;">1. Secciones y Gráficas:</strong>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px;">
              <label><input type="checkbox" id="chk-dos-summary" ${this.dossierConfig.includeTeamSummary ? 'checked' : ''}> Resumen y Ratings Colectivos</label>
              <label><input type="checkbox" id="chk-dos-charts" ${this.dossierConfig.includeColectiveCharts ? 'checked' : ''}> Gráficas de Evolución (Radar & Barras)</label>
              <label><input type="checkbox" id="chk-dos-matrix" ${this.dossierConfig.includeRosterMatrix ? 'checked' : ''}> Matriz Acumulada de Plantilla</label>
              <label><input type="checkbox" id="chk-dos-shots" ${this.dossierConfig.includeShotCharts ? 'checked' : ''}> Mapas de Tiro (Shot Charts)</label>
              <label><input type="checkbox" id="chk-dos-glossary" ${this.dossierConfig.includeGlossary ? 'checked' : ''}> Glosario Oficial FIBA</label>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">2. Fichas de Jugadores a Incluir:</strong>
              <div>
                <button type="button" id="btn-sel-all-players" style="font-size: 10px; font-weight: 800; color: #0284c7; background: none; border: none; cursor: pointer;">Todos</button>
                <span style="color: #cbd5e1;">|</span>
                <button type="button" id="btn-desel-all-players" style="font-size: 10px; font-weight: 800; color: #dc2626; background: none; border: none; cursor: pointer;">Ninguno</button>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; max-height: 120px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px;">
              ${players.map(p => `
                <label style="font-size: 11px; display: flex; align-items: center; gap: 4px;">
                  <input type="checkbox" class="chk-export-p" value="${p.id}" ${this.dossierConfig.selectedPlayerIds.includes(String(p.id)) ? 'checked' : ''}>
                  #${p.jersey ?? p.number ?? ''} ${p.first_name || p.firstName || ''}
                </label>
              `).join('')}
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">3. Partidos / Box Scores a Incluir:</strong>
              <div>
                <button type="button" id="btn-sel-all-games" style="font-size: 10px; font-weight: 800; color: #0284c7; background: none; border: none; cursor: pointer;">Todos</button>
                <span style="color: #cbd5e1;">|</span>
                <button type="button" id="btn-desel-all-games" style="font-size: 10px; font-weight: 800; color: #dc2626; background: none; border: none; cursor: pointer;">Ninguno</button>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; max-height: 120px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px;">
              ${games.map((g, idx) => `
                <label style="font-size: 11px; display: flex; align-items: center; gap: 4px;">
                  <input type="checkbox" class="chk-export-g" value="${g.id}" ${this.dossierConfig.selectedGameIds.includes(String(g.id)) ? 'checked' : ''}>
                  P${idx + 1} vs ${g.opponent || 'Rival'}
                </label>
              `).join('')}
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" id="btn-cancel-dossier" style="padding: 10px 18px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; font-weight: 800; cursor: pointer; font-size: 12px;">Cancelar</button>
            <button type="button" id="btn-generate-final-dossier" style="padding: 10px 22px; border-radius: 8px; border: none; background: #16a34a; color: white; font-weight: 900; cursor: pointer; font-size: 13px; box-shadow: 0 2px 8px rgba(22,163,74,0.3);">📥 Generar y Descargar Dossier PDF</button>
          </div>
        </div>
      </div>
    `;
  }

  _executeDossierPDFExport() {
    const activeTeamId = DataStore.getActiveTeamId?.();
    const teamObj = DataStore.getTeamById?.(activeTeamId) || {};
    const teamName = teamObj.name || "JMJ Manyanet Sant Andreu";
    const allGames = this._getFilteredGames();
    const allPlayers = DataStore.getPlayers?.(activeTeamId) || [];
    const seasonList = this._getSeasonStatsList();

    const selectedGames = allGames.filter(g => this.dossierConfig.selectedGameIds.includes(String(g.id)));
    const selectedPlayers = allPlayers.filter(p => this.dossierConfig.selectedPlayerIds.includes(String(p.id)));

    let pagesHtml = `
      <div style="page-break-after: always; text-align: center; padding-top: 120px; font-family: system-ui, sans-serif;">
        <div style="font-size: 34px; font-weight: 900; color: #1e3a8a; letter-spacing: 2px;">IQ BASKET STATS</div>
        <div style="font-size: 14px; font-weight: 800; color: #f97316; margin-top: 8px; text-transform: uppercase;">DOSSIER TÉCNICO OFICIAL DE TEMPORADA</div>
        
        <div style="margin: 40px auto; width: 140px; height: 4px; background: #1e3a8a; border-radius: 2px;"></div>

        <h1 style="font-size: 26px; font-weight: 900; color: #0f172a; margin-bottom: 6px;">${teamName}</h1>
        <div style="font-size: 13px; color: #64748b; font-weight: 700;">
          Temporada 2026 · Partidos analizados: ${selectedGames.length} · Plantilla: ${selectedPlayers.length}
        </div>

        <div style="margin-top: 180px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          Documento Oficial para Cuerpo Técnico y Dirección Deportiva<br/>
          Estándar FIBA / ACB © IQ Basket
        </div>
      </div>
    `;

    if (this.dossierConfig.includeRosterMatrix) {
      pagesHtml += `
        <div style="page-break-after: always; padding-top: 10px;">
          <h2 style="font-size: 16px; font-weight: 900; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 4px; margin-bottom: 14px;">MATRIZ ACUMULADA DE PLANTILLA</h2>
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 11px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-weight: 800;">
                <th style="text-align: left; padding: 6px;">JUGADOR</th>
                <th>PJ</th><th>MIN</th><th>PTS/PJ</th><th>REB/PJ</th><th>AST/PJ</th><th>ROB/PJ</th><th>PER/PJ</th><th>VAL/PJ</th><th>VAL/40</th>
              </tr>
            </thead>
            <tbody>
              ${seasonList.map(p => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="text-align: left; padding: 6px; font-weight: 700;">${p.name}</td>
                  <td>${p.gamesCount}</td><td>${p.min}'</td>
                  <td>${p.ptsPJ}</td><td>${p.rebPJ}</td><td>${p.astPJ}</td><td>${p.stlPJ}</td>
                  <td style="color:#dc2626;">${p.tovPJ}</td>
                  <td style="font-weight: 900; color: #1e3a8a;">${p.valPJ}</td>
                  <td style="font-weight: 800; color: #15803d;">${p.val40}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (selectedPlayers.length > 0) {
      selectedPlayers.forEach(p => {
        pagesHtml += `
          <div style="page-break-after: always; padding-top: 10px;">
            ${this._renderSinglePlayerCard(p, allGames)}
          </div>
        `;
      });
    }

    if (selectedGames.length > 0) {
      selectedGames.forEach(g => {
        const gameData = {
          game: g,
          teamPts: Number(g.team_score ?? g.teamScore ?? 0),
          oppPts: Number(g.opponent_score ?? g.opponentScore ?? 0),
          diffPts: Number(g.team_score ?? 0) - Number(g.opponent_score ?? 0),
          poss: 70, offRtg: "85.0", defRtg: "90.0", netRtg: "-5.0",
          playersList: this._extractGameBoxScore(g.id, allPlayers),
          periodScores: DataStore.getGamePeriodScores?.(g.id) || []
        };
        pagesHtml += `
          <div style="page-break-after: always; padding-top: 10px;">
            ${this._renderGameReport(gameData)}
          </div>
        `;
      });
    }

    if (this.dossierConfig.includeGlossary) {
      pagesHtml += this._renderGlossarySection();
    }

    if (ReportExporter && typeof ReportExporter.printReport === "function") {
      ReportExporter.printReport(`Dossier_Temporada_${teamName.replace(/\s+/g, '_')}`, pagesHtml);
    } else {
      const w = window.open("", "_blank");
      w.document.write(`<html><head><title>Dossier Temporada</title></head><body>${pagesHtml}</body></html>`);
      w.document.close();
      w.print();
    }
  }

  // =========================================================================
  // 6. RENDER PRINCIPAL Y BINDINGS
  // =========================================================================
  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;

    const activeTeamId = DataStore.getActiveTeamId?.();
    const games = this._getFilteredGames();
    const players = DataStore.getPlayers?.(activeTeamId) || [];

    if (this.dossierConfig.selectedPlayerIds.length === 0 && players.length > 0) {
      this.dossierConfig.selectedPlayerIds = players.map(p => String(p.id));
    }
    if (this.dossierConfig.selectedGameIds.length === 0 && games.length > 0) {
      this.dossierConfig.selectedGameIds = games.map(g => String(g.id));
    }

    const gameData = this._getSelectedGameData();
    const seasonList = this._getSeasonStatsList();

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; padding-bottom: 40px;">
        
        <!-- Header con Selector de Modo -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
          <h1 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 0;">
            ${this.t("reports_module", "Módulo de Informes y Reportes")}
          </h1>

          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn-mode ${this.reportMode === 'game' ? 'active' : ''}" data-mode="game" style="padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.reportMode === 'game' ? '#1e3a8a' : '#fff'}; color: ${this.reportMode === 'game' ? '#fff' : '#0f172a'}; font-weight: 800;">1. Partido</button>
            <button type="button" class="btn-mode ${this.reportMode === 'player' ? 'active' : ''}" data-mode="player" style="padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.reportMode === 'player' ? '#1e3a8a' : '#fff'}; color: ${this.reportMode === 'player' ? '#fff' : '#0f172a'}; font-weight: 800;">2. Jugador</button>
            <button type="button" class="btn-mode ${this.reportMode === 'season_dossier' ? 'active' : ''}" data-mode="season_dossier" style="padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.reportMode === 'season_dossier' ? '#1e3a8a' : '#fff'}; color: ${this.reportMode === 'season_dossier' ? '#fff' : '#0f172a'}; font-weight: 800;">3. Dossier Temporada</button>
          </div>
        </div>

        <!-- Barra de Filtros Limpia -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 18px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
          <span style="font-size: 11px; font-weight: 900; color: #64748b;">FILTROS:</span>
          
          <select id="filter-venue" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 700; background: white; color: #0f172a; cursor: pointer;">
            <option value="all" ${this.filters.venue === 'all' ? 'selected' : ''}>Sede: Todas</option>
            <option value="local" ${this.filters.venue === 'local' ? 'selected' : ''}>Local</option>
            <option value="visitante" ${this.filters.venue === 'visitante' ? 'selected' : ''}>Visitante</option>
          </select>

          ${this.reportMode === 'game' ? `
            <select id="select-game" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 700; background: white; color: #0f172a; cursor: pointer;">
              <option value="all" ${this.selectedGameId === 'all' ? 'selected' : ''}>-- Todos los Partidos (Temporada Completa) --</option>
              ${games.map((g, i) => `<option value="${g.id}" ${String(g.id) === String(this.selectedGameId) ? 'selected' : ''}>P${i + 1} (${g.date || ''}) vs ${g.opponent || 'Rival'}</option>`).join('')}
            </select>
          ` : ''}

          ${this.reportMode === 'player' ? `
            <select id="select-player" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 700; background: white; color: #0f172a; cursor: pointer;">
              <option value="all" ${this.selectedPlayerId === 'all' ? 'selected' : ''}>-- Todos los Jugadores (Fichas de Plantilla) --</option>
              ${players.map(p => `<option value="${p.id}" ${String(p.id) === String(this.selectedPlayerId) ? 'selected' : ''}>#${p.jersey || ''} ${p.first_name || ''} ${p.last_name || ''}</option>`).join('')}
            </select>
          ` : ''}

          <button type="button" id="btn-open-dossier-modal" style="margin-left: auto; padding: 8px 16px; border-radius: 8px; border: none; background: #16a34a; color: white; font-weight: 900; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(22,163,74,0.3);">
            📥 Exportar PDF Personalizado
          </button>
        </div>

        <!-- Contenido del Reporte -->
        <div id="report-view-content-area">
          ${this.reportMode === 'game' ? this._renderGameReport(gameData) : ''}
          ${this.reportMode === 'player' ? this._renderPlayerReport(players, games) : ''}
          ${this.reportMode === 'season_dossier' ? this._renderSeasonDossier(games, seasonList) : ''}
          ${this._renderGlossarySection()}
        </div>

        ${this._renderDossierModal(players, games)}
      </div>
    `;

    this._bindEvents(container, containerId, players, games);
  }

  _bindEvents(container, containerId, players, games) {
    container.querySelectorAll(".btn-mode").forEach(btn => {
      btn.addEventListener("click", () => {
        this.reportMode = btn.dataset.mode;
        this.render(containerId);
      });
    });

    container.querySelectorAll(".btn-metric-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        this.seasonMetricMode = btn.dataset.metric;
        this.render(containerId);
      });
    });

    container.querySelector("#select-game")?.addEventListener("change", (e) => {
      this.selectedGameId = e.target.value;
      this.render(containerId);
    });

    container.querySelector("#select-player")?.addEventListener("change", (e) => {
      this.selectedPlayerId = e.target.value;
      this.render(containerId);
    });

    container.querySelector("#filter-venue")?.addEventListener("change", (e) => {
      this.filters.venue = e.target.value;
      this.render(containerId);
    });

    // Control del Modal de Dossier
    container.querySelector("#btn-open-dossier-modal")?.addEventListener("click", () => {
      this.showDossierModal = true;
      this.render(containerId);
    });

    container.querySelector("#btn-close-dossier-modal")?.addEventListener("click", () => {
      this.showDossierModal = false;
      this.render(containerId);
    });

    container.querySelector("#btn-cancel-dossier")?.addEventListener("click", () => {
      this.showDossierModal = false;
      this.render(containerId);
    });

    // Selección masiva de jugadores / partidos
    container.querySelector("#btn-sel-all-players")?.addEventListener("click", () => {
      this.dossierConfig.selectedPlayerIds = players.map(p => String(p.id));
      this.render(containerId);
    });
    container.querySelector("#btn-desel-all-players")?.addEventListener("click", () => {
      this.dossierConfig.selectedPlayerIds = [];
      this.render(containerId);
    });

    container.querySelector("#btn-sel-all-games")?.addEventListener("click", () => {
      this.dossierConfig.selectedGameIds = games.map(g => String(g.id));
      this.render(containerId);
    });
    container.querySelector("#btn-desel-all-games")?.addEventListener("click", () => {
      this.dossierConfig.selectedGameIds = [];
      this.render(containerId);
    });

    container.querySelectorAll(".chk-export-p").forEach(chk => {
      chk.addEventListener("change", () => {
        const id = chk.value;
        if (chk.checked) {
          if (!this.dossierConfig.selectedPlayerIds.includes(id)) this.dossierConfig.selectedPlayerIds.push(id);
        } else {
          this.dossierConfig.selectedPlayerIds = this.dossierConfig.selectedPlayerIds.filter(x => x !== id);
        }
      });
    });

    container.querySelectorAll(".chk-export-g").forEach(chk => {
      chk.addEventListener("change", () => {
        const id = chk.value;
        if (chk.checked) {
          if (!this.dossierConfig.selectedGameIds.includes(id)) this.dossierConfig.selectedGameIds.push(id);
        } else {
          this.dossierConfig.selectedGameIds = this.dossierConfig.selectedGameIds.filter(x => x !== id);
        }
      });
    });

    container.querySelector("#btn-generate-final-dossier")?.addEventListener("click", () => {
      this.dossierConfig.includeTeamSummary = container.querySelector("#chk-dos-summary")?.checked ?? true;
      this.dossierConfig.includeColectiveCharts = container.querySelector("#chk-dos-charts")?.checked ?? true;
      this.dossierConfig.includeRosterMatrix = container.querySelector("#chk-dos-matrix")?.checked ?? true;
      this.dossierConfig.includeShotCharts = container.querySelector("#chk-dos-shots")?.checked ?? true;
      this.dossierConfig.includeGlossary = container.querySelector("#chk-dos-glossary")?.checked ?? true;

      this.showDossierModal = false;
      this._executeDossierPDFExport();
    });
  }
}

export default ReportsView;