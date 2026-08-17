/**
 * @fileoverview Servicio de Asesoría Integral y Familiar: FamilyAdvisorService.js
 * @description Generador de recomendaciones pedagógicas con IA sobre nutrición, descanso,
 * psicología deportiva, concentración, educación, valores y acompañamiento familiar.
 */

import { supabase } from "../../config/database.config.js";

export class FamilyAdvisorService {
  static CATEGORIES = {
    NUTRITION: {
      id: "nutrition",
      title: "Nutrición & Hidratación",
      icon: "🥗",
      systemPrompt: "Eres un nutricionista deportivo especializado en baloncesto formativo y de rendimiento. Explica qué comer antes y después de partidos y entrenamientos, hidratación y hábitos saludables sin tecnicismos complejos."
    },
    SLEEP_REST: {
      id: "sleep_rest",
      title: "Sueño & Recuperación",
      icon: "😴",
      systemPrompt: "Eres un especialista en descanso y fisiología del deportista. Enseña pautas de higiene del sueño, gestión de pantallas, descanso activo y regeneración física."
    },
    PSYCHOLOGY: {
      id: "psychology",
      title: "Psicología & Concentración",
      icon: "🧠",
      systemPrompt: "Eres un psicólogo deportivo enfocado en baloncesto. Proporciona técnicas sencillas de respiración, foco ante el error, gestión de la frustración y confianza en la pista."
    },
    EDUCATION_VALUES: {
      id: "education_values",
      title: "Educación & Valores",
      icon: "🎓",
      systemPrompt: "Eres un educador deportivo y orientador familiar. Aborda la compatibilidad de estudios y deporte, el respeto arbitral, el trabajo en equipo, la humildad y la cultura del esfuerzo."
    },
    FAMILY_GUIDE: {
      id: "family_guide",
      title: "Acompañamiento Familiar",
      icon: "👨‍👩‍👧‍👦",
      systemPrompt: "Eres un mentor para familias de jugadores/as de baloncesto. Ofrece consejos sobre cómo animar desde la grada sin presionar, cómo hablar tras una derrota o victoria y cómo construir un entorno saludable."
    }
  };

  /**
   * Genera una respuesta estructurada para una consulta.
   * @param {string} categoryKey - Clave de categoría.
   * @param {string} userQuery - Pregunta o temática de la familia/jugador.
   * @param {string} targetAudience - 'jovenes' | 'adultos' | 'familias'
   */
  static async askAdvisor(categoryKey, userQuery, targetAudience = "familias") {
    const category = this.CATEGORIES[categoryKey.toUpperCase()] || this.CATEGORIES.FAMILY_GUIDE;

    const audienceContext = {
      jovenes: "El tono debe ser muy cercano, motivador, con ejemplos prácticos y lenguaje sencillo para niños/as y adolescentes.",
      adultos: "El tono debe ser técnico pero accesible, enfocado al rendimiento, prevención de lesiones y conciliación laboral/deportiva.",
      familias: "El tono debe ser empático, pedagógico y centrado en la educación emocional y el apoyo incondicional."
    }[targetAudience] || "El tono debe ser constructivo y educativo.";

    const fullPrompt = `
Contexto: ${category.systemPrompt}
Audiencia objetivo: ${audienceContext}

Consulta: "${userQuery}"

Estructura tu respuesta en:
1. Resumen directo o consejo clave (1-2 frases).
2. Puntos prácticos aplicables en el día a día (3-4 viñetas).
3. Recomendación de oro para el partido o entrenamiento.
    `;

    // Si tienes integrada Edge Function o Endpoint de OpenAI / Supabase AI
    try {
      if (supabase && supabase.functions) {
        const { data, error } = await supabase.functions.invoke("generate-advisor-advice", {
          body: { prompt: fullPrompt, category: category.id, audience: targetAudience }
        });
        if (!error && data?.response) return data.response;
      }
    } catch (e) {
      console.warn("[FamilyAdvisorService] Fallback local a respuesta guiada:", e.message);
    }

    // Respuestas base educativas integradas (Modo offline / Fallback)
    return this._getFallbackAdvice(category.id, userQuery, targetAudience);
  }

  static _getFallbackAdvice(catId, query, audience) {
    const fallbacks = {
      nutrition: `
**Pauta Clave:** La energía del partido se construye 2-3 horas antes con carbohidratos complejos y una correcta hidratación.
* **Pre-partido (2-3h antes):** Pasta, arroz o avena con proteína magra (pollo, pavo o huevo). Evita fritos y salsas pesadas.
* **Durante el partido:** Agua en pequeños sorbos en cada tiempo muerto; fruta (plátano) al descanso si hay fatiga.
* **Post-partido (recuperación):** Fruta, lácteo o batido recuperador en los primeros 30 minutos para reponer glucógeno muscular.
* **Consejo de Oro:** La hidratación empieza el día anterior, no en el calentamiento.
      `,
      sleep_rest: `
**Pauta Clave:** El sueño es el entrenamiento invisible más determinante para la precisión y la prevención de lesiones.
* **Horas mínimas:** 8 a 9 horas para deportistas jóvenes; 7 a 8 horas en categoría sénior.
* **Cero pantallas:** Apagar móviles, tablets y consolas al menos 45 minutos antes de dormir para permitir la liberación de melatonina.
* **Rutina regular:** Acostarse y levantarse a la misma hora, incluso los fines de semana de competición.
* **Consejo de Oro:** Una siesta de 20-30 minutos antes del partido recarga el sistema nervioso central.
      `,
      psychology: `
**Pauta Clave:** La concentración no es no fallar, sino la velocidad a la que vuelves a la siguiente jugada tras el error.
* **Regla de los 3 segundos:** Permítete sentir el fallo 3 segundos, respira hondo y enfócate en la defensa.
* **Rutina en el Tiro Libre:** Bota siempre el mismo número de veces y visualiza el balón entrando antes de lanzar.
* **Lenguaje corporal:** Mantén la cabeza alta y hombros erguidos; tu postura influye directamente en tu confianza.
* **Consejo de Oro:** El árbitro y el rival no están bajo tu control; tu esfuerzo y tu actitud sí.
      `,
      education_values: `
**Pauta Clave:** La disciplina escolar y el compromiso deportivo se potencian mutuamente cuando hay organización.
* **Horarios prefijados:** Bloquea tiempo de estudio antes del entreno para llegar a pista con la mente despejada.
* **Cultura de equipo:** El éxito del quinteto empieza animando y celebrando las canastas desde el banquillo.
* **Respeto incondicional:** Tratar a árbitros, rivales y entrenadores con máxima deportividad dentro y fuera de pista.
* **Consejo de Oro:** Un mal estudiante difícilmente será un jugador con buena toma de decisiones bajo presión.
      `,
      family_guide: `
**Pauta Clave:** El rol de la familia en la grada es disfrutar y ser el refugio emocional incondicional de sus hijos/as.
* **En el coche de vuelta:** Evita el análisis táctico; la mejor frase es *"Me encanta verte jugar y competir"*.
* **En la grada:** Anima al equipo con positividad y deja las indicaciones técnicas exclusivamente al entrenador.
* **Gestión del resultado:** Enseña que el valor personal no depende de los puntos anotados ni del marcador final.
* **Consejo de Oro:** Tu hijo/a recordará cómo le hiciste sentir tras el partido, no el resultado del acta.
      `
    };

    return fallbacks[catId] || fallbacks.family_guide;
  }
}

export default FamilyAdvisorService;