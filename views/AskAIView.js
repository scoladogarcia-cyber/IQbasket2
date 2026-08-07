/**
 * @fileoverview Vista del Asistente de IA "Pregúntale a tus datos" (AskAIView.js).
 * Utiliza la API Gratuita de Groq Cloud (Llama 3.3 70B / Llama 3.1 8B)
 * ofreciendo un servicio de chat táctico 100% gratuito sin límite práctico de preguntas.
 */

import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";

export class AskAIView {
  constructor(authController) {
    this.auth = authController;
    this.messages = [];
    this.isLoading = false;
    
    // API Key de Groq (Se guarda en localStorage o se usa la clave global)
    this.apiKey = localStorage.getItem("iq_groq_api_key") || "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";
    // Modelo por defecto: 'llama-3.3-70b-versatile' o 'llama-3.1-8b-instant'
    this.model = "llama-3.3-70b-versatile"; 
  }

  /**
   * Prepara el contexto con todos los datos del equipo para la IA
   */
  _buildTeamContext() {
    const games = DataStore.getGames() || [];
    const players = DataStore.getPlayers() || [];
    const playerStats = DataStore.getPlayerGameStats() || [];

    const playersSummary = players.map(p => {
      const pStats = playerStats.filter(s => String(s.player_id) === String(p.id));
      let pts = 0, val = 0;
      pStats.forEach(s => {
        pts += Number(s.fg2_made || 0) * 2 + Number(s.fg3_made || 0) * 3 + Number(s.ft_made || 0);
        val += Number(s.evaluation || 0);
      });
      const pj = pStats.length || 1;
      return `#${p.jersey ?? '?'} ${p.first_name || ''} ${p.last_name || ''} (${p.position || 'Jugador'}): ${pj} PJ | Promedio ${(pts / pj).toFixed(1)} PTS/partido | VAL/PJ ${(val / pj).toFixed(1)}.`;
    }).join("\n");

    const gamesSummary = games.map((g, i) => {
      return `P${i + 1} (${g.date || ''}): vs ${g.opponent || 'Rival'} (${g.venue || 'Local'}) -> Resultado: ${g.team_score ?? 0} - ${g.opponent_score ?? 0}.`;
    }).join("\n");

    return `
Eres el Asistente Analista de Datos Oficial del equipo de baloncesto JMJ Manyanet Sant Andreu (IQ Basket).
Tu misión es analizar la información del equipo y responder las preguntas del entrenador de forma táctica, concisa, profesional y directa.

=== DATOS DE LA PLANTILLA (TEMPORADA 2026) ===
${playersSummary || 'Sin datos de jugadores registrados.'}

=== HISTÓRICO DE PARTIDOS REGISTRADOS (P1 - Pn) ===
${gamesSummary || 'Sin datos de partidos registrados.'}

Instrucciones de respuesta:
- Sé breve, preciso y profesional como un asistente técnico de baloncesto.
- Usa viñetas o formato estructurado si te piden listas o análisis comparativos.
- Basate estrictamente en las cifras y datos facilitados arriba.
`;
  }

