/**
 * @fileoverview Componente AppLayout.js - Shell y Navegación Principal Responsive.
 * @description Genera la estructura Shell adaptada a Desktop (Sidebar), Tablet (Sidebar colapsable/compacto)
 * y Móvil (Bottom Navigation Bar + Bottom Sheet táctil).
 * 
 * Cumple con:
 * - Identidad visual oficial: Logo SVG balón de baloncesto con acento naranja (#f97316) y fondo oscuro (#0f172a).
 * - Sincronización reactiva con `I18n` e `I18nService` (soporta claves planas y jerárquicas sin fallos).
 * - Resaltado dinámico de ruta activa y autocierre táctil del menú "Más".
 * - Acceso directo integrado al nuevo módulo de Familias & Bienestar (`#/family-advisor`).
 */

import { I18n } from "../services/I18nService.js";
import { APP_CONFIG } from "../config/app.config.js";

export class AppLayout {
  /**
   * Crea una instancia de AppLayout.
   * @param {Object} [router=null] - Enrutador SPA de la aplicación.
   */
  constructor(router = null) {
    this.router = router;
    this.activeGame = null;
    this.unsubscribeI18n = null;

    if (I18n && typeof I18n.subscribe === "function") {
      this.unsubscribeI18n = I18n.subscribe(() => {
        this.updateTranslations();
      });
    }
  }

