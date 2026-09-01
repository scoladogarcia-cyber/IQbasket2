/**
 * @fileoverview Vista de "Mi Perfil": ProfileView.js
 * @description Gestión del perfil de usuario y credenciales.
 * Sincronizado en tiempo real con la tabla `user_profiles` de Supabase y Supabase Auth.
 * 
 * Capacidades:
 * 1. Lectura y persistencia de datos personales (nombre, apellidos, teléfono).
 * 2. Visualización protegida de campos inmutables (email, login y rol asignado).
 * 3. Actualización de contraseñas de acceso mediante `supabase.auth.updateUser`.
 * 4. Integración completa con `TranslationStore` e `I18nService` y soporte móvil táctil (44px).
 */

import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { supabase } from "../config/database.config.js";
import { Permission } from "../security/PermissionService.js";

export class ProfileView {
  /**
   * Crea una instancia de ProfileView.
   * @param {Object} [authController=null] - Controlador de autenticación.
   */
  constructor(authController = null) {
    this.auth = authController;
    this.userProfile = null;
    this.isFetching = false;
  }

  t(key, fallback = "") {
    const text = TranslationStore ? TranslationStore.t(key, "") : I18n.t(key);
    if (!text || text === key) {
      return fallback || key;
    }
    return text;
  }

