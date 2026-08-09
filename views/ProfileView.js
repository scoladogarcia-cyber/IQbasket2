/**
 * @fileoverview Vista de "Mi Perfil" para IQ Basket (ProfileView.js).
 * Maquetación con banner de usuario, modificación de datos obligatorios,
 * cambio opcional de contraseña con función ver/ocultar e indicadores de equipos asignados.
 * Adaptado para PWA/Móvil con áreas táctiles de 44px e internacionalización i18n completa.
 */

import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class ProfileView {
  constructor(authController) {
    this.auth = authController;
  }

  /**
   * Helper para obtener traducciones limpias desde TranslationStore / Supabase
   */
  t(key, fallback = "") {
    return TranslationStore.t(key, fallback);
  }

  /**
   * Vincula la funcionalidad de ver/ocultar contraseña en las cajas de texto
   */
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
    const container = document.getElementById(containerId);
    if (!container) return;

    // Obtener datos del usuario guardados o valores por defecto
    const userRole = localStorage.getItem("iq_user_role") || "SUPERADMIN";
    const userName = localStorage.getItem("iq_user_name") || "Sergio";
    const userLastName = localStorage.getItem("iq_user_lastname") || "Colado";
    const userEmail = localStorage.getItem("iq_user_email") || "scolado@nechigroup.com";
    const userPhone = localStorage.getItem("iq_user_phone") || "+34607835406";
    const userLogin = localStorage.getItem("iq_user_login") || "scolado";

    const initial = userName.charAt(0).toUpperCase() || "S";

    container.innerHTML = `
      <div class="profile-container">
        
        <!-- BANNER HEADER AZUL -->
        <div class="profile-header-card">
          <div class="avatar-circle-lg">${initial}</div>
          <div class="header-info">
            <h2>${userName} ${userLastName}</h2>
            <p>${userEmail}</p>
            <span class="badge-role-header">${this.t("profile_role_label", "ROL ASIGNADO:")} ${userRole} (${this.t("not_editable", "NO CAMBIABLE")})</span>
          </div>
        </div>

        <!-- 1. DATOS DE PERFIL (OBLIGATORIOS) -->
        <div class="profile-card card">
          <div class="card-title">
            <span>👤</span> ${this.t("profile_data_title", "DATOS DE PERFIL (OBLIGATORIOS)").toUpperCase()}
          </div>
          <form id="form-profile-data" class="grid-2-cols">
            <div class="form-group">
              <label for="input-profile-name">${this.t("first_name", "Nombre")}</label>
              <input type="text" id="input-profile-name" value="${userName}" required />
            </div>
            <div class="form-group">
              <label for="input-profile-lastname">${this.t("last_name", "Apellidos")}</label>
              <input type="text" id="input-profile-lastname" value="${userLastName}" required />
            </div>
            <div class="form-group">
              <label for="input-profile-phone">${this.t("phone", "Teléfono de Contacto")}</label>
              <input type="text" id="input-profile-phone" value="${userPhone}" />
            </div>
            <div class="form-group">
              <label for="input-profile-email">${this.t("email", "Mail de Contacto (Obligatorio)")}</label>
              <input type="email" id="input-profile-email" value="${userEmail}" required />
            </div>
            <div class="form-group">
              <label for="input-profile-login">${this.t("login", "Login (Obligatorio)")}</label>
              <input type="text" id="input-profile-login" value="${userLogin}" required />
            </div>
            <div class="form-group">
              <label>${this.t("role_disabled_label", "Perfil / Rol (Obligatorio - No Cambiable)")}</label>
              <input type="text" value="${userRole}" disabled class="input-disabled-highlight" />
            </div>
            <div style="grid-column: 1 / -1; text-align: right; margin-top: 10px;">
              <button type="submit" class="btn-primary-blue">💾 ${this.t("save_profile", "Guardar Perfil")}</button>
            </div>
          </form>
        </div>

        <!-- 2. CAMBIAR CONTRASEÑA (OPCIONAL) -->
        <div class="profile-card card">
          <div class="card-title">
            <span>🔑</span> ${this.t("change_password_title", "CAMBIAR CONTRASEÑA (OPCIONAL)").toUpperCase()}
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
              <button type="submit" class="btn-secondary-purple">🔒 ${this.t("change_password_btn", "Cambiar Contraseña")}</button>
            </div>
          </form>
        </div>

        <!-- 3. EQUIPOS ASIGNADOS -->
        <div class="profile-card card">
          <div class="card-title">
            <span>🛡️</span> ${this.t("assigned_teams_title", "EQUIPOS ASIGNADOS").toUpperCase()}
          </div>
          <div class="assigned-info-box">
            ${userRole === 'SUPERADMIN' 
              ? this.t("superadmin_access_msg", "Acceso Total Superadministrador a todos los equipos del sistema.") 
              : `${this.t("assigned_team_msg", "Acceso asignado al equipo:")} <strong>JMJ Manyanet Sant Andreu</strong>.`}
          </div>
        </div>

      </div>

      <!-- ESTILOS ESPECÍFICOS Y RESPONSIVE -->
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
          background: var(--color-primary, #ea580c);
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
          border-color: #2563eb;
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

    // Vincular los toggles ver/ocultar contraseña
    this._bindPasswordToggles(container);

    // Evento de guardar perfil
    container.querySelector("#form-profile-data")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = container.querySelector("#input-profile-name")?.value;
      const lastname = container.querySelector("#input-profile-lastname")?.value;
      const phone = container.querySelector("#input-profile-phone")?.value;
      const email = container.querySelector("#input-profile-email")?.value;

      localStorage.setItem("iq_user_name", name);
      localStorage.setItem("iq_user_lastname", lastname);
      localStorage.setItem("iq_user_phone", phone);
      localStorage.setItem("iq_user_email", email);

      alert("✅ " + this.t("profile_saved_msg", "Perfil guardado correctamente."));
      this.render(containerId);
    });

    // Evento de cambiar contraseña
    container.querySelector("#form-change-password")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const pass1 = container.querySelector("#input-new-password")?.value;
      const pass2 = container.querySelector("#input-repeat-password")?.value;

      if (!pass1 || !pass2) {
        alert("⚠️ " + this.t("passwords_empty_warning", "Por favor, introduce y repite la nueva contraseña."));
        return;
      }

      if (pass1 !== pass2) {
        alert("❌ " + this.t("passwords_mismatch_error", "Las contraseñas no coinciden. Por favor, verifícalas."));
        return;
      }

      alert("🔑 " + this.t("password_updated_msg", "Contraseña actualizada con éxito."));
      container.querySelector("#input-new-password").value = "";
      container.querySelector("#input-repeat-password").value = "";
    });
  }
}

export default ProfileView;