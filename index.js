/**
 * @fileoverview Orquestador Principal de IQ Basket (index.js).
 * - Autenticación Nativa Estricta con Supabase Auth (supabase.auth.signInWithPassword / signUp).
 * - Sincronizado con la tabla 'user_profiles' de la Base de Datos IQB.
 * - Sincronización en tiempo real de cambio de idioma tanto en Desktop como en Header Móvil.
 * - Guarda de seguridad de rutas para redirigir al Dashboard si un rol restringido (ej. JUGADOR) intenta acceder por hash a Comparador o Asistente IA.
 * - Validación estricta de equipos autorizados por usuario para evitar cargas no permitidas.
 * - Bloqueo absoluto de acceso ante contraseñas o correos no válidos.
 * - Registro público asignando de forma permanente el rol INVITADO.
 * - Preserva a scolado@nechigroup.com como SUPERADMIN.
 * - Control global de cambios no guardados (window.hasUnsavedChanges).
 * - Exposición de la instancia global (window.iqApp) para refrescos en tiempo real.
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
import { ProfileView } from "./views/ProfileView.js";

export class IQBasketApp {
  constructor() {
    this.isAuthenticated = false;
    this.userEmail = localStorage.getItem("iq_user_email") || "scolado@nechigroup.com";
    this.userRole = localStorage.getItem("iq_user_role") || "SUPERADMIN";
    this.currentRoute = "dashboard";
    this.routeParams = {};
    this.teamId = localStorage.getItem("iq_active_team_id") || "e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22";
    this.translationsLoaded = false;

    this.gameController = new GameController(
      null, 
      { can: () => true }, 
      { supabase }
    );

    const authController = {
      hasRole: (role) => {
        const activeRole = localStorage.getItem("iq_user_role") || this.userRole;
        if (Array.isArray(role)) return role.includes(activeRole);
        return ["SUPERADMIN", "ADMIN", "ENTRENADOR", "ANALISTA"].includes(activeRole);
      }
    };

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
      ask: new AskAIView(authController),
      profile: new ProfileView(authController),
      perfil: new ProfileView(authController)
    };
  }

  /**
   * Genera textos de fallback limpios según el idioma de preferencia si BBDD no ha respondido aún
   */
  _getPreloadFallbackTexts(key) {
    const lang = (localStorage.getItem("iq_lang") || "es").toLowerCase();
    
    const messages = {
      es: {
        preload_title: "Precargando IQ Basket...",
        preload_subtitle: "Sincronizando plantilla, partidos y estadísticas desde la Base de Datos IQB...",
        changing_team: "Cambiando de equipo...",
        syncing_season: "Sincronizando temporada...",
        changing_language: "Cambiando idioma..."
      },
      ca: {
        preload_title: "Precarregant IQ Basket...",
        preload_subtitle: "Sincronitzant plantilla, partits i estadístiques des de la Base de Dades IQB...",
        changing_team: "Canviant d'equip...",
        syncing_season: "Sincronitzant temporada...",
        changing_language: "Canviant d'idioma..."
      },
      cat: {
        preload_title: "Precarregant IQ Basket...",
        preload_subtitle: "Sincronitzant plantilla, partits i estadístiques des de la Base de Dades IQB...",
        changing_team: "Canviant d'equip...",
        syncing_season: "Sincronitzant temporada...",
        changing_language: "Canviant d'idioma..."
      },
      en: {
        preload_title: "Preloading IQ Basket...",
        preload_subtitle: "Synchronizing roster, games, and statistics from the IQB Database...",
        changing_team: "Changing team...",
        syncing_season: "Synchronizing season...",
        changing_language: "Changing language..."
      },
      fr: {
        preload_title: "Préchargement de IQ Basket...",
        preload_subtitle: "Synchronisation de l'effectif, des matchs et des statistiques depuis la Base de Données IQB...",
        changing_team: "Changement d'équipe...",
        syncing_season: "Synchronisation de la saison...",
        changing_language: "Changement de langue..."
      }
    };

    const currentDict = messages[lang] || messages.es;
    return currentDict[key] || messages.es[key] || key;
  }

  /**
   * Muestra la pantalla de carga sin exponer claves desnudas
   */
  showLoadingOverlay(messageKey = "preload_title") {
    const appContainer = document.getElementById("app");
    if (!appContainer) return;

    let title = TranslationStore.t(messageKey, "");
    if (!title || title === messageKey) {
      title = this._getPreloadFallbackTexts(messageKey);
    }

    let subtitle = TranslationStore.t("preload_subtitle", "");
    if (!subtitle || subtitle === "preload_subtitle") {
      subtitle = this._getPreloadFallbackTexts("preload_subtitle");
    }

    appContainer.innerHTML = `
      <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; padding: 20px; text-align: center;">
        <div style="width: 48px; height: 48px; border: 4px solid #e2e8f0; border-top-color: #ea580c; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
        <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px; font-weight: 800;">⚡ ${title}</h3>
        <p style="margin: 0; color: #64748b; font-size: 13px; max-width: 420px;">${subtitle}</p>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
  }

  /**
   * Vincula eventos de la pantalla Auth (Login Nativo Estricto, Registro, Selector de Idioma, Pestañas)
   */
  bindAuthEvents() {
    const authLangSelect = document.getElementById("auth-lang-toggle");
    if (authLangSelect) {
      authLangSelect.addEventListener("change", async (e) => {
        const lang = e.target.value;

        if (i18n && typeof i18n.changeLanguage === "function") {
          i18n.changeLanguage(lang);
        }
        if (TranslationStore && typeof TranslationStore.setLanguage === "function") {
          await TranslationStore.setLanguage(lang);
        } else {
          localStorage.setItem("iq_lang", lang);
        }

        if (TranslationStore && typeof TranslationStore.initAllTranslations === "function") {
          await TranslationStore.initAllTranslations();
        }

        this.render();
      });
    }

    document.querySelectorAll(".pwd-toggle-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute("data-target");
        const input = document.getElementById(targetId);
        if (input) {
          const isPassword = input.type === "password";
          input.type = isPassword ? "text" : "password";
        }
      });
    });

    const tabLogin = document.getElementById("tab-btn-login");
    const tabRegister = document.getElementById("tab-btn-register");
    const btnSwitchReg = document.getElementById("btn-switch-to-register");
    const btnSwitchLog = document.getElementById("btn-switch-to-login");

    if (tabLogin) tabLogin.addEventListener("click", () => { this.views.auth.activeTab = "login"; this.render(); });
    if (tabRegister) tabRegister.addEventListener("click", () => { this.views.auth.activeTab = "register"; this.render(); });
    if (btnSwitchReg) btnSwitchReg.addEventListener("click", () => { this.views.auth.activeTab = "register"; this.render(); });
    if (btnSwitchLog) btnSwitchLog.addEventListener("click", () => { this.views.auth.activeTab = "login"; this.render(); });

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById("login-email")?.value.trim();
        const passwordInput = document.getElementById("login-password")?.value;

        if (!emailInput || !passwordInput) {
          alert("⚠️ " + TranslationStore.t("fill_required_fields", "Por favor, completa el correo y la contraseña."));
          return;
        }

        this.showLoadingOverlay("preload_title");

        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: emailInput,
            password: passwordInput
          });

          if (authError || !authData?.user) {
            this.isAuthenticated = false;
            
            const errorMsg = authError?.message.includes("Invalid login credentials")
              ? "Credenciales incorrectas: Correo electrónico o contraseña no válidos."
              : (authError?.message || "Error al autenticar usuario.");

            const appContainer = document.getElementById("app");
            if (appContainer) {
              appContainer.innerHTML = this.views.auth.render({ errorMessage: errorMsg });
              this.bindAuthEvents();
            }
            
            alert(`❌ Error de acceso: ${errorMsg}`);
            return;
          }

          const { data: profileData } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("email", emailInput)
            .maybeSingle();

          let roleToAssign = "INVITADO";
          let firstName = emailInput.split("@")[0];
          let lastName = "";

          if (profileData && profileData.role) {
            roleToAssign = String(profileData.role).toUpperCase();
            firstName = profileData.first_name || firstName;
            lastName = profileData.last_name || "";
          } else if (emailInput.toLowerCase() === "scolado@nechigroup.com") {
            roleToAssign = "SUPERADMIN";
          }

          localStorage.setItem("iq_user_email", emailInput);
          localStorage.setItem("iq_user_role", roleToAssign);
          localStorage.setItem("iq_user_name", firstName);
          localStorage.setItem("iq_user_lastname", lastName);
          localStorage.removeItem("iq_simulated_role");

          this.userEmail = emailInput;
          this.userRole = roleToAssign;
          this.isAuthenticated = true;

          await DataStore.init(this.teamId, true);
          this.render();
        } catch (err) {
          console.error("Excepción en inicio de sesión:", err);
          this.isAuthenticated = false;
          alert("❌ Ocurrió un error inesperado al validar las credenciales.");
          this.render();
        }
      });
    }

    const registerForm = document.getElementById("register-form");
    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const firstName = document.getElementById("reg-firstname")?.value.trim();
        const lastName = document.getElementById("reg-lastname")?.value.trim();
        const email = document.getElementById("reg-email")?.value.trim();
        const password = document.getElementById("reg-password")?.value;
        const assignedRole = "INVITADO";

        if (!firstName || !lastName || !email || !password) {
          alert("⚠️ " + TranslationStore.t("fill_required_fields", "Por favor, completa todos los campos obligatorios."));
          return;
        }

        this.showLoadingOverlay("preload_title");

        try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
              data: {
                first_name: firstName,
                last_name: lastName,
                role: assignedRole
              }
            }
          });

          if (authError) {
            this.render();
            alert(`❌ No se pudo completar el registro: ${authError.message}`);
            return;
          }

          localStorage.setItem("iq_user_name", firstName);
          localStorage.setItem("iq_user_lastname", lastName);
          localStorage.setItem("iq_user_email", email);
          localStorage.setItem("iq_user_role", assignedRole);
          localStorage.removeItem("iq_simulated_role");

          this.userEmail = email;
          this.userRole = assignedRole;
          this.isAuthenticated = true;

          alert(`✅ ¡Bienvenido ${firstName}! Tu cuenta ha sido creada en la Base de Datos IQB con perfil INVITADO (Solo Lectura).`);

          await DataStore.init(this.teamId, true);
          this.render();
        } catch (err) {
          console.error("Excepción en registro:", err);
          alert(`❌ Error durante el registro: ${err.message}`);
          this.render();
        }
      });
    }
  }

  bindLayoutEvents() {
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = "true";
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.warn("Nota al cerrar sesión en Supabase:", err);
        }
        this.isAuthenticated = false;
        DataStore.isLoaded = false;
        localStorage.removeItem("iq_simulated_role");
        this.render();
      });
    }

    // Selector de Idioma Global (Desktop y Móvil)
    const handleLanguageChange = async (e) => {
      const lang = e.target.value;

      if (i18n && typeof i18n.changeLanguage === "function") {
        i18n.changeLanguage(lang);
      }
      if (TranslationStore && typeof TranslationStore.setLanguage === "function") {
        await TranslationStore.setLanguage(lang);
      } else {
        localStorage.setItem("iq_lang", lang);
      }

      this.showLoadingOverlay("changing_language");

      if (TranslationStore && typeof TranslationStore.initAllTranslations === "function") {
        await TranslationStore.initAllTranslations();
      }

      const appContainer = document.getElementById("app");
      if (appContainer) appContainer.innerHTML = "";
      this.render();
    };

    const langSelectDesktop = document.getElementById("select-lang-toggle");
    const langSelectMobile = document.getElementById("mobile-select-lang-toggle");

    if (langSelectDesktop && !langSelectDesktop.dataset.bound) {
      langSelectDesktop.dataset.bound = "true";
      langSelectDesktop.addEventListener("change", handleLanguageChange);
    }
    if (langSelectMobile && !langSelectMobile.dataset.bound) {
      langSelectMobile.dataset.bound = "true";
      langSelectMobile.addEventListener("change", handleLanguageChange);
    }

    const handleTeamChange = async (e) => {
      const newTeamId = e.target.value;
      this.teamId = newTeamId;
      localStorage.setItem("iq_active_team_id", newTeamId);
      
      this.showLoadingOverlay("changing_team");

      if (typeof DataStore.setActiveTeamAndSeason === "function") {
        DataStore.setActiveTeamAndSeason(newTeamId, null);
      }
      DataStore.isLoaded = false;

      await DataStore.init(newTeamId, true);
      this.render();
    };

    const teamSelectDesktop = document.getElementById("sidebar-select-team");
    const teamSelectMobile = document.getElementById("mobile-select-team");

    if (teamSelectDesktop && !teamSelectDesktop.dataset.bound) {
      teamSelectDesktop.dataset.bound = "true";
      teamSelectDesktop.addEventListener("change", handleTeamChange);
    }
    if (teamSelectMobile && !teamSelectMobile.dataset.bound) {
      teamSelectMobile.dataset.bound = "true";
      teamSelectMobile.addEventListener("change", handleTeamChange);
    }

    const handleSeasonChange = async (e) => {
      const newSeason = e.target.value;
      localStorage.setItem("iq_active_season", newSeason);

      this.showLoadingOverlay("syncing_season");

      if (typeof DataStore.setActiveTeamAndSeason === "function") {
        DataStore.setActiveTeamAndSeason(null, newSeason);
      }
      DataStore.isLoaded = false;

      await DataStore.init(this.teamId, true);
      this.render();
    };

    const seasonSelectDesktop = document.getElementById("sidebar-select-season");
    const seasonSelectMobile = document.getElementById("mobile-select-season");

    if (seasonSelectDesktop && !seasonSelectDesktop.dataset.bound) {
      seasonSelectDesktop.dataset.bound = "true";
      seasonSelectDesktop.addEventListener("change", handleSeasonChange);
    }
    if (seasonSelectMobile && !seasonSelectMobile.dataset.bound) {
      seasonSelectMobile.dataset.bound = "true";
      seasonSelectMobile.addEventListener("change", handleSeasonChange);
    }

    if (!window.isHashBound) {
      window.isHashBound = true;
      window.onhashchange = () => {
        if (window.hasUnsavedChanges) {
          const confirmLeave = confirm("⚠️ Tienes cambios sin guardar. Si cambias de pantalla se perderán las modificaciones. ¿Deseas salir sin guardar?");
          if (!confirmLeave) {
            window.location.hash = `#/${this.currentRoute}`;
            return;
          }
          window.hasUnsavedChanges = false;
        }

        this.parseHashRoute();
        this.render();
      };
    }
  }

  parseHashRoute() {
    const rawHash = window.location.hash.replace("#/", "").trim();
    if (!rawHash) {
      this.currentRoute = "dashboard";
      this.routeParams = {};
      return;
    }

    const parts = rawHash.split("/");
    const targetRoute = parts[0].toLowerCase();
    
    // GUARDA DE SEGURIDAD POR ROL: Bloquear acceso por hash a Comparador y Asistente IA para JUGADOR
    const activeRole = localStorage.getItem("iq_simulated_role") || localStorage.getItem("iq_user_role") || "SUPERADMIN";
    
    if (activeRole === "JUGADOR" && ["comparator", "comparador", "ask", "ask-ai", "pregunta", "preguntale", "ai", "ia"].includes(targetRoute)) {
      alert("⚠️ Tu rol de JUGADOR no tiene acceso a esta sección. Has sido redirigido al Dashboard.");
      window.location.hash = "#/dashboard";
      this.currentRoute = "dashboard";
      this.routeParams = {};
      return;
    }

    this.currentRoute = targetRoute;
    this.routeParams = {
      id: parts[1] || null
    };
  }

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

  async render() {
    const appContainer = document.getElementById("app");
    if (!appContainer) return;

    if (!this.translationsLoaded && TranslationStore && typeof TranslationStore.initAllTranslations === "function") {
      await TranslationStore.initAllTranslations();
      this.translationsLoaded = true;
    }

    if (!this.isAuthenticated) {
      appContainer.innerHTML = this.views.auth.render();
      this.bindAuthEvents();
      return;
    }

    // 1. DETERMINAR ROL Y EMAIL DEL USUARIO ACTUAL
    const simulated = localStorage.getItem("iq_simulated_role");
    this.userRole = simulated || localStorage.getItem("iq_user_role") || "SUPERADMIN";
    const userEmail = localStorage.getItem("iq_user_email") || "";

    // 2. OBTENER Y VALIDAR EQUIPOS PERMITIDOS SEGÚN EL ROL
    const storedAssignments = localStorage.getItem("iq_user_teams_map");
    const userTeamAssignments = storedAssignments ? JSON.parse(storedAssignments) : {};
    const myAssignedTeamIds = userTeamAssignments[userEmail] || [];

    const allTeams = DataStore.getTeams() || [];
    const allowedTeams = (this.userRole === "SUPERADMIN")
      ? allTeams
      : allTeams.filter(t => myAssignedTeamIds.includes(String(t.id)));

    // 3. SI EL EQUIPO GUARDADO NO ESTÁ AUTORIZADO, FORZAR EL PRIMERO PERMITIDO
    let storedActiveTeamId = localStorage.getItem("iq_active_team_id");
    
    if (this.userRole !== "SUPERADMIN" && allowedTeams.length > 0) {
      const isAuthorized = allowedTeams.some(t => String(t.id) === String(storedActiveTeamId));
      if (!isAuthorized) {
        storedActiveTeamId = allowedTeams[0].id;
        localStorage.setItem("iq_active_team_id", storedActiveTeamId);
      }
    }

    this.teamId = storedActiveTeamId || this.teamId;

    // 4. INICIALIZAR DATASTORE CON EL EQUIPO REALMENTE AUTORIZADO
    if (!DataStore.isLoaded || DataStore.getActiveTeamId() !== this.teamId) {
      this.showLoadingOverlay("preload_title");
      await DataStore.init(this.teamId, true);
    }

    appContainer.innerHTML = LayoutView.wrap(
      `<div id="dashboard-content-area"></div>`, 
      this.currentRoute, 
      this.userRole
    );

    this.bindLayoutEvents();
    LayoutView.updateActiveMenu(this.currentRoute);

    const route = this.currentRoute;
    const contentArea = "dashboard-content-area";

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

      case "profile":
      case "perfil":
        if (this.views.profile) await this.views.profile.render(contentArea);
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
  window.iqApp = app;
  app.parseHashRoute();
  app.render();
});