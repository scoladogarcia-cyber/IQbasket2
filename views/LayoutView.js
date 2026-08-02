/**
 * @fileoverview Layout contenedor principal con la barra lateral azul e integración Responsive para Móviles.
 * Ajustado para garantizar encaje perfecto centrado en pantallas grandes sin desbordamientos hacia la derecha.
 */

import { i18n } from "../core-modules/i18n/I18nEngine.js";

export class LayoutView {
  static t(key, fallback) {
    const val = i18n ? i18n.t(key) : null;
    return (!val || val === key) ? fallback : val;
  }

  static wrap(contentHtml, activeRoute = "dashboard", userRole = "ADMIN") {
    const navItems = [
      { label: LayoutView.t("dashboard", "Dashboard"), icon: "📊", route: "dashboard" },
      { label: LayoutView.t("team", "Equipo"), icon: "👥", route: "team" },
      { label: LayoutView.t("players", "Jugadores"), icon: "👤", route: "players" },
      { label: LayoutView.t("games", "Partidos"), icon: "📅", route: "games" },
      { label: LayoutView.t("boxscore", "Registro estadístico"), icon: "📋", route: "boxscore" },
      { label: LayoutView.t("advanced_stats", "Estadística avanzada"), icon: "📈", route: "advanced" },
      { label: LayoutView.t("lineups", "Quintetos"), icon: "🔥", route: "lineups" },
      { label: LayoutView.t("comparator", "Comparador"), icon: "🔀", route: "comparator" },
      { label: LayoutView.t("reports", "Informes"), icon: "📄", route: "reports" },
      { label: LayoutView.t("ask_ai", "Pregúntale a tus datos"), icon: "🤖", route: "ask" },
      { label: LayoutView.t("profile", "Mi Perfil"), icon: "👤", route: "profile" },
      { label: LayoutView.t("settings", "Configuración"), icon: "⚙️", route: "settings" }
    ];

    const navLinksMarkup = navItems.map(item => {
      const isActive = activeRoute === item.route;
      return `
        <a href="#/${item.route}" 
           class="nav-link ${isActive ? 'active' : ''}">
          <span style="font-size: 14px;">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `;
    }).join("");

    return `
      <div class="app-layout">
        
        <!-- BARRA LATERAL AZUL (SIDEBAR) -->
        <aside class="app-sidebar">
          
          <div style="padding: 20px 16px; display: flex; flex-direction: column; gap: 20px;">
            
            <!-- Logo Header -->
            <div style="display: flex; align-items: center; gap: 10px; padding: 0 8px;">
              <div style="width: 32px; height: 32px; background-color: #f59e0b; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #172554; font-weight: 900; font-size: 14px; flex-shrink: 0;">
                IQ
              </div>
              <span style="font-weight: 900; font-size: 20px; letter-spacing: -0.02em;">BasketIQ</span>
            </div>

            <!-- Selectores de Equipo y Temporada -->
            <div class="sidebar-selectors" style="display: flex; flex-direction: column; gap: 12px; padding: 0 8px;">
              <div>
                <label style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #93c5fd; display: block; margin-bottom: 4px;">EQUIPO</label>
                <select style="width: 100%; background-color: #1e3a8a; border: 1px solid #1d4ed8; color: #ffffff; border-radius: 8px; padding: 8px 10px; font-size: 12px; font-weight: 500; outline: none; box-sizing: border-box;">
                  <option>JMJ Manyanet Sant Andreu</option>
                </select>
              </div>
              <div>
                <label style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #93c5fd; display: block; margin-bottom: 4px;">TEMPORADA</label>
                <select style="width: 100%; background-color: #1e3a8a; border: 1px solid #1d4ed8; color: #ffffff; border-radius: 8px; padding: 8px 10px; font-size: 12px; font-weight: 500; outline: none; box-sizing: border-box;">
                  <option>2026</option>
                </select>
              </div>
            </div>

            <!-- Navegación Menú -->
            <nav class="sidebar-nav">
              ${navLinksMarkup}
            </nav>
          </div>

          <!-- Botón Cerrar Sesión -->
          <div class="logout-container" style="padding: 16px; border-top: 1px solid #1e3a8a;">
            <button id="btn-logout" style="width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px; font-size: 13px; font-weight: 600; color: #93c5fd; background: none; border: none; cursor: pointer; border-radius: 8px; text-align: left;">
              🚪 ${LayoutView.t("logout", "Cerrar sesión")}
            </button>
          </div>
        </aside>

        <!-- ÁREA PRINCIPAL DE CONTENIDO (DASHBOARD / PÁGINAS) -->
        <main class="app-main">
          ${contentHtml}
        </main>

      </div>

      <!-- ESTILOS CORREGIDOS Y RESPONSIVE PARA EL LAYOUT -->
      <style>
        /* Reset para evitar scrollbars fantasma */
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          overflow-x: hidden;
          background-color: #f8fafc;
          font-family: system-ui, -apple-system, sans-serif;
        }

        /* Layout de la App (width: 100% evita que 100vw cree desbordamiento horizontal) */
        .app-layout {
          min-height: 100vh;
          width: 100%;
          display: flex;
          background-color: #f8fafc;
          margin: 0;
          box-sizing: border-box;
        }

        /* Sidebar lateral azul */
        .app-sidebar {
          width: 260px;
          background-color: #172554;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          flex-shrink: 0;
          min-height: 100vh;
          box-sizing: border-box;
          z-index: 50;
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
          background-color: #1e40af;
          color: #ffffff;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
        }

        /* Contenedor principal que se expande sin empujar hacia la derecha */
        .app-main {
          flex: 1;
          min-width: 0; /* Previene desbordamientos por componentes flex anchos */
          padding: 32px 24px;
          overflow-y: auto;
          box-sizing: border-box;
          display: flex;
          justify-content: center;
        }

        /* El área donde vive SeasonDashboardView se auto-centra y limita a 1200px */
        #dashboard-content-area {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        /* 📱 MEDIA QUERIES (MÓVILES Y TABLETS) */
        @media (max-width: 868px) {
          .app-layout {
            flex-direction: column;
          }

          .app-sidebar {
            width: 100%;
            min-height: auto;
            border-bottom: 2px solid #1e3a8a;
          }

          .sidebar-selectors {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
          }

          .sidebar-nav {
            flex-direction: row;
            overflow-x: auto;
            white-space: nowrap;
            padding-bottom: 8px;
            -webkit-overflow-scrolling: touch;
          }

          .nav-link {
            padding: 8px 12px;
            font-size: 12px;
          }

          .logout-container {
            display: none;
          }

          .app-main {
            padding: 16px;
          }
        }
      </style>
    `;
  }
}