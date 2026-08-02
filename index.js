/**
 * @fileoverview Orquestador Principal de IQ Basket.
 * Sincronizado con Auth, Layout, Dashboard, TeamStats, GameLiveEditor y GameController.
 * Garantiza que las vistas se inyecten de forma independiente en 'dashboard-content-area'.
 */

import { supabase } from "./config/database.config.js";
import { AuthView } from "./views/AuthView.js";
import { LayoutView } from "./views/LayoutView.js";
import { SeasonDashboardView } from "./views/SeasonDashboardView.js";
import { TeamStatsView } from "./views/TeamStatsView.js";

// 📌 1. Módulos de anotación en vivo
import { GameController } from "./controllers/GameController.js";
import { GameLiveEditorView } from "./views/GameLiveEditorView.js";

// 📌 Vistas pendientes para descomentar al crear sus archivos:
// import { GameBoxScoreView } from "./views/GameBoxScoreView.js";
// import { PlayerStatsView } from "./views/PlayerStatsView.js";

export class IQBasketApp {
  constructor() {
    this.isAuthenticated = false; // Pantalla de Login al arrancar
    this.userRole = "SUPERADMIN"; // Rol asignado a Sergio Colado
    this.currentRoute = "dashboard";
    this.routeParams = {};
    this.teamId = "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22"; // JMJ Manyanet Sant Andreu

    // 📌 2. Instancia del Controlador de Negocio de Partidos
    this.gameController = new GameController(
      null, 
      { can: () => true }, 
      { supabase }
    );

    // 📌 3. Instancias activas de Vistas
    this.views = {
      auth: new AuthView(),
      dashboard: new SeasonDashboardView(supabase),
      team: new TeamStatsView(supabase),
      equipo: new TeamStatsView(supabase),
      
      // Conectamos el GameLiveEditorView pasándole el GameController
      liveeditor: new GameLiveEditorView(this.gameController),
      live: new GameLiveEditorView(this.gameController),
      registro: new GameLiveEditorView(this.gameController),

      // boxscore: new GameBoxScoreView(supabase),
      // player: new PlayerStatsView(supabase)
    };
  }

  /**
   * Vincula los eventos exactos de AuthView.js (Login y Ver/Ocultar contraseña)
   */
  bindAuthEvents() {
    // 1. Mostrar / Ocultar Contraseña (Ojo 👁️)
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

    // 2. Submit del Formulario de Login
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
    // Botón de Cerrar Sesión
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.isAuthenticated = false;
        this.render();
      });
    }

    // Escuchar cambios de hash en la URL (#/dashboard, #/team, #/live, etc.)
    window.onhashchange = () => {
      this.parseHashRoute();
      this.render();
    };
  }

  /**
   * Extrae la ruta activa y parámetros opcionales de la URL (#/game/ID_PARTIDO)
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
   * Helper para renderizar módulos en desarrollo cuando aún no existe el archivo .js
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

    // A) SI NO ESTÁ AUTENTICADO -> Muestra la tarjeta de AuthView
    if (!this.isAuthenticated) {
      appContainer.innerHTML = this.views.auth.render();
      this.bindAuthEvents();
      return;
    }

    // B) SI ESTÁ AUTENTICADO -> Genera el contenedor Layout con el área de trabajo
    // Solo reescribe el Layout si el contenedor aún no existe en el DOM para evitar parpadeos
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

    // C) ENRUTADOR DINÁMICO
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

      case "game":
      case "boxscore":
        if (this.views.boxscore) {
          await this.views.boxscore.render(contentArea, this.routeParams.id || this.teamId);
        } else {
          this.renderPlaceholder("Análisis de Partido (BoxScore)", "GameBoxScoreView");
        }
        break;

      case "live":
      case "registro":
        if (this.views.liveeditor) {
          await this.views.liveeditor.render(contentArea, this.routeParams.id || this.teamId);
        } else {
          this.renderPlaceholder("Registro Estadístico en Vivo", "GameLiveEditorView");
        }
        break;

      case "player":
      case "jugador":
      case "jugadores":
        if (this.views.player) {
          await this.views.player.render(contentArea, this.routeParams.id || this.teamId);
        } else {
          this.renderPlaceholder("Estadísticas de Jugador", "PlayerStatsView");
        }
        break;

      default:
        this.renderPlaceholder(`Módulo ${route.toUpperCase()}`);
        break;
    }
  }
}

// Inicialización automática cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  const app = new IQBasketApp();
  app.parseHashRoute();
  app.render();
});