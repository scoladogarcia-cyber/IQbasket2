import { FeedbackService } from '../services/FeedbackService.js';
import { ReleaseService } from '../services/ReleaseService.js';
import { I18n } from '../services/I18nService.js';

/**
 * @fileoverview Early Access tester feedback surface.
 * @description Gives authenticated testers a low-friction, privacy-aware way to report product feedback.
 */
export class FeedbackView {
  constructor(supabase, authController) {
    this.supabase = supabase;
    this.authController = authController;
    this.service = new FeedbackService(supabase);
    this.release = { release: 'unknown', label: 'early-access' };
  }

  _copy() {
    const locale = String(I18n?.getLocale?.() || 'es').slice(0, 2);
    const copy = {
      es: { title: 'Ayúdanos a mejorar IQBasket', intro: 'Estás usando una versión Early Access. Cuéntanos qué falla, qué cuesta entender o qué mejorarías.', category: 'Tipo', severity: 'Impacto', message: 'Cuéntanos qué ha pasado', send: 'Enviar feedback', privacy: 'No incluyas información médica, contraseñas ni otros datos sensibles.', success: 'Feedback enviado. Gracias por ayudarnos a mejorar IQBasket.', error: 'No se ha podido enviar. Revisa la conexión e inténtalo de nuevo.' },
      ca: { title: 'Ajuda’ns a millorar IQBasket', intro: 'Estàs utilitzant una versió Early Access. Explica’ns què falla, què costa d’entendre o què milloraries.', category: 'Tipus', severity: 'Impacte', message: 'Explica’ns què ha passat', send: 'Enviar feedback', privacy: 'No incloguis informació mèdica, contrasenyes ni altres dades sensibles.', success: 'Feedback enviat. Gràcies per ajudar-nos a millorar IQBasket.', error: 'No s’ha pogut enviar. Revisa la connexió i torna-ho a provar.' },
      en: { title: 'Help us improve IQBasket', intro: 'You are using an Early Access build. Tell us what broke, what was confusing or what you would improve.', category: 'Type', severity: 'Impact', message: 'Tell us what happened', send: 'Send feedback', privacy: 'Do not include medical information, passwords or other sensitive data.', success: 'Feedback sent. Thanks for helping us improve IQBasket.', error: 'Could not send feedback. Check your connection and try again.' },
      fr: { title: 'Aidez-nous à améliorer IQBasket', intro: 'Vous utilisez une version Early Access. Dites-nous ce qui ne fonctionne pas, ce qui est difficile à comprendre ou ce que vous amélioreriez.', category: 'Type', severity: 'Impact', message: 'Expliquez-nous ce qui s’est passé', send: 'Envoyer', privacy: 'N’incluez pas d’informations médicales, de mots de passe ni d’autres données sensibles.', success: 'Feedback envoyé. Merci de nous aider à améliorer IQBasket.', error: 'Envoi impossible. Vérifiez la connexion et réessayez.' }
    };
    return copy[locale] || copy.es;
  }

  async render(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    this.release = await ReleaseService.getRelease();
    const t = this._copy();
    container.innerHTML = `
      <section class="feedback-view" aria-labelledby="feedback-title">
        <div class="feedback-card">
          <div class="feedback-badge">EARLY ACCESS · ${this.release.release}</div>
          <h1 id="feedback-title">${t.title}</h1>
          <p class="feedback-intro">${t.intro}</p>
          <form id="early-feedback-form">
            <div class="feedback-grid">
              <label>${t.category}
                <select name="category" required>
                  <option value="BUG">Bug</option>
                  <option value="UX">UX / usabilidad</option>
                  <option value="IDEA">Idea</option>
                  <option value="OTHER">Otro</option>
                </select>
              </label>
              <label>${t.severity}
                <select name="severity" required>
                  <option value="BLOCKER">Bloquea la prueba</option>
                  <option value="IMPORTANT">Importante</option>
                  <option value="MINOR" selected>Menor</option>
                  <option value="SUGGESTION">Sugerencia</option>
                </select>
              </label>
            </div>
            <label>${t.message}
              <textarea name="message" minlength="3" maxlength="4000" rows="7" required></textarea>
            </label>
            <p class="feedback-privacy">🛡️ ${t.privacy}</p>
            <button type="submit" class="feedback-submit">${t.send}</button>
            <div id="feedback-status" class="feedback-status" role="status" aria-live="polite"></div>
          </form>
        </div>
      </section>
      ${this._styles()}
    `;
    this._bind(container, t);
  }

  _bind(container, t) {
    const form = container.querySelector('#early-feedback-form');
    const status = container.querySelector('#feedback-status');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const fd = new FormData(form);
      if (submit) submit.disabled = true;
      if (status) status.textContent = '';
      try {
        const role = localStorage.getItem('iq_user_role') || null;
        await this.service.submit({
          category: fd.get('category'),
          severity: fd.get('severity'),
          message: fd.get('message'),
          route: window.location.hash || '#/feedback',
          releaseCode: `${this.release.release}:${this.release.label}`,
          clientContext: {
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            language: I18n?.getLocale?.() || 'es',
            role_hint: role,
            online: navigator.onLine,
            platform: navigator.platform || null
          }
        });
        form.reset();
        if (status) status.textContent = t.success;
      } catch (error) {
        console.error('Feedback submit failed', error);
        if (status) status.textContent = t.error;
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  _styles() {
    return `<style>
      .feedback-view{max-width:760px;margin:0 auto;padding:8px 0 40px}
      .feedback-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;box-shadow:0 10px 28px rgba(15,23,42,.08)}
      .feedback-badge{display:inline-flex;padding:6px 10px;border-radius:999px;background:#fff7ed;color:#c2410c;font-size:12px;font-weight:900;letter-spacing:.04em}
      .feedback-card h1{margin:14px 0 8px;color:#0f172a;font-size:28px;line-height:1.15}
      .feedback-intro{margin:0 0 22px;color:#475569;line-height:1.55}
      .feedback-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .feedback-card label{display:flex;flex-direction:column;gap:7px;margin-bottom:14px;color:#0f172a;font-weight:800;font-size:13px}
      .feedback-card select,.feedback-card textarea{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;background:#fff;color:#0f172a;font:inherit}
      .feedback-card textarea{resize:vertical;min-height:150px}
      .feedback-privacy{font-size:12px;color:#64748b;line-height:1.45}
      .feedback-submit{min-height:46px;border:0;border-radius:10px;padding:0 18px;background:#f97316;color:#fff;font-weight:900;cursor:pointer}
      .feedback-submit:disabled{opacity:.55;cursor:wait}
      .feedback-status{margin-top:12px;min-height:20px;color:#166534;font-weight:750}
      @media(max-width:640px){.feedback-card{padding:18px}.feedback-grid{grid-template-columns:1fr}.feedback-card h1{font-size:23px}}
    </style>`;
  }
}

export default FeedbackView;