  showSyncOverlay(message = "⚡ Sincronizando con Supabase...") {
    let overlay = document.getElementById("sync-loading-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "sync-loading-overlay";
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(4px);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 9999; color: white; font-family: var(--font-family-base, system-ui);
      `;
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div style="width: 48px; height: 48px; border: 4px solid var(--color-primary, #f97316); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800;">${message}</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">Guardando cambios en la Base de Datos...</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    overlay.style.display = "flex";
  }

  hideSyncOverlay() {
    const overlay = document.getElementById("sync-loading-overlay");
    if (overlay) overlay.style.display = "none";
  }

  /**
   * Consulta en tiempo real el perfil del usuario activo en la tabla `user_profiles`.
   */
  async _fetchUserProfile(email) {
    try {
      this.isFetching = true;
      if (!supabase) return;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id,email,first_name,last_name,phone,role,status,assigned_team_ids,linked_player_id,created_at")
        .eq("email", email)
        .maybeSingle();

      if (!error && data) {
        this.userProfile = data;
        if (data.first_name) localStorage.setItem("iq_user_name", data.first_name);
        if (data.last_name) localStorage.setItem("iq_user_lastname", data.last_name);
        if (data.phone) localStorage.setItem("iq_user_phone", data.phone);
      }
    } catch (err) {
      console.warn("Nota leyendo perfil desde user_profiles:", err);
    } finally {
      this.isFetching = false;
    }
  }

  _bindPasswordToggles(container) {
    container.querySelectorAll(".pwd-toggle-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute("data-target");
        const input = container.querySelector(`#${targetId}`);
        if (input) {
          const isPassword = input.type === "password";
          input.type = isPassword ? "text" : "password";
          btn.textContent = isPassword ? "🙈" : "👁️";
        }
      });
    });
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;

    const authenticatedUser = this.auth?.getCurrentUser?.();
    const userEmail = authenticatedUser?.email || "";

    if (!this.userProfile && !this.isFetching) {
      await this._fetchUserProfile(userEmail);
    }

    const userRole = this.auth?.getAuthenticatedRole?.() || "INVITADO";
    const userName = this.userProfile?.first_name || localStorage.getItem("iq_user_name") || "Usuario";
    const userLastName = this.userProfile?.last_name || localStorage.getItem("iq_user_lastname") || "IQ";
    const userPhone = this.userProfile?.phone || localStorage.getItem("iq_user_phone") || "";
    const userLogin = userEmail.split("@")[0];
    const initial = userName.charAt(0).toUpperCase() || "U";

    container.innerHTML = `
      <div class="profile-container">
        
        <!-- HEADER AZUL DEL PERFIL -->
        <div class="profile-header-card">
          <div class="avatar-circle-lg">${initial}</div>
          <div class="header-info">
            <h2>${userName} ${userLastName}</h2>
            <p>${userEmail}</p>
            <span class="badge-role-header">${this.t("profile_role_label", "ROL ASIGNADO:")} ${userRole} (${this.t("not_editable", "NO CAMBIABLE")})</span>
          </div>
        </div>

        <!-- 1. DATOS DEL PERFIL -->
        <div class="profile-card card">
          <div class="card-title">
            <span>👤</span> ${this.t("profile_data_title", "DATOS DEL PERFIL").toUpperCase()}
          </div>
          <form id="form-profile-data" class="grid-2-cols">
            <div class="form-group">
              <label for="input-profile-name">${this.t("first_name", "Nombre")} *</label>
              <input type="text" id="input-profile-name" value="${userName}" required />
            </div>
            <div class="form-group">
              <label for="input-profile-lastname">${this.t("last_name", "Apellidos")} *</label>
              <input type="text" id="input-profile-lastname" value="${userLastName}" required />
            </div>
            <div class="form-group">
              <label for="input-profile-phone">${this.t("phone", "Teléfono de Contacto")}</label>
              <input type="text" id="input-profile-phone" value="${userPhone}" placeholder="Ej. +34 600 000 000" />
            </div>
            <div class="form-group">
              <label for="input-profile-email">${this.t("email", "Correo Electrónico")}</label>
              <input type="email" id="input-profile-email" value="${userEmail}" required disabled class="input-disabled-highlight" />
            </div>
            <div class="form-group">
              <label for="input-profile-login">${this.t("login", "Usuario / Login")}</label>
              <input type="text" id="input-profile-login" value="${userLogin}" disabled class="input-disabled-highlight" />
            </div>
            <div class="form-group">
              <label>${this.t("role_disabled_label", "Rol en el Sistema")}</label>
              <input type="text" value="${userRole}" disabled class="input-disabled-highlight" />
            </div>
            <div style="grid-column: 1 / -1; text-align: right; margin-top: 10px;">
              <button type="submit" class="btn-primary-blue">💾 ${this.t("save_profile", "Guardar Perfil")}</button>
            </div>
          </form>
        </div>

        <!-- 2. CAMBIO DE CONTRASEÑA -->
        <div class="profile-card card">
          <div class="card-title">
            <span>🔑</span> ${this.t("change_password_title", "CAMBIAR CONTRASEÑA").toUpperCase()}
          </div>
          <form id="form-change-password" class="grid-2-cols">
            <div class="form-group">
              <label for="input-new-password">${this.t("new_password", "Nueva Contraseña")}</label>
              <div class="input-password-wrapper">
                <input type="password" id="input-new-password" placeholder="${this.t("new_password_placeholder", "Escribe la nueva contraseña")}" />
                <button type="button" class="pwd-toggle-btn" data-target="input-new-password" title="Ver/Ocultar" aria-label="Ver u ocultar contraseña">👁️</button>
              </div>
            </div>
            <div class="form-group">
              <label for="input-repeat-password">${this.t("repeat_password", "Repetir Nueva Contraseña")}</label>
              <div class="input-password-wrapper">
                <input type="password" id="input-repeat-password" placeholder="${this.t("repeat_password_placeholder", "Repite la nueva contraseña")}" />
                <button type="button" class="pwd-toggle-btn" data-target="input-repeat-password" title="Ver/Ocultar" aria-label="Ver u ocultar contraseña">👁️</button>
              </div>
            </div>
            <div style="grid-column: 1 / -1; text-align: right; margin-top: 10px;">
              <button type="submit" class="btn-secondary-purple">🔒 ${this.t("change_password_btn", "Actualizar Contraseña")}</button>
            </div>
          </form>
        </div>

        <!-- 3. ALCANCE Y EQUIPOS ASIGNADOS -->
        <div class="profile-card card">
          <div class="card-title">
            <span>🛡️</span> ${this.t("assigned_teams_title", "EQUIPOS ASIGNADOS").toUpperCase()}
          </div>
          <div class="assigned-info-box">
            ${userRole === 'SUPERADMIN' 
              ? 'Como SUPERADMIN tienes acceso global y completo a todos los equipos y temporadas.' 
              : (userRole === 'INVITADO'
                  ? 'Acceso en modo INVITADO (Solo Lectura para Demostración).'
                  : 'Acceso técnico asignado al equipo activo actual.')}
          </div>
        </div>

      </div>

      <style>
        .profile-container {
          max-width: 950px;
          margin: 0 auto;
          font-family: var(--font-family-base, system-ui);
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding-bottom: 40px;
        }

        .profile-header-card {
          background: var(--color-secondary, #0f172a);
          color: white;
          border-radius: var(--radius-lg, 12px);
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .avatar-circle-lg {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--color-primary, #f97316);
          color: white;
          font-weight: 900;
          font-size: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 2px solid #fdba74;
        }

        .header-info h2 {
          margin: 0 0 4px 0;
          font-size: 20px;
          font-weight: 800;
        }

        .header-info p {
          margin: 0 0 10px 0;
          font-size: 13px;
          color: #bfdbfe;
        }

        .badge-role-header {
          background: #f59e0b;
          color: #1e293b;
          font-size: 10px;
          font-weight: 900;
          padding: 4px 10px;
          border-radius: 20px;
          letter-spacing: 0.03em;
        }

        .profile-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: var(--radius-lg, 12px);
          padding: 20px 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }

        .card-title {
          font-size: 12px;
          font-weight: 800;
          color: #1e3a8a;
          letter-spacing: 0.04em;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .grid-2-cols {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
        }

        .form-group input {
          padding: 10px 14px;
          border: 1px solid #dbeafe;
          background: #f0f9ff;
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          color: #0f172a;
          min-height: 44px;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          border-color: var(--color-primary, #f97316);
          background: white;
        }

        .input-disabled-highlight {
          background: #f1f5f9 !important;
          color: #1e3a8a !important;
          font-weight: 800 !important;
          border-color: #cbd5e1 !important;
        }

        .input-password-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .input-password-wrapper input {
          width: 100%;
          padding-right: 48px;
          background: white;
          border-color: #cbd5e1;
        }

        .pwd-toggle-btn {
          position: absolute;
          right: 4px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 8px;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
        }

        .pwd-toggle-btn:hover {
          opacity: 1;
        }

        .btn-primary-blue {
          background: var(--color-secondary, #0f172a);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          min-height: 44px;
          transition: background 0.2s;
        }

        .btn-primary-blue:hover {
          background: #1e3a8a;
        }

        .btn-secondary-purple {
          background: #818cf8;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          min-height: 44px;
          transition: background 0.2s;
        }

        .btn-secondary-purple:hover {
          background: #6366f1;
        }

        .assigned-info-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #15803d;
          padding: 14px 18px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        @media (max-width: 767px) {
          .profile-header-card {
            flex-direction: column;
            text-align: center;
          }
        }
      </style>
    `;

    this._bindPasswordToggles(container);

    container.querySelector("#form-profile-data")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!this.auth?.can?.(Permission.EDIT_OWN_PROFILE)) {
        alert("⚠️ No tienes permiso para modificar este perfil.");
        return;
      }
      const name = container.querySelector("#input-profile-name")?.value.trim();
      const lastname = container.querySelector("#input-profile-lastname")?.value.trim();
      const phone = container.querySelector("#input-profile-phone")?.value.trim();

      if (!name || !lastname) {
        alert("⚠️ El nombre y los apellidos son obligatorios.");
        return;
      }

      this.showSyncOverlay("💾 Guardando perfil en Supabase...");

      try {
        if (!supabase) throw new Error("Cliente Supabase no configurado");
        const { data, error } = await supabase
          .from("user_profiles")
          .update({
            first_name: name,
            last_name: lastname,
            phone: phone
          })
          .eq("email", userEmail)
          .select();

        if (error) {
          this.hideSyncOverlay();
          alert(`❌ Error al actualizar perfil en Supabase: ${error.message}`);
          return;
        }

        localStorage.setItem("iq_user_name", name);
        localStorage.setItem("iq_user_lastname", lastname);
        localStorage.setItem("iq_user_phone", phone);

        if (data && data.length > 0) {
          this.userProfile = data[0];
        }

        this.hideSyncOverlay();
        alert("✅ Perfil guardado e integrado con éxito en la tabla 'user_profiles'.");
        await this.render(containerId);
      } catch (err) {
        this.hideSyncOverlay();
        console.error("Error guardando perfil:", err);
        alert(`❌ Error al conectar con Supabase: ${err.message}`);
      }
    });

    container.querySelector("#form-change-password")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!this.auth?.can?.(Permission.CHANGE_OWN_PASSWORD)) {
        alert("⚠️ No tienes permiso para cambiar la contraseña.");
        return;
      }
      const pass1 = container.querySelector("#input-new-password")?.value;
      const pass2 = container.querySelector("#input-repeat-password")?.value;

      if (!pass1 || !pass2) {
        alert("⚠️ Por favor, introduce y repite la nueva contraseña.");
        return;
      }

      if (pass1 !== pass2) {
        alert("❌ Las contraseñas no coinciden. Por favor, verifícalas.");
        return;
      }

      if (pass1.length < 6) {
        alert("⚠️ La contraseña debe tener al menos 6 caracteres.");
        return;
      }

      this.showSyncOverlay("🔒 Actualizando contraseña en Supabase Auth...");

      try {
        if (!supabase) throw new Error("Cliente Supabase no configurado");
        const { error } = await supabase.auth.updateUser({
          password: pass1
        });

        if (error) {
          this.hideSyncOverlay();
          alert(`❌ Error al cambiar la contraseña en Supabase Auth: ${error.message}`);
          return;
        }

        this.hideSyncOverlay();
        alert("🔑 Contraseña actualizada con éxito en tu cuenta de Supabase Auth.");
        const p1 = container.querySelector("#input-new-password");
        const p2 = container.querySelector("#input-repeat-password");
        if (p1) p1.value = "";
        if (p2) p2.value = "";
      } catch (err) {
        this.hideSyncOverlay();
        console.error("Error actualizando contraseña:", err);
        alert(`❌ Error al conectar con Supabase Auth: ${err.message}`);
      }
    });
  }
}

export default ProfileView;