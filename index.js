/**
 * @fileoverview Orquestador Principal de IQ Basket.
 * Sincronizado con Auth, Layout, Dashboard, TeamStats, GameLiveEditorView,
 * GameBoxScoreView, AdvancedStatsView, PlayerStatsView, LineupsView, ComparatorView,
 * ReportsView, TranslationsView, AskAIView y DataStore.
 * 
 * Correcciones & Seguridad:
 * - Control global de cambios no guardados (window.hasUnsavedChanges) al navegar entre vistas.
 * - Registro completo de AskAIView (#/ask) para la vista "Pregúntale a tus datos".
 * - Invocación dinámica de bindLayoutEvents() en cada renderizado.
 * - Sincronización con TranslationStore y el motor i18n.
 */

import { supabase } from "./config/database.config.js";
import { DataStore } from "./services/DataStore.js";
import { TranslationStore } from "./services/TranslationStore.js";
import { i18n } from "./core-modules/i18n/I18nEngine.js";

import { AuthView } from "./views/AuthView.js";
import { LayoutView } from "./views/LayoutView.js";
import { SeasonDashboardView } from "./views/SeasonDashboardView.js";
import { TeamStatsView } from "./views/TeamStatsView.js";

import { GameController } from "./controllers/GameController.js";
import { GameLiveEditorView } from "./views/GameLiveEditorView.js";
import { GameBoxScoreView } from "./views/GameBoxScoreView.js";
import { AdvancedStatsView } from "./views/AdvancedStatsView.js";
import { PlayerStatsView } from "./views/PlayerStatsView.js";
import { LineupsView } from "./views/LineupsView.js";
import { ComparatorView } from "./views/ComparatorView.js";
import { ReportsView } from "./views/ReportsView.js";
import { TranslationsView } from "./views/TranslationsView.js";
import { AskAIView } from "./views/AskAIView.js";

export class IQBasketApp {
  constructor() {
    this.isAuthenticated = false; // Estado inicial de autenticación
    this.userRole = "SUPERADMIN"; // Rol asignado
    this.currentRoute = "dashboard";
    this.routeParams = {};
    this.teamId = "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22"; // JMJ Manyanet Sant Andreu

    // Controller para partidos
    this.gameController = new GameController(
      null, 
      { can: () => true }, 
      { supabase }
    );

    // Instancia auxiliar de Auth Controller simplificada para vistas
    const authController = {
      hasRole: (role) => {
        if (Array.isArray(role)) return role.includes(this.userRole);
        return ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"].includes(this.userRole);
      }
    };

    // Instancias activas de Vistas
    this.views = {
      auth: new AuthView(),
      dashboard: new SeasonDashboardView(supabase, authController),
      team: new TeamStatsView(supabase, authController),
      equipo: new TeamStatsView(supabase, authController),
      
      liveeditor: new GameLiveEditorView(this.gameController, authController),
      partidos: new GameLiveEditorView(this.gameController, authController),
      advanced: new AdvancedStatsView(this.gameController),
      boxscore: new GameBoxScoreView(supabase, authController),

      player: new PlayerStatsView(supabase, authController),
      lineups: new LineupsView(authController),
      comparator: new ComparatorView(authController),
      reports: new ReportsView(authController),
      settings: new TranslationsView(authController),
      ask: new AskAIView(authController) // 👈 Asistente IA
    };
  }

