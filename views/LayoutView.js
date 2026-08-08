/**
 * @fileoverview Layout contenedor principal optimizado para Mobile First & Desktop.
 * El selector de Idioma, los selectores dinámicos de Equipo y Temporada,
 * y el botón de Cerrar Sesión permanecen siempre visibles.
 */

import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";

export class LayoutView {
  static t(key, fallback) {
    return TranslationStore.t(key, fallback);
  }

  static _normalizeRouteKey(route) {
    const r = String(route || '').toLowerCase().trim();
    if (['partidos', 'games', 'game', 'live'].includes(r)) return 'games';
    if (['advanced', 'advanced_stats'].includes(r)) return 'advanced';
    if (['boxscore', 'registro'].includes(r)) return 'boxscore';
    if (['team', 'equipo'].includes(r)) return 'team';
    if (['players', 'jugadores', 'player', 'jugador'].includes(r)) return 'players';
    if (['settings', 'configuracion', 'translations'].includes(r)) return 'settings';
    if (['lineups', 'quintetos'].includes(r)) return 'lineups';
    if (['comparator', 'comparador'].includes(r)) return 'comparator';
    if (['reports', 'informes', 'informe'].includes(r)) return 'reports';
    if (['ask', 'pregunta', 'preguntale', 'ai', 'ia', 'ask-ai'].includes(r)) return 'ask';
    if (['profile', 'perfil'].includes(r)) return 'profile';
    return r || 'dashboard';
  }

