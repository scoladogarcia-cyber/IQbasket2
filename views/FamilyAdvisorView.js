/**
 * @fileoverview Vista del Espacio Familias & Jugadores (IA Advisor): FamilyAdvisorView.js
 * @description Módulo de apoyo formativo en nutrición, sueño, psicología, educación y valores.
 */

import { FamilyAdvisorService } from "../services/ai/FamilyAdvisorService.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class FamilyAdvisorView {
  constructor(authController = null) {
    this.auth = authController;
    this.activeCategory = "NUTRITION";
    this.targetAudience = "familias"; // 'familias' | 'jovenes' | 'adultos'
    this.chatHistory = [];
    this.isLoading = false;
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;

    const categories = Object.keys(FamilyAdvisorService.CATEGORIES);
    const activeCatObj = FamilyAdvisorService.CATEGORIES[this.activeCategory];

    const quickQuestions = {
      NUTRITION: [
        "¿Qué merendar 1 hora antes del entrenamiento?",
        "¿Cómo reponer energía rápidamente tras un partido duro?",
        "¿Cuánta agua debe beber un jugador durante el partido?"
      ],
      SLEEP_REST: [
        "¿Cómo afecta el uso del móvil antes de dormir al rendimiento?",
        "¿Cuántas horas de sueño necesita un jugador cadete/júnior?",
        "Pautas para descansar bien la noche previa a un partido matinal."
      ],
      PSYCHOLOGY: [
        "¿Qué hacer cuando un jugador se bloquea tras varios fallos?",
        "Técnicas de respiración para calmar los nervios en tiros libres.",
        "Cómo mantener la concentración todo el partido saliendo desde el banquillo."
      ],
      EDUCATION_VALUES: [
        "¿Cómo compaginar época de exámenes con entrenamientos?",
        "La importancia de la puntualidad y el respeto al equipo.",
        "Cómo encajar las decisiones del entrenador constructivamente."
      ],
      FAMILY_GUIDE: [
        "¿Qué decir a mi hijo/a después de un partido donde jugó pocos minutos?",
        "Cómo actuar desde la grada ante arbitrajes difíciles.",
        "Claves para motivar sin generar presión por los puntos."
      ]
    }[this.activeCategory] || [];

    container.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; padding-bottom: 50px; color: #0f172a;">
        
        <!-- HEADER PRINCIPAL -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">🌱</span>
              <h1 style="font-size: 22px; font-weight: 900; margin: 0; color: #0f172a;">
                Espacio Familias & Desarrollo Integral
              </h1>
            </div>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
              Asesoría basada en IA y psicología deportiva para el bienestar, nutrición, descanso y valores en el baloncesto.
            </p>
          </div>

          <!-- SELECTOR DE PERFIL / AUDIENCIA -->
          <div style="display: flex; align-items: center; gap: 6px; background: #f1f5f9; padding: 4px; border-radius: 10px; border: 1px solid #cbd5e1;">
            <span style="font-size: 10px; font-weight: 800; color: #64748b; padding-left: 8px; text-transform: uppercase;">Dirigido a:</span>
            <button type="button" class="btn-audience ${this.targetAudience === 'familias' ? 'active' : ''}" data-aud="familias" style="padding: 6px 12px; border-radius: 6px; border: none; font-size: 11px; font-weight: 800; cursor: pointer; background: ${this.targetAudience === 'familias' ? '#1e3a8a' : 'transparent'}; color: ${this.targetAudience === 'familias' ? '#ffffff' : '#475569'};">
              👨‍👩‍👧‍👦 Familias
            </button>
            <button type="button" class="btn-audience ${this.targetAudience === 'jovenes' ? 'active' : ''}" data-aud="jovenes" style="padding: 6px 12px; border-radius: 6px; border: none; font-size: 11px; font-weight: 800; cursor: pointer; background: ${this.targetAudience === 'jovenes' ? '#1e3a8a' : 'transparent'}; color: ${this.targetAudience === 'jovenes' ? '#ffffff' : '#475569'};">
              🏀 Jugadores/as
            </button>
            <button type="button" class="btn-audience ${this.targetAudience === 'adultos' ? 'active' : ''}" data-aud="adultos" style="padding: 6px 12px; border-radius: 6px; border: none; font-size: 11px; font-weight: 800; cursor: pointer; background: ${this.targetAudience === 'adultos' ? '#1e3a8a' : 'transparent'}; color: ${this.targetAudience === 'adultos' ? '#ffffff' : '#475569'};">
              👟 Sénior / Adultos
            </button>
          </div>
        </div>

        <!-- REJILLA DE CATEGORÍAS TEMÁTICAS -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 20px;">
          ${categories.map(catKey => {
            const cat = FamilyAdvisorService.CATEGORIES[catKey];
            const isActive = this.activeCategory === catKey;
            return `
              <button type="button" class="btn-category-card" data-cat="${catKey}" style="background: ${isActive ? '#eff6ff' : '#ffffff'}; border: 2px solid ${isActive ? '#2563eb' : '#e2e8f0'}; border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px; transition: all 0.2s ease;">
                <span style="font-size: 20px;">${cat.icon}</span>
                <strong style="font-size: 12px; color: ${isActive ? '#1e40af' : '#0f172a'};">${cat.title}</strong>
              </button>
            `;
          }).join("")}
        </div>

        <!-- PANEL INTERACTIVO DE CONSULTA Y RESPUESTA -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 16px;">
          
          <!-- CAJA DE CONSULTA Y PREGUNTAS FRECUENTES -->
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 18px;">${activeCatObj.icon}</span>
              <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #0f172a;">Preguntas Rápidas en ${activeCatObj.title}</h3>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
              ${quickQuestions.map(q => `
                <button type="button" class="btn-quick-query" data-query="${q}" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #334155; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; cursor: pointer; text-align: left;">
                  💡 ${q}
                </button>
              `).join("")}
            </div>

            <div style="display: flex; gap: 8px;">
              <input type="text" id="advisor-input" placeholder="Escribe tu consulta sobre ${activeCatObj.title.toLowerCase()}..." style="flex: 1; height: 42px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 600; padding: 0 12px; outline: none; color: #0f172a;" />
              <button type="button" id="btn-send-advisor" style="background: #f97316; color: #ffffff; border: none; padding: 0 20px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(249,115,22,0.3);">
                ✨ Consultar
              </button>
            </div>
          </div>

          <!-- HISTORIAL / RESULTADOS GENERADOS -->
          <div id="advisor-output-container" style="display: flex; flex-direction: column; gap: 14px;">
            ${this.chatHistory.length === 0 ? `
              <div style="background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 14px; padding: 30px; text-align: center; color: #64748b;">
                <span style="font-size: 32px; display: block; margin-bottom: 8px;">🏀👨‍👩‍👧‍👦</span>
                <strong style="font-size: 14px; color: #334155; display: block;">Bienvenido al Asesor Educativo y Familiar</strong>
                <p style="margin: 4px 0 0 0; font-size: 12px;">Selecciona una pregunta rápida o escribe tu consulta para recibir pautas prácticas adaptadas.</p>
              </div>
            ` : this.chatHistory.map(item => `
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 11px; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 2px 8px; border-radius: 6px;">
                    ${item.categoryTitle} · ${item.audienceLabel}
                  </span>
                  <span style="font-size: 10px; color: #94a3b8;">${item.timestamp}</span>
                </div>
                <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 10px;">❓ ${item.query}</strong>
                <div style="font-size: 13px; line-height: 1.6; color: #334155; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 14px;">
                  ${this._formatMarkdownResponse(item.response)}
                </div>
              </div>
            `).join("")}
          </div>

        </div>

      </div>
    `;

    this._bindEvents(container);
  }

  _formatMarkdownResponse(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0f172a;">$1</strong>')
      .replace(/^\* (.*?)$/gm, '<li style="margin-bottom: 4px;">$1</li>')
      .replace(/(<li.*<\/li>)/s, '<ul style="padding-left: 18px; margin: 8px 0;">$1</ul>')
      .replace(/\n\n/g, '<br/><br/>');
  }

  _bindEvents(container) {
    container.querySelectorAll(".btn-audience").forEach(btn => {
      btn.addEventListener("click", () => {
        this.targetAudience = btn.getAttribute("data-aud");
        this.render();
      });
    });

    container.querySelectorAll(".btn-category-card").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activeCategory = btn.getAttribute("data-cat");
        this.render();
      });
    });

    container.querySelectorAll(".btn-quick-query").forEach(btn => {
      btn.addEventListener("click", () => {
        const query = btn.getAttribute("data-query");
        this._handleAdvisorQuery(query);
      });
    });

    const sendBtn = container.querySelector("#btn-send-advisor");
    const inputEl = container.querySelector("#advisor-input");

    sendBtn?.addEventListener("click", () => {
      const q = inputEl?.value?.trim();
      if (q) this._handleAdvisorQuery(q);
    });

    inputEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = inputEl.value?.trim();
        if (q) this._handleAdvisorQuery(q);
      }
    });
  }

  async _handleAdvisorQuery(query) {
    const inputEl = this.container?.querySelector("#advisor-input");
    const sendBtn = this.container?.querySelector("#btn-send-advisor");

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = "⏳ Analizando...";
    }

    const response = await FamilyAdvisorService.askAdvisor(this.activeCategory, query, this.targetAudience);
    const activeCatObj = FamilyAdvisorService.CATEGORIES[this.activeCategory];

    const audienceLabels = {
      familias: "Familias",
      jovenes: "Jugadores/as",
      adultos: "Sénior / Adultos"
    };

    this.chatHistory.unshift({
      categoryTitle: activeCatObj.title,
      audienceLabel: audienceLabels[this.targetAudience],
      query,
      response,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    this.render();
  }
}

export default FamilyAdvisorView;