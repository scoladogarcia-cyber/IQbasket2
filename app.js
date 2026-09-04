/**
 * @fileoverview Punto de Entrada y Enrutador SPA Principal de IQ Basket: app.js
 * @description Orquesta la inicialización de DataStore, autenticación RBAC, sincronización de idioma (I18n),
 * envoltura del layout responsive (LayoutView) y resolución declarativa de todas las rutas de la plataforma.
 */

import { supabase } from "./config/database.config.js";
import { DataStore } from "./services/DataStore.js";
import { TranslationStore } from "./services/TranslationStore.js";
import { I18n } from "./services/I18nService.js";
import { AuthController } from "./controllers/AuthController.js";
import { GameController } from "./controllers/GameController.js";

// Vistas del Sistema
import { LayoutView } from "./views/LayoutView.js";
import { ApprovalCenterView } from "./views/ApprovalCenterView.js";
import { AuthView } from "./views/AuthView.js";
import { SeasonDashboardView } from "./views/SeasonDashboardView.js";
import { TeamStatsView } from "./views/TeamStatsView.js";
import { PlayerStatsView } from "./views/PlayerStatsView.js";
import { GameLiveEditorView } from "./views/GameLiveEditorView.js";
import { EasyStatsEntryView } from "./views/EasyStatsEntryView.js";
import { GameBoxScoreView } from "./views/GameBoxScoreView.js";
import { AdvancedStatsView } from "./views/AdvancedStatsView.js";
import { HeatmapAnalysisView } from "./views/HeatmapAnalysisView.js";
import { LineupsView } from "./views/LineupsView.js";
import { ComparatorView } from "./views/ComparatorView.js";
import { ReportsView } from "./views/ReportsView.js";
import { AskAIView } from "./views/AskAIView.js";
import { ProfileView } from "./views/ProfileView.js";
import { TranslationsView } from "./views/TranslationsView.js";
import { TrainingView } from "./views/TrainingView.js";
import { NutritionView } from "./views/NutritionView.js";
import { Player360View } from "./views/Player360View.js";
import { PrivacyCenterView } from "./views/PrivacyCenterView.js";

class App {
  constructor() {
    this.supabase = supabase;
    this.authController = new AuthController(this.supabase);
    this.gameController = new GameController(this.supabase);

    this.teamId = localStorage.getItem("iq_active_team_id") || "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22";
    this.currentView = null;
    this.currentRoute = "dashboard";
  }

  /**
   * Inicializa almacenes locales, escucha de sesión y el enrutador SPA.
   */
  async init() {
    // 1. Inicializar idioma y diccionarios
    const savedLang = localStorage.getItem("iq_lang") || "es";
    if (TranslationStore) {
      await TranslationStore.setLanguage(savedLang);
    }
    if (I18n && typeof I18n.setLocale === "function") {
      I18n.setLocale(savedLang);
    }

    // 2. Inicializar DataStore con caché local
    await DataStore.init(this.teamId, false);

    // 3. Listener global de cambio de ruta (Hash Router)
    window.addEventListener("hashchange", () => this.handleRoute());

    // 4. Suscripción a cambios de idioma para refrescar la interfaz
    if (I18n && typeof I18n.subscribe === "function") {
      I18n.subscribe(() => {
        LayoutView.updateActiveMenu(this.currentRoute);
      });
    }

    // 5. Cargar ruta inicial
    await this.handleRoute();
  }

