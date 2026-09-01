/**
 * @fileoverview Layout contenedor principal optimizado para Mobile First & Desktop (LayoutView.js).
 * @description Implementa la navegación agrupada en desktop, la barra de navegación inferior para móviles,
 * el selector de los 4 idiomas oficiales (ES, CA, EN, FR), y selectores de Equipo y Temporada.
 * 
 * Correcciones críticas:
 * 1. Contraste absoluto forzado (!important) en todos los textos e iconos del sidebar.
 * 2. Persistencia síncrona del scroll de la barra lateral entre transiciones de ruta.
 * 3. Bottom Sheet táctil para móviles y control de accesos RBAC.
 * 4. Integración completa del nuevo módulo Familias & Bienestar (family-advisor).
 */

import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { APP_CONFIG } from "../config/app.config.js";

export class LayoutView {
  static t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  static _normalizeRouteKey(route) {
    const r = String(route || '').toLowerCase().trim();
    if (['partidos', 'games', 'game', 'live'].includes(r)) return 'games';
    if (['advanced', 'advanced_stats'].includes(r)) return 'advanced';
    if (['heatmap', 'calor', 'shotchart'].includes(r)) return 'heatmap';
    if (['easy-entry', 'easy', 'entrada-facil', 'live-entry'].includes(r)) return 'easy-entry';
    if (['boxscore', 'registro'].includes(r)) return 'boxscore';
    if (['team', 'equipo'].includes(r)) return 'team';
    if (['players', 'jugadores', 'player', 'jugador'].includes(r)) return 'players';
    if (['settings', 'configuracion', 'translations'].includes(r)) return 'settings';
    if (['lineups', 'quintetos'].includes(r)) return 'lineups';
    if (['comparator', 'comparador'].includes(r)) return 'comparator';
    if (['reports', 'informes', 'informe'].includes(r)) return 'reports';
    if (['family-advisor', 'family', 'familia', 'familias', 'bienestar', 'advisor'].includes(r)) return 'family-advisor';
    if (['ask', 'pregunta', 'preguntale', 'ai', 'ia', 'ask-ai'].includes(r)) return 'ask';
    if (['profile', 'perfil'].includes(r)) return 'profile';
    return r || 'dashboard';
  }

