/**
 * @fileoverview Compact, read-only family passport preview.
 * This never exposes the 69-attribute staff editor or bypasses licence/RBAC.
 */
import {presentFamilyPassportBrief} from "../../domain/family/FamilyPassportBriefPresenter.js";
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function stat(label,value,detail=''){
  return `<div class="family-passport-mini-stat"><span>${esc(label)}</span>
    <strong>${esc(value)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</div>`;
}
export function renderFamilyPassportBrief(payload={},passport={}){
 const m=presentFamilyPassportBrief(payload,passport);
 if(!m.available)return `<section class="family-passport-brief" aria-label="Pasaporte del jugador">
   <h2>Pasaporte en un vistazo</h2><p>${esc(m.message)}</p></section>`;
 const t=m.training,c=m.competition,q=m.evaluation;
 const training=t.available
  ?stat('Asistencia registrada',t.recorded,'Sin confundirla con las horas confirmadas')+
   stat('Horas confirmadas',t.accredited,'Entrenamientos revisados por el entrenador')+
   stat('Pendiente de validar',t.pending,'No significa que el jugador no haya entrenado')
  :stat('Entrenamientos','No disponibles','Tu plan o tus permisos no incluyen estos datos');
 const competition=c.available
   ?`<p class="family-passport-short">En competición constan <strong>${esc(c.games)} partidos</strong> y <strong>${esc(c.minutes??'N/D')} minutos</strong> registrados. Son datos, no una nota sobre el talento.</p>`
   :'<p class="family-passport-short">Las estadísticas de partidos no están disponibles en este plan o contexto.</p>';
 const quality=q.available
   ?`<p class="family-passport-short">Valoraciones: <strong>${esc(q.documented)} de ${esc(q.rated)}</strong> atributos puntuados tienen las observaciones mínimas anotadas.${q.needsEvidence?
       ` Hay ${esc(q.needsEvidence)} que necesitan documentación adicional.`:''} Esto no equivale a una validación científica.</p>`
   :'<p class="family-passport-short">Las valoraciones técnicas detalladas se consultan cuando el pasaporte avanzado está incluido en la licencia.</p>';
 return `<section class="family-passport-brief" aria-labelledby="family-passport-title">
   <style>
    .family-passport-brief{background:#fff;border:1px solid #d6deeb;border-radius:18px;padding:18px;margin:14px 0;color:#10233c;box-shadow:0 5px 20px rgba(15,23,42,.04)}
    .family-passport-brief *{box-sizing:border-box}
    .family-passport-brief h2{margin:4px 0 6px;font-size:clamp(21px,4vw,28px);line-height:1.22}
    .family-passport-brief .family-passport-eyebrow{font-size:11px;font-weight:800;letter-spacing:.07em;color:#4c1d95;margin:0}
    .family-passport-brief .family-passport-context{margin:4px 0 16px;font-size:14px;color:#475569}
    .family-passport-mini-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .family-passport-mini-stat{background:#f4f6fa;border-radius:11px;padding:13px;display:grid;gap:5px}
    .family-passport-mini-stat span{font-size:12px;color:#334155}
    .family-passport-mini-stat strong{font-size:clamp(17px,2.8vw,22px);font-variant-numeric:tabular-nums}
    .family-passport-mini-stat small,.family-passport-brief .family-passport-short{font-size:12px;line-height:1.55;color:#475569}
    .family-passport-short{margin:12px 0 0}
    .family-passport-brief .family-passport-quality{border-top:1px solid #e2e8f0;margin-top:13px;padding-top:3px}
    @media(max-width:580px){.family-passport-brief{padding:14px}.family-passport-mini-grid{grid-template-columns:1fr}.family-passport-mini-stat{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:5px}.family-passport-mini-stat small{width:100%}}
   </style>
   <p class="family-passport-eyebrow">SU HISTORIA, NO SU EQUIPO</p>
   <h2 id="family-passport-title">Pasaporte en un vistazo</h2>
   <p class="family-passport-context">${esc([m.category,m.team,m.season].filter(Boolean).join(' · ')||'Categoría por confirmar')}</p>
   <div class="family-passport-mini-grid">${training}</div>
   <div class="family-passport-quality">${competition}${quality}</div>
 </section>`;
}
export default renderFamilyPassportBrief;
