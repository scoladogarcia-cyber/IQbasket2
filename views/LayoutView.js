/**
 * @fileoverview Layout contenedor principal con Sidebar fija en pantalla.
 * El selector de Idioma y el botón de Cerrar Sesión permanecen siempre visibles
 * a continuación del menú principal, sin desplazarse con el scroll del contenido.
 */

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
          <span style="font-size: 14px;">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `;
    }).join("");

    return `
      <div class="app-layout">
        
        <!-- BARRA LATERAL AZUL FIJA -->
        <aside class="app-sidebar">
          
          <div style="display: flex; flex-direction: column; gap: 16px; overflow-y: auto; padding-right: 4px;">
            
            <!-- Logo Header -->
            <div style="display: flex; align-items: center; gap: 10px; padding: 0 8px;">
              <div style="width: 32px; height: 32px; background-color: #f59e0b; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #172554; font-weight: 900; font-size: 14px; flex-shrink: 0;">
                IQ
              </div>
              <span style="font-weight: 900; font-size: 20px; letter-spacing: -0.02em;">BasketIQ</span>
            </div>

            <!-- Selectores de Equipo y Temporada -->
            <div class="sidebar-selectors" style="display: flex; flex-direction: column; gap: 10px; padding: 0 8px;">
              <div>
                <label style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #93c5fd; display: block; margin-bottom: 4px;">
                  ${LayoutView.t("team", "EQUIPO").toUpperCase()}
                </label>
                <select style="width: 100%; background-color: #1e3a8a; border: 1px solid #1d4ed8; color: #ffffff; border-radius: 8px; padding: 8px 10px; font-size: 12px; font-weight: 500; outline: none; box-sizing: border-box;">
                  <option>JMJ Manyanet Sant Andreu</option>
                </select>
              </div>
              <div>
                <label style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #93c5fd; display: block; margin-bottom: 4px;">
                  ${LayoutView.t("season", "TEMPORADA").toUpperCase()}
                </label>
                <select style="width: 100%; background-color: #1e3a8a; border: 1px solid #1d4ed8; color: #ffffff; border-radius: 8px; padding: 8px 10px; font-size: 12px; font-weight: 500; outline: none; box-sizing: border-box;">
                  <option>2026</option>
                </select>
              </div>
            </div>

            <!-- Navegación Menú -->
            <nav class="sidebar-nav">
              ${navLinksMarkup}
            </nav>

            <!-- SELECTOR DE IDIOMA Y CERRAR SESIÓN -->
            <div style="border-top: 1px solid #1e3a8a; padding-top: 12px; margin-top: 8px; display: flex; flex-direction: column; gap: 10px;">
              
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 8px;">
                <span style="font-size: 11px; font-weight: 800; color: #93c5fd; letter-spacing: 0.05em;">🌐 ${LayoutView.t("language", "IDIOMA")}</span>
                <select id="select-lang-toggle" style="background-color: #1e3a8a; border: 1px solid #1d4ed8; color: #ffffff; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 700; outline: none; cursor: pointer;">
                  <option value="es" ${currentLang === 'es' ? 'selected' : ''}>ES</option>
                  <option value="cat" ${currentLang === 'cat' ? 'selected' : ''}>CAT</option>
                  <option value="en" ${currentLang === 'en' ? 'selected' : ''}>EN</option>
                </select>
              </div>

              <button id="btn-logout" style="width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 10px; font-size: 13px; font-weight: 600; color: #93c5fd; background: none; border: none; cursor: pointer; border-radius: 8px; text-align: left;">
                🚪 ${LayoutView.t("logout", "Cerrar sesión")}
              </button>
            </div>

          </div>
        </aside>

        <!-- ÁREA PRINCIPAL CON MARGEN IZQUIERDO CORRESPONDIENTE AL SIDEBAR FIJO -->
        <main class="app-main">
          ${contentHtml}
        </main>

      </div>

      <!-- ESTILOS Y POSICIONAMIENTO FIJO -->
      <style>
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          background-color: #f8fafc;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .app-layout {
          min-height: 100vh;
          width: 100%;
          display: flex;
          background-color: #f8fafc;
          box-sizing: border-box;
        }

        /* Sidebar con posicionamiento fijo para no desplazarse en scrolls largos */
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

        /* Desplazamiento del contenido principal a la derecha de la sidebar fija */
        .app-main {
          flex: 1;
          margin-left: 260px;
          padding: 32px 24px;
          box-sizing: border-box;
          display: flex;
          justify-content: center;
          min-width: 0;
        }

        #dashboard-content-area {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        @media (max-width: 868px) {
          .app-layout { flex-direction: column; }
          .app-sidebar { position: relative; width: 100%; height: auto; border-bottom: 2px solid #1e3a8a; }
          .app-main { margin-left: 0; padding: 16px; }
          .sidebar-selectors { display: grid !important; grid-template-columns: 1fr 1fr; }
          .sidebar-nav { flex-direction: row; overflow-x: auto; white-space: nowrap; padding-bottom: 8px; }
          .nav-link { padding: 8px 12px; font-size: 12px; }
        }
      </style>
    `;
  }
}