import{I as A,D as b,S as I,a as v,A as _,T as S,P as L}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class w{static buildSystemPrompt(e={}){var d;const a=A.getLocale()||"es",f={es:"Spanish (Español)",ca:"Catalan (Català)",cat:"Catalan (Català)",en:"English",fr:"French (Français)"}[a]||"Spanish (Español)",o=b.getGames()||[],u=I.filterPlayedGames(o),h=b.getPlayers()||[],p=b.getPlayerGameStats()||[],m=b.getActiveSeason()||"2026",i=v.aggregateTeamSeasonStats(u);let s="Sin datos suficientes de partidos finalizados.";i&&(s=`
- Partidos Jugados: ${i.record.gamesPlayed} (W: ${i.record.wins} | L: ${i.record.losses} | Win%: ${i.record.winPercentage}%)
- Puntos: ${i.points.avgFor} PPG a favor vs ${i.points.avgAgainst} PPG en contra (Diff: ${(i.points.avgFor-i.points.avgAgainst).toFixed(1)})
- Eficiencia: ORtg ${i.seasonReport.offensiveRating} | DRtg ${i.seasonReport.defensiveRating} | Net Rating ${i.seasonReport.netRating}
- Ritmo y Tiro: Pace ${i.seasonReport.pace} | eFG% ${i.seasonReport.fourFactors.team.eFG}% | TOV% ${i.seasonReport.fourFactors.team.tovPct}%
      `.trim());const g=h.map(t=>{const $=p.filter(y=>String(y.playerId??y.player_id)===String(t.id)),x=v.aggregatePlayerSeasonStats($);if(!x||x.totals.gp===0)return`#${t.jersey??"?"} ${t.fullName||t.name||"Jugador"} (${t.position||"N/D"}): Sin partidos disputados.`;const{averages:r,shooting:n}=x;return`#${t.jersey??"?"} ${t.fullName||t.name||"Jugador"} (${t.position||"N/D"}): ${r.gp} PJ | ${r.min} MIN | ${r.ppg} PTS | ${r.rpg} REB (${r.orb} OF / ${r.drb} DF) | ${r.apg} AST | ${r.spg} STL | ${r.bpg} BLK | ${r.topg} TOV | VAL/PIR: ${r.pir} | GameScore: ${r.gameScore} | %2P: ${n.pct2P}% | %3P: ${n.pct3P}% | %TL: ${n.pctFT}% | eFG%: ${n.eFG}% | TS%: ${n.tsPct}%.`}).join(`
`),c=o.map((t,$)=>{const x=t.status||"FINISHED",r=t.teamScore!==void 0&&t.opponentScore!==void 0?`${t.teamScore} - ${t.opponentScore}`:`${t.team_score??0} - ${t.opponent_score??0}`,n=Number(t.teamScore??t.team_score??0)-Number(t.opponentScore??t.opponent_score??0),y=n>0?"VICTORIA":n<0?"DERROTA":"EMPATE";return`P${$+1} (${t.date||"Fecha N/D"}): vs ${t.opponentName||t.opponent||"Rival"} (${t.venue||"Local"}) -> ${r} (${y}, Diff: ${n>0?"+"+n:n}) [${x}]`}).join(`
`);return`
You are the Official Tactical & Statistical Basketball Analyst Assistant for ${(d=_)==null?void 0:d.appName}.

CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST provide your ENTIRE answer strictly in ${f}.
2. Tone: Professional, direct, highly tactical, analytical, and coach-oriented.
3. Use Markdown structuring, bullet points, and compact tables when comparing players or games.
4. Base your tactical conclusions strictly on the official dataset provided below.

=== RESUMEN COLECTIVO DEL EQUIPO (TEMPORADA ${m}) ===
${s}

=== RENDIMIENTO INDIVIDUAL DE LA PLANTILLA ===
${g||"Sin datos de jugadores registrados."}

=== REGISTRO DE PARTIDOS (P1 - P${o.length}) ===
${c||"Sin datos de partidos registrados."}
`.trim()}static buildUserPrompt(e){return e?String(e).trim():""}}class T{constructor(e=null){this.auth=e,this.messages=[],this.isLoading=!1,this.apiKey=localStorage.getItem("iq_groq_api_key")||"",this.model="llama-3.3-70b-versatile"}t(e,a=""){return(S?S.t(e,a):A.t(e,a))||a}_canAccess(){var e,a;return!!((a=(e=this.auth)==null?void 0:e.canPreview)!=null&&a.call(e,L.USE_AI))}_getRoleLimit(){var a,l;const e=(l=(a=this.auth)==null?void 0:a.getAiMonthlyLimit)==null?void 0:l.call(a,{preview:!0});return e===1/0?-1:Number(e??0)}_getMonthlyUsage(){const e=new Date().toISOString().substring(0,7);return localStorage.getItem("iq_ai_usage_month")!==e?(localStorage.setItem("iq_ai_usage_month",e),localStorage.setItem("iq_ai_usage_count","0"),0):parseInt(localStorage.getItem("iq_ai_usage_count")||"0",10)}_incrementMonthlyUsage(){const e=this._getMonthlyUsage();localStorage.setItem("iq_ai_usage_count",String(e+1))}_hasReachedLimit(){const e=this._getRoleLimit();return e===-1?!1:this._getMonthlyUsage()>=e}async _queryGroqAI(e){var h,p,m,i;if(!this.apiKey)throw new Error(this.t("ai.errors.noApiKey","API Key no configurada. Por favor introduce tu clave de Groq Cloud."));const a=w.buildSystemPrompt?w.buildSystemPrompt():"Eres el Asistente Analítico oficial de IQ Basket.",l="https://api.groq.com/openai/v1/chat/completions",f={model:this.model,messages:[{role:"system",content:a},...this.messages.map(s=>({role:s.role,content:s.text})),{role:"user",content:e}],temperature:.3,max_tokens:1024},o=await fetch(l,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${this.apiKey}`},body:JSON.stringify(f)});if(!o.ok){const s=await o.json().catch(()=>({}));throw new Error(((h=s==null?void 0:s.error)==null?void 0:h.message)||"Error al conectar con la API de Groq AI.")}const u=await o.json();return((i=(m=(p=u==null?void 0:u.choices)==null?void 0:p[0])==null?void 0:m.message)==null?void 0:i.content)||this.t("ai.errors.invalidReply","No se pudo obtener una respuesta válida.")}async render(e="dashboard-content-area"){var m,i;const a=document.getElementById(e)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;if(!a)return;if(!this._canAccess()){a.innerHTML=`
        <div style="padding: 40px; text-align: center; background: white; border-radius: 14px; border: 1px solid #fecaca; max-width: 600px; margin: 40px auto;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔒</div>
          <h2 style="margin: 0 0 8px 0; color: #991b1b; font-size: 18px; font-weight: 800;">Acceso no permitido</h2>
          <p style="color: #7f1d1d; font-size: 13px; margin: 0 0 20px 0;">Tu rol de usuario de JUGADOR no tiene acceso al Asistente IA.</p>
          <a href="#/dashboard" style="background: #1e3a8a; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 13px; display: inline-block;">Volver al Dashboard</a>
        </div>
      `;return}const l=this._getRoleLimit(),f=this._getMonthlyUsage(),o=this._hasReachedLimit(),u=l===-1?"Consultas ilimitadas":`${f} / ${l} consultas este mes`,h=this.messages.map(s=>`
      <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-direction: ${s.role==="user"?"row-reverse":"row"};">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: ${s.role==="user"?"#1e3a8a":"var(--color-primary, #f97316)"}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0;">
          ${s.role==="user"?"👤":"🤖"}
        </div>
        <div style="max-width: 82%; background: ${s.role==="user"?"#1e3a8a":"white"}; color: ${s.role==="user"?"white":"#0f172a"}; border: 1px solid ${s.role==="user"?"#1e3a8a":"#e2e8f0"}; border-radius: 12px; padding: 12px 16px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
          ${s.text}
        </div>
      </div>
    `).join("");a.innerHTML=`
      <div style="max-width: 900px; margin: 0 auto; font-family: var(--font-family-base, system-ui); min-height: calc(100vh - 120px); display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">🤖 ${this.t("ai.title","Pregúntale a tus datos (Asistente IA)")}</h1>
            <span style="font-size: 12px; color: #64748b;">${this.t("ai.subtitle","Consultas tácticas sobre partidos y jugadores en tiempo real")}</span>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 11px; font-weight: 800; color: ${o?"#dc2626":"#1e3a8a"}; background: ${o?"#fee2e2":"#f1f5f9"}; padding: 6px 12px; border-radius: 20px; border: 1px solid ${o?"#fca5a5":"#cbd5e1"};">
              📊 ${u}
            </span>

            <button id="btn-config-key" style="background: white; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer; min-height: 44px;">
              ⚙️ ${this.apiKey?this.t("ai.status.configured","API Key Configurada"):this.t("ai.status.unconfigured","Configurar API Key Gratis")}
            </button>
          </div>
        </div>

        ${o?`
          <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 16px; border-radius: 10px; font-size: 12px; font-weight: 700; margin-bottom: 16px;">
            ⚠️ Has alcanzado el límite máximo mensual de consultas permitidas para tu rol (${l} consultas/mes). El campo de pregunta se encuentra bloqueado hasta el próximo mes.
          </div>
        `:""}

        <!-- Botones de Sugerencias Tácticas -->
        <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 6px;">
          <button class="btn-prompt-chip" data-prompt="${this.t("ai.suggestions.topScorers","¿Quién es nuestro máximo anotador y cuál es su promedio de valoración por partido?")}" ${o?"disabled":""} style="background: white; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #1e3a8a; cursor: ${o?"not-allowed":"pointer"}; opacity: ${o?"0.5":"1"}; white-space: nowrap; min-height: 44px;">
            💡 Líderes de anotación y VAL
          </button>
          <button class="btn-prompt-chip" data-prompt="${this.t("ai.suggestions.homeAway","Resume el rendimiento del equipo en los partidos como Local vs Visitante.")}" ${o?"disabled":""} style="background: white; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #1e3a8a; cursor: ${o?"not-allowed":"pointer"}; opacity: ${o?"0.5":"1"}; white-space: nowrap; min-height: 44px;">
            🏟️ Rendimiento Local vs Visitante
          </button>
          <button class="btn-prompt-chip" data-prompt="${this.t("ai.suggestions.tacticalDiagnosis","¿Qué aspectos defensivos u ofensivos deberíamos mejorar según los resultados obtenidos?")}" ${o?"disabled":""} style="background: white; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #1e3a8a; cursor: ${o?"not-allowed":"pointer"}; opacity: ${o?"0.5":"1"}; white-space: nowrap; min-height: 44px;">
            📋 Diagnóstico Táctico Global
          </button>
        </div>

        <!-- Área de Mensajes del Chat -->
        <div id="chat-messages-box" style="flex: 1; min-height: 350px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; overflow-y: auto; margin-bottom: 16px;">
          ${this.messages.length===0?`
            <div style="text-align: center; color: #94a3b8; margin-top: 80px;">
              <span style="font-size: 44px; display: block; margin-bottom: 10px;">🏀</span>
              <strong style="font-size: 15px; color: #334155; display: block;">${this.t("ai.welcome.title","¡Hola Entrenador! Soy tu Asistente Táctico de IQ Basket.")}</strong>
              <p style="font-size: 12px; margin-top: 6px; color: #64748b; max-width: 450px; margin-left: auto; margin-right: auto;">
                ${this.t("ai.welcome.message","Tengo acceso en tiempo real a los partidos y estadísticas de tu plantilla. Hazme cualquier pregunta sobre el equipo.")}
              </p>
            </div>
          `:h}
        </div>

        <!-- Formulario de Entrada de Pregunta -->
        <form id="form-ask-ai" style="display: flex; gap: 8px;">
          <input type="text" id="input-ai-prompt" placeholder="${o?"Límite mensual alcanzado":this.t("ai.input.placeholder","Escribe tu consulta táctica...")}" ${this.isLoading||o?"disabled":""} style="flex: 1; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; outline: none; background: ${o?"#f1f5f9":"white"}; min-height: 44px;" />
          <button type="submit" ${this.isLoading||o?"disabled":""} style="background: ${o?"#cbd5e1":"var(--color-primary, #f97316)"}; color: ${o?"#64748b":"white"}; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: ${o?"not-allowed":"pointer"}; display: flex; align-items: center; gap: 6px; min-height: 44px;">
            ${this.isLoading?"⏳ ...":this.t("send","Enviar 🚀")}
          </button>
        </form>

      </div>
    `;const p=a.querySelector("#chat-messages-box");p&&(p.scrollTop=p.scrollHeight),(m=a.querySelector("#btn-config-key"))==null||m.addEventListener("click",()=>{const s=prompt(this.t("ai.promptApiKey","Introduce tu API Key Gratuita de Groq Cloud (console.groq.com):"),this.apiKey);s!==null&&(this.apiKey=s.trim(),localStorage.setItem("iq_groq_api_key",this.apiKey),this.render(e))}),a.querySelectorAll(".btn-prompt-chip").forEach(s=>{s.addEventListener("click",()=>{var d;if(this._hasReachedLimit()){alert("⚠️ Has alcanzado el límite mensual de consultas para tu rol.");return}const g=s.getAttribute("data-prompt"),c=a.querySelector("#input-ai-prompt");c&&(c.value=g,(d=a.querySelector("#form-ask-ai"))==null||d.dispatchEvent(new Event("submit")))})}),(i=a.querySelector("#form-ask-ai"))==null||i.addEventListener("submit",async s=>{var d;if(s.preventDefault(),this._hasReachedLimit()){alert("⚠️ Has alcanzado el límite máximo de interacciones mensuales permitidas para tu rol.");return}const g=a.querySelector("#input-ai-prompt"),c=(d=g==null?void 0:g.value)==null?void 0:d.trim();if(!(!c||this.isLoading)){this.messages.push({role:"user",text:c}),this.isLoading=!0,this._incrementMonthlyUsage(),this.render(e);try{const t=await this._queryGroqAI(c);this.messages.push({role:"assistant",text:t})}catch(t){this.messages.push({role:"assistant",text:`⚠️ Error: ${t.message}`})}finally{this.isLoading=!1,this.render(e)}}})}}export{T as AskAIView};