  /**
   * Vincula los eventos de AuthView.js (Login y Ver/Ocultar contraseña)
   */
  bindAuthEvents() {
    const toggleBtn = document.getElementById("toggle-password-btn");
    const passwordInput = document.getElementById("login-password");

    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
      });
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.isAuthenticated = true;
        this.render();
      });
    }
  }

  /**
   * Vincula los eventos del Layout (Cerrar Sesión, Selector de Idioma Global y Navegación Hash).
   * Se ejecuta dinámicamente para asegurar que los elementos del DOM siempre tengan listeners activos.
   */
  bindLayoutEvents() {
    // 1. Logout
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = "true";
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.isAuthenticated = false;
        DataStore.isLoaded = false;
        this.render();
      });
    }

    // 2. Selector de Idioma Global en el Sidebar
    const langSelect = document.getElementById("select-lang-toggle");
    if (langSelect && !langSelect.dataset.bound) {
      langSelect.dataset.bound = "true";
      langSelect.addEventListener("change", (e) => {
        const lang = e.target.value;

        // Actualizar el motor i18n y la tienda de traducciones
        if (i18n && typeof i18n.changeLanguage === "function") {
          i18n.changeLanguage(lang);
        }
        if (TranslationStore && typeof TranslationStore.setLanguage === "function") {
          TranslationStore.setLanguage(lang);
        } else {
          localStorage.setItem("iq_lang", lang);
        }

        // Reconstrucción limpia del DOM para aplicar las nuevas etiquetas traducidas
        const appContainer = document.getElementById("app");
        if (appContainer) appContainer.innerHTML = "";
        this.render();
      });
    }

    // 3. Navegación Hash (Solo se vincula una vez al window) con prevención de pérdidas de datos
    if (!window.isHashBound) {
      window.isHashBound = true;
      window.onhashchange = () => {
        // Control de seguridad: Si hay cambios de edición pendientes sin guardar
        if (window.hasUnsavedChanges) {
          const confirmLeave = confirm("⚠️ Tienes cambios sin guardar. Si cambias de pantalla se perderán las modificaciones. ¿Deseas salir sin guardar?");
          if (!confirmLeave) {
            // Revertir la URL a la ruta donde estaba editando
            window.location.hash = `#/${this.currentRoute}`;
            return;
          }
          // Limpiar el estado de advertencia si el usuario decide descartar los cambios
          window.hasUnsavedChanges = false;
        }

        this.parseHashRoute();
        this.render();
      };
    }
  }

  /**
   * Extrae la ruta activa y parámetros opcionales de la URL (#/game/ID_PARTIDO o #/boxscore/ID_PARTIDO)
   */
  parseHashRoute() {
    const rawHash = window.location.hash.replace("#/", "").trim();
    if (!rawHash) {
      this.currentRoute = "dashboard";
      this.routeParams = {};
      return;
    }

    const parts = rawHash.split("/");
    this.currentRoute = parts[0].toLowerCase();
    this.routeParams = {
      id: parts[1] || null
    };
  }

  /**
   * Helper para renderizar módulos en desarrollo
   */
  renderPlaceholder(title, className = "") {
    const area = document.getElementById("dashboard-content-area");
    if (area) {
      area.innerHTML = `
        <div style="padding: 24px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; font-family: system-ui;">
          <h2 style="margin: 0 0 8px 0; color: #0f172a;">${title}</h2>
          <p style="color: #64748b; font-size: 13px; margin: 0;">
            ${className ? `Sección en desarrollo para la temporada 2026. Requiere <code>src/views/${className}.js</code>` : 'Sección en desarrollo para la temporada 2026.'}
          </p>
        </div>
      `;
    }
  }

  /**
   * Renderiza la aplicación según el estado de sesión, precarga y ruta activa
   */
  async render() {
    const appContainer = document.getElementById("app");
    if (!appContainer) return;

    // A) PANTALLA DE LOGIN
    if (!this.isAuthenticated) {
      appContainer.innerHTML = this.views.auth.render();
      this.bindAuthEvents();
      return;
    }

    // B) PRECARGA MASIVA ÚNICA EN MEMORIA LOCAL (DATASTORE)
    if (!DataStore.isLoaded) {
      appContainer.innerHTML = `
        <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc;">
          <div style="width: 48px; height: 48px; border: 4px solid #e2e8f0; border-top-color: #1e3a8a; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
          <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px; font-weight: 800;">⚡ Precargando IQ Basket</h3>
          <p style="margin: 0; color: #64748b; font-size: 13px;">Sincronizando plantilla, partidos y estadísticas en memoria local...</p>
        </div>
        <style>
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      `;
      await DataStore.init(this.teamId);
    }

    // C) ESTRUCTURA DEL LAYOUT PRINCIPAL
    let contentAreaEl = document.getElementById("dashboard-content-area");
    if (!contentAreaEl) {
      appContainer.innerHTML = LayoutView.wrap(
        `<div id="dashboard-content-area"></div>`, 
        this.currentRoute, 
        this.userRole
      );
      contentAreaEl = document.getElementById("dashboard-content-area");
    }

    // Revincular eventos del Layout y actualizar el marcado 'active' en cada render
    this.bindLayoutEvents();
    LayoutView.updateActiveMenu(this.currentRoute);

    const route = this.currentRoute;
    const contentArea = "dashboard-content-area";

    // D) ENRUTADOR PRINCIPAL (SWITCH DE VISTAS)
    switch (route) {
      case "dashboard":
        if (this.views.dashboard) await this.views.dashboard.render(contentArea, this.teamId);
        break;

      case "team":
      case "equipo":
        if (this.views.team) await this.views.team.render(contentArea, this.teamId);
        break;

      case "games":
      case "partidos":
      case "game":
      case "live":
        if (this.views.liveeditor) {
          await this.views.liveeditor.render(contentArea, this.routeParams.id, this.teamId);
        } else {
          this.renderPlaceholder("Listado y Editor de Partidos", "GameLiveEditorView");
        }
        break;

      case "advanced":
        if (this.views.advanced) await this.views.advanced.render(contentArea);
        break;

      case "boxscore":
      case "registro":
        if (this.views.boxscore) await this.views.boxscore.render(contentArea, this.routeParams.id);
        break;

      case "players":
      case "jugadores":
      case "player":
      case "jugador":
        if (this.views.player) await this.views.player.render(contentArea, this.routeParams.id, this.teamId);
        break;

      case "lineups":
      case "quintetos":
        if (this.views.lineups) await this.views.lineups.render(contentArea);
        break;

      case "comparator":
      case "comparador":
        if (this.views.comparator) await this.views.comparator.render(contentArea);
        break;

      case "reports":
      case "informes":
      case "informe":
        if (this.views.reports) await this.views.reports.render(contentArea);
        break;

      case "ask":
      case "ask-ai":
      case "pregunta":
      case "preguntale":
      case "ai":
      case "ia":
        if (this.views.ask) await this.views.ask.render(contentArea);
        break;

      case "settings":
      case "configuracion":
      case "translations":
        if (this.views.settings) await this.views.settings.render(contentArea);
        break;

      default:
        this.renderPlaceholder(`Módulo ${route.toUpperCase()}`);
        break;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = new IQBasketApp();
  app.parseHashRoute();
  app.render();
});