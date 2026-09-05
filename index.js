/**
 * @fileoverview Orquestador Principal de IQ Basket: index.js
 * @description Punto de entrada central y enrutador SPA reactivo.
 * 
 * Capacidades integradas:
 * 1. Autenticación nativa con Supabase Auth.
 * 2. Sincronización en tiempo real con user_profiles y control estricto de roles RBAC.
 * 3. Integración de la suite completa de LiveScoreHUDView (Anotación Pro en Vivo).
 * 4. Gestión y filtrado de equipos autorizados por usuario.
 * 5. Sincronización en tiempo real de idioma (ES, CA, EN, FR) en Desktop y Móvil vía TranslationStore e I18n.
 * 6. Integración del nuevo módulo formativo y familiar: FamilyAdvisorView.
 * 7. Control de cambios sin guardar y preservación de estados en tiempo de ejecución.
 */

import { supabase } from "./config/database.config.js";
import { DataStore } from "./services/DataStore.js";
import { TranslationStore } from "./services/TranslationStore.js";
import { I18n } from "./services/I18nService.js";
import { AuthorizationContextService } from "./services/security/AuthorizationContextService.js";
import { AccountStatusService } from "./services/security/AccountStatusService.js";
import { PermissionService, Permission, UserRole } from "./security/PermissionService.js";
import { ROUTE_PERMISSIONS } from "./security/permissions.js";
import { AccountAccessError, AccountStatus, assertAccountActive } from "./security/accountStatus.js";
import { LazyViewRegistry } from "./services/LazyViewRegistry.js";

import { AuthView } from "./views/AuthView.js";
import { LayoutView } from "./views/LayoutView.js";
import { ApprovalCenterView } from "./views/ApprovalCenterView.js";
import { SeasonDashboardView } from "./views/SeasonDashboardView.js";
import { GameController } from "./controllers/GameController.js";

export class IQBasketApp {
  constructor() {
    this.isAuthenticated = false;
    this.userEmail = "";
    this.userRole = UserRole.INVITADO;
    this.currentRoute = "dashboard";
    this.routeParams = {};
    this.teamId = localStorage.getItem("iq_active_team_id") || "";
    this.translationsLoaded = false;

    // Única fuente de verdad para autorización. localStorage queda solo como caché de UI.
    this.permissionService = new PermissionService();
    this.authController = this.permissionService;
    this.authorizationContextService = new AuthorizationContextService(supabase);
    this.accountStatusService = new AccountStatusService(supabase);
    this._authorizationRefreshPromise = null;

    // Se elimina el bypass histórico { can: () => true }.
    this.gameController = new GameController(
      null,
      this.authController,
      { supabase }
    );

    // El shell crítico permanece eager. Las vistas secundarias se cargan por ruta
    // y se cachean tras el primer acceso para reducir el coste inicial en móvil.
    this.views = {
      auth: new AuthView(),
      dashboard: new SeasonDashboardView(supabase, this.authController),
      approvals: new ApprovalCenterView(supabase, this.authController)
    };
    this.lazyViews = new LazyViewRegistry({
      supabase,
      authController: this.authController,
      gameController: this.gameController,
      i18n: I18n
    }, this.views);
  }

