/**
 * @fileoverview Componente AppLayout.js
 * Genera la estructura Shell responsive de IQ Basket.
 * Resuelto: Menú "Más" en formato Lista Vertical Táctil, autocierre al hacer clic,
 * botón X operativo, overlay oscuro funcional y Z-Index correcto.
 */

import { I18n } from '../services/I18nService.js';
import { APP_CONFIG } from '../config/app.config.js';

export class AppLayout {
  constructor(router) {
    this.router = router;
    this.activeGame = null;

    I18n.subscribe(() => {
      this.updateTranslations();
    });
  }

  render(containerId = "app") {
    const appContainer = document.getElementById(containerId);
    if (!appContainer) return;

    appContainer.innerHTML = `
      <div class="app-layout-shell">
        
        <!-- 1. BARRA SUPERIOR MÓVIL (Header) -->
        <header class="mobile-header mobile-only">
          <div class="mobile-brand">
            <svg class="brand-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M5.6 5.6C9.2 9.2 14.8 9.2 18.4 5.6"></path>
              <path d="M5.6 18.4C9.2 14.8 14.8 14.8 18.4 18.4"></path>
              <line x1="12" y1="2" x2="12" y2="22"></line>
            </svg>
            <span class="brand-title">${APP_CONFIG.appName || 'IQ Basket'}</span>
          </div>
          <div id="contextual-game-badge" class="contextual-game-container"></div>
        </header>

        <!-- 2. NAVEGACIÓN LATERAL (Desktop & Tablet) -->
        <aside class="app-sidebar desktop-only">
          <div class="sidebar-brand">
            <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M5.6 5.6C9.2 9.2 14.8 9.2 18.4 5.6"></path>
              <path d="M5.6 18.4C9.2 14.8 14.8 14.8 18.4 18.4"></path>
              <line x1="12" y1="2" x2="12" y2="22"></line>
            </svg>
            <span class="brand-name">${APP_CONFIG.appName || 'IQ Basket'}</span>
          </div>

          <div id="desktop-contextual-game" class="sidebar-contextual-box"></div>

          <nav class="sidebar-nav">
            <div class="nav-group">
              <span class="nav-group-title" data-i18n="navigation.groups.general">GENERAL</span>
              <a href="#/dashboard" class="nav-item" data-hash="#/dashboard">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
                <span class="nav-text" data-i18n="navigation.dashboard">Inicio</span>
              </a>
            </div>

            <div class="nav-group">
              <span class="nav-group-title" data-i18n="navigation.groups.team">EQUIPO</span>
              <a href="#/team" class="nav-item" data-hash="#/team">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <span class="nav-text" data-i18n="navigation.team">Equipo</span>
              </a>
              <a href="#/players" class="nav-item" data-hash="#/players">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 1 0-16 0"></path></svg>
                <span class="nav-text" data-i18n="navigation.players">Jugadores</span>
              </a>
              <a href="#/games" class="nav-item" data-hash="#/games">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span class="nav-text" data-i18n="navigation.games">Partidos</span>
              </a>
              <a href="#/lineups" class="nav-item" data-hash="#/lineups">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="19" cy="11" r="2"></circle></svg>
                <span class="nav-text" data-i18n="navigation.lineups">Quintetos</span>
              </a>
            </div>

            <div class="nav-group">
              <span class="nav-group-title" data-i18n="navigation.groups.analysis">ANÁLISIS</span>
              <a href="#/advanced-stats" class="nav-item" data-hash="#/advanced-stats">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                <span class="nav-text" data-i18n="navigation.advancedStats">Análisis Avanzado</span>
              </a>
              <a href="#/comparator" class="nav-item" data-hash="#/comparator">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5"></path><path d="M8 21H3v-5"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>
                <span class="nav-text" data-i18n="navigation.comparator">Comparador</span>
              </a>
              <a href="#/reports" class="nav-item" data-hash="#/reports">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <span class="nav-text" data-i18n="navigation.reports">Informes</span>
              </a>
              <a href="#/ask-ai" class="nav-item" data-hash="#/ask-ai">
                <svg class="nav-svg highlight-ai" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12L2.5 7.5"></path><path d="M12 12v10"></path></svg>
                <span class="nav-text" data-i18n="navigation.aiAssistant">Asistente IQ</span>
              </a>
            </div>

            <div class="nav-group">
              <span class="nav-group-title" data-i18n="navigation.groups.account">CUENTA</span>
              <a href="#/profile" class="nav-item" data-hash="#/profile">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span class="nav-text" data-i18n="navigation.profile">Perfil</span>
              </a>
              <a href="#/settings" class="nav-item" data-hash="#/settings">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                <span class="nav-text" data-i18n="navigation.settings">Configuración</span>
              </a>
            </div>
          </nav>
        </aside>

        <!-- 3. ÁREA DE CONTENIDO PRINCIPAL -->
        <main id="main-content" class="app-main-content">
          <!-- Las vistas se renderizan AQUÍ -->
        </main>

        <!-- 4. BARRA DE NAVEGACIÓN INFERIOR (Móvil) -->
        <nav class="mobile-bottom-bar mobile-only" aria-label="Navegación Móvil">
          <a href="#/dashboard" class="mobile-nav-item" data-hash="#/dashboard">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
            <span class="mobile-label" data-i18n="navigation.home">Inicio</span>
          </a>
          <a href="#/team" class="mobile-nav-item" data-hash="#/team">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
            <span class="mobile-label" data-i18n="navigation.team">Equipo</span>
          </a>
          <a href="#/games" class="mobile-nav-item" data-hash="#/games">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line></svg>
            <span class="mobile-label" data-i18n="navigation.games">Partidos</span>
          </a>
          <a href="#/advanced-stats" class="mobile-nav-item" data-hash="#/advanced-stats">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            <span class="mobile-label" data-i18n="navigation.advancedStats">Stats</span>
          </a>
          <button type="button" id="btn-mobile-more" class="mobile-nav-item">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
            <span class="mobile-label" data-i18n="navigation.more">Más</span>
          </button>
        </nav>

        <!-- 5. CAPA OSCURA TRASLÚCIDA (Backdrop) -->
        <div id="mobile-sheet-overlay" class="mobile-sheet-overlay"></div>

        <!-- 6. MENÚ EMERGENTE "MÁS" EN LISTA TÁCTIL VERTICAL -->
        <div id="mobile-more-sheet" class="mobile-more-sheet">
          <div class="sheet-header">
            <span class="sheet-title" data-i18n="navigation.moreOptions">Más Opciones</span>
            <button type="button" id="btn-close-sheet" class="sheet-close-btn" aria-label="Cerrar">✕</button>
          </div>
          <div class="sheet-list">
            <a href="#/players" class="sheet-list-item">
              <span class="sheet-icon">👤</span>
              <span class="sheet-text" data-i18n="navigation.players">Jugadores</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/lineups" class="sheet-list-item">
              <span class="sheet-icon">🏀</span>
              <span class="sheet-text" data-i18n="navigation.lineups">Quintetos</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/comparator" class="sheet-list-item">
              <span class="sheet-icon">⚖️</span>
              <span class="sheet-text" data-i18n="navigation.comparator">Comparador</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/reports" class="sheet-list-item">
              <span class="sheet-icon">📄</span>
              <span class="sheet-text" data-i18n="navigation.reports">Informes</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/ask-ai" class="sheet-list-item">
              <span class="sheet-icon">🤖</span>
              <span class="sheet-text" data-i18n="navigation.aiAssistant">Asistente IQ</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/profile" class="sheet-list-item">
              <span class="sheet-icon">👤</span>
              <span class="sheet-text" data-i18n="navigation.profile">Perfil</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/settings" class="sheet-list-item">
              <span class="sheet-icon">⚙️</span>
              <span class="sheet-text" data-i18n="navigation.settings">Configuración</span>
              <span class="sheet-arrow">➔</span>
            </a>
          </div>
        </div>

      </div>

      <style>
        .app-layout-shell {
          display: flex;
          width: 100%;
          min-height: 100vh;
          background-color: var(--color-bg, #f8fafc);
          position: relative;
        }

        .desktop-only { display: flex; }
        .mobile-only { display: none; }

        /* Sidebar Desktop */
        .app-sidebar {
          width: 260px;
          background-color: var(--color-secondary, #0f172a);
          color: #ffffff;
          flex-direction: column;
          flex-shrink: 0;
          padding: 20px 16px;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 20px;
          color: var(--color-primary, #f97316);
          margin-bottom: 24px;
          padding: 0 8px;
        }

        .brand-icon { width: 28px; height: 28px; color: var(--color-primary, #f97316); }

        .sidebar-nav { display: flex; flex-direction: column; gap: 16px; }

        .nav-group-title {
          display: block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #64748b;
          margin-bottom: 4px;
          padding-left: 8px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          color: #94a3b8;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          min-height: 40px;
          transition: all 0.2s ease;
        }

        .nav-item:hover, .nav-item.active {
          background-color: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        .nav-item.active .nav-svg { color: var(--color-primary, #f97316); }
        .nav-svg { width: 20px; height: 20px; }

        .app-main-content {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          max-width: 100%;
          box-sizing: border-box;
          position: relative;
          z-index: 1;
        }

        /* RESPONSIVE MÓVIL (< 768px) */
        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }

          .app-layout-shell { flex-direction: column; }

          .mobile-header {
            position: sticky;
            top: 0;
            z-index: 100;
            background-color: #0f172a;
            color: #ffffff;
            height: 56px;
            padding: 0 16px;
            align-items: center;
            justify-content: space-between;
          }

          .mobile-brand {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 800;
            color: var(--color-primary, #f97316);
          }

          .brand-svg { width: 24px; height: 24px; }

          .app-main-content {
            padding: 16px;
            padding-bottom: calc(80px + env(safe-area-inset-bottom, 16px));
          }

          /* Bottom Bar Fija */
          .mobile-bottom-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: calc(60px + env(safe-area-inset-bottom, 0px));
            padding-bottom: env(safe-area-inset-bottom, 0px);
            background-color: #0f172a;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            z-index: 999;
            justify-content: space-around;
            align-items: center;
          }

          .mobile-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            text-decoration: none;
            font-size: 11px;
            font-weight: 600;
            min-width: 56px;
            min-height: 48px;
            background: none;
            border: none;
            cursor: pointer;
          }

          .mobile-nav-item.active { color: var(--color-primary, #f97316); }
          .mobile-svg { width: 22px; height: 22px; margin-bottom: 2px; }

          /* CAPA TRASLÚCIDA OSCURA (OVERLAY) */
          .mobile-sheet-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background-color: rgba(15, 23, 42, 0.75) !important;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 99998 !important;
            display: none;
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
          }

          .mobile-sheet-overlay.is-visible {
            display: block !important;
            opacity: 1 !important;
          }

          /* BOTTOM SHEET "MÁS" (MODAL TIPO LISTA) */
          .mobile-more-sheet {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            background-color: #ffffff !important;
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
            padding: 20px 16px;
            padding-bottom: calc(24px + env(safe-area-inset-bottom, 16px));
            max-height: 85vh;
            overflow-y: auto;
            box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.3);
            z-index: 99999 !important;
            box-sizing: border-box;
            transform: translateY(100%);
            transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .mobile-more-sheet.is-open {
            transform: translateY(0) !important;
          }

          .sheet-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #f1f5f9;
          }

          .sheet-title {
            font-weight: 800;
            font-size: 17px;
            color: #0f172a;
          }

          .sheet-close-btn {
            font-size: 18px;
            background: #f1f5f9;
            border: none;
            border-radius: 50%;
            width: 38px;
            height: 38px;
            color: #0f172a;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
          }

          /* FORMATO LISTA TÁCTIL VERTICAL */
          .sheet-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .sheet-list-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            text-decoration: none;
            color: #0f172a;
            font-weight: 700;
            font-size: 14px;
            min-height: 52px;
            box-sizing: border-box;
          }

          .sheet-list-item:active {
            background-color: #e2e8f0;
          }

          .sheet-icon {
            font-size: 18px;
            margin-right: 12px;
          }

          .sheet-text {
            flex: 1;
            text-align: left;
          }

          .sheet-arrow {
            color: #94a3b8;
            font-size: 12px;
          }
        }
      </style>
    `;

    this._attachEvents();
    this._attachNavigationHighlight();
    this.updateTranslations();
  }