  /**
   * Parsea la ruta hash actual y sus parámetros dinámicos.
   * @returns {{ route: string, id: string|null }}
   */
  _parseRoute() {
    const rawHash = window.location.hash.slice(1).replace(/^\//, "") || "dashboard";
    const parts = rawHash.split("/");
    return {
      route: parts[0] || "dashboard",
      id: parts[1] || null
    };
  }

  /**
   * Obtiene el rol de usuario activo (considerando simulación).
   * @returns {string}
   */
  _getUserRole() {
    return localStorage.getItem("iq_simulated_role") || localStorage.getItem("iq_user_role") || "SUPERADMIN";
  }

  /**
   * Enrutador centralizado.
   */
  async handleRoute() {
    const { route, id } = this._parseRoute();
    this.currentRoute = route;
    const userRole = this._getUserRole();

    const appContainer = document.getElementById("app");
    if (!appContainer) return;

    // Rutas públicas de Autenticación
    if (route === "login" || route === "register") {
      const authView = new AuthView();
      authView.activeTab = route;
      appContainer.innerHTML = authView.render();
      this._bindAuthEvents(appContainer);
      return;
    }

    // Estructurar el Layout principal si no está montado
    if (!document.getElementById("dashboard-content-area")) {
      appContainer.innerHTML = LayoutView.wrap('<div id="dashboard-content-area"></div>', route, userRole);
      this._bindGlobalLayoutEvents();
    } else {
      LayoutView.updateActiveMenu(route);
    }

    const contentAreaId = "dashboard-content-area";

    // Enrutamiento modular por vista
    switch (route) {
      case "dashboard":
        this.currentView = new SeasonDashboardView(this.supabase, this.authController);
        await this.currentView.render(contentAreaId, this.teamId);
        break;

      case "team":
        this.currentView = new TeamStatsView(this.supabase, this.authController);
        await this.currentView.render(contentAreaId, this.teamId);
        break;

      case "training":
      case "entrenamientos":
      case "development":
      case "desarrollo":
        this.currentView = new TrainingView(this.supabase, this.authController);
        await this.currentView.render(contentAreaId, this.teamId);
        break;

      case "nutrition":
      case "nutricion":
        this.currentView = new NutritionView(this.supabase, this.authController);
        await this.currentView.render(contentAreaId, id, this.teamId);
        break;

      case "player360":
      case "player-360":
      case "desarrollo-jugador":
        this.currentView = new Player360View(this.supabase, this.authController);
        await this.currentView.render(contentAreaId, id, this.teamId);
        break;

      case "players":
      case "player":
        this.currentView = new PlayerStatsView(this.supabase, this.authController);
        await this.currentView.render(contentAreaId, id, this.teamId);
        break;

      case "approvals":
      case "requests":
      case "solicitudes":
      case "bandeja":
        this.currentView = new ApprovalCenterView(this.supabase, this.authController);
        await this.currentView.render(contentAreaId);
        break;

      case "games":
      case "game":
      case "game-editor":
        this.currentView = new GameLiveEditorView(this.gameController, this.authController);
        await this.currentView.render(contentAreaId, id, this.teamId);
        break;

      case "easy-entry":
        this.currentView = new EasyStatsEntryView(this.gameController, this.authController, I18n, id);
        await this.currentView.render(contentAreaId, id);
        break;

      case "boxscore":
        this.currentView = new GameBoxScoreView(this.supabase, this.authController);
        await this.currentView.render(contentAreaId, id);
        break;

      case "advanced":
      case "advanced_stats":
        this.currentView = new AdvancedStatsView(this.gameController);
        await this.currentView.render(contentAreaId);
        break;

      case "heatmap":
        this.currentView = new HeatmapAnalysisView(this.supabase, this.authController);
        await this.currentView.render(contentAreaId, this.teamId);
        break;

      case "lineups":
        this.currentView = new LineupsView(this.authController);
        await this.currentView.render(contentAreaId);
        break;

      case "comparator":
        this.currentView = new ComparatorView(this.authController);
        await this.currentView.render(contentAreaId);
        break;

      case "reports":
        this.currentView = new ReportsView(this.authController);
        await this.currentView.render(contentAreaId);
        break;

      case "ask":
      case "ask-ai":
        this.currentView = new AskAIView(this.authController);
        await this.currentView.render(contentAreaId);
        break;

      case "profile":
        this.currentView = new ProfileView(this.authController);
        await this.currentView.render(contentAreaId);
        break;

      case "privacy":
      case "privacy-center":
      case "privacidad":
        this.currentView = new PrivacyCenterView(this.supabase, this.authController);
        await this.currentView.render(contentAreaId);
        break;

      case "settings":
      case "translations":
        this.currentView = new TranslationsView(this.authController);
        await this.currentView.render(contentAreaId);
        break;

      default:
        window.location.hash = "#/dashboard";
        break;
    }
  }

  /**
   * Vincula eventos de la vista de autenticación (Login/Registro e idioma).
   */
  _bindAuthEvents(container) {
    const langSelect = container.querySelector("#auth-lang-toggle");
    if (langSelect) {
      langSelect.addEventListener("change", async (e) => {
        const newLang = e.target.value;
        localStorage.setItem("iq_lang", newLang);
        if (TranslationStore) await TranslationStore.setLanguage(newLang);
        if (I18n) I18n.setLocale(newLang);
        window.location.reload();
      });
    }

    container.querySelector("#tab-btn-login")?.addEventListener("click", () => {
      window.location.hash = "#/login";
    });

    container.querySelector("#tab-btn-register")?.addEventListener("click", () => {
      window.location.hash = "#/register";
    });

    container.querySelector("#btn-switch-to-register")?.addEventListener("click", () => {
      window.location.hash = "#/register";
    });

    container.querySelector("#btn-switch-to-login")?.addEventListener("click", () => {
      window.location.hash = "#/login";
    });

    // Envío del formulario de Login
    container.querySelector("#login-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = container.querySelector("#login-email")?.value.trim();
      const password = container.querySelector("#login-password")?.value;

      try {
        const result = await this.authController.login(email, password);
        if (result && result.success) {
          window.location.hash = "#/dashboard";
        } else {
          alert(`❌ ${result?.error || "Error al iniciar sesión"}`);
        }
      } catch (err) {
        alert(`❌ Error de conexión: ${err.message}`);
      }
    });

    // Envío del formulario de Registro
    container.querySelector("#register-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const firstName = container.querySelector("#reg-firstname")?.value.trim();
      const lastName = container.querySelector("#reg-lastname")?.value.trim();
      const email = container.querySelector("#reg-email")?.value.trim();
      const password = container.querySelector("#reg-password")?.value;

      try {
        const result = await this.authController.register(email, password, {
          first_name: firstName,
          last_name: lastName,
          role: "INVITADO"
        });

        if (result && result.success) {
          alert("✅ Cuenta creada con éxito en modo Invitado.");
          window.location.hash = "#/dashboard";
        } else {
          alert(`❌ ${result?.error || "Error al registrar cuenta"}`);
        }
      } catch (err) {
        alert(`❌ Error de registro: ${err.message}`);
      }
    });
  }

  /**
   * Vincula selectores globales del layout (cambio de equipo, temporada, idioma y logout).
   */
  _bindGlobalLayoutEvents() {
    // Cambio de idioma (Sidebar y Mobile Header)
    const handleLangChange = async (e) => {
      const newLang = e.target.value;
      localStorage.setItem("iq_lang", newLang);
      if (TranslationStore) await TranslationStore.setLanguage(newLang);
      if (I18n) I18n.setLocale(newLang);
      window.location.reload();
    };

    document.getElementById("select-lang-toggle")?.addEventListener("change", handleLangChange);
    document.getElementById("mobile-select-lang-toggle")?.addEventListener("change", handleLangChange);

    // Cambio de equipo activo
    const handleTeamChange = async (e) => {
      const newTeamId = e.target.value;
      if (!newTeamId) return;

      this.teamId = newTeamId;
      localStorage.setItem("iq_active_team_id", newTeamId);
      DataStore.setActiveTeamAndSeason(newTeamId, null);
      await DataStore.init(newTeamId, true);
      await this.handleRoute();
    };

    document.getElementById("sidebar-select-team")?.addEventListener("change", handleTeamChange);
    document.getElementById("mobile-select-team")?.addEventListener("change", handleTeamChange);

    // Cambio de temporada activa
    const handleSeasonChange = async (e) => {
      const newSeason = e.target.value;
      localStorage.setItem("iq_active_season", newSeason);
      DataStore.setActiveTeamAndSeason(this.teamId, newSeason);
      await this.handleRoute();
    };

    document.getElementById("sidebar-select-season")?.addEventListener("change", handleSeasonChange);
    document.getElementById("mobile-select-season")?.addEventListener("change", handleSeasonChange);

    // Cerrar sesión
    document.getElementById("btn-logout")?.addEventListener("click", async () => {
      if (confirm("¿Deseas cerrar tu sesión actual?")) {
        await this.authController.logout();
        window.location.hash = "#/login";
      }
    });
  }
}

// Exponer la instancia global para interoperabilidad
document.addEventListener("DOMContentLoaded", () => {
  window.iqApp = new App();
  window.iqApp.init();
});

export default App;
