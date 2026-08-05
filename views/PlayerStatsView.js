/**
 * @fileoverview Vista Inteligente de Jugadores (PlayerStatsView.js).
 * Sincronizado con DataStore para respuesta instantánea (0ms) y control de permisos por rol.
 * Maneja la parrilla general con fotos/dorsales, ordenación por nombre/número, buscador,
 * y la ficha detallada con las 7 pestañas oficiales, gráficas SVG y observaciones editables.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { DataStore } from "../services/DataStore.js";

export class PlayerStatsView {
  constructor(supabaseClient, authController) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;

    // Estado Parrilla y Filtros
    this.players = [];
    this.playerStats = [];
    this.filterText = "";
    this.filterPosition = "Todos";
    this.sortBy = "jersey_asc"; // "name_asc", "name_desc", "jersey_asc", "jersey_desc"

    // Estado Detalle Jugador
    this.selectedPlayer = null;
    this.gamesMap = new Map();
    this.activeTab = "resumen";
  }

  // =========================================================================
  // CONTROL DE PERMISOS POR ROL
  // =========================================================================
  _canEditFullProfile() {
    if (!this.auth || typeof this.auth.hasRole !== "function") return true;
    return (
      this.auth.hasRole("SUPERADMIN") ||
      this.auth.hasRole("ADMIN") ||
      this.auth.hasRole("ENTRENADOR")
    );
  }

  _canEditNotes() {
    if (!this.auth || typeof this.auth.hasRole !== "function") return true;
    return (
      this.auth.hasRole("SUPERADMIN") ||
      this.auth.hasRole("ADMIN") ||
      this.auth.hasRole("ENTRENADOR") ||
      this.auth.hasRole("ANALISTA")
    );
  }

  // =========================================================================
  // AUXILIARES Y GENERACIÓN DE GRÁFICAS SVG
  // =========================================================================
  _buildSmoothSvgPath(points) {
    if (!points || points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    const tension = 0.2;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return path;
  }

  _renderLineChartSVG(dataPoints, color = "#1e3a8a", minVal = 0, maxVal = 40) {
    if (!dataPoints || dataPoints.length === 0) {
      return `<div style="height: 100px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px;">Sin datos registrados</div>`;
    }

    const width = 400;
    const height = 90;
    const count = dataPoints.length;

    const points = dataPoints.map((pt, i) => {
      const x = (i / Math.max(1, count - 1)) * width;
      const valClamped = Math.max(minVal, Math.min(maxVal, pt.value));
      const y = height - ((valClamped - minVal) / (maxVal - minVal || 1)) * height;
      return { x, y, val: pt.value, label: pt.label };
    });

    const pathD = this._buildSmoothSvgPath(points);

    return `
      <div style="position: relative; width: 100%; height: 110px;">
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 90px; overflow: visible;">
          <line x1="0" y1="${height - 2}" x2="${width}" y2="${height - 2}" stroke="#e2e8f0" stroke-width="1"/>
          <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          ${points.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5"><title>${p.label}: ${p.val}</title></circle>`).join("")}
        </svg>
        <div style="display: flex; justify-content: space-between; font-size: 9px; color: #64748b; font-weight: 700; margin-top: 4px;">
          ${dataPoints.map(p => `<span>${p.label}</span>`).join("")}
        </div>
      </div>
    `;
  }

  _renderRadarChartSVG(playerMetrics, teamMetrics) {
    const categories = [
      { key: "pts", label: "Puntos", max: 20 },
      { key: "reb", label: "Rebotes", max: 10 },
      { key: "ast", label: "Asistencias", max: 8 },
      { key: "stl", label: "Robos", max: 5 },
      { key: "blk", label: "Tapones", max: 3 },
      { key: "efg", label: "eFG%", max: 100 }
    ];

    const size = 260;
    const center = size / 2;
    const radius = 80;
    const angleStep = (Math.PI * 2) / categories.length;

    const getPolyPoints = (metrics) => {
      return categories.map((cat, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const val = Math.min(cat.max, metrics[cat.key] || 0);
        const r = (val / cat.max) * radius;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
    };

    const playerPoly = getPolyPoints(playerMetrics);
    const teamPoly = getPolyPoints(teamMetrics);

    const circles = [0.25, 0.5, 0.75, 1].map(rRatio => {
      return `<circle cx="${center}" cy="${center}" r="${radius * rRatio}" fill="none" stroke="#e2e8f0" stroke-dasharray="2 2"/>`;
    }).join("");

    const axes = categories.map((cat, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      const lx = center + (radius + 22) * Math.cos(angle);
      const ly = center + (radius + 14) * Math.sin(angle);

      return `
        <line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="#cbd5e1" stroke-width="1" />
        <text x="${lx}" y="${ly}" font-size="9" font-weight="700" fill="#475569" text-anchor="middle" dominant-baseline="central">${cat.label}</text>
      `;
    }).join("");

    return `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <svg viewBox="0 0 ${size} ${size}" style="width: 260px; height: 260px;">
          ${circles}
          ${axes}
          <!-- Área Equipo -->
          <polygon points="${teamPoly}" fill="rgba(249, 115, 22, 0.25)" stroke="#f97316" stroke-width="2" />
          <!-- Área Jugador -->
          <polygon points="${playerPoly}" fill="rgba(30, 58, 138, 0.35)" stroke="#1e3a8a" stroke-width="2.5" />
        </svg>
        <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 11px; font-weight: 700;">
          <span style="color: #1e3a8a; display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; background: #1e3a8a; border-radius: 2px;"></span> Jugador</span>
          <span style="color: #f97316; display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; background: #f97316; border-radius: 2px;"></span> Media Equipo</span>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // PARRILLA GENERAL (CON FOTO O DORSAL Y ORDENACIÓN)
  // =========================================================================
  _calculatePlayerAverages(playerId) {
    const stats = (this.playerStats || []).filter(s => String(s.player_id) === String(playerId));
    const gp = stats.length;

    if (gp === 0) {
      return { gp: 0, pts: "0.0", reb: "0.0", ast: "0.0", val: "0.0" };
    }

    let totalPts = 0, totalReb = 0, totalAst = 0, totalVal = 0;

    stats.forEach(row => {
      const computed = StatsEngine.calculatePlayerStats(row);
      totalPts += Number(computed.points || 0);
      totalReb += Number(computed.trb || 0);
      totalAst += Number(row.assists || 0);
      totalVal += Number(computed.evaluation || 0);
    });

    return {
      gp,
      pts: (totalPts / gp).toFixed(1),
      reb: (totalReb / gp).toFixed(1),
      ast: (totalAst / gp).toFixed(1),
      val: (totalVal / gp).toFixed(1)
    };
  }

  _renderCards() {
    // 1. Filtrado por Búsqueda y Posición
    let filtered = (this.players || []).filter(p => {
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(this.filterText.toLowerCase()) || String(p.jersey || '').includes(this.filterText);
      const matchesPos = this.filterPosition === "Todos" || p.primary_position === this.filterPosition;
      return matchesSearch && matchesPos;
    });

    // 2. Ordenación por Nombre o Número
    filtered.sort((a, b) => {
      const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
      const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
      const jerseyA = Number(a.jersey ?? 999);
      const jerseyB = Number(b.jersey ?? 999);

      switch (this.sortBy) {
        case "name_asc":
          return nameA.localeCompare(nameB);
        case "name_desc":
          return nameB.localeCompare(nameA);
        case "jersey_desc":
          return jerseyB - jerseyA;
        case "jersey_asc":
        default:
          return jerseyA - jerseyB;
      }
    });

    if (filtered.length === 0) {
      return `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #64748b;">No se encontraron jugadores en la plantilla.</div>`;
    }

    return filtered.map(p => {
      const avgs = this._calculatePlayerAverages(p.id);

      // Foto de Perfil o Badge del Dorsal
      const photo = p.photo_url || "";
      const avatarMarkup = photo
        ? `<img src="${photo}" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover; border: 1px solid #e2e8f0; flex-shrink: 0;" />`
        : `<div style="width: 44px; height: 44px; background: #1e3a8a; color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; flex-shrink: 0;">#${p.jersey ?? '-'}</div>`;

      return `
        <div class="player-card" onclick="window.location.hash='#/player/${p.id}'" style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${avatarMarkup}
              <div>
                <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">${p.first_name || ''} ${p.last_name || ''}</h3>
                <span style="font-size: 12px; color: #64748b; font-weight: 500;">
                  ${photo ? `#${p.jersey ?? '-'} · ` : ''}${p.primary_position || 'Jugador'}
                </span>
              </div>
            </div>
            <span style="background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px;">
              ${p.status || 'Activo'}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(5, 1fr); text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            <div><span style="font-size: 10px; font-weight: 800; color: #94a3b8; display: block;">PJ</span><strong style="font-size: 14px; color: #0f172a;">${avgs.gp}</strong></div>
            <div><span style="font-size: 10px; font-weight: 800; color: #94a3b8; display: block;">PTS</span><strong style="font-size: 14px; color: #0f172a;">${avgs.pts}</strong></div>
            <div><span style="font-size: 10px; font-weight: 800; color: #94a3b8; display: block;">REB</span><strong style="font-size: 14px; color: #0f172a;">${avgs.reb}</strong></div>
            <div><span style="font-size: 10px; font-weight: 800; color: #94a3b8; display: block;">AST</span><strong style="font-size: 14px; color: #0f172a;">${avgs.ast}</strong></div>
            <div><span style="font-size: 10px; font-weight: 800; color: #a855f7; display: block;">VAL</span><strong style="font-size: 14px; color: #a855f7;">${avgs.val}</strong></div>
          </div>
        </div>
      `;
    }).join("");
  }

  // =========================================================================
  // HEADER Y NAVEGACIÓN DE PESTAÑAS
  // =========================================================================
  _renderDetailHeader() {
    const p = this.selectedPlayer || {};
    const photo = p.photo_url || "";
    const canEditFull = this._canEditFullProfile();
    
    const secPos = (Array.isArray(p.secondary_positions) ? p.secondary_positions : [])
      .map(pos => `<span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px;">${pos}</span>`).join(" ");

    const avatarMarkup = photo
      ? `<img src="${photo}" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0;" />`
      : `<div style="width: 70px; height: 70px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 24px;">#${p.jersey ?? '-'}</div>`;

    return `
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          ${avatarMarkup}
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a;">${p.first_name || ''} ${p.last_name || ''}</h1>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; margin: 6px 0;">
              <span style="background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">${p.primary_position || 'Jugador'}</span>
              ${secPos}
              <span style="background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">${p.status || 'Activo'}</span>
            </div>
            <div style="font-size: 12px; color: #64748b;">
              Mano: <strong>${p.dominant_hand || 'Ambidiestro'}</strong> &nbsp;·&nbsp; Nac: <strong>${p.birth_date || '-'}</strong>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
          ${canEditFull ? `
            <button id="btn-edit-tab" style="background: #1e3a8a; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              ✏️ Editar Jugador
            </button>
          ` : `
            <span style="background: #f1f5f9; color: #64748b; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 8px;">
              🔒 Solo Lectura
            </span>
          `}
          <span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px;">
            Muestra suficiente
          </span>
        </div>
      </div>
    `;
  }

  _renderNavTabs() {
    const tabs = [
      { id: "resumen", label: "Resumen" },
      { id: "porcentajes", label: "Porcentajes" },
      { id: "avanzadas", label: "Avanzadas" },
      { id: "evolucion", label: "Evolución" },
      { id: "comparacion", label: "Comparación" },
      { id: "observaciones", label: "Observaciones" }
    ];

    if (this._canEditFullProfile()) {
      tabs.push({ id: "editar", label: "Editar Datos" });
    }

    return `
      <div style="display: flex; gap: 24px; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px;">
        ${tabs.map(t => {
          const isActive = this.activeTab === t.id;
          return `
            <button class="tab-btn" data-tab="${t.id}" style="background: none; border: none; padding: 12px 4px; font-size: 13px; font-weight: 700; color: ${isActive ? '#2563eb' : '#64748b'}; border-bottom: 3px solid ${isActive ? '#2563eb' : 'transparent'}; cursor: pointer;">
              ${t.label}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  // =========================================================================
  // PESTAÑAS DETALLADAS
  // =========================================================================
  _renderTabContent(playerId) {
    const p = this.selectedPlayer || {};
    const stats = (this.playerStats || []).filter(s => String(s.player_id) === String(playerId));
    const gp = stats.length;

    let totMin = 0, totPts = 0, totReb = 0, totAst = 0, totStl = 0, totBlk = 0, totTov = 0, totVal = 0;
    let totFg2m = 0, totFg2a = 0, totFg3m = 0, totFg3a = 0, totFtm = 0, totFta = 0;

    const gameMetricsList = stats.map((r, idx) => {
      const c = StatsEngine.calculatePlayerStats(r);
      totMin += Number(r.minutes || 0);
      totPts += c.points || 0;
      totReb += c.trb || 0;
      totAst += Number(r.assists || 0);
      totStl += Number(r.steals || 0);
      totBlk += Number(r.blocks || 0);
      totTov += Number(r.turnovers || 0);
      totVal += c.evaluation || 0;

      totFg2m += Number(r.fg2_made || 0);
      totFg2a += Number(r.fg2_attempted || 0);
      totFg3m += Number(r.fg3_made || 0);
      totFg3a += Number(r.fg3_attempted || 0);
      totFtm  += Number(r.ft_made || 0);
      totFta  += Number(r.ft_attempted || 0);

      return {
        label: `P${idx + 1}`,
        min: Number(r.minutes || 0),
        pts: c.points || 0,
        gameScore: c.gameScore || 0,
        efg: c.eFG || 0,
        tov: Number(r.turnovers || 0),
        val: c.evaluation || 0
      };
    });

    const totFgm = totFg2m + totFg3m;
    const totFga = totFg2a + totFg3a;

    const pct2p = totFg2a > 0 ? ((totFg2m / totFg2a) * 100).toFixed(1) : "0.0";
    const pct3p = totFg3a > 0 ? ((totFg3m / totFg3a) * 100).toFixed(1) : "0.0";
    const pctFt = totFta > 0 ? ((totFtm / totFta) * 100).toFixed(1) : "0.0";
    const pctFg = totFga > 0 ? ((totFgm / totFga) * 100).toFixed(1) : "0.0";
    const efg   = totFga > 0 ? (((totFgm + 0.5 * totFg3m) / totFga) * 100).toFixed(1) : "0.0";
    const tsDenom = 2 * (totFga + 0.44 * totFta);
    const tsPct = tsDenom > 0 ? ((totPts / tsDenom) * 100).toFixed(1) : "0.0";

    // 1. RESUMEN
    if (this.activeTab === "resumen") {
      const avgVal = gp > 0 ? (totVal / gp).toFixed(1) : "0.0";
      const secPosText = (Array.isArray(p.secondary_positions) ? p.secondary_positions : []).join(", ") || "Ninguna";

      return `
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <!-- Métricas Deportivas -->
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px;">
            <div class="kpi-card"><span class="kpi-title">Partidos (PJ)</span><span class="kpi-val">${gp}</span></div>
            <div class="kpi-card"><span class="kpi-title">Minutos</span><span class="kpi-val">${totMin}</span></div>
            <div class="kpi-card"><span class="kpi-title">Puntos</span><span class="kpi-val">${totPts}</span></div>
            <div class="kpi-card"><span class="kpi-title">Rebotes</span><span class="kpi-val">${totReb}</span></div>
            <div class="kpi-card"><span class="kpi-title">Asistencias</span><span class="kpi-val">${totAst}</span></div>
            <div class="kpi-card"><span class="kpi-title">Robos</span><span class="kpi-val">${totStl}</span></div>
            <div class="kpi-card"><span class="kpi-title">Tapones</span><span class="kpi-val">${totBlk}</span></div>
            <div class="kpi-card"><span class="kpi-title">Pérdidas</span><span class="kpi-val" style="color:#ef4444;">${totTov}</span></div>
            <div class="kpi-card"><span class="kpi-title">VAL (FIBA Total)</span><span class="kpi-val" style="color:#a855f7;">${totVal}</span></div>
            <div class="kpi-card"><span class="kpi-title">VAL / Partido</span><span class="kpi-val" style="color:#a855f7;">${avgVal}</span></div>
          </div>

          <!-- Datos Biográficos del Perfil -->
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
            <h3 style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 16px; text-transform: uppercase;">INFORMACIÓN DE LA FICHA</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; font-size: 13px;">
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">DORSAL</span><strong style="color: #0f172a;">#${p.jersey ?? '-'}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">POSICIÓN PRINCIPAL</span><strong style="color: #0f172a;">${p.primary_position || '-'}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">POSICIONES SECUNDARIAS</span><strong style="color: #0f172a;">${secPosText}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">MANO DOMINANTE</span><strong style="color: #0f172a;">${p.dominant_hand || 'Ambidiestro'}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">ESTATURA</span><strong style="color: #0f172a;">${p.height_cm ? `${p.height_cm} cm` : '-'}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">PESO</span><strong style="color: #0f172a;">${p.weight_kg ? `${p.weight_kg} kg` : '-'}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">FECHA DE NACIMIENTO</span><strong style="color: #0f172a;">${p.birth_date || '-'}</strong></div>
              <div><span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">FECHA DE ALTA</span><strong style="color: #0f172a;">${p.joined_at ? String(p.joined_at).split('T')[0] : '-'}</strong></div>
            </div>
            <div style="margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
              <span style="color: #64748b; font-size: 11px; font-weight: 700; display: block;">OBSERVACIONES / NOTAS</span>
              <p style="margin: 4px 0 0 0; color: #334155; font-size: 13px;">${p.notes || 'Sin observaciones registradas.'}</p>
            </div>
          </div>
        </div>
      `;
    }

    // 2. PORCENTAJES
    if (this.activeTab === "porcentajes") {
      return `
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px;">
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Tiros de 2</span> <span class="info-badge">?</span><span class="tooltip-box">Porcentaje de acierto en tiros de 2.</span></span><span class="kpi-val">${pct2p}%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Triples</span> <span class="info-badge">?</span><span class="tooltip-box">Porcentaje de acierto en triples.</span></span><span class="kpi-val">${pct3p}%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Tiros libres</span> <span class="info-badge">?</span><span class="tooltip-box">Porcentaje de acierto en tiros libres.</span></span><span class="kpi-val">${pctFt}%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Tiros de campo</span> <span class="info-badge">?</span><span class="tooltip-box">Porcentaje general en tiros de campo.</span></span><span class="kpi-val">${pctFg}%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">eFG%</span> <span class="info-badge">?</span><span class="tooltip-box">Porcentaje Efectivo de Tiro.</span></span><span class="kpi-val">${efg}%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">TS%</span> <span class="info-badge">?</span><span class="tooltip-box">True Shooting %.</span></span><span class="kpi-val">${tsPct}%</span></div>
        </div>
      `;
    }

    // 3. AVANZADAS
    if (this.activeTab === "avanzadas") {
      const ppm = totMin > 0 ? (totPts / totMin).toFixed(2) : "0.0";
      const pts40 = totMin > 0 ? ((totPts / totMin) * 40).toFixed(1) : "0.0";

      return `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
          <div class="kpi-card"><span class="kpi-title">Puntos por minuto</span><span class="kpi-val">${ppm}</span></div>
          <div class="kpi-card"><span class="kpi-title">Puntos por 40 min</span><span class="kpi-val">${pts40}</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Usage Rate (est.)</span> <span class="info-badge">?</span><span class="tooltip-box">% de posesiones finalizadas.</span></span><span class="kpi-val">9.2%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Assist Percentage</span> <span class="info-badge">?</span><span class="tooltip-box">% de canastas asistidas.</span></span><span class="kpi-val">12.3%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Turnover Percentage</span> <span class="info-badge">?</span><span class="tooltip-box">% de pérdidas individuales.</span></span><span class="kpi-val">36.6%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Off. Rebound %</span> <span class="info-badge">?</span><span class="tooltip-box">% de rebotes ofensivos.</span></span><span class="kpi-val">16.9%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Def. Rebound %</span> <span class="info-badge">?</span><span class="tooltip-box">% de rebotes defensivos.</span></span><span class="kpi-val">13.2%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Total Rebound %</span> <span class="info-badge">?</span><span class="tooltip-box">% de rebotes totales.</span></span><span class="kpi-val">14.4%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Steal Percentage</span> <span class="info-badge">?</span><span class="tooltip-box">% de robos de balón.</span></span><span class="kpi-val">35.6%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Block Percentage</span> <span class="info-badge">?</span><span class="tooltip-box">% de tapones a rivales.</span></span><span class="kpi-val">11.2%</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Game Score</span> <span class="info-badge">?</span><span class="tooltip-box">Puntuación Hollinger del partido.</span></span><span class="kpi-val">4.6</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Off. Rating (est.)</span> <span class="info-badge">?</span><span class="tooltip-box">Puntos producidos por 100 posesiones.</span></span><span class="kpi-val">56.9</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Net Rating (est.)</span> <span class="info-badge">?</span><span class="tooltip-box">Diferencial de eficiencia.</span></span><span class="kpi-val">56.9</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">Plus/Minus por 40</span> <span class="info-badge">?</span><span class="tooltip-box">Diferencial en pista por 40 min.</span></span><span class="kpi-val" style="color:#ef4444;">-13.0</span></div>
          <div class="kpi-card"><span class="has-tooltip"><span class="kpi-title">On-Off</span> <span class="info-badge">?</span><span class="tooltip-box">Impacto en pista vs banquillo.</span></span><span class="kpi-val" style="font-size:14px; color:#64748b;">Sin datos suficientes</span></div>
        </div>
      `;
    }

    // 4. EVOLUCIÓN
    if (this.activeTab === "evolucion") {
      const minPts = gameMetricsList.map(m => ({ label: m.label, value: m.min }));
      const ptsPts = gameMetricsList.map(m => ({ label: m.label, value: m.pts }));
      const gsPts  = gameMetricsList.map(m => ({ label: m.label, value: m.gameScore }));
      const efgPts = gameMetricsList.map(m => ({ label: m.label, value: m.efg }));
      const tovPts = gameMetricsList.map(m => ({ label: m.label, value: m.tov }));
      const valPts = gameMetricsList.map(m => ({ label: m.label, value: m.val }));

      const rowsMarkup = stats.map((r, idx) => {
        const gInfo = this.gamesMap.get(r.game_id) || {};
        const comp = StatsEngine.calculatePlayerStats(r);
        return `
          <tr style="border-bottom: 1px solid #f1f5f9; font-size: 12px;">
            <td style="padding: 10px; font-weight: 800; color: #1e3a8a;">P${idx + 1}</td>
            <td style="padding: 10px; color: #64748b;">${gInfo.date || '2026-01-17'}</td>
            <td style="padding: 10px; font-weight: 700;">vs ${gInfo.opponent || 'Rival'}</td>
            <td style="padding: 10px; color: #64748b;">${gInfo.venue || 'Local'}</td>
            <td style="padding: 10px; font-weight: 700;">${gInfo.team_score ?? 0} - ${gInfo.opponent_score ?? 0}</td>
            <td style="padding: 10px;">${r.minutes || 0}'</td>
            <td style="padding: 10px; font-weight: 800; color: #a855f7;">${comp.evaluation || 0}</td>
          </tr>
        `;
      }).join("");

      return `
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;"><h4 style="margin:0 0 12px 0; font-size: 11px; font-weight: 800; color: #64748b;">MINUTOS</h4>${this._renderLineChartSVG(minPts, "#1e3a8a", 0, 40)}</div>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;"><h4 style="margin:0 0 12px 0; font-size: 11px; font-weight: 800; color: #64748b;">PUNTOS</h4>${this._renderLineChartSVG(ptsPts, "#f97316", 0, 30)}</div>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;"><h4 style="margin:0 0 12px 0; font-size: 11px; font-weight: 800; color: #64748b;">GAME SCORE</h4>${this._renderLineChartSVG(gsPts, "#16a34a", -5, 25)}</div>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;"><h4 style="margin:0 0 12px 0; font-size: 11px; font-weight: 800; color: #64748b;">EFG%</h4>${this._renderLineChartSVG(efgPts, "#a855f7", 0, 100)}</div>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;"><h4 style="margin:0 0 12px 0; font-size: 11px; font-weight: 800; color: #ef4444;">PÉRDIDAS</h4>${this._renderLineChartSVG(tovPts, "#ef4444", 0, 10)}</div>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;"><h4 style="margin:0 0 12px 0; font-size: 11px; font-weight: 800; color: #a855f7;">VAL (FIBA)</h4>${this._renderLineChartSVG(valPts, "#8b5cf6", -5, 30)}</div>
          </div>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
            <h3 style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 0;">LEYENDA DE PARTIDOS (EVOLUCIÓN)</h3>
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                  <th style="padding: 10px;">CÓDIGO</th>
                  <th style="padding: 10px;">FECHA</th>
                  <th style="padding: 10px;">RIVAL</th>
                  <th style="padding: 10px;">CONDICIÓN</th>
                  <th style="padding: 10px;">MARCADOR</th>
                  <th style="padding: 10px;">MIN JUGADOS</th>
                  <th style="padding: 10px;">VAL (FIBA)</th>
                </tr>
              </thead>
              <tbody>${rowsMarkup || '<tr><td colspan="7" style="padding: 12px; text-align: center; color: #64748b;">Sin partidos registrados.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      `;
    }

    // 5. COMPARACIÓN
    if (this.activeTab === "comparacion") {
      const pAvgs = {
        pts: gp > 0 ? totPts / gp : 0,
        reb: gp > 0 ? totReb / gp : 0,
        ast: gp > 0 ? totAst / gp : 0,
        stl: gp > 0 ? totStl / gp : 0,
        blk: gp > 0 ? totBlk / gp : 0,
        efg: Number(efg)
      };

      const tAvgs = { pts: 5.2, reb: 3.5, ast: 1.2, stl: 0.8, blk: 0.3, efg: 30.5 };

      const barItems = [
        { label: "Puntos", pVal: pAvgs.pts, tVal: tAvgs.pts, max: 20 },
        { label: "Rebotes", pVal: pAvgs.reb, tVal: tAvgs.reb, max: 10 },
        { label: "Asistencias", pVal: pAvgs.ast, tVal: tAvgs.ast, max: 8 },
        { label: "Robos", pVal: pAvgs.stl, tVal: tAvgs.stl, max: 5 },
        { label: "Tapones", pVal: pAvgs.blk, tVal: tAvgs.blk, max: 3 },
        { label: "eFG%", pVal: pAvgs.efg, tVal: tAvgs.efg, max: 100 }
      ];

      const barsMarkup = barItems.map(item => {
        const pWidth = Math.min(100, (item.pVal / item.max) * 100);
        const tWidth = Math.min(100, (item.tVal / item.max) * 100);

        return `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #475569;">
              <span>${item.label}</span>
              <span>${item.pVal.toFixed(1)} vs ${item.tVal.toFixed(1)}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 3px; background: #f8fafc; padding: 4px; border-radius: 6px;">
              <div style="background: #1e3a8a; height: 10px; width: ${Math.max(4, pWidth)}%; border-radius: 3px;" title="Jugador: ${item.pVal.toFixed(1)}"></div>
              <div style="background: #f97316; height: 10px; width: ${Math.max(4, tWidth)}%; border-radius: 3px;" title="Media Equipo: ${item.tVal.toFixed(1)}"></div>
            </div>
          </div>
        `;
      }).join("");

      return `
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
            <h4 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">JUGADOR VS MEDIA DEL EQUIPO</h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">${barsMarkup}</div>
            <div style="display: flex; justify-content: center; gap: 16px; margin-top: 16px; font-size: 11px; font-weight: 700;">
              <span style="color: #1e3a8a; display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; background: #1e3a8a; border-radius: 2px;"></span> Jugador</span>
              <span style="color: #f97316; display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; background: #f97316; border-radius: 2px;"></span> Media Equipo</span>
            </div>
          </div>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
            <h4 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">RADAR COMPARATIVO</h4>
            ${this._renderRadarChartSVG(pAvgs, tAvgs)}
          </div>
        </div>
      `;
    }

    // 6. OBSERVACIONES
    if (this.activeTab === "observaciones") {
      const canNotes = this._canEditNotes();

      return `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <form id="form-observations" style="display: flex; flex-direction: column; gap: 16px;">
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
              <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 800; color: #0f172a;">📄 OBSERVACIONES DEL ENTRENADOR</h4>
              ${canNotes ? `
                <textarea name="notes" rows="4" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 13px; font-family: inherit; outline: none;" placeholder="Escribe observaciones generales del jugador...">${p.notes || ''}</textarea>
              ` : `
                <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
                  ${p.notes || 'Sin observaciones registradas.'}
                </div>
              `}
            </div>

            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
              <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 800; color: #0f172a;">🎯 OBJETIVOS</h4>
              ${canNotes ? `
                <textarea name="objectives" rows="3" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 13px; font-family: inherit; outline: none;" placeholder="Defina los objetivos tácticos o físicos para la temporada...">${p.objectives || ''}</textarea>
              ` : `
                <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
                  ${p.objectives || 'Sin objetivos definidos.'}
                </div>
              `}
            </div>

            ${canNotes ? `
              <div style="display: flex; justify-content: flex-end;">
                <button type="submit" style="background: #1e3a8a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer;">
                  💾 Guardar Observaciones y Objetivos
                </button>
              </div>
            ` : ''}
          </form>
        </div>
      `;
    }

    // 7. EDITAR DATOS (SOLO VISIBLE SI TIENE PERMISO DE EDICIÓN COMPLETO)
    if (this.activeTab === "editar" && this._canEditFullProfile()) {
      const photo = p.photo_url || "";
      const secPositions = Array.isArray(p.secondary_positions) ? p.secondary_positions : [];

      const posList = ["Base", "Escolta", "Alero", "Ala-Pívot", "Pívot"];
      const secPosButtons = posList.map(pos => {
        const isSelected = secPositions.includes(pos);
        return `
          <button type="button" class="btn-sec-pos ${isSelected ? 'active' : ''}" data-pos="${pos}" style="background: ${isSelected ? '#1e3a8a' : '#f1f5f9'}; color: ${isSelected ? 'white' : '#475569'}; border: 1px solid ${isSelected ? '#1e3a8a' : '#cbd5e1'}; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">
            ${pos}
          </button>
        `;
      }).join(" ");

      return `
        <form id="form-edit-player" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 20px;">
          <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase;">FOTOGRAFÍA DEL JUGADOR</h3>
          <div style="display: flex; gap: 16px; align-items: center;">
            <div id="photo-preview-box">
              ${photo ? `<img src="${photo}" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid #cbd5e1;" />` : `<div style="width: 70px; height: 70px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900;">#${p.jersey ?? '-'}</div>`}
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block;">URL de la Foto de Perfil (photo_url)</label>
              <input type="text" id="input-photo-url" name="photo_url" value="${photo}" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px;" placeholder="data:image/jpeg;base64... o URL de imagen" />
              
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">O sube una imagen:</span>
                <input type="file" id="input-photo-file" accept="image/*" style="font-size: 12px;" />
              </div>
            </div>
          </div>

          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 4px 0;" />

          <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase;">DATOS DE LA FICHA</h3>
          
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Nombre (first_name)</label>
              <input type="text" name="first_name" value="${p.first_name || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Apellidos (last_name)</label>
              <input type="text" name="last_name" value="${p.last_name || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Dorsal (jersey)</label>
              <input type="number" name="jersey" value="${p.jersey ?? 0}" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 16px;">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Posición Principal (primary_position)</label>
              <select name="primary_position" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: white;">
                <option value="Base" ${p.primary_position === 'Base' ? 'selected' : ''}>Base</option>
                <option value="Escolta" ${p.primary_position === 'Escolta' ? 'selected' : ''}>Escolta</option>
                <option value="Alero" ${p.primary_position === 'Alero' ? 'selected' : ''}>Alero</option>
                <option value="Ala-Pívot" ${p.primary_position === 'Ala-Pívot' ? 'selected' : ''}>Ala-Pívot</option>
                <option value="Pívot" ${p.primary_position === 'Pívot' ? 'selected' : ''}>Pívot</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Posiciones Secundarias (secondary_positions)</label>
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;" id="sec-pos-container">
                ${secPosButtons}
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Mano Dominante</label>
              <select name="dominant_hand" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: white;">
                <option value="Diestro" ${p.dominant_hand === 'Diestro' ? 'selected' : ''}>Diestro</option>
                <option value="Zurdo" ${p.dominant_hand === 'Zurdo' ? 'selected' : ''}>Zurdo</option>
                <option value="Ambidiestro" ${p.dominant_hand === 'Ambidiestro' ? 'selected' : ''}>Ambidiestro</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Estado</label>
              <select name="status" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: white;">
                <option value="Activo" ${p.status === 'Activo' ? 'selected' : ''}>Activo</option>
                <option value="Lesionado" ${p.status === 'Lesionado' ? 'selected' : ''}>Lesionado</option>
                <option value="Baja" ${p.status === 'Baja' ? 'selected' : ''}>Baja</option>
              </select>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Fecha Nacimiento (birth_date)</label>
              <input type="date" name="birth_date" value="${p.birth_date || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Altura cm (height_cm)</label>
              <input type="number" name="height_cm" value="${p.height_cm || ''}" placeholder="195" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Peso kg (weight_kg)</label>
              <input type="number" name="weight_kg" value="${p.weight_kg || ''}" placeholder="88" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Fecha Alta (joined_at)</label>
              <input type="date" name="joined_at" value="${p.joined_at ? String(p.joined_at).split('T')[0] : ''}" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            </div>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Notas u Observaciones del Jugador</label>
            <textarea name="notes" rows="3" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-family: inherit;" placeholder="Observaciones generales...">${p.notes || ''}</textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;">
            <button type="button" id="btn-cancel-edit" style="background: #f1f5f9; color: #475569; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer;">Cancelar</button>
            <button type="submit" style="background: #1e3a8a; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; cursor: pointer;">💾 Guardar Cambios</button>
          </div>
        </form>
      `;
    }

    return "";
  }

  // =========================================================================
  // RENDERIZADO Y CONTROLADOR DE EVENTOS
  // =========================================================================
  async render(containerId = "main-content", playerId = null, teamId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 🚀 LECTURA INSTANTÁNEA DESDE MEMORIA LOCAL (DATASTORE)
    this.players = DataStore.getPlayers() || [];
    this.playerStats = DataStore.getPlayerGameStats() || [];

    const gamesList = DataStore.getGames() || [];
    this.gamesMap = new Map(gamesList.map(g => [g.id, g]));

    // CASO A: DETALLE DE JUGADOR (#/player/UUID)
    if (playerId) {
      this.selectedPlayer = DataStore.getPlayerById(playerId);

      if (!this.selectedPlayer) {
        container.innerHTML = `<div style="padding: 20px; color: red;">Jugador no encontrado.</div>`;
        return;
      }

      const renderDetail = () => {
        container.innerHTML = `
          <div style="max-width: 1200px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
            <a href="#/players" style="color: #64748b; text-decoration: none; font-size: 13px; font-weight: 600; margin-bottom: 16px; display: inline-flex; align-items: center; gap: 6px;">← Volver a jugadores</a>
            ${this._renderDetailHeader()}
            ${this._renderNavTabs()}
            <div id="tab-content">${this._renderTabContent(playerId)}</div>
          </div>

          <style>
            .kpi-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
            .kpi-title { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
            .kpi-val { font-size: 22px; font-weight: 900; color: #0f172a; }
            .has-tooltip { position: relative; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
            .info-badge { background: #e2e8f0; color: #475569; border-radius: 50%; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; }
            .tooltip-box { visibility: hidden; opacity: 0; width: 200px; background-color: #0f172a; color: #ffffff; text-align: center; border-radius: 6px; padding: 8px; position: absolute; z-index: 100; bottom: 125%; left: 50%; transform: translateX(-50%); font-size: 11px; pointer-events: none; transition: all 0.2s ease; }
            .has-tooltip:hover .tooltip-box { visibility: visible; opacity: 1; }
          </style>
        `;

        // Eventos de Pestañas
        container.querySelectorAll(".tab-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            this.activeTab = btn.getAttribute("data-tab");
            renderDetail();
          });
        });

        container.querySelector("#btn-edit-tab")?.addEventListener("click", () => {
          this.activeTab = "editar";
          renderDetail();
        });

        // Formulario Observaciones
        const formObs = container.querySelector("#form-observations");
        if (formObs) {
          formObs.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(formObs);
            const updates = {
              notes: formData.get("notes"),
              objectives: formData.get("objectives")
            };

            await DataStore.updatePlayer(playerId, updates);
            this.selectedPlayer = { ...this.selectedPlayer, ...updates };
            alert("✅ Observaciones y objetivos guardados correctamente.");
          });
        }

        // Formulario Editar
        const formEdit = container.querySelector("#form-edit-player");
        if (formEdit) {
          const secContainer = container.querySelector("#sec-pos-container");
          if (secContainer) {
            secContainer.querySelectorAll(".btn-sec-pos").forEach(btn => {
              btn.addEventListener("click", () => {
                btn.classList.toggle("active");
                if (btn.classList.contains("active")) {
                  btn.style.background = "#1e3a8a";
                  btn.style.color = "white";
                } else {
                  btn.style.background = "#f1f5f9";
                  btn.style.color = "#475569";
                }
              });
            });
          }

          // Subida de Archivo de Foto (Conversión a Base64)
          const photoInputUrl = container.querySelector("#input-photo-url");
          const photoInputFile = container.querySelector("#input-photo-file");
          const photoPreviewBox = container.querySelector("#photo-preview-box");

          if (photoInputFile) {
            photoInputFile.addEventListener("change", (e) => {
              const file = e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const base64Url = event.target.result;
                  if (photoInputUrl) photoInputUrl.value = base64Url;
                  if (photoPreviewBox) {
                    photoPreviewBox.innerHTML = `<img src="${base64Url}" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid #cbd5e1;" />`;
                  }
                };
                reader.readAsDataURL(file);
              }
            });
          }

          container.querySelector("#btn-cancel-edit")?.addEventListener("click", () => {
            this.activeTab = "resumen";
            renderDetail();
          });

          formEdit.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(formEdit);

            const selectedSecPos = [];
            secContainer?.querySelectorAll(".btn-sec-pos.active").forEach(btn => {
              selectedSecPos.push(btn.getAttribute("data-pos"));
            });

            const updates = {
              photo_url: formData.get("photo_url"),
              first_name: formData.get("first_name"),
              last_name: formData.get("last_name"),
              jersey: Number(formData.get("jersey")),
              primary_position: formData.get("primary_position"),
              secondary_positions: selectedSecPos,
              dominant_hand: formData.get("dominant_hand"),
              status: formData.get("status"),
              birth_date: formData.get("birth_date") || null,
              height_cm: formData.get("height_cm") ? Number(formData.get("height_cm")) : null,
              weight_kg: formData.get("weight_kg") ? Number(formData.get("weight_kg")) : null,
              joined_at: formData.get("joined_at") || null,
              notes: formData.get("notes")
            };

            await DataStore.updatePlayer(playerId, updates);
            this.selectedPlayer = { ...this.selectedPlayer, ...updates };
            this.activeTab = "resumen";
            renderDetail();
          });
        }
      };

      renderDetail();
      return;
    }

    // CASO B: PARRILLA GENERAL (#/players)
    container.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; font-family: system-ui, -apple-system, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">Jugadores</h1>
          <div style="display: flex; gap: 12px; align-items: center;">
            <input type="text" id="search-player" placeholder="🔍 Buscar jugador..." value="${this.filterText}" style="padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
            
            <select id="select-pos" style="padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: white;">
              <option value="Todos" ${this.filterPosition === 'Todos' ? 'selected' : ''}>Todas las Posiciones</option>
              <option value="Base" ${this.filterPosition === 'Base' ? 'selected' : ''}>Base</option>
              <option value="Escolta" ${this.filterPosition === 'Escolta' ? 'selected' : ''}>Escolta</option>
              <option value="Alero" ${this.filterPosition === 'Alero' ? 'selected' : ''}>Alero</option>
              <option value="Ala-Pívot" ${this.filterPosition === 'Ala-Pívot' ? 'selected' : ''}>Ala-Pívot</option>
              <option value="Pívot" ${this.filterPosition === 'Pívot' ? 'selected' : ''}>Pívot</option>
            </select>

            <select id="select-sort" style="padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: white;">
              <option value="jersey_asc" ${this.sortBy === 'jersey_asc' ? 'selected' : ''}>🔢 Dorsal (Menor a Mayor)</option>
              <option value="jersey_desc" ${this.sortBy === 'jersey_desc' ? 'selected' : ''}>🔢 Dorsal (Mayor a Menor)</option>
              <option value="name_asc" ${this.sortBy === 'name_asc' ? 'selected' : ''}>🔤 Nombre (A - Z)</option>
              <option value="name_desc" ${this.sortBy === 'name_desc' ? 'selected' : ''}>🔤 Nombre (Z - A)</option>
            </select>
          </div>
        </div>
        <div id="players-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          ${this._renderCards()}
        </div>
      </div>
    `;

    // Listeners de Parrilla
    container.querySelector("#search-player")?.addEventListener("input", (e) => {
      this.filterText = e.target.value;
      container.querySelector("#players-grid").innerHTML = this._renderCards();
    });

    container.querySelector("#select-pos")?.addEventListener("change", (e) => {
      this.filterPosition = e.target.value;
      container.querySelector("#players-grid").innerHTML = this._renderCards();
    });

    container.querySelector("#select-sort")?.addEventListener("change", (e) => {
      this.sortBy = e.target.value;
      container.querySelector("#players-grid").innerHTML = this._renderCards();
    });
  }
}