  /**
   * Petición a la API Gratuita de Groq Cloud
   */
  async _queryGroqAI(userPrompt) {
    if (!this.apiKey) {
      throw new Error("API Key no configurada. Haz clic en 'Configurar API Key' e introduce tu clave gratuita de Groq.");
    }

    const systemPrompt = this._buildTeamContext();
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
      throw new Error(errData?.error?.message || "Error al conectar con el servidor de Groq AI.");
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "No se pudo obtener una respuesta válida de la IA.";
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const messagesMarkup = this.messages.map(m => `
      <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-direction: ${m.role === 'user' ? 'row-reverse' : 'row'};">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${m.role === 'user' ? '#1e3a8a' : '#f97316'}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0;">
          ${m.role === 'user' ? '👤' : '🤖'}
        </div>
        <div style="max-width: 78%; background: ${m.role === 'user' ? '#1e3a8a' : 'white'}; color: ${m.role === 'user' ? 'white' : '#0f172a'}; border: 1px solid ${m.role === 'user' ? '#1e3a8a' : '#e2e8f0'}; border-radius: 12px; padding: 12px 16px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
          ${m.text}
        </div>
      </div>
    `).join("");

    container.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; height: calc(100vh - 110px); display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">🤖 Pregúntale a tus datos (Asistente IA)</h1>
            <span style="font-size: 12px; color: #64748b;">Consultas tácticas sobre partidos y jugadores en tiempo real (Groq Cloud)</span>
          </div>

          <button id="btn-config-key" style="background: white; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer;">
            ⚙️ ${this.apiKey ? 'API Key Configurada' : 'Configurar API Key Gratis'}
          </button>
        </div>

        <!-- Botones de Sugerencias Tácticas -->
        <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px;">
          <button class="btn-prompt-chip" data-prompt="¿Quién es nuestro máximo anotador y cuál es su promedio de valoración por partido?" style="background: white; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #1e3a8a; cursor: pointer; white-space: nowrap;">
            💡 Líderes de anotación y VAL
          </button>
          <button class="btn-prompt-chip" data-prompt="Resume el rendimiento del equipo en los partidos como Local vs Visitante." style="background: white; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #1e3a8a; cursor: pointer; white-space: nowrap;">
            🏟️ Rendimiento Local vs Visitante
          </button>
          <button class="btn-prompt-chip" data-prompt="¿Qué aspectos defensivos u ofensivos deberíamos mejorar según los resultados obtenidos?" style="background: white; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #1e3a8a; cursor: pointer; white-space: nowrap;">
            📋 Diagnóstico Táctico Global
          </button>
        </div>

        <!-- Área de Mensajes del Chat -->
        <div id="chat-messages-box" style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; overflow-y: auto; margin-bottom: 16px;">
          ${this.messages.length === 0 ? `
            <div style="text-align: center; color: #94a3b8; margin-top: 90px;">
              <span style="font-size: 44px; display: block; margin-bottom: 10px;">🏀</span>
              <strong style="font-size: 15px; color: #334155; display: block;">¡Hola Entrenador! Soy tu Asistente Táctico de IQ Basket.</strong>
              <p style="font-size: 12px; margin-top: 6px; color: #64748b; max-width: 450px; margin-left: auto; margin-right: auto;">
                Tengo acceso en tiempo real a los partidos y estadísticas de tu plantilla. Hazme cualquier pregunta sobre el equipo.
              </p>
            </div>
          ` : messagesMarkup}
        </div>

        <!-- Formulario de Entrada de Pregunta -->
        <form id="form-ask-ai" style="display: flex; gap: 8px;">
          <input type="text" id="input-ai-prompt" placeholder="Escribe tu consulta táctica..." ${this.isLoading ? 'disabled' : ''} style="flex: 1; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; outline: none; background: white;" />
          <button type="submit" ${this.isLoading ? 'disabled' : ''} style="background: #1e3a8a; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            ${this.isLoading ? '⏳ Analizando...' : 'Enviar 🚀'}
          </button>
        </form>

      </div>
    `;

    // Ajustar scroll automático al final
    const chatBox = container.querySelector("#chat-messages-box");
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

    // Listeners
    container.querySelector("#btn-config-key")?.addEventListener("click", () => {
      const key = prompt("Introduce tu API Key Gratuita de Groq Cloud (consíguela gratis en console.groq.com):", this.apiKey);
      if (key !== null) {
        this.apiKey = key.trim();
        localStorage.setItem("iq_groq_api_key", this.apiKey);
        this.render(containerId);
      }
    });

    container.querySelectorAll(".btn-prompt-chip").forEach(chip => {
      chip.addEventListener("click", () => {
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
      const input = container.querySelector("#input-ai-prompt");
      const text = input?.value?.trim();
      if (!text || this.isLoading) return;

      this.messages.push({ role: "user", text });
      this.isLoading = true;
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