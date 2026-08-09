/**
 * @fileoverview Vista del Asistente de IA "Pregúntale a tus datos" (AskAIView.js).
 * Utiliza la API Gratuita de Groq Cloud con inyección dinámica del idioma activo.
 * Totalmente internacionalizado y adaptado para dispositivos móviles con áreas táctiles de 44px.
 * Restricciones por rol y contador/bloqueo por límite mensual de interacciones.
 */

import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { AiPromptBuilder } from "../services/ai/AiPromptBuilder.js";

export class AskAIView {
  constructor(authController) {
    this.auth = authController;
    this.messages = [];
    this.isLoading = false;
    
    // Clave de Groq guardada en localStorage o por defecto
    this.apiKey = localStorage.getItem("iq_groq_api_key") || "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";
    this.model = "llama-3.3-70b-versatile"; 
  }

  // =========================================================================
  // CONTROL DE PERMISOS Y LÍMITES MENSUALES POR ROL
  // =========================================================================
  _canAccess() {
    const role = localStorage.getItem("iq_simulated_role") || localStorage.getItem("iq_user_role") || "SUPERADMIN";
    return role !== "JUGADOR";
  }

  _getRoleLimit() {
    const role = localStorage.getItem("iq_simulated_role") || localStorage.getItem("iq_user_role") || "SUPERADMIN";
    const limits = {
      SUPERADMIN: -1, // Ilimitado
      ADMIN: 200,
      ENTRENADOR: 100,
      ANALISTA: 100,
      INVITADO: 10,
      JUGADOR: 0
    };
    return limits[role] !== undefined ? limits[role] : 10;
  }

  _getMonthlyUsage() {
    const currentMonth = new Date().toISOString().substring(0, 7); // "2026-08"
    const savedMonth = localStorage.getItem("iq_ai_usage_month");

    if (savedMonth !== currentMonth) {
      localStorage.setItem("iq_ai_usage_month", currentMonth);
      localStorage.setItem("iq_ai_usage_count", "0");
      return 0;
    }

    return parseInt(localStorage.getItem("iq_ai_usage_count") || "0", 10);
  }

  _incrementMonthlyUsage() {
    const currentCount = this._getMonthlyUsage();
    localStorage.setItem("iq_ai_usage_count", String(currentCount + 1));
  }

  _hasReachedLimit() {
    const limit = this._getRoleLimit();
    if (limit === -1) return false; // Ilimitado para SUPERADMIN
    return this._getMonthlyUsage() >= limit;
  }

