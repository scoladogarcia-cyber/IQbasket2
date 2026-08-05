/**
 * @fileoverview Orquestador Principal de IQ Basket.
 * Sincronizado con Auth, Layout, Dashboard, TeamStats, GameLiveEditorView, GameBoxScoreView, PlayerStatsView y DataStore.
 */

import { supabase } from "./config/database.config.js";
import { DataStore } from "./services/DataStore.js";

import { AuthView } from "./views/AuthView.js";
import { LayoutView } from "./views/LayoutView.js";
import { SeasonDashboardView } from "./views/SeasonDashboardView.js";
import { TeamStatsView } from "./views/TeamStatsView.js";

// 📌 1. Módulos de anotación en vivo, BoxScore y controladores
import { GameController } from "./controllers/GameController.js";
import { GameLiveEditorView } from "./views/GameLiveEditorView.js";
import { GameBoxScoreView } from "./views/GameBoxScoreView.js";

// 📌 2. Módulo Único de Jugadores (Parrilla + Ficha Detallada)
import { PlayerStatsView } from "./views/PlayerStatsView.js";

export class IQBasketApp {
  constructor() {
    this.isAuthenticated = false; // Pantalla de Login al arrancar
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
      hasRole: (role) => ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"].includes(this.userRole)
    };

    // Instancias activas de Vistas
    this.views = {
      auth: new AuthView(),
      dashboard: new SeasonDashboardView(supabase),
      team: new TeamStatsView(supabase),
      equipo: new TeamStatsView(supabase),
      
      // Vistas del Módulo de Partidos
      liveeditor: new GameLiveEditorView(this.gameController),
      partidos: new GameLiveEditorView(this.gameController),
      boxscore: new GameBoxScoreView(supabase, authController),

      // Vista del Módulo de Jugadores
      player: new PlayerStatsView(supabase, authController)
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
   * Vincula los eventos del Layout (Menú lateral, Logout y navegación responsive)
   */
  bindLayoutEvents() {
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.isAuthenticated = false;
        DataStore.isLoaded = false; // Resetear caché local al cerrar sesión
        this.render();
      });
    }

    window.onhashchange = () => {
      this.parseHashRoute();
      this.render();
    };
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
   * Renderiza la aplicación según el estado de sesión y ruta
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

    // B) PRECARGA MASIVA ÚNICA EN MEMORIA LOCAL (DATASTORE) AL INICIAR SESIÓN
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
      this.bindLayoutEvents();
      contentAreaEl = document.getElementById("dashboard-content-area");
    }

    const route = this.currentRoute;
    const contentArea = "dashboard-content-area";

    // D) ENRUTADOR PRINCIPAL
    switch (route) {
      case "dashboard":
        if (this.views.dashboard) {
          await this.views.dashboard.render(contentArea, this.teamId);
        }
        break;

      case "team":
      case "equipo":
        if (this.views.team) {
          await this.views.team.render(contentArea, this.teamId);
        }
        break;

      // 🏀 1. RUTA DE PARTIDOS Y EDITOR (#/partidos, #/live, #/game/ID_PARTIDO)
      case "partidos":
      case "games":
      case "game":
      case "live":
      case "registro":
        if (this.views.liveeditor) {
          await this.views.liveeditor.render(contentArea, this.routeParams.id, this.teamId);
        } else {
          this.renderPlaceholder("Listado y Registro de Partidos", "GameLiveEditorView");
        }
        break;

      // 📊 2. RUTA DE BOXSCORE Y MÉTRICAS AVANZADAS (#/boxscore o #/boxscore/ID_PARTIDO)
      case "boxscore":
        if (this.views.boxscore) {
          await this.views.boxscore.render(contentArea, this.routeParams.id);
        } else {
          this.renderPlaceholder("Análisis de Partido (BoxScore)", "GameBoxScoreView");
        }
        break;

      // 👤 3. RUTA DE JUGADORES (#/players, #/jugadores, #/player/ID_JUGADOR)
      case "players":
      case "jugadores":
      case "player":
      case "jugador":
        if (this.views.player) {
          await this.views.player.render(contentArea, this.routeParams.id, this.teamId);
        } else {
          this.renderPlaceholder("Sección de Jugadores", "PlayerStatsView");
        }
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