  _attachEvents() {
    const btnMore = document.getElementById("btn-mobile-more");
    const btnClose = document.getElementById("btn-close-sheet");
    const sheet = document.getElementById("mobile-more-sheet");
    const overlay = document.getElementById("mobile-sheet-overlay");

    const closeSheet = () => {
      if (sheet) sheet.classList.remove("is-open");
      if (overlay) overlay.classList.remove("is-visible");
      document.body.style.overflow = ""; // Reactiva el scroll
    };

    const openSheet = () => {
      if (sheet) sheet.classList.add("is-open");
      if (overlay) overlay.classList.add("is-visible");
      document.body.style.overflow = "hidden"; // Congela scroll del fondo
    };

    if (btnMore) {
      btnMore.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (sheet?.classList.contains("is-open")) {
          closeSheet();
        } else {
          openSheet();
        }
      });
    }

    if (btnClose) {
      btnClose.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeSheet();
      });
    }

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        e.preventDefault();
        closeSheet();
      });
    }

    // AUTOCIERRE TÁCTIL AUTOMÁTICO AL TOCAR CUALQUIER OPCIÓN DEL MENÚ
    document.querySelectorAll(".sheet-list-item, .mobile-nav-item").forEach(item => {
      item.addEventListener("click", () => {
        closeSheet();
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSheet();
    });
  }

  _attachNavigationHighlight() {
    const updateActive = () => {
      const currentHash = window.location.hash || "#/dashboard";
      
      document.querySelectorAll("[data-hash]").forEach((item) => {
        if (item.getAttribute("data-hash") === currentHash) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
      });
    };

    window.addEventListener("hashchange", updateActive);
    updateActive();
  }

  updateTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        el.textContent = I18n.t(key);
      }
    });
  }
}

export default AppLayout;