  /**
   * Petición a la API Gratuita de Groq Cloud
   */
  async _queryGroqAI(userPrompt) {
    if (!this.apiKey) {
      throw new Error(I18n.t("ai.errors.noApiKey", {}, "API Key no configurada. Por favor introduce tu clave de Groq Cloud."));
    }

    const systemPrompt = AiPromptBuilder.buildSystemPrompt();
    const endpoint = "https://api.groq.com/openai/v1/chat/completions";

    const payload = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...this.messages.map(m => ({ role: m.role, content: m.text })),
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1024
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData?.error?.message || "Error al conectar con la API de Groq AI.");
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || I18n.t("ai.errors.invalidReply", {}, "No se pudo obtener una respuesta válida.");
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 🔒 RESTRICCIÓN DE ACCESO: Bloqueo para JUGADOR
    if (!this._canAccess()) {
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; background: white; border-radius: 14px; border: 1px solid #fecaca; max-width: 600px; margin: 40px auto;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔒</div>
          <h2 style="margin: 0 0 8px 0; color: #991b1b; font-size: 18px; font-weight: 800;">Acceso no permitido</h2>
          <p style="color: #7f1d1d; font-size: 13px; margin: 0 0 20px 0;">Tu rol de usuario de JUGADOR no tiene acceso al Asistente IA.</p>
          <a href="#/dashboard" style="background: #1e3a8a; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 13px; display: inline-block;">Volver al Dashboard</a>
        </div>
      `;
      return;
    }

    const limit = this._getRoleLimit();
    const usage = this._getMonthlyUsage();
    const isLimitReached = this._hasReachedLimit();

    const limitLabelText = limit === -1 
      ? "Consultas ilimitadas" 
      : `${usage} / ${limit} consultas este mes`;

    const messagesMarkup = this.messages.map(m => `
      <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-direction: ${m.role === 'user' ? 'row-reverse' : 'row'};">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: ${m.role === 'user' ? '#1e3a8a' : 'var(--color-primary, #ea580c)'}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0;">
          ${m.role === 'user' ? '👤' : '🤖'}
        </div>
        <div style="max-width: 82%; background: ${m.role === 'user' ? '#1e3a8a' : 'white'}; color: ${m.role === 'user' ? 'white' : '#0f172a'}; border: 1px solid ${m.role === 'user' ? '#1e3a8a' : '#e2e8f0'}; border-radius: 12px; padding: 12px 16px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
          ${m.text}
        </div>
      </div>
    `).join("");

    container.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto; font-family: var(--font-family-base, system-ui); min-height: calc(100vh - 120px); display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">🤖 ${I18n.t("ai.title", {}, "Pregúntale a tus datos (Asistente IA)")}</h1>
            <span style="font-size: 12px; color: #64748b;">${I18n.t("ai.subtitle", {}, "Consultas tácticas sobre partidos y jugadores en tiempo real")}</span>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 11px; font-weight: 800; color: ${isLimitReached ? '#dc2626' : '#1e3a8a'}; background: ${isLimitReached ? '#fee2e2' : '#f1f5f9'}; padding: 6px 12px; border-radius: 20px; border: 1px solid ${isLimitReached ? '#fca5a5' : '#cbd5e1'};">
              📊 ${limitLabelText}
            </span>

            <button id="btn-config-key" style="background: white; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer; min-height: 44px;">
              ⚙️ ${this.apiKey ? I18n.t("ai.status.configured", {}, "API Key Configurada") : I18n.t("ai.status.unconfigured", {}, "Configurar API Key Gratis")}
            </button>
          </div>
        </div>

        ${isLimitReached ? `
          <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 16px; border-radius: 10px; font-size: 12px; font-weight: 700; margin-bottom: 16px;">
            ⚠️ Has alcanzado el límite máximo mensual de interacciones permitidas para tu rol (${limit} consultas/mes). El campo de pregunta se encuentra bloqueado hasta el próximo mes.
          </div>
        ` : ''}

        <!-- Botones de Sugerencias Tácticas -->
        <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 6px;">
          <button class="btn-prompt-chip" data-prompt="${I18n.t("ai.suggestions.topScorers", {}, "¿Quién es nuestro máximo anotador y cuál es su promedio de valoración por partido?")}" ${isLimitReached ? 'disabled' : ''} style="background: white; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #1e3a8a; cursor: ${isLimitReached ? 'not-allowed' : 'pointer'}; opacity: ${isLimitReached ? '0.5' : '1'}; white-space: nowrap; min-height: 44px;">
            💡 Líderes de anotación y VAL
          </button>
          <button class="btn-prompt-chip" data-prompt="${I18n.t("ai.suggestions.homeAway", {}, "Resume el rendimiento del equipo en los partidos como Local vs Visitante.")}" ${isLimitReached ? 'disabled' : ''} style="background: white; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #1e3a8a; cursor: ${isLimitReached ? 'not-allowed' : 'pointer'}; opacity: ${isLimitReached ? '0.5' : '1'}; white-space: nowrap; min-height: 44px;">
            🏟️ Rendimiento Local vs Visitante
          </button>
          <button class="btn-prompt-chip" data-prompt="${I18n.t("ai.suggestions.tacticalDiagnosis", {}, "¿Qué aspectos defensivos u ofensivos deberíamos mejorar según los resultados obtenidos?")}" ${isLimitReached ? 'disabled' : ''} style="background: white; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #1e3a8a; cursor: ${isLimitReached ? 'not-allowed' : 'pointer'}; opacity: ${isLimitReached ? '0.5' : '1'}; white-space: nowrap; min-height: 44px;">
            📋 Diagnóstico Táctico Global
          </button>
        </div>

        <!-- Área de Mensajes del Chat -->
        <div id="chat-messages-box" style="flex: 1; min-height: 350px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; overflow-y: auto; margin-bottom: 16px;">
          ${this.messages.length === 0 ? `
            <div style="text-align: center; color: #94a3b8; margin-top: 80px;">
              <span style="font-size: 44px; display: block; margin-bottom: 10px;">🏀</span>
              <strong style="font-size: 15px; color: #334155; display: block;">${I18n.t("ai.welcome.title", {}, "¡Hola Entrenador! Soy tu Asistente Táctico de IQ Basket.")}</strong>
              <p style="font-size: 12px; margin-top: 6px; color: #64748b; max-width: 450px; margin-left: auto; margin-right: auto;">
                ${I18n.t("ai.welcome.message", {}, "Tengo acceso en tiempo real a los partidos y estadísticas de tu plantilla. Hazme cualquier pregunta sobre el equipo.")}
              </p>
            </div>
          ` : messagesMarkup}
        </div>

        <!-- Formulario de Entrada de Pregunta -->
        <form id="form-ask-ai" style="display: flex; gap: 8px;">
          <input type="text" id="input-ai-prompt" placeholder="${isLimitReached ? 'Límite mensual alcanzado' : I18n.t("ai.input.placeholder", {}, "Escribe tu consulta táctica...")}" ${this.isLoading || isLimitReached ? 'disabled' : ''} style="flex: 1; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; outline: none; background: ${isLimitReached ? '#f1f5f9' : 'white'}; min-height: 44px;" />
          <button type="submit" ${this.isLoading || isLimitReached ? 'disabled' : ''} style="background: ${isLimitReached ? '#cbd5e1' : 'var(--color-primary, #ea580c)'}; color: ${isLimitReached ? '#64748b' : 'white'}; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: ${isLimitReached ? 'not-allowed' : 'pointer'}; display: flex; align-items: center; gap: 6px; min-height: 44px;">
            ${this.isLoading ? '⏳ ...' : TranslationStore.t("send", "Enviar 🚀")}
          </button>
        </form>

      </div>
    `;

    // Ajustar scroll automático al final
    const chatBox = container.querySelector("#chat-messages-box");
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

    // Listeners
    container.querySelector("#btn-config-key")?.addEventListener("click", () => {
      const key = prompt(I18n.t("ai.promptApiKey", {}, "Introduce tu API Key Gratuita de Groq Cloud (console.groq.com):"), this.apiKey);
      if (key !== null) {
        this.apiKey = key.trim();
        localStorage.setItem("iq_groq_api_key", this.apiKey);
        this.render(containerId);
      }
    });

    container.querySelectorAll(".btn-prompt-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        if (this._hasReachedLimit()) {
          alert("⚠️ Has alcanzado el límite mensual de consultas para tu rol.");
          return;
        }
        const promptText = chip.getAttribute("data-prompt");
        const input = container.querySelector("#input-ai-prompt");
        if (input) {
          input.value = promptText;
          container.querySelector("#form-ask-ai")?.dispatchEvent(new Event("submit"));
        }
      });
    });

    container.querySelector("#form-ask-ai")?.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (this._hasReachedLimit()) {
        alert("⚠️ Has alcanzado el límite máximo de interacciones mensuales permitidas para tu rol.");
        return;
      }

      const input = container.querySelector("#input-ai-prompt");
      const text = input?.value?.trim();
      if (!text || this.isLoading) return;

      this.messages.push({ role: "user", text });
      this.isLoading = true;
      this._incrementMonthlyUsage();
      this.render(containerId);

      try {
        const reply = await this._queryGroqAI(text);
        this.messages.push({ role: "assistant", text: reply });
      } catch (err) {
        this.messages.push({ role: "assistant", text: `⚠️ Error: ${err.message}` });
      } finally {
        this.isLoading = false;
        this.render(containerId);
      }
    });
  }
}

export default AskAIView;