  /**
   * Genera textos de fallback limpios según el idioma de preferencia.
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

  showLoadingOverlay(messageKey = "preload_title") {
    const appContainer = document.getElementById("app");
    if (!appContainer) return;

    let title = TranslationStore ? TranslationStore.t(messageKey, "") : "";
    if (!title || title === messageKey) {
      title = this._getPreloadFallbackTexts(messageKey);
    }

    let subtitle = TranslationStore ? TranslationStore.t("preload_subtitle", "") : "";
    if (!subtitle || subtitle === "preload_subtitle") {
      subtitle = this._getPreloadFallbackTexts("preload_subtitle");
    }

    appContainer.innerHTML = `
      <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: var(--font-family-base, system-ui); background: #f8fafc; padding: 20px; text-align: center;">
        <div style="width: 48px; height: 48px; border: 4px solid #e2e8f0; border-top-color: var(--color-primary, #f97316); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
        <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px; font-weight: 800;">⚡ ${title}</h3>
        <p style="margin: 0; color: #64748b; font-size: 13px; max-width: 420px;">${subtitle}</p>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
  }

  /**
   * Aplica la identidad autenticada y normaliza su rol/alcance con PermissionService.
   * El rol guardado en localStorage es únicamente una caché visual.
   */
  _applyAuthenticatedUser(authUser, profileData = null) {
    if (!authUser?.email) return null;

    const mergedProfile = {
      ...(profileData || {}),
      id: authUser.id || profileData?.id || null,
      email: authUser.email,
      role: profileData?.role || authUser.user_metadata?.role || UserRole.INVITADO,
      first_name: profileData?.first_name || authUser.user_metadata?.first_name || "",
      last_name: profileData?.last_name || authUser.user_metadata?.last_name || ""
    };

    const normalizedUser = this.permissionService.setCurrentUser(mergedProfile);
    if (!normalizedUser) return null;
    assertAccountActive(normalizedUser.accountStatus);

    this.userEmail = normalizedUser.email;
    this.userRole = normalizedUser.role;
    this.isAuthenticated = true;

    localStorage.setItem("iq_user_email", normalizedUser.email);
    localStorage.setItem("iq_user_role", normalizedUser.role);
    localStorage.setItem("iq_user_name", mergedProfile.first_name || "");
    localStorage.setItem("iq_user_lastname", mergedProfile.last_name || "");
    localStorage.removeItem("iq_simulated_role");

    // Compatibilidad visual temporal: la seguridad NO usa este mapa.
    const cachedAssignments = JSON.parse(localStorage.getItem("iq_user_teams_map") || "{}");
    cachedAssignments[normalizedUser.email] = normalizedUser.allowedTeamIds || [];
    localStorage.setItem("iq_user_teams_map", JSON.stringify(cachedAssignments));

    if (typeof DataStore.setPermissionService === "function") {
      DataStore.setPermissionService(this.permissionService);
    }

    return normalizedUser;
  }

  async _enrichAuthenticatedProfile(authUser, profileData = null) {
    const baseProfile = {
      ...(profileData || {}),
      id: authUser?.id || profileData?.id || null,
      email: authUser?.email || profileData?.email || ""
    };

    // El estado de cuenta es un gate anterior al RBAC: si no puede verificarse,
    // no se hidratan membresías ni se concede acceso por compatibilidad legacy.
    const accountState = await this.accountStatusService.getCurrentState();
    if (!accountState.active) throw new AccountAccessError(accountState.accountStatus);
    baseProfile.account_status = accountState.accountStatus;

    try {
      return await this.authorizationContextService.enrichProfile(baseProfile);
    } catch (error) {
      console.warn("[RBAC] No se pudo cargar el contexto v3; se mantiene compatibilidad legacy:", error.message);
      return baseProfile;
    }
  }

  _getAccountAccessMessage(error) {
    if (error?.code === "ACCOUNT_NOT_ACTIVE") {
      const byStatus = {
        [AccountStatus.SUSPENDED]: ["account_suspended", "Tu cuenta está suspendida. Contacta con un administrador."],
        [AccountStatus.PENDING_ACTIVATION]: ["account_pending_activation", "Tu cuenta está pendiente de activación."],
        [AccountStatus.DISABLED]: ["account_disabled", "Tu cuenta está desactivada. Contacta con un administrador."]
      };
      const [key, fallback] = byStatus[error.accountStatus] || byStatus[AccountStatus.DISABLED];
      return TranslationStore?.t?.(key, fallback) || fallback;
    }
    return TranslationStore?.t?.(
      "account_status_unavailable",
      "No se ha podido verificar de forma segura el estado de tu cuenta. Inténtalo de nuevo."
    ) || "No se ha podido verificar de forma segura el estado de tu cuenta. Inténtalo de nuevo.";
  }

  _isAccountSecurityError(error) {
    return error?.code === "ACCOUNT_NOT_ACTIVE"
      || error?.code === "ACCOUNT_STATUS_LOOKUP_FAILED"
      || error?.message === "ACCOUNT_STATUS_BACKEND_UNAVAILABLE";
  }

  async _closeRejectedAccountSession(error, { renderAuth = false } = {}) {
    try {
      if (supabase) await supabase.auth.signOut({ scope: "local" });
    } catch (signOutError) {
      console.warn("[ACCOUNT] No se pudo cerrar la sesión rechazada:", signOutError?.message || signOutError);
    }
    this._clearSessionContext();

    if (renderAuth) {
      const appContainer = document.getElementById("app");
      if (appContainer) {
        appContainer.innerHTML = this.views.auth.render({
          errorMessage: this._getAccountAccessMessage(error)
        });
        this.bindAuthEvents();
      }
    }
  }