  static updateActiveMenu(route) {
    const activeKey = LayoutView._normalizeRouteKey(route);
    const links = document.querySelectorAll(".nav-link, .mobile-nav-item");

    links.forEach(link => {
      const linkKey = link.getAttribute("data-route-key");
      if (linkKey === activeKey) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  /**
   * Restaura la posición del scroll de la barra lateral de forma inmediata.
   */
  static _restoreSidebarScroll() {
    const savedPos = sessionStorage.getItem("iq_sidebar_scroll");
    if (savedPos !== null) {
      const scrollPos = parseInt(savedPos, 10);
      const sidebars = document.querySelectorAll(".sidebar-inner, .app-sidebar, #app-sidebar");
      sidebars.forEach(s => {
        s.scrollTop = scrollPos;
      });
      requestAnimationFrame(() => {
        sidebars.forEach(s => {
          s.scrollTop = scrollPos;
        });
      });
    }
  }

  /**
   * Vincula la escucha del scroll del sidebar para guardarlo continuamente.
   */
  static _bindSidebarScrollPreservation() {
    const sidebars = document.querySelectorAll(".sidebar-inner, .app-sidebar, #app-sidebar");
    sidebars.forEach(sidebar => {
      sidebar.addEventListener("scroll", () => {
        sessionStorage.setItem("iq_sidebar_scroll", sidebar.scrollTop);
      }, { passive: true });
    });
  }

  /**
   * Inicializa el menú desplegable táctil para móviles (Botón "Más")
   */
  static bindMobileDrawerEvents() {
    LayoutView._restoreSidebarScroll();
    LayoutView._bindSidebarScrollPreservation();

    setTimeout(() => {
      LayoutView._restoreSidebarScroll();
      
      const btnToggle = document.getElementById("btn-mobile-more-toggle");
      const btnClose = document.getElementById("btn-close-drawer");
      const drawerOverlay = document.getElementById("mobile-more-drawer");

      if (!btnToggle || !drawerOverlay) return;

      const closeDrawer = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        drawerOverlay.classList.remove("open", "is-visible");
        drawerOverlay.setAttribute("aria-hidden", "true");
        drawerOverlay.style.display = "none";
        document.body.style.overflow = "";
      };

      const openDrawer = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        drawerOverlay.classList.add("open", "is-visible");
        drawerOverlay.setAttribute("aria-hidden", "false");
        drawerOverlay.style.display = "flex";
        document.body.style.overflow = "hidden";
      };

      btnToggle.onclick = (e) => {
        const isOpen = drawerOverlay.classList.contains("open") || drawerOverlay.style.display === "flex";
        if (isOpen) {
          closeDrawer(e);
        } else {
          openDrawer(e);
        }
      };

      if (btnClose) {
        btnClose.onclick = (e) => closeDrawer(e);
      }

      drawerOverlay.onclick = (e) => {
        if (e.target === drawerOverlay) {
          closeDrawer(e);
        }
      };

      const drawerItems = drawerOverlay.querySelectorAll("a, button, .drawer-item");
      drawerItems.forEach(item => {
        item.onclick = (e) => {
          if (item.classList.contains("disabled-link")) {
            e.preventDefault();
            alert("⚠️ Esta función no está disponible para tu rol de usuario.");
            return;
          }
          closeDrawer();
        };
      });

      document.querySelectorAll(".disabled-link").forEach(link => {
        link.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          alert("⚠️ Esta función no está disponible para tu rol de usuario.");
        };
      });

      document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
          const sidebar = document.querySelector(".sidebar-inner, .app-sidebar, #app-sidebar");
          if (sidebar) {
            sessionStorage.setItem("iq_sidebar_scroll", sidebar.scrollTop);
          }
        });
      });
    }, 30);
  }

  static wrap(contentHtml, activeRoute = "dashboard", userRole = "ADMIN") {
    const existingSidebar = document.querySelector(".sidebar-inner, .app-sidebar, #app-sidebar");
    if (existingSidebar && existingSidebar.scrollTop > 0) {
      sessionStorage.setItem("iq_sidebar_scroll", existingSidebar.scrollTop);
    }

    const currentActiveKey = LayoutView._normalizeRouteKey(activeRoute);
    const currentLang = I18n.getLocale ? I18n.getLocale() : "es";
    const currentUserEmail = localStorage.getItem("iq_user_email") || "";

    const currentActiveTeamId = DataStore.getActiveTeamId() || localStorage.getItem("iq_active_team_id") || "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22";
    const currentActiveSeason = DataStore.getActiveSeason() || localStorage.getItem("iq_active_season") || "2026";

    const allTeams = DataStore.getTeams() || [];

    // DataStore ya está filtrado por la identidad autenticada.
    // localStorage no participa en la autorización.
    const teamsToRender = allTeams;

    const storedSeasons = localStorage.getItem("iq_seasons");
    const seasons = storedSeasons ? JSON.parse(storedSeasons) : [
      { id: "s-1", name: "2026", isActive: true },
      { id: "s-2", name: "2025", isActive: false }
    ];

    LayoutView.bindMobileDrawerEvents();

    const isComparatorRestricted = userRole === "JUGADOR" || userRole === "FAMILIA_TUTOR";
    const isAiRestricted = userRole === "JUGADOR";

    const navGroups = [
      {
        titleKey: "general",
        defaultTitle: "GENERAL",
        items: [
          { key: "dashboard", labelKey: "dashboard", fallback: "Dashboard", route: "dashboard", svg: '<rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect>' }
        ]
      },
      {
        titleKey: "team",
        defaultTitle: "EQUIPO",
        items: [
          { key: "team", labelKey: "team", fallback: "Equipo", route: "team", svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle>' },
          { key: "players", labelKey: "players", fallback: "Jugadores", route: "players", svg: '<circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 1 0-16 0"></path>' },
          { key: "games", labelKey: "games", fallback: "Partidos", route: "games", svg: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>' },
          { key: "lineups", labelKey: "lineups", fallback: "Quintetos", route: "lineups", svg: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><circle cx="19" cy="11" r="2"></circle>' }
        ]
      },
      {
        titleKey: "advanced_stats",
        defaultTitle: "ESTADÍSTICA AVANZADA",
        items: [
          { key: "advanced", labelKey: "advanced_stats", fallback: "Stats Avanzadas", route: "advanced", svg: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>' },
          { key: "heatmap", labelKey: "heatmap_analysis", fallback: "Mapa de Calor", route: "heatmap", svg: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>' },
          { key: "comparator", labelKey: "comparator", fallback: "Comparador", route: "comparator", disabled: isComparatorRestricted, svg: '<path d="M16 3h5v5"></path><path d="M8 21H3v-5"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path>' },
          { key: "reports", labelKey: "reports", fallback: "Informes", route: "reports", svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line>' },
          { key: "ask", labelKey: "ask_ai", fallback: "Asistente IQ", route: "ask", disabled: isAiRestricted, svg: '<path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12L2.5 7.5"></path><path d="M12 12v10"></path>' }
        ]
      },
      {
        titleKey: "welfare",
        defaultTitle: "BIENESTAR",
        items: [
          { key: "family-advisor", labelKey: "family_advisor", fallback: "Familias & Bienestar", route: "family-advisor", svg: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>' }
        ]
      },
      {
        titleKey: "profile",
        defaultTitle: "MI PERFIL",
        items: [
          { key: "profile", labelKey: "profile", fallback: "Mi Perfil", route: "profile", svg: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>' },
          { key: "settings", labelKey: "settings", fallback: "Configuración", route: "settings", svg: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' }
        ]
      }
    ];

    const desktopNavMarkup = navGroups.map(group => `
      <div class="nav-group">
        <span class="nav-group-title">${LayoutView.t(group.titleKey, group.defaultTitle).toUpperCase()}</span>
        ${group.items.map(item => {
          const isActive = currentActiveKey === item.key;
          const label = LayoutView.t(item.labelKey, item.fallback);
          const isDisabled = Boolean(item.disabled);
          return `
            <a href="${isDisabled ? 'javascript:void(0);' : '#/' + item.route}" 
               class="nav-link ${isActive ? 'active' : ''} ${isDisabled ? 'disabled-link' : ''}" 
               data-route-key="${item.key}">
              <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.svg}</svg>
              <span class="nav-label">${label}${isDisabled ? ' 🔒' : ''}</span>
            </a>
          `;
        }).join("")}
      </div>
    `).join("");

    const teamOptionsMarkup = teamsToRender.length > 0 ? teamsToRender.map(t => `
      <option value="${t.id}" ${String(t.id) === String(currentActiveTeamId) ? 'selected' : ''}>
        ${t.name} (${t.category || 'Senior'})
      </option>
    `).join("") : `<option value="" disabled selected>⚠️ Sin equipos asignados</option>`;

    const seasonOptionsMarkup = seasons.length > 0 ? seasons.map(s => `
      <option value="${s.name}" ${String(s.name) === String(currentActiveSeason) ? 'selected' : ''}>
        ${s.name}
      </option>
    `).join("") : `<option value="2026" selected>2026</option>`;

    const langOptionsMarkup = `
      <option value="es" ${currentLang === 'es' ? 'selected' : ''}>ES</option>
      <option value="ca" ${currentLang === 'ca' || currentLang === 'cat' ? 'selected' : ''}>CAT</option>
      <option value="en" ${currentLang === 'en' ? 'selected' : ''}>EN</option>
      <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>FR</option>
    `;

    return `
      <div class="app-layout">

        <!-- HEADER MÓVIL (< 768px) -->
        <header class="mobile-header mobile-only">
          <div class="mobile-brand">
            <div class="logo-box" style="width: 28px; height: 28px; font-size: 12px;">IQ</div>
            <span class="brand-title">${APP_CONFIG.appName || "IQ Basket"}</span>
          </div>

          <div class="mobile-selectors-row">
            <select id="mobile-select-team" class="mobile-select">
              ${teamOptionsMarkup}
            </select>
            <select id="mobile-select-season" class="mobile-select">
              ${seasonOptionsMarkup}
            </select>
            <div class="mobile-lang-box">
              <span class="mobile-lang-icon">🌐</span>
              <select id="mobile-select-lang-toggle" class="mobile-select mobile-lang-select">
                ${langOptionsMarkup}
              </select>
            </div>
          </div>
        </header>

        <!-- BARRA LATERAL (DESKTOP >= 768px) -->
        <aside id="app-sidebar" class="app-sidebar desktop-only">
          <div class="sidebar-inner">

            <div class="sidebar-header">
              <div class="logo-box">IQ</div>
              <span class="logo-title">${APP_CONFIG.appName || "IQ Basket"}</span>
            </div>

            <div class="sidebar-selectors">
              <div class="selector-group">
                <label>${LayoutView.t("team", "EQUIPO").toUpperCase()}</label>
                <select id="sidebar-select-team" class="sidebar-select">
                  ${teamOptionsMarkup}
                </select>
              </div>
              <div class="selector-group">
                <label>${LayoutView.t("season", "TEMPORADA").toUpperCase()}</label>
                <select id="sidebar-select-season" class="sidebar-select">
                  ${seasonOptionsMarkup}
                </select>
              </div>
            </div>

            <nav class="sidebar-nav">
              ${desktopNavMarkup}
            </nav>

            <div class="sidebar-footer">
              <div class="lang-row">
                <span class="lang-label">🌐 ${LayoutView.t("language", "IDIOMA")}</span>
                <select id="select-lang-toggle" class="lang-select">
                  <option value="es" ${currentLang === 'es' ? 'selected' : ''}>Español</option>
                  <option value="ca" ${currentLang === 'ca' || currentLang === 'cat' ? 'selected' : ''}>Català</option>
                  <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English</option>
                  <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>Français</option>
                </select>
              </div>

              <button id="btn-logout" class="btn-logout">
                <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                <span>${LayoutView.t("logout", "Cerrar sesión")}</span>
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

        <!-- NAVEGACIÓN INFERIOR MÓVIL (5 ÍTEMS) -->
        <nav class="mobile-bottom-bar mobile-only" aria-label="Navegación Móvil">
          <a href="#/dashboard" class="mobile-nav-item ${currentActiveKey === 'dashboard' ? 'active' : ''}" data-route-key="dashboard">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
            <span class="mobile-label">${LayoutView.t("dashboard", "Dashboard")}</span>
          </a>
          <a href="#/team" class="mobile-nav-item ${currentActiveKey === 'team' ? 'active' : ''}" data-route-key="team">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
            <span class="mobile-label">${LayoutView.t("team", "Equipo")}</span>
          </a>
          <a href="#/games" class="mobile-nav-item ${currentActiveKey === 'games' ? 'active' : ''}" data-route-key="games">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line></svg>
            <span class="mobile-label">${LayoutView.t("games", "Partidos")}</span>
          </a>
          <a href="#/heatmap" class="mobile-nav-item ${currentActiveKey === 'heatmap' ? 'active' : ''}" data-route-key="heatmap">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            <span class="mobile-label">${LayoutView.t("heatmap_analysis", "Calor")}</span>
          </a>
          <button type="button" id="btn-mobile-more-toggle" class="mobile-nav-item" aria-expanded="false">
            <svg class="mobile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
            <span class="mobile-label">${LayoutView.t("navigation.more", "Más")}</span>
          </button>
        </nav>

        <!-- BOTTOM SHEET MÓVIL PARA "MÁS" -->
        <div id="mobile-more-drawer" class="mobile-drawer-overlay mobile-only" aria-hidden="true" style="display: none;">
          <div class="mobile-drawer-content">
            <div class="drawer-header">
              <span class="drawer-title">${LayoutView.t("navigation.more", "Más Opciones")}</span>
              <button type="button" id="btn-close-drawer" class="drawer-close">&times;</button>
            </div>
            <div class="drawer-grid">
              <a href="#/advanced" class="drawer-item">
                <span class="drawer-icon">📈</span>
                <span>${LayoutView.t("advanced_stats", "Stats Avanzadas")}</span>
              </a>
              <a href="#/players" class="drawer-item">
                <span class="drawer-icon">👤</span>
                <span>${LayoutView.t("players", "Jugadores")}</span>
              </a>
              <a href="#/lineups" class="drawer-item">
                <span class="drawer-icon">🏀</span>
                <span>${LayoutView.t("lineups", "Quintetos")}</span>
              </a>
              <a href="${isComparatorRestricted ? 'javascript:void(0);' : '#/comparator'}" class="drawer-item ${isComparatorRestricted ? 'disabled-link' : ''}">
                <span class="drawer-icon">⚖️</span>
                <span>${LayoutView.t("comparator", "Comparador")}${isComparatorRestricted ? ' 🔒' : ''}</span>
              </a>
              <a href="#/reports" class="drawer-item">
                <span class="drawer-icon">📄</span>
                <span>${LayoutView.t("reports", "Informes")}</span>
              </a>
              <a href="#/family-advisor" class="drawer-item">
                <span class="drawer-icon">👨‍👩‍👧‍👦</span>
                <span>${LayoutView.t("family_advisor", "Familias & Bienestar")}</span>
              </a>
              <a href="${isAiRestricted ? 'javascript:void(0);' : '#/ask'}" class="drawer-item ${isAiRestricted ? 'disabled-link' : ''}">
                <span class="drawer-icon">🤖</span>
                <span>${LayoutView.t("ask_ai", "Asistente IQ")}${isAiRestricted ? ' 🔒' : ''}</span>
              </a>
              <a href="#/profile" class="drawer-item">
                <span class="drawer-icon">👤</span>
                <span>${LayoutView.t("profile", "Perfil")}</span>
              </a>
              <a href="#/settings" class="drawer-item">
                <span class="drawer-icon">⚙️</span>
                <span>${LayoutView.t("settings", "Configuración")}</span>
              </a>
            </div>
          </div>
        </div>

      </div>

      <!-- ESTILOS CON ALTO CONTRASTE TIPOGRÁFICO Y PROTECCIÓN DE COLORES -->
      <style>
        *, *::before, *::after {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          background-color: var(--color-bg, #f8fafc);
          font-family: var(--font-family-base, system-ui, -apple-system, sans-serif);
          overflow-x: hidden;
        }

        .app-layout {
          min-height: 100vh;
          width: 100%;
          display: flex;
          background-color: var(--color-bg, #f8fafc);
        }

        .desktop-only { display: flex; }
        .mobile-only { display: none; }

        .disabled-link {
          opacity: 0.45 !important;
          cursor: not-allowed !important;
          filter: grayscale(0.8);
        }

        /* SIDEBAR DESKTOP CON FONDO OSCURO */
        .app-sidebar {
          width: 260px;
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          background-color: #0b1329 !important;
          color: #ffffff !important;
          box-sizing: border-box;
          z-index: 50;
          border-right: 1px solid #1e293b;
        }

        .sidebar-inner {
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 20px 14px;
          box-sizing: border-box;
        }

        .sidebar-inner::-webkit-scrollbar {
          width: 5px;
        }
        .sidebar-inner::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .sidebar-inner::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 4px;
        }

        .logo-box {
          width: 32px;
          height: 32px;
          background-color: var(--color-primary, #f97316);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 900;
          font-size: 14px;
          flex-shrink: 0;
        }

        .logo-title {
          font-weight: 900;
          font-size: 18px;
          letter-spacing: -0.02em;
          color: #ffffff !important;
        }

        .sidebar-selectors {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0 4px;
        }

        /* ETIQUETAS: BLANCO NÍTIDO */
        .selector-group label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #f1f5f9 !important;
          display: block;
          margin-bottom: 4px;
          letter-spacing: 0.05em;
        }

        .sidebar-select {
          width: 100%;
          background-color: #1e293b !important;
          border: 1px solid #475569;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 600;
          outline: none;
          box-sizing: border-box;
          cursor: pointer;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .nav-group {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        /* TÍTULOS DE CATEGORÍA: AZUL CELESTE LUMINOSO */
        .nav-group-title {
          font-size: 10px;
          font-weight: 800;
          color: #60a5fa !important;
          letter-spacing: 0.08em;
          padding-left: 10px;
          margin-bottom: 4px;
        }

        /* ENLACES Y TEXTOS INACTIVOS: BLANCO HUESO (#f8fafc) CON MÁXIMO CONTRASTE */
        .nav-link, 
        .app-sidebar a, 
        .app-sidebar a span,
        .app-sidebar .nav-label {
          color: #f8fafc !important;
          -webkit-text-fill-color: #f8fafc !important;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.15s ease;
          min-height: 40px;
        }

        .nav-link .nav-svg {
          stroke: #f8fafc !important;
          color: #f8fafc !important;
        }

        .nav-link:hover {
          background-color: rgba(255, 255, 255, 0.14) !important;
          color: #ffffff !important;
        }

        .nav-link:hover .nav-svg,
        .nav-link:hover span {
          stroke: #ffffff !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        /* ENLACE ACTIVO: FONDO NARANJA CON TEXTO BLANCO */
        .nav-link.active,
        .app-sidebar .nav-link.active span,
        .app-sidebar .nav-link.active .nav-label {
          background-color: var(--color-primary, #f97316) !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          box-shadow: 0 4px 10px rgba(249, 115, 22, 0.35);
        }

        .nav-link.active .nav-svg {
          stroke: #ffffff !important;
          color: #ffffff !important;
        }

        .nav-svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .sidebar-footer {
          border-top: 1px solid #1e293b;
          padding-top: 14px;
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lang-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 4px;
        }

        .lang-label {
          font-size: 11px;
          font-weight: 800;
          color: #f1f5f9 !important;
        }

        .lang-select {
          background-color: #1e293b !important;
          border: 1px solid #475569;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
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
          font-weight: 700;
          color: #fca5a5 !important;
          background: transparent;
          border: 1px solid #334155;
          cursor: pointer;
          border-radius: 8px;
          min-height: 40px;
          transition: background 0.15s ease;
        }

        .btn-logout .nav-svg {
          stroke: #fca5a5 !important;
        }

        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #ffffff !important;
        }

        .btn-logout:hover .nav-svg {
          stroke: #ffffff !important;
        }

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
          max-width: 1400px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }

          .app-layout {
            flex-direction: column;
          }

          .mobile-header {
            position: sticky;
            top: 0;
            z-index: 1000;
            background-color: var(--color-secondary, #0f172a);
            color: #ffffff;
            height: 56px;
            padding: 0 10px;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #1e293b;
            gap: 6px;
          }

          .mobile-brand {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 800;
            color: #ffffff;
            flex-shrink: 0;
          }

          .mobile-brand .brand-title {
            font-size: 13px;
            font-weight: 900;
          }

          .mobile-selectors-row {
            display: flex;
            gap: 4px;
            align-items: center;
            flex: 1;
            justify-content: flex-end;
          }

          .mobile-select {
            background-color: #1e293b;
            border: 1px solid #334155;
            color: #ffffff;
            border-radius: 6px;
            padding: 4px;
            font-size: 11px;
            font-weight: 700;
            outline: none;
            max-width: 110px;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
            height: 34px;
          }

          .mobile-lang-box {
            display: flex;
            align-items: center;
            background-color: #1e293b;
            border: 1px solid #334155;
            border-radius: 6px;
            padding-left: 4px;
            height: 34px;
          }

          .mobile-lang-icon {
            font-size: 12px;
          }

          .mobile-lang-select {
            border: none !important;
            background: transparent !important;
            padding-left: 2px !important;
            width: 52px !important;
          }

          .app-main {
            margin-left: 0;
            width: 100%;
            padding: 16px 12px;
            padding-bottom: calc(64px + env(safe-area-inset-bottom, 16px));
          }

          .mobile-bottom-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: calc(58px + env(safe-area-inset-bottom, 0px));
            padding-bottom: env(safe-area-inset-bottom, 0px);
            background-color: var(--color-secondary, #0f172a);
            border-top: 1px solid #1e293b;
            z-index: 1000;
            display: flex;
            justify-content: space-around;
            align-items: center;
            box-sizing: border-box;
          }

          .mobile-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #cbd5e1;
            text-decoration: none;
            font-size: 10px;
            font-weight: 700;
            flex: 1;
            max-width: 20%;
            height: 100%;
            padding: 4px 0;
            background: none;
            border: none;
            cursor: pointer;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
            box-sizing: border-box;
          }

          .mobile-nav-item.active {
            color: var(--color-primary, #f97316);
          }

          .mobile-svg {
            width: 20px;
            height: 20px;
            margin-bottom: 2px;
          }

          .mobile-label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            display: block;
          }

          .mobile-drawer-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 1050;
            display: none;
            align-items: flex-end;
          }

          .mobile-drawer-overlay.open {
            display: flex !important;
          }

          .mobile-drawer-content {
            width: 100%;
            background-color: #ffffff;
            border-top-left-radius: 16px;
            border-top-right-radius: 16px;
            padding: 20px;
            padding-bottom: calc(24px + env(safe-area-inset-bottom, 16px));
            max-height: 80vh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .drawer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }

          .drawer-title {
            font-weight: 800;
            font-size: 16px;
            color: #0f172a;
          }

          .drawer-close {
            font-size: 24px;
            background: none;
            border: none;
            cursor: pointer;
            color: #64748b;
            font-weight: 800;
          }

          .drawer-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          .drawer-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            text-decoration: none;
            color: #0f172a;
            font-weight: 600;
            font-size: 13px;
            min-height: 48px;
            box-sizing: border-box;
            touch-action: manipulation;
          }
        }
      </style>
    `;
  }
}

// SUSCRIPCIÓN EN TIEMPO REAL
if (I18n && typeof I18n.subscribe === "function") {
  I18n.subscribe(() => {
    const links = document.querySelectorAll(".nav-link .nav-label");
    if (links.length > 0) {
      const keysMap = {
        dashboard: "dashboard",
        team: "team",
        players: "players",
        games: "games",
        lineups: "lineups",
        advanced: "advanced_stats",
        heatmap: "heatmap_analysis",
        comparator: "comparator",
        reports: "reports",
        "family-advisor": "family_advisor",
        ask: "ask_ai",
        profile: "profile",
        settings: "settings"
      };

      document.querySelectorAll(".nav-link, .mobile-nav-item, .drawer-item").forEach(item => {
        const routeKey = item.getAttribute("data-route-key") || item.getAttribute("href")?.replace("#/", "");
        const normKey = LayoutView._normalizeRouteKey(routeKey);
        const dictKey = keysMap[normKey];
        if (dictKey) {
          const labelEl = item.querySelector(".nav-label, .mobile-label, span:last-child");
          if (labelEl) {
            labelEl.textContent = LayoutView.t(dictKey, labelEl.textContent);
          }
        }
      });
    }
  });
}

// Mantener la posición del scroll de la barra lateral al cambiar de ruta
window.addEventListener("hashchange", () => {
  LayoutView._restoreSidebarScroll();
});

export default LayoutView;