/**
 * @fileoverview Family Home V70: concise, accessible overview from already-authorized data.
 * @description Pure presentation; no protected reads, ratings, diagnoses or speculative zeroes.
 * Reuses the existing Family RPC boundary, goals, cycles and longitudinal passport.
 */
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const rows = v => Array.isArray(v) ? v : [];
const known = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const fmt = v => known(v) ? Number(v).toLocaleString("es-ES",{maximumFractionDigits:1}) : "N/D";
const sentence = (v, fallback) => String(v ?? "").trim() || fallback;
const gameDate = v => /^\d{4}-\d{2}-\d{2}/.test(String(v||"")) ? String(v).slice(0,10) : null;

/** Never treat a missing score/minute as zero. Never fabricate verified progress. */
export function buildFamilyHomeV70({passport={},growth={},story=null,plan={},cycleProjection={},playerId="",selectedPlayer=null,contributionsAvailable=false}={}) {
  const totals=passport.career_totals||{};
  const player=passport.player||{};
  const name=[player.first_name,player.last_name].filter(Boolean).join(" ").trim()
    || [selectedPlayer?.first_name,selectedPlayer?.last_name].filter(Boolean).join(" ").trim() || "Mi jugador";
  const career=rows(passport.career);
  const games=rows(passport.recent_games).slice().sort((a,b)=>String(b?.date||"").localeCompare(String(a?.date||"")));
  const latest=games[0]||null;
  const objective=growth?.objective;
  const cycle=cycleProjection?.allowed ? cycleProjection?.current_cycle : null;
  const actions=rows(cycle?.actions);
  const active=actions.find(a=>!["COMPLETED","SKIPPED"].includes(String(a?.status||"").toUpperCase()));
  const next=sentence(active?.title,
    plan?.allowed ? sentence(plan?.actions?.[0],"") : "") ||
    sentence(story?.next?.[0],"Pide al entrenador un objetivo concreto para esta semana.");
  const evolution=story?.enoughEvidence
    ? sentence(story?.evolution?.[0],"Hay registros disponibles, pero no una mejora concluyente.")
    : sentence(growth?.title,"Seguimos construyendo un historial de rendimiento.");
  return {
    name, playerId:String(playerId||""),
    games: fmt(totals.games), minutes:fmt(totals.minutes), seasons:career.length,
    latest: latest ? {date:gameDate(latest.date),opponent:sentence(latest.opponent,"Rival"),points:fmt(latest.points),minutes:fmt(latest.minutes)} : null,
    evolution, objective:sentence(objective?.title||plan?.objectiveTitle,"Aún no hay un objetivo compartido."),
    next, actionStatus: active?.status||null,
    complete:actions.filter(a=>String(a?.status||"").toUpperCase()==="COMPLETED").length,
    actionCount:actions.length,
    career:career.map(row=>({
      season:sentence(row?.season_name,"Temporada"),
      team:sentence(row?.team_name,"Equipo"),
      club:sentence(row?.club_name,""),
      games:fmt(row?.games),
      points:fmt(row?.points)
    })),
    hasSharedEvaluation:Boolean(story?.latestEvaluation),
    shareableSummary:story?.latestEvaluation?.summary||null,
    contributionsAvailable:Boolean(contributionsAvailable)
  };
}

function familyHomeStyles() {
  return '<style id="family-home-v70-css">'+
    '.family-home-v70{display:grid;gap:12px;margin:16px 0;color:#172334}.family-home-v70 *{box-sizing:border-box}'+
    '.fh70-card{padding:18px;border:1px solid #d9e4f1;background:#fff;border-radius:17px;min-width:0}'+
    '.fh70-lead{background:linear-gradient(135deg,#eef6ff,#f5f3ff)}.fh70-kicker{font-size:11px!important;text-transform:uppercase;color:#235ca0!important;font-weight:900;letter-spacing:.07em;margin:0}'+
    '.fh70-card h2{font-size:clamp(20px,4.8vw,26px);margin:5px 0 10px}.fh70-card h3{font-size:16px;margin:4px 0}'+
    '.fh70-card p{font-size:14px;line-height:1.55;margin:5px 0;color:#334155}'+
    '.fh70-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:14px 0}'+
    '.fh70-stat{background:#fff;border:1px solid #dbeafe;border-radius:12px;padding:10px;display:grid;gap:4px}'+
    '.fh70-stat strong{font-size:clamp(18px,4vw,24px);overflow-wrap:anywhere}.fh70-stat span,.fh70-muted{font-size:12px;color:#475569}'+
    '.fh70-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}'+
    '.fh70-focus{border-left:4px solid #2563eb;padding-left:12px}.fh70-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}'+
    '.fh70-link{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:9px 13px;border-radius:11px;background:#1e40af;color:#fff;text-decoration:none;font-size:13px;font-weight:800}'+
    '.fh70-link.secondary{background:#eff6ff;border:1px solid #93c5fd;color:#1e40af}.fh70-link:focus-visible{outline:3px solid #2563eb;outline-offset:2px}'+
    '.fh70-timeline{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:9px}.fh70-timeline li{border-left:3px solid #93c5fd;padding:5px 0 6px 12px}'+
    '.fh70-timeline strong,.fh70-timeline span{display:block}.fh70-timeline span{font-size:12px;color:#64748b}'+
    '.family-deep-dive{margin:18px 0;border:1px solid #cbd5e1;border-radius:16px;padding:12px;background:#f8fafc}'+
    '.family-deep-dive>summary{cursor:pointer;font-weight:900;color:#1e3a8a;min-height:44px;display:flex;align-items:center;padding:8px}'+
    '@media(max-width:680px){.fh70-grid{grid-template-columns:1fr}.fh70-card{padding:14px}.fh70-stats{gap:6px}.fh70-stat{padding:8px}.fh70-actions{display:grid}.fh70-link{width:100%}}'+
    '</style>';
}