  /**
   * Renderiza el contenedor Shell en el DOM.
   * @param {string} [containerId="app"] - ID del elemento raíz.
   */
  render(containerId = "app") {
    const appContainer = document.getElementById(containerId);
    if (!appContainer) return;

    appContainer.innerHTML = `
      <div class="app-layout-shell">
        
        <!-- 1. BARRA SUPERIOR MÓVIL Y TABLET COMPACTA -->
        <header class="mobile-header mobile-tablet-only">
          <div class="mobile-brand">
            <svg class="brand-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M5.6 5.6C9.2 9.2 14.8 9.2 18.4 5.6"></path>
              <path d="M5.6 18.4C9.2 14.8 14.8 14.8 18.4 18.4"></path>
              <line x1="12" y1="2" x2="12" y2="22"></line>
            </svg>
            <span class="brand-title">${APP_CONFIG?.appName || "IQ BASKET"}</span>
          </div>
          <div id="contextual-game-badge" class="contextual-game-container"></div>
        </header>

        <!-- 2. SIDEBAR LATERAL (DESKTOP & TABLET LANDSCAPE) -->
        <aside class="app-sidebar desktop-only">
          <div class="sidebar-brand">
            <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M5.6 5.6C9.2 9.2 14.8 9.2 18.4 5.6"></path>
              <path d="M5.6 18.4C9.2 14.8 14.8 14.8 18.4 18.4"></path>
              <line x1="12" y1="2" x2="12" y2="22"></line>
            </svg>
            <span class="brand-name">${APP_CONFIG?.appName || "IQ BASKET"}</span>
          </div>

          <div id="desktop-contextual-game" class="sidebar-contextual-box"></div>

          <nav class="sidebar-nav">
            <!-- GRUPO GENERAL -->
            <div class="nav-group">
              <span class="nav-group-title" data-i18n="navigation.groups.general">GENERAL</span>
              <a href="#/dashboard" class="nav-item" data-hash="#/dashboard">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="9"></rect>
                  <rect x="14" y="3" width="7" height="5"></rect>
                  <rect x="14" y="12" width="7" height="9"></rect>
                  <rect x="3" y="16" width="7" height="5"></rect>
                </svg>
                <span class="nav-text" data-i18n="navigation.dashboard">Inicio</span>
              </a>
            </div>

            <!-- GRUPO EQUIPO -->
            <div class="nav-group">
              <span class="nav-group-title" data-i18n="navigation.groups.team">EQUIPO</span>
              <a href="#/team" class="nav-item" data-hash="#/team">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span class="nav-text" data-i18n="navigation.team">Equipo</span>
              </a>
              <a href="#/players" class="nav-item" data-hash="#/players">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="8" r="5"></circle>
                  <path d="M20 21a8 8 0 1 0-16 0"></path>
                </svg>
                <span class="nav-text" data-i18n="navigation.players">Jugadores</span>
              </a>
              <a href="#/games" class="nav-item" data-hash="#/games">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span class="nav-text" data-i18n="navigation.games">Partidos</span>
              </a>
              <a href="#/lineups" class="nav-item" data-hash="#/lineups">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <circle cx="19" cy="11" r="2"></circle>
                </svg>
                <span class="nav-text" data-i18n="navigation.lineups">Quintetos</span>
              </a>
            </div>

            <!-- GRUPO ANÁLISIS -->
            <div class="nav-group">
              <span class="nav-group-title" data-i18n="navigation.groups.analysis">ANÁLISIS</span>
              <a href="#/advanced-stats" class="nav-item" data-hash="#/advanced-stats">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <span class="nav-text" data-i18n="navigation.advancedStats">Stats Avanzadas</span>
              </a>
              <a href="#/comparator" class="nav-item" data-hash="#/comparator">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 3h5v5"></path>
                  <path d="M8 21H3v-5"></path>
                  <path d="M21 3l-7 7"></path>
                  <path d="M3 21l7-7"></path>
                </svg>
                <span class="nav-text" data-i18n="navigation.comparator">Comparador</span>
              </a>
              <a href="#/reports" class="nav-item" data-hash="#/reports">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <span class="nav-text" data-i18n="navigation.reports">Informes</span>
              </a>
              <a href="#/ask-ai" class="nav-item nav-item-ai" data-hash="#/ask-ai">
                <svg class="nav-svg highlight-ai" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
                  <path d="M12 12L2.5 7.5"></path>
                  <path d="M12 12v10"></path>
                </svg>
                <span class="nav-text" data-i18n="navigation.aiAssistant">Asistente IQ</span>
              </a>
            </div>

            <!-- GRUPO FAMILIAS & FORMACIÓN -->
            <div class="nav-group">
              <span class="nav-group-title" data-i18n="navigation.groups.welfare">BIENESTAR</span>
              <a href="#/family-advisor" class="nav-item" data-hash="#/family-advisor">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                </svg>
                <span class="nav-text" data-i18n="navigation.familyAdvisor">Familias & Bienestar</span>
              </a>
            </div>

            <!-- GRUPO CUENTA -->
            <div class="nav-group">
              <span class="nav-group-title" data-i18n="navigation.groups.account">SISTEMA</span>
              <a href="#/profile" class="nav-item" data-hash="#/profile">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span class="nav-text" data-i18n="navigation.profile">Perfil</span>
              </a>
              <a href="#/settings" class="nav-item" data-hash="#/settings">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                <span class="nav-text" data-i18n="navigation.settings">Configuración</span>
              </a>
            </div>
          </nav>
        </aside>

        <!-- 3. ÁREA DE CONTENIDO PRINCIPAL -->
        <main id="main-content" class="app-main-content">
          <!-- Vistas renderizadas dinámicamente -->
        </main>

        <!-- 4. BARRA DE NAVEGACIÓN INFERIOR (MÓVIL & TABLET PORTRAIT) -->
        <nav class="mobile-bottom-bar mobile-tablet-only" aria-label="Navegación Móvil">
          <a href="#/dashboard" class="mobile-nav-item" data-hash="#/dashboard">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="9"></rect>
              <rect x="14" y="3" width="7" height="5"></rect>
              <rect x="14" y="12" width="7" height="9"></rect>
              <rect x="3" y="16" width="7" height="5"></rect>
            </svg>
            <span class="mobile-label" data-i18n="navigation.dashboard">Inicio</span>
          </a>
          <a href="#/team" class="mobile-nav-item" data-hash="#/team">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
            <span class="mobile-label" data-i18n="navigation.team">Equipo</span>
          </a>
          <a href="#/games" class="mobile-nav-item" data-hash="#/games">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="mobile-label" data-i18n="navigation.games">Partidos</span>
          </a>
          <a href="#/advanced-stats" class="mobile-nav-item" data-hash="#/advanced-stats">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span class="mobile-label" data-i18n="navigation.advancedStats">Stats</span>
          </a>
          <button type="button" id="btn-mobile-more" class="mobile-nav-item" aria-expanded="false" aria-controls="mobile-more-sheet">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
            <span class="mobile-label" data-i18n="navigation.more">Más</span>
          </button>
        </nav>

        <!-- 5. CAPA OSCURA TRASLÚCIDA (Backdrop) -->
        <div id="mobile-sheet-overlay" class="mobile-sheet-overlay"></div>

        <!-- 6. MENÚ EMERGENTE TÁCTIL "MÁS" (BOTTOM SHEET) -->
        <div id="mobile-more-sheet" class="mobile-more-sheet" role="dialog" aria-modal="true">
          <div class="sheet-header">
            <span class="sheet-title" data-i18n="navigation.more">Más Opciones</span>
            <button type="button" id="btn-close-sheet" class="sheet-close-btn" aria-label="Cerrar">✕</button>
          </div>
          <div class="sheet-list">
            <a href="#/players" class="sheet-list-item" data-hash="#/players">
              <span class="sheet-icon">👤</span>
              <span class="sheet-text" data-i18n="navigation.players">Jugadores</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/lineups" class="sheet-list-item" data-hash="#/lineups">
              <span class="sheet-icon">🏀</span>
              <span class="sheet-text" data-i18n="navigation.lineups">Quintetos</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/comparator" class="sheet-list-item" data-hash="#/comparator">
              <span class="sheet-icon">⚖️</span>
              <span class="sheet-text" data-i18n="navigation.comparator">Comparador</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/reports" class="sheet-list-item" data-hash="#/reports">
              <span class="sheet-icon">📄</span>
              <span class="sheet-text" data-i18n="navigation.reports">Informes</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/family-advisor" class="sheet-list-item" data-hash="#/family-advisor">
              <span class="sheet-icon">👨‍👩‍👧‍👦</span>
              <span class="sheet-text" data-i18n="navigation.familyAdvisor">Familias & Bienestar</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/ask-ai" class="sheet-list-item" data-hash="#/ask-ai">
              <span class="sheet-icon">🤖</span>
              <span class="sheet-text" data-i18n="navigation.aiAssistant">Asistente IQ</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/profile" class="sheet-list-item" data-hash="#/profile">
              <span class="sheet-icon">👤</span>
              <span class="sheet-text" data-i18n="navigation.profile">Perfil</span>
              <span class="sheet-arrow">➔</span>
            </a>
            <a href="#/settings" class="sheet-list-item" data-hash="#/settings">
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
        .mobile-tablet-only { display: none; }

        /* =========================================================================
           SIDEBAR DESKTOP (>= 1024px)
           ========================================================================= */
        .app-sidebar {
          width: 250px;
          background-color: #0f172a;
          color: #ffffff;
          flex-direction: column;
          flex-shrink: 0;
          padding: 20px 14px;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          z-index: 10;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 900;
          font-size: 18px;
          letter-spacing: 0.5px;
          color: #f97316;
          margin-bottom: 24px;
          padding: 0 8px;
        }

        .brand-icon {
          width: 28px;
          height: 28px;
          color: #f97316;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
        }

        .nav-group-title {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #64748b;
          margin-bottom: 4px;
          padding-left: 10px;
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
          min-height: 38px;
          transition: all 0.15s ease-in-out;
        }

        .nav-item:hover {
          background-color: rgba(255, 255, 255, 0.06);
          color: #f8fafc;
        }

        .nav-item.active {
          background-color: rgba(249, 115, 22, 0.15);
          color: #f97316;
          font-weight: 700;
        }

        .nav-item.active .nav-svg {
          color: #f97316;
        }

        .nav-svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .nav-item-ai.active .highlight-ai {
          color: #38bdf8;
        }

        .app-main-content {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          max-width: 100%;
          box-sizing: border-box;
          position: relative;
          z-index: 1;
        }

        /* =========================================================================
           TABLET EN MODO LANDSCAPE / DISPOSITIVOS MEDIANOS (768px - 1023px)
           ========================================================================= */
        @media (min-width: 768px) and (max-width: 1023px) {
          .app-sidebar {
            width: 210px;
            padding: 16px 10px;
          }
          .sidebar-brand {
            font-size: 16px;
            margin-bottom: 18px;
          }
          .nav-item {
            font-size: 12px;
            padding: 7px 10px;
            gap: 10px;
          }
          .app-main-content {
            padding: 18px;
          }
        }

        /* =========================================================================
           MÓVIL Y TABLET PORTRAIT (< 768px)
           ========================================================================= */
        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-tablet-only { display: flex !important; }

          .app-layout-shell {
            flex-direction: column;
          }

          /* Header Superior Fijo */
          .mobile-header {
            position: sticky;
            top: 0;
            z-index: 100;
            background-color: #0f172a;
            color: #ffffff;
            height: 52px;
            padding: 0 16px;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }

          .mobile-brand {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 900;
            font-size: 16px;
            color: #f97316;
            letter-spacing: 0.5px;
          }

          .brand-svg {
            width: 22px;
            height: 22px;
            color: #f97316;
          }

          .app-main-content {
            padding: 14px;
            padding-bottom: calc(75px + env(safe-area-inset-bottom, 12px));
          }

          /* Bottom Bar Fija */
          .mobile-bottom-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: calc(56px + env(safe-area-inset-bottom, 0px));
            padding-bottom: env(safe-area-inset-bottom, 0px);
            background-color: #0f172a;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
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
            font-size: 10px;
            font-weight: 600;
            min-width: 52px;
            min-height: 44px;
            background: none;
            border: none;
            cursor: pointer;
            transition: color 0.15s ease;
          }

          .mobile-nav-item.active {
            color: #f97316;
            font-weight: 700;
          }

          .mobile-svg {
            width: 20px;
            height: 20px;
            margin-bottom: 2px;
          }

          /* Overlay Oscuro Traslúcido */
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

          /* Bottom Sheet "Más" */
          .mobile-more-sheet {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            background-color: #ffffff !important;
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
            padding: 18px 16px;
            padding-bottom: calc(24px + env(safe-area-inset-bottom, 16px));
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.28);
            z-index: 99999 !important;
            box-sizing: border-box;
            transform: translateY(100%);
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .mobile-more-sheet.is-open {
            transform: translateY(0) !important;
          }

          .sheet-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 1px solid #f1f5f9;
          }

          .sheet-title {
            font-weight: 800;
            font-size: 16px;
            color: #0f172a;
          }

          .sheet-close-btn {
            font-size: 16px;
            background: #f1f5f9;
            border: none;
            border-radius: 50%;
            width: 34px;
            height: 34px;
            color: #0f172a;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
          }

          .sheet-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .sheet-list-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            text-decoration: none;
            color: #0f172a;
            font-weight: 700;
            font-size: 13px;
            min-height: 48px;
            box-sizing: border-box;
            transition: background-color 0.15s ease;
          }

          .sheet-list-item:active {
            background-color: #e2e8f0;
          }

          .sheet-icon {
            font-size: 16px;
            margin-right: 10px;
          }

          .sheet-text {
            flex: 1;
            text-align: left;
          }

          .sheet-arrow {
            color: #94a3b8;
            font-size: 11px;
          }
        }
      </style>
    `;

    this._attachEvents();
    this._attachNavigationHighlight();
    this.updateTranslations();
  }