  /**
   * Refresca roles y alcances desde Supabase sin cerrar la sesion.
   * Recupera cambios de membresia realizados mientras la sesion permanece abierta.
   * En caso de error conserva el contexto anterior: la autorizacion sigue deny-by-default.
   */
  async refreshAuthenticatedAuthorizationContext({ reason = "runtime" } = {}) {
    if (!supabase || !this.isAuthenticated) return false;
    if (this._authorizationRefreshPromise) return this._authorizationRefreshPromise;

    this._authorizationRefreshPromise = (async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const authUser = sessionData?.session?.user;
        if (sessionError || !authUser?.email) {
          if (sessionError) {
            console.warn(`[RBAC] Refresco de autorizacion (${reason}) sin sesion valida:`, sessionError.message);
          }
          return false;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("id,email,first_name,last_name,phone,role,global_role,status,assigned_team_ids,linked_player_id,created_at")
          .eq("email", authUser.email)
          .maybeSingle();

        if (profileError) {
          console.warn(`[RBAC] Refresco de autorizacion (${reason}) sin perfil:`, profileError.message);
          return false;
        }

        const previousPreviewRole = this.permissionService.previewRole || null;
        const enrichedProfile = await this._enrichAuthenticatedProfile(authUser, profileData);
        const normalizedUser = this._applyAuthenticatedUser(authUser, enrichedProfile);

        if (previousPreviewRole && normalizedUser?.role === UserRole.SUPERADMIN) {
          this.permissionService.setPreviewRole(previousPreviewRole);
        }

        return Boolean(normalizedUser);
      } catch (error) {
        console.warn(`[RBAC] No se pudo refrescar la autorizacion (${reason}):`, error?.message || error);
        if (this._isAccountSecurityError(error)) {
          await this._closeRejectedAccountSession(error, { renderAuth: true });
        }
        return false;
      } finally {
        this._authorizationRefreshPromise = null;
      }
    })();

