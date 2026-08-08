/**
 * @fileoverview Vista de Autenticación / Login de IQ Basket.
 * Soporta visualización/ocultamiento de contraseña con toque táctil accesible (44px),
 * manejo de errores visuales e internacionalización i18n completa mediante I18nService.
 */

import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { APP_CONFIG } from "../config/app.config.js";

export class AuthView {
  t(key, fallback = "") {
    return TranslationStore.t(key, fallback);
  }

  render(params = {}) {
    const errorMessage = params.errorMessage 
      ? I18n.t("auth.error", {}, params.errorMessage)
      : "";

    const errorMarkup = errorMessage 
      ? `<div style="background-color: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 12px; border-radius: 8px; font-size: 12px; margin-bottom: 16px; font-weight: 600;">${errorMessage}</div>`
      : "";

    return `
      <div style="min-height: 100vh; background-color: var(--color-bg, #f8fafc); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; font-family: var(--font-family-base, system-ui);">
        
        <!-- Logotipo Superior -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 64px; height: 64px; background-color: var(--color-secondary, #0f172a); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
            <span style="font-size: 32px;">🏀</span>
          </div>
          <h1 style="font-size: 26px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.02em;">${APP_CONFIG.appName}</h1>
          <p style="font-size: 13px; color: #64748b; margin-top: 4px;">${this.t("app_tagline", "Análisis estadístico de baloncesto")}</p>
        </div>

        <!-- Tarjeta de Formulario -->
        <div class="card" style="width: 100%; max-width: 420px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); box-sizing: border-box;">
          
          <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 20px;">
            ${this.t("login_title", "Iniciar sesión")}
          </h2>

          <div id="login-error-container">${errorMarkup}</div>

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
                value="scolado@nechigroup.com"
                style="width: 100%; height: 44px; padding: 10px 12px; background-color: #f0f7ff; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; color: #0f172a; outline: none; box-sizing: border-box;"
              />
            </div>

            <!-- Campo Contraseña con Ojo Visto/Oculto -->
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label for="login-password" style="display: block; font-size: 12px; font-weight: 700; color: #334155;">
                ${this.t("password_label", "Contraseña")} *
              </label>
              <div style="position: relative; display: flex; align-items: center; width: 100%;">
                <input
                  id="login-password"
                  type="password"
                  required
                  value="12345678"
                  style="width: 100%; height: 44px; padding: 10px 48px 10px 12px; background-color: #f0f7ff; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; color: #0f172a; outline: none; box-sizing: border-box;"
                />
                <button
                  type="button"
                  id="toggle-password-btn"
                  style="position: absolute; right: 4px; background: none; border: none; cursor: pointer; color: #64748b; font-size: 16px; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;"
                  title="${this.t("toggle_password_title", "Mostrar/Ocultar contraseña")}"
                  aria-label="Mostrar u ocultar contraseña"
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

          <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; display: flex; flex-direction: column; gap: 10px;">
            <a href="#" style="font-size: 12px; color: #2563eb; font-weight: 700; text-decoration: none; min-height: 36px; display: inline-flex; align-items: center; justify-content: center;">
              ${this.t("request_superadmin_access", "¿No tienes cuenta? Solicita acceso al Superadmin")}
            </a>
            <a href="#" style="font-size: 12px; color: #94a3b8; text-decoration: none; min-height: 36px; display: inline-flex; align-items: center; justify-content: center;">
              ${this.t("forgot_password", "¿Olvidaste tu contraseña?")}
            </a>
          </div>

        </div>
      </div>
    `;
  }
}

export default AuthView;