  // =========================================================================
  // CONTROL DE EVENTOS, NAVEGACIÓN Y REACTIVIDAD
  // =========================================================================

  /**
   * Adjunta listeners de apertura, cierre táctil y backdrop del menú móvil.
   * @private
   */
  _attachEvents() {
    const btnMore = document.getElementById("btn-mobile-more");
    const btnClose = document.getElementById("btn-close-sheet");
    const sheet = document.getElementById("mobile-more-sheet");
    const overlay = document.getElementById("mobile-sheet-overlay");

    const closeSheet = () => {
      if (sheet) sheet.classList.remove("is-open");
      if (overlay) overlay.classList.remove("is-visible");
      if (btnMore) btnMore.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };

    const openSheet = () => {
      if (sheet) sheet.classList.add("is-open");
      if (overlay) overlay.classList.add("is-visible");
      if (btnMore) btnMore.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
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

    // Autocierre automático al hacer clic en cualquier opción
    document.querySelectorAll(".sheet-list-item, .mobile-nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        closeSheet();
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSheet();
    });
  }

  /**
   * Sincroniza la clase `.active` con el hash actual de la URL.
   * @private
   */
  _attachNavigationHighlight() {
    const updateActive = () => {
      const currentHash = window.location.hash || "#/dashboard";

      document.querySelectorAll("[data-hash]").forEach((item) => {
        const itemHash = item.getAttribute("data-hash");
        if (itemHash && (itemHash === currentHash || (itemHash !== "#/dashboard" && currentHash.startsWith(itemHash)))) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
      });
    };

    window.addEventListener("hashchange", updateActive);
    updateActive();
  }

  /**
   * Actualiza los textos de la interfaz con el diccionario activo de I18n.
   */
  updateTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        const translated = I18n.t(key, {}, null);
        if (translated && translated !== key) {
          el.textContent = translated;
        }
      }
    });
  }
}

export default AppLayout;