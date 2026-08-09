/**
 * @fileoverview Vista de Autenticación / Login / Registro de IQ Basket (AuthView.js).
 * Incluye selector global de idioma accesible en la parte superior.
 * Incluye fallbacks en texto plano para garantizar que NUNCA se muestren claves desnudas al arrancar.
 * Soporta alternancia fluida entre Inicio de Sesión y Alta Nueva (Registro Público).
 * Los usuarios registrados públicamente reciben el rol INVITADO (Solo Lectura) por defecto.
 */

import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { APP_CONFIG } from "../config/app.config.js";

export class AuthView {
  constructor() {
    this.activeTab = "login";
  }

  t(key, fallback = "") {
    return TranslationStore.t(key, fallback);
  }

  render(params = {}) {
    const currentLang = localStorage.getItem("iq_lang") || "es";
    const errorMessage = params.errorMessage 
      ? I18n.t("auth.error", {}, params.errorMessage)
      : "";

    const errorMarkup = errorMessage 
      ? `<div style="background-color: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 12px; border-radius: 8px; font-size: 12px; margin-bottom: 16px; font-weight: 600;">${errorMessage}</div>`
      : "";

    return `
      <div style="min-height: 100vh; background-color: var(--color-bg, #f8fafc); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; font-family: var(--font-family-base, system-ui); position: relative;">
        
        <!-- Selector Global de Idioma en la esquina superior derecha -->
        <div style="position: absolute; top: 16px; right: 20px; display: flex; align-items: center; gap: 8px; background: white; padding: 6px 12px; border-radius: 20px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <span style="font-size: 14px;">🌐</span>
          <select id="auth-lang-toggle" style="border: none; background: transparent; font-size: 12px; font-weight: 800; color: #334155; outline: none; cursor: pointer;">
            <option value="es" ${currentLang === 'es' ? 'selected' : ''}>Español (ES)</option>
            <option value="ca" ${currentLang === 'ca' || currentLang === 'cat' ? 'selected' : ''}>Català (CAT)</option>
            <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English (EN)</option>
            <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>Français (FR)</option>
          </select>
        </div>

        <!-- Logotipo Superior -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 64px; height: 64px; background-color: var(--color-secondary, #0f172a); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
            <span style="font-size: 32px;">🏀</span>
          </div>
          <h1 style="font-size: 26px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.02em;">${APP_CONFIG.appName}</h1>
          <p style="font-size: 13px; color: #64748b; margin-top: 4px;">${this.t("app_tagline", "Análisis estadístico de baloncesto")}</p>
        </div>

        <!-- Tarjeta de Formulario -->
        <div class="card" style="width: 100%; max-width: 440px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 28px 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); box-sizing: border-box;">
          
          <!-- Pestañas de Navegación -->
          <div style="display: flex; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px;">
            <button
              type="button"
              id="tab-btn-login"
              style="flex: 1; padding: 10px; background: none; border: none; font-size: 13px; font-weight: 800; cursor: pointer; color: ${this.activeTab === 'login' ? '#1e3a8a' : '#64748b'}; border-bottom: 3px solid ${this.activeTab === 'login' ? '#1e3a8a' : 'transparent'}; margin-bottom: -2px;"
            >
              ${this.t("login_title", "Iniciar sesión")}
            </button>
            <button
              type="button"
              id="tab-btn-register"
              style="flex: 1; padding: 10px; background: none; border: none; font-size: 13px; font-weight: 800; cursor: pointer; color: ${this.activeTab === 'register' ? '#1e3a8a' : '#64748b'}; border-bottom: 3px solid ${this.activeTab === 'register' ? '#1e3a8a' : 'transparent'}; margin-bottom: -2px;"
            >
              ${this.t("register_tab", "Alta Nueva (Registro)")}
            </button>
          </div>

          <div id="login-error-container">${errorMarkup}</div>

          <!-- 1. FORMULARIO DE INICIO DE SESIÓN -->
          ${this.activeTab === 'login' ? `
            <form id="login-form" style="display: flex; flex-direction: column; gap: 18px;">
              
              <!-- Campo Email -->
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label for="login-email" style="display: block; font-size: 12px; font-weight: 700; color: #334155;">
                  ${this.t("email_label", "Mail de acceso")} *
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="scolado@nechigroup.com"
                  style="width: 100%; height: 44px; padding: 10px 12px; background-color: #f0f7ff; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; color: #0f172a; outline: none; box-sizing: border-box;"
                />
              </div>

              <!-- Campo Contraseña -->
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label for="login-password" style="display: block; font-size: 12px; font-weight: 700; color: #334155;">
                  ${this.t("password_label", "Contraseña")} *
                </label>
                <div style="position: relative; display: flex; align-items: center; width: 100%;">
                  <input
                    id="login-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    style="width: 100%; height: 44px; padding: 10px 48px 10px 12px; background-color: #f0f7ff; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; color: #0f172a; outline: none; box-sizing: border-box;"
                  />
                  <button
                    type="button"
                    class="pwd-toggle-btn"
                    data-target="login-password"
                    style="position: absolute; right: 4px; background: none; border: none; cursor: pointer; color: #64748b; font-size: 16px; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;"
                    title="${this.t("toggle_password_title", "Mostrar/Ocultar contraseña")}"
                  >
                    👁️
                  </button>
                </div>
              </div>

              <!-- Botón Entrar -->
              <button
                id="login-submit-btn"
                type="submit"
                style="width: 100%; height: 44px; background-color: var(--color-primary, #ea580c); color: #ffffff; font-weight: 800; border-radius: 10px; border: none; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 6px;"
              >
                ➔ ${this.t("enter_button", "Entrar")}
              </button>
            </form>

            <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: center; display: flex; flex-direction: column; gap: 8px;">
              <button type="button" id="btn-switch-to-register" style="background: none; border: none; font-size: 12px; color: #2563eb; font-weight: 700; cursor: pointer; min-height: 36px;">
                ${this.t("new_registration", "Alta nueva (Crear cuenta)")}
              </button>
              <a href="#" style="font-size: 12px; color: #94a3b8; text-decoration: none; min-height: 36px; display: inline-flex; align-items: center; justify-content: center;">
                ${this.t("forgot_password", "¿Olvidaste tu contraseña?")}
              </a>
            </div>
          ` : ''}

          <!-- 2. FORMULARIO DE ALTA NUEVA / REGISTRO -->
          ${this.activeTab === 'register' ? `
            <form id="register-form" style="display: flex; flex-direction: column; gap: 14px;">
              
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 12px; border-radius: 8px; font-size: 11px; color: #166534; font-weight: 600;">
                ℹ️ ${this.t("register_subtitle", "Obtendrás acceso en modo INVITADO (Solo Lectura para Demo).")}
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label for="reg-firstname" style="font-size: 11px; font-weight: 700; color: #334155;">
                    ${this.t("first_name", "Nombre")} *
                  </label>
                  <input id="reg-firstname" type="text" required placeholder="Ej. Carlos" style="height: 40px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label for="reg-lastname" style="font-size: 11px; font-weight: 700; color: #334155;">
                    ${this.t("last_name", "Apellidos")} *
                  </label>
                  <input id="reg-lastname" type="text" required placeholder="Ej. García" style="height: 40px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="reg-email" style="font-size: 11px; font-weight: 700; color: #334155;">
                  ${this.t("email_label", "Correo Electrónico")} *
                </label>
                <input id="reg-email" type="email" required placeholder="usuario@ejemplo.com" style="height: 40px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
              </div>

              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="reg-password" style="font-size: 11px; font-weight: 700; color: #334155;">
                  ${this.t("password_label", "Contraseña")} *
                </label>
                <div style="position: relative; display: flex; align-items: center; width: 100%;">
                  <input id="reg-password" type="password" required placeholder="Mínimo 6 caracteres" minlength="6" style="width: 100%; height: 40px; padding: 8px 40px 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;" />
                  <button type="button" class="pwd-toggle-btn" data-target="reg-password" style="position: absolute; right: 2px; background: none; border: none; cursor: pointer; color: #64748b; font-size: 14px; padding: 8px;">👁️</button>
                </div>
              </div>

              <input type="hidden" id="reg-role" value="INVITADO" />

              <button
                id="register-submit-btn"
                type="submit"
                style="width: 100%; height: 44px; background-color: #1e3a8a; color: #ffffff; font-weight: 800; border-radius: 10px; border: none; font-size: 13px; cursor: pointer; margin-top: 8px;"
              >
                📝 ${this.t("register_button", "Completar Registro (Invitado)")}
              </button>
            </form>

            <div style="margin-top: 16px; text-align: center;">
              <button type="button" id="btn-switch-to-login" style="background: none; border: none; font-size: 12px; color: #2563eb; font-weight: 700; cursor: pointer;">
                ${this.t("already_have_account", "¿Ya tienes una cuenta? Iniciar sesión")}
              </button>
            </div>
          ` : ''}

        </div>
      </div>
    `;
  }
}

export default AuthView;