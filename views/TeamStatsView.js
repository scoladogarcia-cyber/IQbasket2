/**
 * @fileoverview Vista de Presentación: Informe de Equipo y Plantilla (TeamStatsView.js).
 * Ignora el ppg precalculado en BD para garantizar el cálculo 100% real de player_game_stats.
 */

import { StatsEngine } from "../engine/StatsEngine.js";

export class TeamStatsView {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;

    this.sortState = {
      column: "jersey",
      ascending: true
    };

    this.cachedPlayers = [];
  }

  _fetchSupabaseClient() {
    if (this.supabase) return this.supabase;
    if (window.supabase) return window.supabase;
    return null;
  }

  async _fetchTeamData(teamId) {
    const client = this._fetchSupabaseClient();

    try {
      let team = null;
      let games = [];
      let players = [];
      let playerStats = [];

      if (client) {
        // 1. Datos del equipo
        let teamQuery = client.from("teams").select("*");
        if (teamId) {
          teamQuery = teamQuery.eq("id", teamId);
        }
        const { data: tData } = await teamQuery.maybeSingle();
        team = tData;

        const effectiveTeamId = team?.id || teamId;

        // 2. Partidos
        let gamesQuery = client.from("games").select("*");
        if (effectiveTeamId) {
          gamesQuery = gamesQuery.eq("team_id", effectiveTeamId);
        }
        const { data: gData } = await gamesQuery;
        games = gData || [];

        // 3. Jugadores
        let playersQuery = client.from("players").select("*");
        if (effectiveTeamId) {
          playersQuery = playersQuery.eq("team_id", effectiveTeamId);
        }
        const { data: pData } = await playersQuery;
        players = pData || [];

        // 4. Traer SIEMPRE las estadísticas individuales de todos los jugadores
        const playerIds = players.map((p) => p.id);
        if (playerIds.length > 0) {
          const { data: psData } = await client
            .from("player_game_stats")
            .select("*")
            .in("player_id", playerIds);
          playerStats = psData || [];
        }
      }

      // Balance Real (Victorias / Derrotas)
      const playedGames = StatsEngine ? StatsEngine.filterPlayedGames(games) : games;
      let wins = 0;
      let losses = 0;

      playedGames.forEach((g) => {
        const teamPts = g.team_score ?? g.our_score ?? 0;
        const oppPts = g.opponent_score ?? g.opp_score ?? 0;
        if (teamPts > oppPts) wins++;
        else if (teamPts < oppPts) losses++;
      });

      // Mapeo dinámico y real de puntos por partido
      const statsMap = {};
      playerStats.forEach((r) => {
        const pId = r.player_id;
        if (!pId) return;

        // Búsqueda exhaustiva de columnas de tiro
        const fg2m = Number(r.fg2_made || r.points_2_made || r.fg2m || 0);
        const fg3m = Number(r.fg3_made || r.points_3_made || r.fg3m || 0);
        const ftm  = Number(r.ft_made  || r.free_throws_made || r.ftm || 0);

        // Búsqueda de la columna de puntos totales anotados en la fila
        let pts = 0;
        if (r.points !== undefined && r.points !== null && Number(r.points) > 0) {
          pts = Number(r.points);
        } else if (r.pts !== undefined && r.pts !== null && Number(r.pts) > 0) {
          pts = Number(r.pts);
        } else if (r.points_scored !== undefined && r.points_scored !== null && Number(r.points_scored) > 0) {
          pts = Number(r.points_scored);
        } else {
          // Si no existe columna 'points', calcula (2PM*2 + 3PM*3 + FTM)
          pts = (fg2m * 2) + (fg3m * 3) + ftm;
        }

        if (!statsMap[pId]) {
          statsMap[pId] = { totalPts: 0, gamesPlayed: 0 };
        }
        statsMap[pId].totalPts += pts;
        statsMap[pId].gamesPlayed += 1;
      });

      // Formatear jugadores calculando el PPG 100% dinámico
      const formattedPlayers = players.map((p) => {
        const pSt = statsMap[p.id];
        let realPpg = 0.0;

        if (pSt && pSt.gamesPlayed > 0) {
          realPpg = Number((pSt.totalPts / pSt.gamesPlayed).toFixed(1));
        }

        return {
          ...p,
          fullName: `${p.first_name || ''} ${p.last_name || ''}`.trim() || "Jugador",
          jerseyNum: p.jersey !== undefined && p.jersey !== null ? p.jersey : 99,
          position: p.primary_position || "—",
          statusTxt: String(p.status || "Activo").trim(),
          heightCm: p.height_cm ? Number(p.height_cm) : null,
          ppg: realPpg // IGNORA p.ppg de la tabla players si este venía en 0
        };
      });

      return {
        team: team || {},
        wins,
        losses,
        totalGames: games.length,
        players: formattedPlayers,
        isSuccess: true
      };
    } catch (err) {
      console.error("Error cargando equipo:", err);
      return { isSuccess: false, error: err.message, team: {}, wins: 0, losses: 0, totalGames: 0, players: [] };
    }
  }

  _sortPlayers(players) {
    const { column, ascending } = this.sortState;
    const mult = ascending ? 1 : -1;

    return [...players].sort((a, b) => {
      switch (column) {
        case "jersey":
          return mult * (a.jerseyNum - b.jerseyNum);
        case "name":
          return mult * a.fullName.localeCompare(b.fullName);
        case "position":
          return mult * a.position.localeCompare(b.position);
        case "status":
          return mult * a.statusTxt.localeCompare(b.statusTxt);
        case "height":
          return mult * ((a.heightCm || 0) - (b.heightCm || 0));
        case "ppg":
          return mult * (a.ppg - b.ppg);
        default:
          return 0;
      }
    });
  }

  _renderPlayerRows(players) {
    if (!players || players.length === 0) {
      return `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #64748b;">No hay jugadores cargados en la plantilla.</td></tr>`;
    }

    return players.map((p) => {
      const heightStr = p.heightCm ? `${p.heightCm} cm` : "—";
      const isActivo = p.statusTxt.toLowerCase() === "activo" || p.statusTxt.toLowerCase() === "active";

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 14px 12px; font-weight: 800; color: #0f172a;">#${p.jerseyNum}</td>
          <td style="padding: 14px 12px; font-weight: 700; color: #0f172a;">${p.fullName}</td>
          <td style="padding: 14px 12px; color: #475569;">${p.position}</td>
          <td style="padding: 14px 12px;">
            <span style="background: ${isActivo ? '#dcfce7' : '#f1f5f9'}; color: ${isActivo ? '#15803d' : '#64748b'}; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 11px;">
              ${p.statusTxt}
            </span>
          </td>
          <td style="padding: 14px 12px; color: #64748b;">${heightStr}</td>
          <td style="padding: 14px 12px; font-weight: 800; color: #1e3a8a;">${p.ppg.toFixed(1)}</td>
        </tr>
      `;
    }).join("");
  }

  _attachSortEventListeners(container) {
    const sortHeaders = container.querySelectorAll("[data-sort-player]");
    sortHeaders.forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.getAttribute("data-sort-player");
        if (this.sortState.column === col) {
          this.sortState.ascending = !this.sortState.ascending;
        } else {
          this.sortState.column = col;
          this.sortState.ascending = true;
        }

        const sorted = this._sortPlayers(this.cachedPlayers);
        const tbody = container.querySelector("#roster-table-body");
        if (tbody) {
          tbody.innerHTML = this._renderPlayerRows(sorted);
        }

        sortHeaders.forEach((header) => {
          const arrowSpan = header.querySelector(".sort-arrow");
          if (arrowSpan) {
            const hCol = header.getAttribute("data-sort-player");
            if (hCol === this.sortState.column) {
              arrowSpan.textContent = this.sortState.ascending ? " ▲" : " ▼";
              arrowSpan.style.color = "#2563eb";
            } else {
              arrowSpan.textContent = " ↕";
              arrowSpan.style.color = "#cbd5e1";
            }
          }
        });
      });
    });
  }

  async render(param1 = "main-content", param2) {
    let containerId = "main-content";
    let teamId = param2;

    if (typeof param1 === "string") {
      containerId = param1;
    } else if (param1 && typeof param1 === "object") {
      teamId = param1.id || param1.teamId;
    }

    const container = document.getElementById(containerId) || document.querySelector(".main-content") || document.body;

    const data = await this._fetchTeamData(teamId);
    const team = data.team || {};
    this.cachedPlayers = data.players || [];

    const activePlayersCount = this.cachedPlayers.filter(
      (p) => p.statusTxt.toLowerCase() === "activo" || p.statusTxt.toLowerCase() === "active"
    ).length;

    const sortedPlayers = this._sortPlayers(this.cachedPlayers);
    const tableRowsMarkup = this._renderPlayerRows(sortedPlayers);

    const teamName = team.name || "Equipo";
    const teamCategory = team.category || "—";
    const teamCompetition = team.competition || "—";
    const teamCoach = team.coach_name || "—";
    const teamPeriods = team.periods_count ? `${team.periods_count} × ${team.period_minutes || 10} min` : "—";
    const teamColor = team.color || "#1e3a8a";

    const htmlContent = `
      <div style="display: flex; flex-direction: column; gap: 24px; font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding-bottom: 40px;">
        
        <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">Equipo</h1>

        <!-- Tarjeta Principal del Equipo -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; display: flex; align-items: center; gap: 16px;">
          <div style="width: 56px; height: 56px; background: ${teamColor}; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">
            🏆
          </div>
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">${teamName}</h2>
            <p style="margin: 4px 0 8px 0; font-size: 12px; color: #64748b;">${teamName}</p>
            <div style="display: flex; gap: 8px;">
              <span style="background: #dbeafe; color: #1e40af; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">${teamCategory}</span>
              <span style="background: #ffedd5; color: #c2410c; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">${teamCompetition}</span>
            </div>
          </div>
        </div>

        <!-- Rejilla de Métricas Rápidas -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
          
          <div class="team-stat-card">
            <span class="team-stat-title">🏆 BALANCE</span>
            <span style="font-size: 22px; font-weight: 900; margin-top: 4px;">
              <strong style="color: #16a34a;">${data.wins}V</strong> - <strong style="color: #dc2626;">${data.losses}D</strong>
            </span>
          </div>

          <div class="team-stat-card">
            <span class="team-stat-title">📅 PARTIDOS</span>
            <span style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px;">${data.totalGames}</span>
          </div>

          <div class="team-stat-card">
            <span class="team-stat-title">👥 JUGADORES ACTIVOS</span>
            <span style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px;">${activePlayersCount}</span>
          </div>

          <div class="team-stat-card">
            <span class="team-stat-title">📍 TEMPORADA</span>
            <span style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 4px;">2026</span>
          </div>

        </div>

        <!-- Tabla de Información del Equipo -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px;">
          <h3 style="font-size: 12px; font-weight: 800; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 0; margin-bottom: 16px;">
            INFORMACIÓN DEL EQUIPO
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">Club</span>
              <strong style="color: #0f172a;">${teamName}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">Categoría</span>
              <strong style="color: #0f172a;">${teamCategory}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">Competición</span>
              <strong style="color: #0f172a;">${teamCompetition}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">Entrenador</span>
              <strong style="color: #0f172a;">${teamCoach}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">Periodos</span>
              <strong style="color: #0f172a;">${teamPeriods}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc; border-radius: 6px;">
              <span style="color: #64748b;">Color principal</span>
              <strong style="color: #0f172a;">${teamColor}</strong>
            </div>
          </div>
        </div>

        <!-- Tabla de Plantilla con Encabezados Ordenables -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px;">
          <h3 style="font-size: 12px; font-weight: 800; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 0; margin-bottom: 16px;">
            PLANTILLA
          </h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                
                <th data-sort-player="jersey" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  DORSAL <span class="sort-arrow" style="color: #2563eb;">▲</span>
                </th>

                <th data-sort-player="name" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  JUGADOR <span class="sort-arrow" style="color: #cbd5e1;">↕</span>
                </th>

                <th data-sort-player="position" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  POSICIÓN <span class="sort-arrow" style="color: #cbd5e1;">↕</span>
                </th>

                <th data-sort-player="status" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  ESTADO <span class="sort-arrow" style="color: #cbd5e1;">↕</span>
                </th>

                <th data-sort-player="height" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  ALTURA <span class="sort-arrow" style="color: #cbd5e1;">↕</span>
                </th>

                <th data-sort-player="ppg" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  <span class="has-tooltip">
                    PPG <span class="info-badge">?</span>
                    <span class="tooltip-box">Puntos Por Partido promedio anotados por el jugador.</span>
                  </span>
                  <span class="sort-arrow" style="color: #cbd5e1;">↕</span>
                </th>

              </tr>
            </thead>
            <tbody id="roster-table-body">
              ${tableRowsMarkup}
            </tbody>
          </table>
        </div>

      </div>

      <style>
        .team-stat-card {
          background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px;
        }
        .team-stat-title {
          font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.05em;
        }
        .sortable-th:hover {
          color: #2563eb;
        }

        .has-tooltip {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }

        .info-badge {
          background: #e2e8f0;
          color: #475569;
          border-radius: 50%;
          width: 14px;
          height: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 800;
          transition: all 0.2s ease;
        }

        .has-tooltip:hover .info-badge {
          background: #2563eb;
          color: white;
        }

        .tooltip-box {
          visibility: hidden;
          opacity: 0;
          width: 180px;
          background-color: #0f172a;
          color: #ffffff;
          text-align: center;
          border-radius: 6px;
          padding: 8px 10px;
          position: absolute;
          z-index: 100;
          bottom: 125%;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          font-weight: 500;
          line-height: 1.35;
          text-transform: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: opacity 0.2s ease, visibility 0.2s ease;
          pointer-events: none;
        }

        .tooltip-box::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -5px;
          border-width: 5px;
          border-style: solid;
          border-color: #0f172a transparent transparent transparent;
        }

        .has-tooltip:hover .tooltip-box {
          visibility: visible;
          opacity: 1;
        }
      </style>
    `;

    if (container.innerHTML !== undefined) {
      container.innerHTML = htmlContent;
      this._attachSortEventListeners(container);
    }

    return htmlContent;
  }
}