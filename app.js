/**
 * @fileoverview Punto de Entrada y Enrutador Principal de IQ Basket (app.js)
 */

import { AppLayout } from "./components/AppLayout.js";
import { SeasonDashboardView } from "./views/SeasonDashboardView.js";

class App {
  constructor() {
    this.layout = new AppLayout();
    this.currentView = null;
    this.teamId = "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22"; // ID por defecto
  }

  /**
   * Inicializa la estructura global de la aplicación
   */
  init() {
    // 1. Renderizar el Marco Global (Menú + Contenedor main-content) en el div #app
    this.layout.render("app");

    // 2. Registrar el listener para cambios de hash/ruta
    window.addEventListener("hashchange", () => this.handleRoute());
    
    // 3. Cargar la ruta inicial al arrancar
    this.handleRoute();
  }

  /**
   * Gestor de rutas (Router)
   */
  async handleRoute() {
    const hash = window.location.hash || "#/dashboard";

    // Enrutado a las pantallas de la app
    if (hash === "#/dashboard" || hash === "#/" || hash === "") {
      this.currentView = new SeasonDashboardView(window.supabase);
      await this.currentView.render("main-content", this.teamId);
    } 
    // Aquí podrás añadir el resto de rutas según crees las vistas:
    // else if (hash === "#/team") { ... }
    // else if (hash === "#/games") { ... }
  }
}

// Arrancar la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});