/** Screen-reader labels, no synthetic scoring, no raw HTML from player records. */
export function renderFamilyHomeV70(model) {
  const m=model||{};
  const latest=m.latest
    ? 'Último partido: '+esc(m.latest.opponent)+' · '+esc(m.latest.points)+' puntos · '+esc(m.latest.minutes)+' minutos'+(m.latest.date?' · '+esc(m.latest.date):'')
    : 'Todavía no hay un partido reciente registrado.';
  const career=rows(m.career).slice(0,8).map(item =>
    '<li><strong>'+esc(item.season)+' · '+esc(item.team)+'</strong><span>'+esc(item.club||'')+
    ' · '+esc(item.games)+' partidos</span></li>').join("");
  const href=encodeURIComponent(String(m.playerId||""));
  return familyHomeStyles()+
    '<section class="family-home-v70" aria-label="Mi jugador, resumen familiar">'+
    '<article class="fh70-card fh70-lead"><p class="fh70-kicker">Mi jugador · de un vistazo</p>'+
    '<h2>'+esc(m.name||"Mi jugador")+'</h2>'+
    '<p>Su historia deportiva: resultados, evolución y próximos pasos, sin comparaciones innecesarias.</p>'+
    '<div class="fh70-stats" aria-label="Datos básicos del pasaporte">'+
    '<div class="fh70-stat"><strong>'+esc(m.games)+'</strong><span>Partidos</span></div>'+
    '<div class="fh70-stat"><strong>'+esc(m.minutes)+'</strong><span>Minutos registrados</span></div>'+
    '<div class="fh70-stat"><strong>'+esc(m.seasons)+'</strong><span>Temporadas</span></div></div>'+
    '<p class="fh70-muted">'+latest+'</p></article>'+
    '<div class="fh70-grid">'+
    '<article class="fh70-card"><p class="fh70-kicker">¿Cómo evoluciona?</p><h3>Progreso con contexto</h3><p>'+esc(m.evolution)+'</p>'+
    (m.hasSharedEvaluation && m.shareableSummary ? '<p><strong>Evaluación compartida:</strong> '+esc(m.shareableSummary)+'</p>' : '')+
    '</article>'+
    '<article class="fh70-card"><p class="fh70-kicker">¿Qué trabajar ahora?</p>'+
    '<div class="fh70-focus"><h3>'+esc(m.objective)+'</h3><p>'+esc(m.next)+'</p></div>'+
    (m.actionCount ? '<p class="fh70-muted">'+esc(m.complete)+' de '+esc(m.actionCount)+' acciones registradas como completadas por el staff.</p>' : '')+
    '</article></div>'+
    '<article class="fh70-card"><p class="fh70-kicker">Mi desarrollo</p><h3>Una historia, muchas temporadas</h3>'+
    (career?'<ol class="fh70-timeline">'+career+'</ol>':'<p>Las temporadas se mostrarán aquí cuando haya registros autorizados.</p>')+
    '<div class="fh70-actions">'+
    '<a class="fh70-link" href="#/passport/'+href+'">Abrir pasaporte deportivo</a>'+
    '<a class="fh70-link secondary" href="#/player360/'+href+'">Ver objetivos y evaluaciones</a>'+
    (m.contributionsAvailable?'<a class="fh70-link secondary" href="#/player360/'+href+'">Añadir información del jugador</a>':'')+
    '</div></article>'+
    '<p class="fh70-muted">Las tendencias dependen del contexto, el número de partidos y la calidad de los datos. N/D no significa cero.</p></section>';
}
export default renderFamilyHomeV70;
