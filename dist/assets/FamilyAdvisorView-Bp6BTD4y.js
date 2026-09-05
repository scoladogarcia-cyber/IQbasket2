var f=Object.defineProperty;var m=(r,e,t)=>e in r?f(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):r[e]=t;var p=(r,e,t)=>m(r,typeof e!="symbol"?e+"":e,t);import{s as c,T as u,I as g}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class d{static async askAdvisor(e,t,i="familias"){const a=this.CATEGORIES[e.toUpperCase()]||this.CATEGORIES.FAMILY_GUIDE,n={jovenes:"El tono debe ser muy cercano, motivador, con ejemplos prácticos y lenguaje sencillo para niños/as y adolescentes.",adultos:"El tono debe ser técnico pero accesible, enfocado al rendimiento, prevención de lesiones y conciliación laboral/deportiva.",familias:"El tono debe ser empático, pedagógico y centrado en la educación emocional y el apoyo incondicional."}[i]||"El tono debe ser constructivo y educativo.",o=`
Contexto: ${a.systemPrompt}
Audiencia objetivo: ${n}

Consulta: "${t}"

Estructura tu respuesta en:
1. Resumen directo o consejo clave (1-2 frases).
2. Puntos prácticos aplicables en el día a día (3-4 viñetas).
3. Recomendación de oro para el partido o entrenamiento.
    `;try{if(c&&c.functions){const{data:s,error:l}=await c.functions.invoke("generate-advisor-advice",{body:{prompt:o,category:a.id,audience:i}});if(!l&&(s!=null&&s.response))return s.response}}catch(s){console.warn("[FamilyAdvisorService] Fallback local a respuesta guiada:",s.message)}return this._getFallbackAdvice(a.id,t,i)}static _getFallbackAdvice(e,t,i){const a={nutrition:`
**Pauta Clave:** La energía del partido se construye 2-3 horas antes con carbohidratos complejos y una correcta hidratación.
* **Pre-partido (2-3h antes):** Pasta, arroz o avena con proteína magra (pollo, pavo o huevo). Evita fritos y salsas pesadas.
* **Durante el partido:** Agua en pequeños sorbos en cada tiempo muerto; fruta (plátano) al descanso si hay fatiga.
* **Post-partido (recuperación):** Fruta, lácteo o batido recuperador en los primeros 30 minutos para reponer glucógeno muscular.
* **Consejo de Oro:** La hidratación empieza el día anterior, no en el calentamiento.
      `,sleep_rest:`
**Pauta Clave:** El sueño es el entrenamiento invisible más determinante para la precisión y la prevención de lesiones.
* **Horas mínimas:** 8 a 9 horas para deportistas jóvenes; 7 a 8 horas en categoría sénior.
* **Cero pantallas:** Apagar móviles, tablets y consolas al menos 45 minutos antes de dormir para permitir la liberación de melatonina.
* **Rutina regular:** Acostarse y levantarse a la misma hora, incluso los fines de semana de competición.
* **Consejo de Oro:** Una siesta de 20-30 minutos antes del partido recarga el sistema nervioso central.
      `,psychology:`
**Pauta Clave:** La concentración no es no fallar, sino la velocidad a la que vuelves a la siguiente jugada tras el error.
* **Regla de los 3 segundos:** Permítete sentir el fallo 3 segundos, respira hondo y enfócate en la defensa.
* **Rutina en el Tiro Libre:** Bota siempre el mismo número de veces y visualiza el balón entrando antes de lanzar.
* **Lenguaje corporal:** Mantén la cabeza alta y hombros erguidos; tu postura influye directamente en tu confianza.
* **Consejo de Oro:** El árbitro y el rival no están bajo tu control; tu esfuerzo y tu actitud sí.
      `,education_values:`
**Pauta Clave:** La disciplina escolar y el compromiso deportivo se potencian mutuamente cuando hay organización.
* **Horarios prefijados:** Bloquea tiempo de estudio antes del entreno para llegar a pista con la mente despejada.
* **Cultura de equipo:** El éxito del quinteto empieza animando y celebrando las canastas desde el banquillo.
* **Respeto incondicional:** Tratar a árbitros, rivales y entrenadores con máxima deportividad dentro y fuera de pista.
* **Consejo de Oro:** Un mal estudiante difícilmente será un jugador con buena toma de decisiones bajo presión.
      `,family_guide:`
**Pauta Clave:** El rol de la familia en la grada es disfrutar y ser el refugio emocional incondicional de sus hijos/as.
* **En el coche de vuelta:** Evita el análisis táctico; la mejor frase es *"Me encanta verte jugar y competir"*.
* **En la grada:** Anima al equipo con positividad y deja las indicaciones técnicas exclusivamente al entrenador.
* **Gestión del resultado:** Enseña que el valor personal no depende de los puntos anotados ni del marcador final.
* **Consejo de Oro:** Tu hijo/a recordará cómo le hiciste sentir tras el partido, no el resultado del acta.
      `};return a[e]||a.family_guide}}p(d,"CATEGORIES",{NUTRITION:{id:"nutrition",title:"Nutrición & Hidratación",icon:"🥗",systemPrompt:"Eres un nutricionista deportivo especializado en baloncesto formativo y de rendimiento. Explica qué comer antes y después de partidos y entrenamientos, hidratación y hábitos saludables sin tecnicismos complejos."},SLEEP_REST:{id:"sleep_rest",title:"Sueño & Recuperación",icon:"😴",systemPrompt:"Eres un especialista en descanso y fisiología del deportista. Enseña pautas de higiene del sueño, gestión de pantallas, descanso activo y regeneración física."},PSYCHOLOGY:{id:"psychology",title:"Psicología & Concentración",icon:"🧠",systemPrompt:"Eres un psicólogo deportivo enfocado en baloncesto. Proporciona técnicas sencillas de respiración, foco ante el error, gestión de la frustración y confianza en la pista."},EDUCATION_VALUES:{id:"education_values",title:"Educación & Valores",icon:"🎓",systemPrompt:"Eres un educador deportivo y orientador familiar. Aborda la compatibilidad de estudios y deporte, el respeto arbitral, el trabajo en equipo, la humildad y la cultura del esfuerzo."},FAMILY_GUIDE:{id:"family_guide",title:"Acompañamiento Familiar",icon:"👨‍👩‍👧‍👦",systemPrompt:"Eres un mentor para familias de jugadores/as de baloncesto. Ofrece consejos sobre cómo animar desde la grada sin presionar, cómo hablar tras una derrota o victoria y cómo construir un entorno saludable."}});class x{constructor(e=null){this.auth=e,this.activeCategory="NUTRITION",this.targetAudience="familias",this.chatHistory=[],this.isLoading=!1}t(e,t=""){return(u?u.t(e,t):g.t(e,t))||t}async render(e="dashboard-content-area"){const t=document.getElementById(e)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;if(!t)return;const i=Object.keys(d.CATEGORIES),a=d.CATEGORIES[this.activeCategory],n={NUTRITION:["¿Qué merendar 1 hora antes del entrenamiento?","¿Cómo reponer energía rápidamente tras un partido duro?","¿Cuánta agua debe beber un jugador durante el partido?"],SLEEP_REST:["¿Cómo afecta el uso del móvil antes de dormir al rendimiento?","¿Cuántas horas de sueño necesita un jugador cadete/júnior?","Pautas para descansar bien la noche previa a un partido matinal."],PSYCHOLOGY:["¿Qué hacer cuando un jugador se bloquea tras varios fallos?","Técnicas de respiración para calmar los nervios en tiros libres.","Cómo mantener la concentración todo el partido saliendo desde el banquillo."],EDUCATION_VALUES:["¿Cómo compaginar época de exámenes con entrenamientos?","La importancia de la puntualidad y el respeto al equipo.","Cómo encajar las decisiones del entrenador constructivamente."],FAMILY_GUIDE:["¿Qué decir a mi hijo/a después de un partido donde jugó pocos minutos?","Cómo actuar desde la grada ante arbitrajes difíciles.","Claves para motivar sin generar presión por los puntos."]}[this.activeCategory]||[];t.innerHTML=`
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
            <button type="button" class="btn-audience ${this.targetAudience==="familias"?"active":""}" data-aud="familias" style="padding: 6px 12px; border-radius: 6px; border: none; font-size: 11px; font-weight: 800; cursor: pointer; background: ${this.targetAudience==="familias"?"#1e3a8a":"transparent"}; color: ${this.targetAudience==="familias"?"#ffffff":"#475569"};">
              👨‍👩‍👧‍👦 Familias
            </button>
            <button type="button" class="btn-audience ${this.targetAudience==="jovenes"?"active":""}" data-aud="jovenes" style="padding: 6px 12px; border-radius: 6px; border: none; font-size: 11px; font-weight: 800; cursor: pointer; background: ${this.targetAudience==="jovenes"?"#1e3a8a":"transparent"}; color: ${this.targetAudience==="jovenes"?"#ffffff":"#475569"};">
              🏀 Jugadores/as
            </button>
            <button type="button" class="btn-audience ${this.targetAudience==="adultos"?"active":""}" data-aud="adultos" style="padding: 6px 12px; border-radius: 6px; border: none; font-size: 11px; font-weight: 800; cursor: pointer; background: ${this.targetAudience==="adultos"?"#1e3a8a":"transparent"}; color: ${this.targetAudience==="adultos"?"#ffffff":"#475569"};">
              👟 Sénior / Adultos
            </button>
          </div>
        </div>

        <!-- REJILLA DE CATEGORÍAS TEMÁTICAS -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 20px;">
          ${i.map(o=>{const s=d.CATEGORIES[o],l=this.activeCategory===o;return`
              <button type="button" class="btn-category-card" data-cat="${o}" style="background: ${l?"#eff6ff":"#ffffff"}; border: 2px solid ${l?"#2563eb":"#e2e8f0"}; border-radius: 12px; padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px; transition: all 0.2s ease;">
                <span style="font-size: 20px;">${s.icon}</span>
                <strong style="font-size: 12px; color: ${l?"#1e40af":"#0f172a"};">${s.title}</strong>
              </button>
            `}).join("")}
        </div>

        <!-- PANEL INTERACTIVO DE CONSULTA Y RESPUESTA -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 16px;">
          
          <!-- CAJA DE CONSULTA Y PREGUNTAS FRECUENTES -->
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 18px;">${a.icon}</span>
              <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #0f172a;">Preguntas Rápidas en ${a.title}</h3>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
              ${n.map(o=>`
                <button type="button" class="btn-quick-query" data-query="${o}" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #334155; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; cursor: pointer; text-align: left;">
                  💡 ${o}
                </button>
              `).join("")}
            </div>

            <div style="display: flex; gap: 8px;">
              <input type="text" id="advisor-input" placeholder="Escribe tu consulta sobre ${a.title.toLowerCase()}..." style="flex: 1; height: 42px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 600; padding: 0 12px; outline: none; color: #0f172a;" />
              <button type="button" id="btn-send-advisor" style="background: #f97316; color: #ffffff; border: none; padding: 0 20px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(249,115,22,0.3);">
                ✨ Consultar
              </button>
            </div>
          </div>

          <!-- HISTORIAL / RESULTADOS GENERADOS -->
          <div id="advisor-output-container" style="display: flex; flex-direction: column; gap: 14px;">
            ${this.chatHistory.length===0?`
              <div style="background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 14px; padding: 30px; text-align: center; color: #64748b;">
                <span style="font-size: 32px; display: block; margin-bottom: 8px;">🏀👨‍👩‍👧‍👦</span>
                <strong style="font-size: 14px; color: #334155; display: block;">Bienvenido al Asesor Educativo y Familiar</strong>
                <p style="margin: 4px 0 0 0; font-size: 12px;">Selecciona una pregunta rápida o escribe tu consulta para recibir pautas prácticas adaptadas.</p>
              </div>
            `:this.chatHistory.map(o=>`
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 11px; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 2px 8px; border-radius: 6px;">
                    ${o.categoryTitle} · ${o.audienceLabel}
                  </span>
                  <span style="font-size: 10px; color: #94a3b8;">${o.timestamp}</span>
                </div>
                <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 10px;">❓ ${o.query}</strong>
                <div style="font-size: 13px; line-height: 1.6; color: #334155; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 14px;">
                  ${this._formatMarkdownResponse(o.response)}
                </div>
              </div>
            `).join("")}
          </div>

        </div>

      </div>
    `,this._bindEvents(t)}_formatMarkdownResponse(e){return e.replace(/\*\*(.*?)\*\*/g,'<strong style="color: #0f172a;">$1</strong>').replace(/^\* (.*?)$/gm,'<li style="margin-bottom: 4px;">$1</li>').replace(/(<li.*<\/li>)/s,'<ul style="padding-left: 18px; margin: 8px 0;">$1</ul>').replace(/\n\n/g,"<br/><br/>")}_bindEvents(e){e.querySelectorAll(".btn-audience").forEach(a=>{a.addEventListener("click",()=>{this.targetAudience=a.getAttribute("data-aud"),this.render()})}),e.querySelectorAll(".btn-category-card").forEach(a=>{a.addEventListener("click",()=>{this.activeCategory=a.getAttribute("data-cat"),this.render()})}),e.querySelectorAll(".btn-quick-query").forEach(a=>{a.addEventListener("click",()=>{const n=a.getAttribute("data-query");this._handleAdvisorQuery(n)})});const t=e.querySelector("#btn-send-advisor"),i=e.querySelector("#advisor-input");t==null||t.addEventListener("click",()=>{var n;const a=(n=i==null?void 0:i.value)==null?void 0:n.trim();a&&this._handleAdvisorQuery(a)}),i==null||i.addEventListener("keydown",a=>{var n;if(a.key==="Enter"){const o=(n=i.value)==null?void 0:n.trim();o&&this._handleAdvisorQuery(o)}})}async _handleAdvisorQuery(e){var o,s;(o=this.container)==null||o.querySelector("#advisor-input");const t=(s=this.container)==null?void 0:s.querySelector("#btn-send-advisor");t&&(t.disabled=!0,t.textContent="⏳ Analizando...");const i=await d.askAdvisor(this.activeCategory,e,this.targetAudience),a=d.CATEGORIES[this.activeCategory],n={familias:"Familias",jovenes:"Jugadores/as",adultos:"Sénior / Adultos"};this.chatHistory.unshift({categoryTitle:a.title,audienceLabel:n[this.targetAudience],query:e,response:i,timestamp:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}),this.render()}}export{x as FamilyAdvisorView};
