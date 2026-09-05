import { PasswordRecoveryService } from "../../services/security/PasswordRecoveryService.js";
import { supabase } from "../../config/database.config.js";

/**
 * Lazy password-recovery UI and orchestration.
 * Loaded only when recovery is requested or when Supabase returns from a recovery email.
 */
export class PasswordRecoveryCoordinator {
  constructor() {
    this.service = new PasswordRecoveryService(supabase, { minPasswordLength: 8 });
    this.overlay = null;
  }

  _escape(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  _removeOverlay() {
    this.overlay?.remove?.();
    this.overlay = null;
  }

  _render(title, content, { closable = true } = {}) {
    this._removeOverlay();
    const overlay = document.createElement("div");
    overlay.id = "iq-password-recovery-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", title);
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.78);box-sizing:border-box";
    overlay.innerHTML = `
      <div style="width:100%;max-width:430px;max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.28);box-sizing:border-box;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;">
          <div><div style="font-size:26px;margin-bottom:6px;">&#128272;</div><h2 style="margin:0;color:#0f172a;font-size:21px;">${this._escape(title)}</h2></div>
          ${closable ? '<button type="button" id="iq-recovery-close" aria-label="Cerrar" style="min-width:44px;min-height:44px;border:0;background:#f1f5f9;border-radius:12px;font-size:20px;cursor:pointer;">&times;</button>' : ''}
        </div>
        <div id="iq-recovery-message" aria-live="polite"></div>
        ${content}
      </div>`;
    document.body.appendChild(overlay);
    this.overlay = overlay;
    overlay.querySelector("#iq-recovery-close")?.addEventListener("click", () => this._removeOverlay());
    return overlay;
  }

  _message(text, type = "info") {
    const target = this.overlay?.querySelector?.("#iq-recovery-message");
    if (!target) return;
    const palette = type === "error" ? ["#fef2f2", "#b91c1c", "#fecaca"] : ["#f0fdf4", "#166534", "#bbf7d0"];
    target.style.cssText = `display:block;margin:0 0 14px;padding:11px 12px;border-radius:9px;background:${palette[0]};color:${palette[1]};border:1px solid ${palette[2]};font-size:12px;font-weight:700;line-height:1.45;`;
    target.textContent = text;
  }

  _fieldStyle() {
    return "width:100%;height:46px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;box-sizing:border-box;color:#0f172a;background:#fff";
  }

  _primaryButtonStyle() {
    return "width:100%;min-height:48px;border:0;border-radius:11px;background:#f97316;color:#fff;font-weight:800;font-size:14px;cursor:pointer";
  }

  async openRequest({ email = "" } = {}) {
    const safeEmail = this._escape(email);
    const overlay = this._render("Recuperar contraseña", `
      <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.5;">Introduce el correo con el que accedes a IQBasket. Recibirás un enlace seguro para crear una contraseña nueva.</p>
      <form id="iq-recovery-request-form" style="display:flex;flex-direction:column;gap:12px;">
        <label for="iq-recovery-email" style="font-size:12px;font-weight:800;color:#334155;">Correo electrónico</label>
        <input id="iq-recovery-email" type="email" required autocomplete="email" value="${safeEmail}" style="${this._fieldStyle()}" />
        <button id="iq-recovery-send" type="submit" style="${this._primaryButtonStyle()}">Enviar enlace de recuperación</button>
      </form>
      <p style="margin:14px 0 0;color:#64748b;font-size:11px;line-height:1.45;">Por seguridad, IQBasket no indicará si el correo está registrado.</p>
    `);
    const form = overlay.querySelector("#iq-recovery-request-form");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = overlay.querySelector("#iq-recovery-email");
      const button = overlay.querySelector("#iq-recovery-send");
      const value = input?.value || "";
      if (button) button.disabled = true;
      const result = await this.service.requestReset(value);
      if (button) button.disabled = false;

      if (!result.success && result.code === "INVALID_EMAIL") {
        this._message("Introduce un correo electrónico válido.", "error");
        input?.focus?.();
        return;
      }
      if (!result.success && result.code === "RATE_LIMITED") {
        this._message("Has solicitado varios enlaces seguidos. Espera unos minutos y vuelve a intentarlo.", "error");
        return;
      }
      if (!result.success) {
        this._message("No se ha podido enviar el enlace de recuperación. Inténtalo de nuevo.", "error");
        return;
      }
      this._message("Si existe una cuenta con ese correo, recibirás un enlace para crear una contraseña nueva.");
    });
    setTimeout(() => overlay.querySelector("#iq-recovery-email")?.focus?.(), 0);
  }

  async openRecoveryFromCallback() {
    this.service.subscribe(async () => {
      await this.openReset();
    });

    const context = await this.service.inspectRecoveryContext();
    if (context.ready) {
      await this.openReset();
      return true;
    }

    const overlay = this._render("Enlace de recuperación", `
      <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.5;">El enlace no se ha podido validar o ha caducado.</p>
      <button type="button" id="iq-recovery-request-again" style="${this._primaryButtonStyle()}">Solicitar un enlace nuevo</button>
    `, { closable: false });
    this._message("Solicita un enlace nuevo para continuar.", "error");
    overlay.querySelector("#iq-recovery-request-again")?.addEventListener("click", () => this.openRequest());
    return false;
  }

  async openReset() {
    const overlay = this._render("Crear nueva contraseña", `
      <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.5;">El enlace es válido. Define ahora una contraseña nueva para IQBasket.</p>
      <form id="iq-recovery-update-form" style="display:flex;flex-direction:column;gap:12px;">
        <label for="iq-recovery-password" style="font-size:12px;font-weight:800;color:#334155;">Nueva contraseña</label>
        <input id="iq-recovery-password" type="password" required minlength="8" autocomplete="new-password" style="${this._fieldStyle()}" />
        <label for="iq-recovery-confirm" style="font-size:12px;font-weight:800;color:#334155;">Repite la nueva contraseña</label>
        <input id="iq-recovery-confirm" type="password" required minlength="8" autocomplete="new-password" style="${this._fieldStyle()}" />
        <small style="color:#64748b;font-size:11px;">Mínimo 8 caracteres.</small>
        <button id="iq-recovery-save" type="submit" style="${this._primaryButtonStyle()}">Guardar nueva contraseña</button>
      </form>
      <button type="button" id="iq-recovery-cancel" style="width:100%;min-height:44px;margin-top:10px;border:0;background:none;color:#2563eb;font-weight:700;cursor:pointer;">Cancelar y volver al acceso</button>
    `, { closable: false });
    const cancel = async () => {
      await this.service.finishRecovery();
      window.location.reload();
    };
    overlay.querySelector("#iq-recovery-cancel")?.addEventListener("click", cancel);

    overlay.querySelector("#iq-recovery-update-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = overlay.querySelector("#iq-recovery-password")?.value || "";
      const confirmation = overlay.querySelector("#iq-recovery-confirm")?.value || "";
      const button = overlay.querySelector("#iq-recovery-save");

      if (password.length < 8) {
        this._message("La nueva contraseña debe tener al menos 8 caracteres.", "error");
        return;
      }
      if (password !== confirmation) {
        this._message("Las dos contraseñas no coinciden.", "error");
        return;
      }

      if (button) button.disabled = true;
      const result = await this.service.updatePassword(password);
      if (button) button.disabled = false;
      if (!result.success) {
        this._message("No se ha podido actualizar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.", "error");
        return;
      }

      await this.service.finishRecovery();
      const card = overlay.firstElementChild;
      if (card) {
        card.innerHTML = `
          <div style="font-size:32px;margin-bottom:10px;">&#9989;</div>
          <h2 style="margin:0 0 10px;color:#0f172a;font-size:21px;">Contraseña actualizada</h2>
          <p style="margin:0 0 18px;color:#475569;font-size:13px;line-height:1.5;">Ya puedes iniciar sesión con tu nueva contraseña.</p>
          <button type="button" id="iq-recovery-return-login" style="${this._primaryButtonStyle()}">Volver al acceso</button>`;
        card.querySelector("#iq-recovery-return-login")?.addEventListener("click", () => window.location.reload());
      }
    });

    setTimeout(() => overlay.querySelector("#iq-recovery-password")?.focus?.(), 0);
  }

  destroy() {
    this.service.destroy();
    this._removeOverlay();
  }
}

export default PasswordRecoveryCoordinator;