    return this._authorizationRefreshPromise;
  }

  /**
   * Restaura una sesión Supabase válida al recargar la SPA.
   */
  async restoreAuthenticatedSession() {
    if (window.__IQ_PASSWORD_RECOVERY__ === true) return false;
    if (!supabase) return false;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session?.user) return false;

      const authUser = data.session.user;
      const email = authUser.email || "";
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("id,email,first_name,last_name,phone,role,global_role,status,assigned_team_ids,linked_player_id,created_at")
        .eq("email", email)
        .maybeSingle();

      const enrichedProfile = await this._enrichAuthenticatedProfile(authUser, profileData);
      this._applyAuthenticatedUser(authUser, enrichedProfile);
      return true;
    } catch (err) {
      console.warn("[RBAC] No se pudo restaurar la sesión:", err);
      if (this._isAccountSecurityError(err)) {
        await this._closeRejectedAccountSession(err);
      }
      return false;
    }
  }

  bindAuthEvents() {
    const authLangSelect = document.getElementById("auth-lang-toggle");
    if (authLangSelect) {
      authLangSelect.addEventListener("change", async (e) => {
        const lang = e.target.value;

        if (I18n && typeof I18n.setLocale === "function") {
          I18n.setLocale(lang);
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
          alert("⚠️ " + (TranslationStore ? TranslationStore.t("fill_required_fields", "Por favor, completa el correo y la contraseña.") : "Por favor, completa el correo y la contraseña."));
          return;
        }

        this.showLoadingOverlay("preload_title");

        try {
          if (!supabase) throw new Error("Supabase no configurado");
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
            .select("id,email,first_name,last_name,phone,role,global_role,status,assigned_team_ids,linked_player_id,created_at")
            .eq("email", emailInput)
            .maybeSingle();

          const enrichedProfile = await this._enrichAuthenticatedProfile(authData.user, profileData);
          const normalizedUser = this._applyAuthenticatedUser(authData.user, enrichedProfile);
          if (!normalizedUser) {
            throw new Error("No se pudo resolver el perfil de autorización.");
          }

          await DataStore.init(this.teamId, true);
          this.render();
        } catch (err) {
          console.error("Excepción en inicio de sesión:", err);
          if (this._isAccountSecurityError(err)) {
            const message = this._getAccountAccessMessage(err);
            await this._closeRejectedAccountSession(err, { renderAuth: true });
            alert(`⛔ ${message}`);
            return;
          }
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
          alert("⚠️ " + (TranslationStore ? TranslationStore.t("fill_required_fields", "Por favor, completa todos los campos obligatorios.") : "Por favor, completa todos los campos obligatorios."));
          return;
        }

        this.showLoadingOverlay("preload_title");

        try {
          if (!supabase) throw new Error("Supabase no configurado");
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

          const registrationProfile = await this._enrichAuthenticatedProfile(authData.user, {
            email,
            first_name: firstName,
            last_name: lastName,
            role: assignedRole
          });
          const normalizedUser = this._applyAuthenticatedUser(authData.user, registrationProfile);
          if (!normalizedUser) {
            throw new Error("No se pudo inicializar el perfil INVITADO.");
          }

          alert(`✅ ¡Bienvenido ${firstName}! Tu cuenta ha sido creada con perfil INVITADO (Demo / acceso limitado).`);

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

  /**
   * Limpia únicamente el contexto local de la sesión cerrada.
   * Mantiene preferencias no sensibles (por ejemplo, idioma) y fuerza
   * una recarga limpia de datos al autenticar una cuenta diferente.
   */
  _clearSessionContext() {
    this.isAuthenticated = false;
    this.userEmail = "";
    this.userRole = UserRole.INVITADO;
    this.teamId = "";
    this.currentRoute = "dashboard";
    this.routeParams = {};

    this.permissionService.clear();
    DataStore.isLoaded = false;

    const sessionKeys = [
      "iq_user_email",
      "iq_user_role",
      "iq_user_name",
      "iq_user_lastname",
      "iq_user_phone",
      "iq_user_teams_map",
      "iq_simulated_role",
      "iq_active_team_id",
      "iq_active_season"
    ];

    sessionKeys.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem("iq_sidebar_scroll");
    document.body.style.overflow = "";
  }

  bindLayoutEvents() {
    const appRoot = document.getElementById("app");
    if (appRoot && appRoot.dataset.sessionActionsBound !== "true") {
      appRoot.dataset.sessionActionsBound = "true";
      appRoot.addEventListener("click", async (event) => {
        const logoutBtn = event.target.closest?.('[data-session-action="logout"]');
        if (!logoutBtn || !appRoot.contains(logoutBtn)) return;

        event.preventDefault();
        event.stopPropagation();
        if (logoutBtn.dataset.logoutBusy === "true") return;
        logoutBtn.dataset.logoutBusy = "true";
        logoutBtn.disabled = true;
        logoutBtn.setAttribute("aria-busy", "true");

        try {
          if (supabase) {
            const { error } = await supabase.auth.signOut({ scope: "local" });
            if (error) console.warn("Nota al cerrar sesión:", error.message || error);
          }
        } catch (err) {
          console.warn("Nota al cerrar sesión:", err);
        }

        this._clearSessionContext();
        if (window.location.hash !== "#/dashboard") {
          window.history.replaceState(null, "", "#/dashboard");
        }
        await this.render();
      });
    }

    const handleLanguageChange = async (e) => {
      const lang = e.target.value;

      if (I18n && typeof I18n.setLocale === "function") {
        I18n.setLocale(lang);
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
      let canSelectTeam = this.permissionService.can(Permission.SELECT_TEAM, { teamId: newTeamId });

      // La membresia puede haberse concedido despues del login. Antes de denegar,
      // refrescamos una vez el contexto autenticado desde su fuente real.
      if (!canSelectTeam) {
        await this.refreshAuthenticatedAuthorizationContext({ reason: "team_change" });
        canSelectTeam = this.permissionService.can(Permission.SELECT_TEAM, { teamId: newTeamId });
      }

      if (!canSelectTeam) {
        alert("No tienes permiso para acceder a este equipo.");
        this.render();
        return;
      }
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

      // Sincroniza cambios de alcance/rol de temporada hechos con la sesion abierta.
      await this.refreshAuthenticatedAuthorizationContext({ reason: "season_change" });

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
      window.onhashchange = async () => {
        if (window.hasUnsavedChanges) {
          const confirmLeave = confirm("⚠️ Tienes cambios sin guardar. Si cambias de pantalla se perderán las modificaciones. ¿Deseas salir sin guardar?");
          if (!confirmLeave) {
            window.location.hash = `#/${this.currentRoute}`;
            return;
          }
          window.hasUnsavedChanges = false;
        }

        await this.parseHashRoute();
        await this.render();
      };
    }
  }

  async parseHashRoute() {
    const rawHash = window.location.hash.replace("#/", "").trim();
    if (!rawHash) {
      this.currentRoute = "dashboard";
      this.routeParams = {};
      return;
    }

    const parts = rawHash.split("/");
    const targetRoute = parts[0].toLowerCase();
    
    // Guarda centralizada por permiso. En modo simulación usa el rol de previsualización.
    let requiredPermission = ROUTE_PERMISSIONS[targetRoute];
    const authenticatedRole = this.permissionService.getAuthenticatedRole();
    if (['player360', 'player-360', 'desarrollo-jugador'].includes(targetRoute)) {
      if (authenticatedRole === UserRole.JUGADOR) requiredPermission = Permission.VIEW_OWN_PLAYER_360;
      if (authenticatedRole === UserRole.FAMILIA_TUTOR) requiredPermission = Permission.VIEW_LINKED_PLAYER_360;
    }
    const routePlayerId = [
      "player360", "player-360", "desarrollo-jugador", "nutrition", "nutricion"
    ].includes(targetRoute)
      ? parts[1] || null
      : null;
    const routeContext = {
      teamId: this.teamId || DataStore.getActiveTeamId?.() || null,
      teamSeasonId: DataStore.getActiveTeamSeasonId?.() || null,
      playerId: routePlayerId,
      playerTeamId: this.teamId || DataStore.getActiveTeamId?.() || null
    };
    if (requiredPermission && this.isAuthenticated) {
      let canNavigate = this.permissionService.canPreview(requiredPermission, routeContext);

      // Una sesion larga puede conservar un alcance anterior a una invitacion,
      // asignacion o cambio de temporada. Revalidamos una vez antes de denegar.
      if (!canNavigate) {
        await this.refreshAuthenticatedAuthorizationContext({ reason: `route:${targetRoute}` });
        canNavigate = this.permissionService.canPreview(requiredPermission, routeContext);
      }

      if (!canNavigate) {
        alert("Tu perfil no tiene acceso a esta seccion. Has sido redirigido al Dashboard.");
        window.location.hash = "#/dashboard";
        this.currentRoute = "dashboard";
        this.routeParams = {};
        return;
      }
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
        <div style="padding: 24px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; font-family: var(--font-family-base, system-ui);">
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

    // 1. El rol visual se resolverá de nuevo tras cargar el contexto activo.
    this.userRole = this.permissionService.getEffectiveRole({
      teamId: this.teamId || DataStore.getActiveTeamId?.() || null,
      teamSeasonId: DataStore.getActiveTeamSeasonId?.() || null
    });
    const userEmail = this.permissionService.getCurrentUser()?.email || "";

    // 2. Equipos visibles según alcance autenticado (no según localStorage).
    const allTeams = DataStore.getTeams() || [];
    const allowedTeams = this.permissionService.getAuthenticatedRole() === UserRole.SUPERADMIN
      ? allTeams
      : allTeams.filter(t => this.permissionService.canAccessTeam(t.id));

    let storedActiveTeamId = localStorage.getItem("iq_active_team_id");
    
    if (this.permissionService.getAuthenticatedRole() !== UserRole.SUPERADMIN && allowedTeams.length > 0) {
      const isAuthorized = allowedTeams.some(t => String(t.id) === String(storedActiveTeamId));
      if (!isAuthorized) {
        storedActiveTeamId = allowedTeams[0].id;
        localStorage.setItem("iq_active_team_id", storedActiveTeamId);
      }
    }

    this.teamId = storedActiveTeamId || this.teamId;

    if (!DataStore.isLoaded || DataStore.getActiveTeamId() !== this.teamId) {
      this.showLoadingOverlay("preload_title");
      await DataStore.init(this.teamId, true);
    }

    this.userRole = this.permissionService.getEffectiveRole({
      teamId: this.teamId || DataStore.getActiveTeamId?.() || null,
      teamSeasonId: DataStore.getActiveTeamSeasonId?.() || null
    });

    appContainer.innerHTML = LayoutView.wrap(
      `<div id="dashboard-content-area"></div>`, 
      this.currentRoute, 
      this.userRole
    );

    LayoutView.bindMobileDrawerEvents();
    this.bindLayoutEvents();
    LayoutView.updateActiveMenu(this.currentRoute);

    const route = this.currentRoute;
    const contentArea = "dashboard-content-area";

    switch (route) {
      case "dashboard":
        if (this.views.dashboard) await this.views.dashboard.render(contentArea, this.teamId);
        break;

      case "team":
      case "equipo": {
        const view = await this.lazyViews.get("team");
        await view.render(contentArea, this.teamId);
        break;
      }

      // MODO ANOTACIÓN EN VIVO (HUD PRO)
      case "live":
      case "hud":
      case "live-hud":
      case "easy-entry":
      case "easy":
      case "entrada-facil":
      case "live-entry":
        const liveView = await this.lazyViews.create("livehud", {
          gameId: this.routeParams.id || null
        });
        await liveView.render(contentArea);
        break;

      case "approvals":
      case "requests":
      case "solicitudes":
      case "bandeja":
        if (this.views.approvals) await this.views.approvals.render(contentArea);
        break;

      case "games":
      case "partidos":
      case "game": {
        const view = await this.lazyViews.get("liveeditor");
        await view.render(contentArea, this.routeParams.id, this.teamId);
        break;
      }

      case "advanced": {
        const view = await this.lazyViews.get("advanced");
        await view.render(contentArea);
        break;
      }

      case "heatmap":
      case "calor":
      case "shotchart": {
        const view = await this.lazyViews.get("heatmap");
        await view.render(contentArea, this.teamId);
        break;
      }

      case "boxscore":
      case "registro": {
        const view = await this.lazyViews.get("boxscore");
        await view.render(contentArea, this.routeParams.id);
        break;
      }

      case "players":
      case "jugadores":
      case "player":
      case "jugador": {
        const view = await this.lazyViews.get("player");
        await view.render(contentArea, this.routeParams.id, this.teamId);
        break;
      }

      case "lineups":
      case "quintetos": {
        const view = await this.lazyViews.get("lineups");
        await view.render(contentArea);
        break;
      }

      case "training":
      case "entrenamientos":
      case "development":
      case "desarrollo": {
        const view = await this.lazyViews.get("training");
        await view.render(contentArea, this.teamId);
        break;
      }

      case "nutrition":
      case "nutricion": {
        const view = await this.lazyViews.get("nutrition");
        await view.render(contentArea, this.routeParams.id, this.teamId);
        break;
      }

      case "player360":
      case "player-360":
      case "desarrollo-jugador": {
        const view = await this.lazyViews.get("player360");
        await view.render(contentArea, this.routeParams.id, this.teamId);
        break;
      }


      case "comparator":
      case "comparador": {
        const view = await this.lazyViews.get("comparator");
        await view.render(contentArea);
        break;
      }

      case "reports":
      case "informes":
      case "informe": {
        const view = await this.lazyViews.get("reports");
        await view.render(contentArea);
        break;
      }

      case "family":
      case "familia":
      case "familias": {
        const view = await this.lazyViews.get("familyworkspace");
        await view.render(contentArea, this.routeParams);
        break;
      }

      case "family-advisor":
      case "bienestar":
      case "advisor": {
        const view = await this.lazyViews.get("familyadvisor");
        await view.render(contentArea);
        break;
      }

      case "business":
      case "negocio": {
        const view = await this.lazyViews.get("business");
        await view.render(contentArea);
        break;
      }

      case "ask":
      case "ask-ai":
      case "pregunta":
      case "preguntale":
      case "ai":
      case "ia": {
        const view = await this.lazyViews.get("ask");
        await view.render(contentArea);
        break;
      }

      case "profile":
      case "perfil": {
        const view = await this.lazyViews.get("profile");
        await view.render(contentArea);
        break;
      }

      case "privacy":
      case "privacy-center":
      case "privacidad": {
        const view = await this.lazyViews.get("privacy");
        await view.render(contentArea);
        break;
      }

      case "settings":
      case "configuracion":
      case "translations": {
        const view = await this.lazyViews.get("settings");
        await view.render(contentArea);
        break;
      }

      default:
        this.renderPlaceholder(`Módulo ${route.toUpperCase()}`);
        break;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const recoveryMarker = new URLSearchParams(window.location.search).get("recovery") === "1"
    || /(?:^|[&#])type=recovery(?:&|$)/i.test(window.location.hash || "");
  if (recoveryMarker) window.__IQ_PASSWORD_RECOVERY__ = true;

  const app = new IQBasketApp();
  window.iqApp = app;
  await app.restoreAuthenticatedSession();
  await app.parseHashRoute();
  await app.render();

  if (recoveryMarker) {
    const { PasswordRecoveryCoordinator } = await import("./features/auth/PasswordRecoveryCoordinator.js");
    await new PasswordRecoveryCoordinator().openRecoveryFromCallback();
  }
});

export default IQBasketApp;
