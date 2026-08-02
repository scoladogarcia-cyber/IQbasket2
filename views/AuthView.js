/**
 * @fileoverview Vista de Autenticación / Login con soporte para mostrar/ocultar contraseña.
 */

import { i18n } from "../core-modules/i18n/I18nEngine.js";

export class AuthView {
  t(key, fallback) {
    const val = i18n.t(key);
    return (!val || val === key) ? fallback : val;
  }

  render(params = {}) {
    const errorMarkup = params.errorMessage 
      ? `<div style="background-color: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 12px; border-radius: 8px; font-size: 12px; margin-bottom: 16px;">${params.errorMessage}</div>`
      : "";

    return `
      <div style="min-height: 100vh; background-color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; font-family: system-ui, -apple-system, sans-serif;">
        
        <!-- Logotipo Superior -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 64px; height: 64px; background-color: #1e3a8a; border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
            <span style="font-size: 32px;">🏆</span>
          </div>
          <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0;">BasketIQ</h1>
          <p style="font-size: 13px; color: #64748b; margin-top: 4px;">${this.t("app_tagline", "Análisis estadístico de baloncesto")}</p>
        </div>

        <!-- Tarjeta de Formulario -->
        <div style="width: 100%; max-width: 420px; background-color: #ffffff; border-radius: 16px; border: 1px solid #f1f5f9; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); box-sizing: border-box;">
          
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 20px;">
            ${this.t("login_title", "Iniciar sesión")}
          </h2>

          <div id="login-error-container">${errorMarkup}</div>

          <form id="login-form" style="display: flex; flex-direction: column; gap: 18px;">
            
            <!-- Campo Email -->
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                ${this.t("email_label", "Mail de acceso")} *
              </label>
              <input
                id="login-email"
                type="email"
                required
                value="scolado@nechigroup.com"
                style="width: 100%; padding: 10px 12px; background-color: #f0f7ff; border: 1px solid #e0f2fe; border-radius: 10px; font-size: 13px; color: #0f172a; outline: none; box-sizing: border-box;"
              />
            </div>

            <!-- Campo Contraseña con Ojo Visto/Oculto -->
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                ${this.t("password_label", "Contraseña")} *
              </label>
              <div style="position: relative; display: flex; align-items: center;">
                <input
                  id="login-password"
                  type="password"
                  required
                  value="12345678"
                  style="width: 100%; padding: 10px 40px 10px 12px; background-color: #f0f7ff; border: 1px solid #e0f2fe; border-radius: 10px; font-size: 13px; color: #0f172a; outline: none; box-sizing: border-box;"
                />
                <button
                  type="button"
                  id="toggle-password-btn"
                  style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; color: #64748b; font-size: 16px; padding: 4px;"
                  title="Mostrar/Ocultar contraseña"
                >
                  👁️
                </button>
              </div>
            </div>

            <!-- Botón Entrar -->
            <button
              id="login-submit-btn"
              type="submit"
              style="width: 100%; padding: 12px; background-color: #1e3a8a; color: #ffffff; font-weight: 600; border-radius: 10px; border: none; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 6px;"
            >
              ➔ ${this.t("enter_button", "Entrar")}
            </button>
          </form>

          <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; display: flex; flex-direction: column; gap: 8px;">
            <a href="#" style="font-size: 12px; color: #1e3a8a; font-weight: 600; text-decoration: none;">
              ${this.t("request_superadmin_access", "¿No tienes cuenta? Solicita acceso al Superadmin")}
            </a>
            <a href="#" style="font-size: 12px; color: #94a3b8; text-decoration: none;">
              ${this.t("forgot_password", "¿Olvidaste tu contraseña?")}
            </a>
          </div>

        </div>
      </div>
    `;
  }
}