  static updateActiveMenu(route) {
    const activeKey = LayoutView._normalizeRouteKey(route);
    const links = document.querySelectorAll(".app-sidebar .nav-link");

    links.forEach(link => {
      const linkKey = link.getAttribute("data-route-key");
      if (linkKey === activeKey) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  static wrap(contentHtml, activeRoute = "dashboard", userRole = "ADMIN") {
    const currentActiveKey = LayoutView._normalizeRouteKey(activeRoute);
    const currentLang = TranslationStore.currentLang;

    // Cargar datos dinámicos de equipos y temporadas activas
    const currentActiveTeamId = localStorage.getItem("iq_active_team_id") || "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22";
    const currentActiveSeason = localStorage.getItem("iq_active_season") || "2026";

    const teams = DataStore.getTeams() || [];
    const storedSeasons = localStorage.getItem("iq_seasons");
    const seasons = storedSeasons ? JSON.parse(storedSeasons) : [{ id: "s-1", name: "2026", isActive: true }];

    const navItems = [
      { key: "dashboard", label: LayoutView.t("dashboard", "Dashboard"), icon: "📊", route: "dashboard" },
      { key: "team", label: LayoutView.t("team", "Equipo"), icon: "👥", route: "team" },
      { key: "players", label: LayoutView.t("players", "Jugadores"), icon: "👤", route: "players" },
      { key: "games", label: LayoutView.t("games", "Partidos"), icon: "📅", route: "games" },
      { key: "boxscore", label: LayoutView.t("boxscore", "Registro estadístico"), icon: "📋", route: "boxscore" },
      { key: "advanced", label: LayoutView.t("advanced_stats", "Estadística avanzada"), icon: "📈", route: "advanced" },
      { key: "lineups", label: LayoutView.t("lineups", "Quintetos"), icon: "🔥", route: "lineups" },
      { key: "comparator", label: LayoutView.t("comparator", "Comparador"), icon: "🔀", route: "comparator" },
      { key: "reports", label: LayoutView.t("reports", "Informes"), icon: "📄", route: "reports" },
      { key: "ask", label: LayoutView.t("ask_ai", "Pregúntale a tus datos"), icon: "🤖", route: "ask" },
      { key: "profile", label: LayoutView.t("profile", "Mi Perfil"), icon: "👤", route: "profile" },
      { key: "settings", label: LayoutView.t("settings", "Configuración"), icon: "⚙️", route: "settings" }
    ];

    const navLinksMarkup = navItems.map(item => {
      const isActive = currentActiveKey === item.key;
      return `
        <a href="#/${item.route}" 
           class="nav-link ${isActive ? 'active' : ''}" 
           data-route-key="${item.key}">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
        </a>
      `;
    }).join("");

    return `
      <div class="app-layout">
        
        <!-- BARRA LATERAL AZUL -->
        <aside class="app-sidebar">
          
          <div class="sidebar-inner">
            
            <!-- Logo Header -->
            <div class="sidebar-header">
              <div class="logo-box">IQ</div>
              <span class="logo-title">BasketIQ</span>
            </div>

            <!-- Selectores Dinámicos de Equipo y Temporada -->
            <div class="sidebar-selectors">
              <div class="selector-group">
                <label>${LayoutView.t("team", "EQUIPO").toUpperCase()}</label>
                <select id="sidebar-select-team" class="sidebar-select">
                  ${teams.length > 0 ? teams.map(t => `
                    <option value="${t.id}" ${String(t.id) === String(currentActiveTeamId) ? 'selected' : ''}>
                      ${t.name} (${t.category || 'Senior'})
                    </option>
                  `).join("") : `<option value="${currentActiveTeamId}">JMJ Manyanet Sant Andreu</option>`}
                </select>
              </div>
              <div class="selector-group">
                <label>${LayoutView.t("season", "TEMPORADA").toUpperCase()}</label>
                <select id="sidebar-select-season" class="sidebar-select">
                  ${seasons.map(s => `
                    <option value="${s.name}" ${String(s.name) === String(currentActiveSeason) ? 'selected' : ''}>
                      ${s.name}
                    </option>
                  `).join("")}
                </select>
              </div>
            </div>

            <!-- Navegación Menú -->
            <nav class="sidebar-nav">
              ${navLinksMarkup}
            </nav>

            <!-- SELECTOR DE IDIOMA Y CERRAR SESIÓN -->
            <div class="sidebar-footer">
              <div class="lang-row">
                <span class="lang-label">🌐 ${LayoutView.t("language", "IDIOMA")}</span>
                <select id="select-lang-toggle" class="lang-select">
                  <option value="es" ${currentLang === 'es' ? 'selected' : ''}>ES</option>
                  <option value="cat" ${currentLang === 'cat' ? 'selected' : ''}>CAT</option>
                  <option value="en" ${currentLang === 'en' ? 'selected' : ''}>EN</option>
                </select>
              </div>

              <button id="btn-logout" class="btn-logout">
                🚪 ${LayoutView.t("logout", "Cerrar sesión")}
              </button>
            </div>

          </div>
        </aside>

        <!-- ÁREA PRINCIPAL -->
        <main class="app-main">
          <div id="dashboard-content-area">
            ${contentHtml}
          </div>
        </main>

      </div>

      <!-- ESTILOS Y RESPONSIVE MOBILE FIRST -->
      <style>
        *, *::before, *::after {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          background-color: #f8fafc;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          overflow-x: hidden;
        }

        .app-layout {
          min-height: 100vh;
          width: 100%;
          display: flex;
          background-color: #f8fafc;
        }

        /* Sidebar Escritorio */
        .app-sidebar {
          width: 260px;
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          background-color: #172554;
          color: #ffffff;
          padding: 16px;
          box-sizing: border-box;
          z-index: 50;
        }

        .sidebar-inner {
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
          overflow-y: auto;
          padding-right: 4px;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 8px;
        }

        .logo-box {
          width: 32px;
          height: 32px;
          background-color: #f59e0b;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #172554;
          font-weight: 900;
          font-size: 14px;
          flex-shrink: 0;
        }

        .logo-title {
          font-weight: 900;
          font-size: 20px;
          letter-spacing: -0.02em;
        }

        .sidebar-selectors {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0 8px;
        }

        .selector-group label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #93c5fd;
          display: block;
          margin-bottom: 4px;
        }

        .sidebar-select {
          width: 100%;
          background-color: #1e3a8a;
          border: 1px solid #1d4ed8;
          color: #ffffff;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 500;
          outline: none;
          box-sizing: border-box;
          cursor: pointer;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
          color: #bfdbfe;
        }

        .nav-link:hover {
          background-color: #1e3a8a;
          color: #ffffff;
        }

        .nav-link.active {
          background-color: #1e40af !important;
          color: #ffffff !important;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
        }

        .sidebar-footer {
          border-top: 1px solid #1e3a8a;
          padding-top: 12px;
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lang-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 8px;
        }

        .lang-label {
          font-size: 11px;
          font-weight: 800;
          color: #93c5fd;
          letter-spacing: 0.05em;
        }

        .lang-select {
          background-color: #1e3a8a;
          border: 1px solid #1d4ed8;
          color: #ffffff;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 700;
          outline: none;
          cursor: pointer;
        }

        .btn-logout {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          font-size: 13px;
          font-weight: 600;
          color: #93c5fd;
          background: none;
          border: none;
          cursor: pointer;
          border-radius: 8px;
          text-align: left;
        }

        /* Área Principal Escritorio */
        .app-main {
          flex: 1;
          margin-left: 260px;
          padding: 32px 24px;
          box-sizing: border-box;
          display: flex;
          justify-content: center;
          min-width: 0;
          width: calc(100% - 260px);
        }

        #dashboard-content-area {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        /* ========================================================
           RESPONSIVE MÓVIL (PANTALLAS PEQUEÑAS)
           ======================================================== */
        @media (max-width: 868px) {
          .app-layout {
            flex-direction: column;
          }

          .app-sidebar {
            position: relative;
            width: 100%;
            height: auto;
            border-bottom: 2px solid #1e3a8a;
            padding: 12px 12px 8px 12px;
          }

          .sidebar-inner {
            overflow-y: visible;
            gap: 12px;
          }

          .sidebar-selectors {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding: 0;
          }

          /* Cinta de navegación deslizante en móviles */
          .sidebar-nav {
            flex-direction: row;
            overflow-x: auto;
            white-space: nowrap;
            padding: 4px 0 8px 0;
            gap: 6px;
            -webkit-overflow-scrolling: touch;
          }

          .nav-link {
            padding: 8px 14px;
            font-size: 13px;
            flex-shrink: 0;
            background-color: #1e3a8a;
            border-radius: 20px;
          }

          .sidebar-footer {
            margin-top: 4px;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            padding-top: 8px;
          }

          .btn-logout {
            width: auto;
            padding: 4px 8px;
          }

          /* Ajuste del contenido para Móviles */
          .app-main {
            margin-left: 0;
            width: 100%;
            padding: 16px 12px;
          }

          /* Forzar 1 sola columna vertical para tarjetas */
          #dashboard-content-area .grid,
          #dashboard-content-area [class*="grid-cols-"],
          #dashboard-content-area [style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
            width: 100% !important;
          }

          /* Asegurar que las tarjetas e imágenes no se corten */
          #dashboard-content-area .card,
          #dashboard-content-area [class*="card"] {
            width: 100% !important;
            box-sizing: border-box;
          }
        }
      </style>
    `;
  }
}