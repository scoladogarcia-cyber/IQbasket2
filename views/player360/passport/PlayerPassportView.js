
/**
 * @fileoverview Responsive premium Player Passport view.
 * @description Collectible-card inspired identity plus evidence-based longitudinal profile.
 * No synthetic overall rating is calculated or displayed.
 */
import { DataStore } from "../../../services/DataStore.js";
import { PlayerPassportService } from "../../../services/player360/PlayerPassportService.js";
import { Permission } from "../../../security/PermissionService.js";
import { ageOnDate } from "../../../domain/player360/PlayerAge.js";
import { latestScoresByAttribute, summarizePassport, rightLeftAsymmetries } from "../../../domain/player360/PlayerPassportScoring.js";
import { deriveFunctionalRoles } from "../../../domain/player360/PlayerPassportRoles.js";
import { PLAYER_PASSPORT_CONFIG } from "../../../config/player-passport.config.js";

function esc(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function pName(p) {
  p = p || {};
  return p.name || [p.first_name,p.last_name].filter(Boolean).join(" ") || [p.firstName,p.lastName].filter(Boolean).join(" ") || "Jugador";
}
function pPhoto(p) { p=p||{}; return p.photo_url || p.avatar_url || p.image_url || p.photo || ""; }
function pNumber(p) { p=p||{}; return p.number == null ? (p.jersey_number == null ? (p.dorsal == null ? "—" : p.dorsal) : p.jersey_number) : p.number; }
function pPosition(p) { p=p||{}; return p.position || p.position_name || "—"; }
function initials(name) { return String(name||"").split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join("").toUpperCase() || "IQ"; }
function today() {
  var d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}
function pct(value) { return Math.round(Math.max(0,Math.min(1,Number(value)||0))*100)+"%"; }

export class PlayerPassportView {
  constructor(supabaseClient, authController) {
    this.supabase = supabaseClient && (supabaseClient.supabase || supabaseClient.default) || supabaseClient;
    this.auth = authController;
    this.service = new PlayerPassportService(this.supabase);
    this.containerId = "dashboard-content-area";
    this.teamId = null;
    this.teamSeasonId = null;
    this.playerId = null;
    this.data = null;
    this.error = null;
    this.editorOpen = false;
    this.filterContext = "P5";
    this.filterDimension = "";
    this.filterSubdimension = "";
  }

  _context() {
    return { teamId:this.teamId, teamSeasonId:this.teamSeasonId, playerId:this.playerId, playerTeamId:this.teamId };
  }
  _can(permission) {
    if (typeof (this.auth && this.auth.canPreview) === "function") return Boolean(this.auth.canPreview(permission,this._context()));
    if (typeof (this.auth && this.auth.can) === "function") return Boolean(this.auth.can(permission,this._context()));
    return false;
  }
  _seasonId() {
    var c=DataStore.getActiveSeasonContext && DataStore.getActiveSeasonContext(this.teamId);
    return (DataStore.getActiveTeamSeasonId && DataStore.getActiveTeamSeasonId()) || (c && (c.team_season_id || c.teamSeasonId)) || null;
  }
  _players() {
    var rows=(DataStore.getPlayers && DataStore.getPlayers()) || DataStore.players || [];
    return Array.isArray(rows) ? rows : [];
  }
  _ownPlayerId() {
    var u=(this.auth && this.auth.getCurrentUser && this.auth.getCurrentUser()) || (DataStore.permissionService && DataStore.permissionService.getCurrentUser && DataStore.permissionService.getCurrentUser()) || {};
    return u.playerId || u.player_id || u.linkedPlayerId || u.linked_player_id || null;
  }

  async render(containerId, playerId, teamId) {
    this.containerId=containerId || "dashboard-content-area";
    this.teamId=teamId || (DataStore.getActiveTeamId && DataStore.getActiveTeamId()) || null;
    this.teamSeasonId=this._seasonId();
    this.playerId=playerId || this._ownPlayerId() || null;
    if (!this.playerId) { this._renderPicker(); return; }
    await this._load();
    this._render();
  }

  async _load() {
    this.error=null;
    this._renderLoading();
    try {
      if (!this.teamSeasonId) throw new Error("Selecciona una temporada antes de abrir el pasaporte.");
      this.data=await this.service.getPassport({playerId:this.playerId,teamSeasonId:this.teamSeasonId});
    } catch (e) { this.error=e; console.error("[PlayerPassportView]",e); }
  }

  _model() {
    var attrs=(this.data && this.data.catalog && this.data.catalog.attributes) || [];
    var evaluations=(this.data && this.data.evaluations) || [];
    var summary=summarizePassport(attrs,evaluations,{
      strengthThreshold:PLAYER_PASSPORT_CONFIG.strengthThreshold,
      limiterThreshold:PLAYER_PASSPORT_CONFIG.limiterThreshold
    });
    var latest=latestScoresByAttribute(evaluations);
    return {
      summary:summary,
      latest:latest,
      roles:deriveFunctionalRoles(latest,{minimumCoverage:PLAYER_PASSPORT_CONFIG.roleCoverageThreshold}),
      asymmetries:rightLeftAsymmetries(summary.attributes)
    };
  }

  _renderLoading() {
    var el=document.getElementById(this.containerId); if(!el)return;
    el.innerHTML='<div class="pp-loading" role="status"><span class="pp-spinner"></span><strong>Cargando Pasaporte del Jugador…</strong></div>'+this._styles();
  }

  _renderPicker() {
    var el=document.getElementById(this.containerId); if(!el)return;
    var cards=this._players().map(function(p){
      var n=pName(p);
      return '<a class="pp-pick" href="#/passport/'+esc(p.id)+'"><span class="pp-avatar">'+esc(initials(n))+'</span><span><strong>'+esc(n)+'</strong><small>#'+esc(pNumber(p))+' · '+esc(pPosition(p))+'</small></span><b>→</b></a>';
    }).join("");
    el.innerHTML='<section class="pp-page"><header class="pp-picker"><span class="pp-eyebrow">IQBASKET · PLAYER PASSPORT</span><h1>Pasaporte del Jugador</h1><p>Selecciona un jugador para abrir su perfil longitudinal.</p></header><div class="pp-pick-grid">'+(cards||'<div class="pp-empty">No hay jugadores disponibles.</div>')+'</div></section>'+this._styles();
  }

  _pips(score) {
    if (score == null) return '<span class="pp-ne">NE</span>';
    var dots="";
    for(var i=1;i<=5;i++) dots+='<i class="'+(i<=score?"on":"")+'"></i>';
    return '<span class="pp-pips" aria-label="'+score+' de 5">'+dots+'</span>';
  }

  _hero(model) {
    var p=this.data.player||{}, t=this.data.team||{}, name=pName(p), photo=pPhoto(p);
    var age=ageOnDate(p.birth_date||null);
    var roles=model.roles.filter(function(r){return r.status==="AVAILABLE";}).slice(0,3);
    var strengths=model.summary.strengths.slice(0,4);
    var roleHtml=roles.length ? roles.map(function(r){return '<span>'+esc(r.label)+' <b>'+r.score.toFixed(1)+'</b></span>';}).join("") : '<span>Datos insuficientes</span>';
    var strengthHtml=strengths.length ? strengths.map(function(x){return '<span>'+esc(x.name)+' <b>'+x.latest.score+'/5</b></span>';}).join("") : '<span>Aún sin evidencia suficiente</span>';
    var art=photo ? '<img src="'+esc(photo)+'" alt="Foto de '+esc(name)+'" loading="lazy">' : '<div class="pp-silhouette">'+esc(initials(name))+'</div>';
    return '<section class="pp-hero">'+
      '<div class="pp-identity"><span class="pp-eyebrow">IQBASKET · PLAYER PASSPORT</span><h1>'+esc(name)+'</h1><p>Perfil longitudinal basado en evidencia, contexto y evolución.</p>'+
      '<div class="pp-meta"><span><b>#</b> '+esc(pNumber(p))+'</span><span><b>POS</b> '+esc(pPosition(p))+'</span><span><b>EDAD</b> '+esc(age==null?"—":age)+'</span><span><b>NAC.</b> '+esc(p.birth_date||"—")+'</span></div>'+
      '<div class="pp-meta"><span><b>EQUIPO</b> '+esc(t.team_name||"—")+'</span><span><b>TEMP.</b> '+esc(t.season_name||t.season_code||"—")+'</span></div></div>'+
      '<div class="pp-art">'+art+'<div class="pp-watermark">'+esc(pNumber(p))+'</div></div>'+
      '<div class="pp-badges"><article class="pp-shield"><small>COBERTURA</small><strong>'+model.summary.ratedCount+'<span>/'+model.summary.totalCount+'</span></strong><em>'+pct(model.summary.coverage)+'</em></article>'+
      '<article class="pp-mini"><small>ROLES CON EVIDENCIA</small>'+roleHtml+'</article><article class="pp-mini"><small>FORTALEZAS</small>'+strengthHtml+'</article></div></section>';
  }

  _dimensions(model) {
    var map=new Map();
    model.summary.attributes.forEach(function(a){var k=a.dimension||"Otros"; if(!map.has(k))map.set(k,[]); map.get(k).push(a);});
    var self=this;
    var cards=[...map.entries()].map(function(entry){
      var dimension=entry[0], items=entry[1], rated=items.filter(function(x){return x.latest && x.latest.score!=null;});
      var mean=rated.length ? rated.reduce(function(s,x){return s+x.latest.score;},0)/rated.length : null;
      var rows=items.map(function(a){return '<div class="pp-attribute"><span title="'+esc(a.definition)+'">'+esc(a.name)+'</span>'+self._pips(a.latest && a.latest.score)+'</div>';}).join("");
      return '<article class="pp-dimension"><header><div><h3>'+esc(dimension)+'</h3><small>'+rated.length+'/'+items.length+' evaluados</small></div><b>'+(mean==null?"NE":mean.toFixed(1))+'</b></header><div class="pp-bar"><span style="width:'+Math.round((items.length?rated.length/items.length:0)*100)+'%"></span></div>'+rows+'</article>';
    }).join("");
    return '<section class="pp-panel"><div class="pp-head"><div><span class="pp-eyebrow dark">MAPA DE ATRIBUTOS</span><h2>Cómo es el jugador hoy</h2></div><p>No existe un OVR único: cada dimensión conserva su significado.</p></div><div class="pp-dim-grid">'+cards+'</div></section>';
  }

  _insights(model) {
    var roles=model.roles.filter(function(r){return r.status==="AVAILABLE";}).slice(0,6).map(function(r){
      return '<div><span>'+esc(r.label)+'</span><b>'+r.score.toFixed(1)+'/5</b><small>Cobertura '+pct(r.coverage)+'</small></div>';
    }).join("") || '<div class="pp-empty">Se necesita más evidencia para derivar roles.</div>';
    var asym=model.asymmetries.map(function(a){
      var d=a.difference==null?"Sin comparación":(a.difference===0?"Equilibrado":"Δ "+Math.abs(a.difference)+" hacia "+(a.difference>0?"derecha":"izquierda"));
      return '<div><strong>'+esc(a.label)+'</strong><span>D '+(a.right==null?"NE":a.right)+' · I '+(a.left==null?"NE":a.left)+'</span><small>'+esc(d)+'</small></div>';
    }).join("");
    return '<section class="pp-two"><article class="pp-panel"><span class="pp-eyebrow dark">ROLES FUNCIONALES</span><h2>Qué puede aportar</h2><div class="pp-list">'+roles+'</div></article><article class="pp-panel"><span class="pp-eyebrow dark">ASIMETRÍAS D/I</span><h2>Dominancia funcional</h2><div class="pp-list">'+asym+'</div></article></section>';
  }

  _measurements() {
    var rows=((this.data&&this.data.measurements)||[]).slice(0,12).map(function(m){
      return '<div class="pp-measure"><span>'+esc(String(m.test_code||"").replaceAll("_"," "))+'</span><strong>'+esc(m.value)+' <small>'+esc(m.unit)+'</small></strong><em>'+esc(String(m.measured_at||"").slice(0,10))+'</em></div>';
    }).join("") || '<div class="pp-empty">Todavía no hay mediciones objetivas registradas.</div>';
    return '<section class="pp-panel"><div class="pp-head"><div><span class="pp-eyebrow dark">MEDICIONES OBJETIVAS</span><h2>Antropometría y rendimiento</h2></div><p>Datos medidos, no notas subjetivas.</p></div><div class="pp-measure-grid">'+rows+'</div></section>';
  }

  _filteredAttributes() {
    var self=this;
    return ((this.data&&this.data.catalog&&this.data.catalog.attributes)||[]).filter(function(a){
      var contextOk=!Array.isArray(a.valid_contexts) || a.valid_contexts.includes(self.filterContext) || self.filterContext==="VIDEO";
      return contextOk && (!self.filterDimension || a.dimension===self.filterDimension) && (!self.filterSubdimension || a.subdimension===self.filterSubdimension);
    });
  }

  _attributeEditor(a) {
    var anchors=(a.anchors||[]).map(function(x){return '<div><b>'+x.level+' · '+esc(x.label)+'</b><span>'+esc(x.criteria)+'</span></div>';}).join("");
    var buttons='<button type="button" class="selected" data-score="">NE</button>';
    for(var i=1;i<=5;i++) buttons+='<button type="button" data-score="'+i+'">'+i+'</button>';
    return '<article class="pp-eval-card" data-code="'+esc(a.code)+'"><header><div><small>'+esc(a.code)+'</small><h3>'+esc(a.name)+'</h3></div><button type="button" class="pp-help" aria-label="Ver rúbrica">?</button></header><p>'+esc(a.definition)+'</p>'+
      '<div class="pp-score">'+buttons+'</div><div class="pp-evidence"><label>Evidencias<input class="pp-count" type="number" min="0" inputmode="numeric" value="0"></label><label>Confianza<select class="pp-confidence"><option value="LOW">Baja</option><option value="MEDIUM" selected>Media</option><option value="HIGH">Alta</option></select></label></div>'+
      '<label>Nota<textarea class="pp-notes" rows="2"></textarea></label><div class="pp-rubric" hidden><strong>Qué observar</strong><p>'+esc(a.observation_guide||"")+'</p>'+anchors+'</div></article>';
  }

  _editor() {
    if(!this._can(Permission.CREATE_PLAYER_EVALUATION)) return "";
    if(!this.editorOpen) return '<section class="pp-panel pp-editor-shell"><button id="pp-toggle" class="pp-toggle"><span><b>＋ Nueva evaluación del pasaporte</b><small>Solo puntúa atributos realmente observados.</small></span><b>+</b></button></section>';
    var attrs=(this.data&&this.data.catalog&&this.data.catalog.attributes)||[];
    var dims=[...new Set(attrs.map(function(a){return a.dimension;}))];
    var self=this;
    var subs=[...new Set(attrs.filter(function(a){return !self.filterDimension || a.dimension===self.filterDimension;}).map(function(a){return a.subdimension;}))];
    var dimOptions=dims.map(function(x){return '<option value="'+esc(x)+'" '+(x===self.filterDimension?"selected":"")+'>'+esc(x)+'</option>';}).join("");
    var subOptions=subs.map(function(x){return '<option value="'+esc(x)+'" '+(x===self.filterSubdimension?"selected":"")+'>'+esc(x)+'</option>';}).join("");
    var cards=this._filteredAttributes().map(function(a){return self._attributeEditor(a);}).join("") || '<div class="pp-empty">No hay atributos válidos para estos filtros.</div>';
    return '<section class="pp-panel pp-editor-shell"><button id="pp-toggle" class="pp-toggle"><span><b>Evaluación contextual</b><small>NE significa no evaluado.</small></span><b>−</b></button>'+
      '<form id="pp-form" class="pp-editor"><div class="pp-filters"><label>Fecha<input id="pp-date" type="date" required value="'+today()+'"></label><label>Contexto<select id="pp-context"><option value="T" '+(this.filterContext==="T"?"selected":"")+'>Tarea controlada</option><option value="JR" '+(this.filterContext==="JR"?"selected":"")+'>Juego reducido</option><option value="P5" '+(this.filterContext==="P5"?"selected":"")+'>Partido / 5x5</option><option value="VIDEO" '+(this.filterContext==="VIDEO"?"selected":"")+'>Vídeo</option></select></label>'+
      '<label>Dimensión<select id="pp-dimension"><option value="">Todas</option>'+dimOptions+'</select></label><label>Subdimensión<select id="pp-subdimension"><option value="">Todas</option>'+subOptions+'</select></label></div>'+
      '<label class="pp-title">Título<input id="pp-title" required maxlength="140" value="Evaluación Pasaporte · '+today()+'"></label><div class="pp-note">NE no es un nivel bajo: no existe evidencia suficiente. Un nivel 3+ debe sostenerse con oposición real cuando proceda.</div>'+
      '<div class="pp-eval-grid">'+cards+'</div><label class="pp-title">Resumen opcional<textarea id="pp-summary" rows="3"></textarea></label><div class="pp-save"><span id="pp-status" aria-live="polite"></span><button type="submit">Guardar evaluación</button></div></form></section>';
  }

  _render() {
    var el=document.getElementById(this.containerId); if(!el)return;
    if(this.error){
      var denied=/ACCESS_DENIED|42501|permission|denied/i.test(String(this.error.message||this.error));
      el.innerHTML='<section class="pp-page"><a class="pp-back" href="#/players">← Jugadores</a><div class="pp-error"><strong>'+(denied?"Pasaporte no incluido en esta licencia":"No se pudo abrir el pasaporte")+'</strong><p>'+(denied?"El acceso requiere permiso deportivo y el módulo PLAYER_PASSPORT activo para este jugador. Demo, SUPERADMIN y ADMIN se validan en backend.":esc(this.error.message||"Error desconocido"))+'</p></div></section>'+this._styles();
      return;
    }
    var model=this._model();
    el.innerHTML='<section class="pp-page"><div class="pp-top"><a class="pp-back" href="#/players">← Jugadores</a><a class="pp-back" href="#/player360/'+esc(this.playerId)+'">Player 360 →</a></div>'+this._hero(model)+this._insights(model)+this._dimensions(model)+this._measurements()+this._editor()+'</section>'+this._styles();
    this._bind();
  }

  _bind() {
    var self=this;
    var toggle=document.getElementById("pp-toggle"); if(toggle)toggle.addEventListener("click",function(){self.editorOpen=!self.editorOpen;self._render();});
    var context=document.getElementById("pp-context"); if(context)context.addEventListener("change",function(e){self.filterContext=e.target.value;self._render();});
    var dim=document.getElementById("pp-dimension"); if(dim)dim.addEventListener("change",function(e){self.filterDimension=e.target.value;self.filterSubdimension="";self._render();});
    var sub=document.getElementById("pp-subdimension"); if(sub)sub.addEventListener("change",function(e){self.filterSubdimension=e.target.value;self._render();});
    document.querySelectorAll(".pp-score").forEach(function(group){group.querySelectorAll("button").forEach(function(btn){btn.addEventListener("click",function(){group.querySelectorAll("button").forEach(function(x){x.classList.remove("selected");});btn.classList.add("selected");});});});
    document.querySelectorAll(".pp-help").forEach(function(btn){btn.addEventListener("click",function(){var r=btn.closest(".pp-eval-card").querySelector(".pp-rubric");r.hidden=!r.hidden;});});
    var form=document.getElementById("pp-form"); if(form)form.addEventListener("submit",function(e){self._save(e);});
  }

  async _save(event) {
    event.preventDefault();
    var status=document.getElementById("pp-status");
    var scores=[...event.currentTarget.querySelectorAll(".pp-eval-card")].map(function(row){
      var s=row.querySelector(".pp-score .selected");
      if(!s || !s.dataset.score)return null;
      return {metric_code:row.dataset.code,score:Number(s.dataset.score),evidence_count:Number(row.querySelector(".pp-count").value||0),confidence:row.querySelector(".pp-confidence").value,notes:row.querySelector(".pp-notes").value.trim()||null,rubric_version:"1.0"};
    }).filter(Boolean);
    if(!scores.length){if(status)status.textContent="Selecciona al menos un atributo observado.";return;}
    try{
      if(status)status.textContent="Guardando…";
      await this.service.saveEvaluation({playerId:this.playerId,teamSeasonId:this.teamSeasonId,evaluationDate:document.getElementById("pp-date").value,title:document.getElementById("pp-title").value.trim(),context:this.filterContext,scores:scores,summary:document.getElementById("pp-summary").value.trim()||null});
      this.editorOpen=false; await this._load(); this._render();
    }catch(e){console.error("[PlayerPassportView] save",e);if(status)status.textContent=e.message||"No se pudo guardar.";}
  }

  _styles() {
    return '<style>'+
      '.pp-page{max-width:1380px;margin:0 auto;padding:18px;display:grid;gap:18px;color:#0f172a;font-family:var(--font-family-base,system-ui,-apple-system,sans-serif)}.pp-page *{box-sizing:border-box}.pp-top{display:flex;justify-content:space-between}.pp-back{min-height:44px;display:inline-flex;align-items:center;color:#475569;text-decoration:none;font-weight:800}'+
      '.pp-hero{position:relative;overflow:hidden;min-height:410px;border:1px solid #473487;border-radius:22px;padding:28px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(230px,.75fr) minmax(250px,.8fr);gap:22px;align-items:center;background:radial-gradient(circle at 52% 40%,rgba(124,58,237,.45),transparent 28%),linear-gradient(135deg,#070914,#11183a 58%,#250a42);color:#fff;box-shadow:0 24px 60px rgba(15,23,42,.22)}.pp-hero:before{content:"";position:absolute;inset:10px;border:1px solid rgba(196,181,253,.27);border-radius:16px}.pp-identity,.pp-art,.pp-badges{position:relative;z-index:1}.pp-eyebrow{display:block;color:#c4b5fd;font-size:10px;font-weight:950;letter-spacing:.14em;margin-bottom:8px}.pp-eyebrow.dark{color:#6d28d9}.pp-identity h1{margin:0;font-size:clamp(34px,5vw,64px);line-height:.92;text-transform:uppercase;letter-spacing:-.04em;color:#fff}.pp-identity>p{color:#ddd6fe}.pp-meta{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.pp-meta span{border:1px solid rgba(255,255,255,.16);background:rgba(15,23,42,.58);border-radius:999px;padding:7px 9px;font-size:11px}.pp-meta b{color:#a78bfa}.pp-art{min-height:300px;align-self:end;display:flex;justify-content:center;align-items:flex-end}.pp-art img{max-width:100%;max-height:370px;object-fit:contain;filter:drop-shadow(0 18px 22px rgba(0,0,0,.45))}.pp-silhouette{width:200px;height:260px;border-radius:100px 100px 26px 26px;display:grid;place-items:center;background:linear-gradient(160deg,#7c3aed,#1e293b);font-size:68px;font-weight:950}.pp-watermark{position:absolute;right:-5px;bottom:0;font-size:120px;line-height:.75;font-weight:950;color:rgba(255,255,255,.06);z-index:-1}.pp-badges{display:grid;gap:10px}.pp-shield,.pp-mini{border:1px solid rgba(196,181,253,.32);background:rgba(3,7,22,.64);border-radius:15px;padding:14px}.pp-shield{text-align:center}.pp-shield small,.pp-mini small{display:block;color:#c4b5fd;font-size:9px;font-weight:950;letter-spacing:.1em;margin-bottom:6px}.pp-shield strong{display:block;font-size:40px}.pp-shield strong span{font-size:15px;color:#94a3b8}.pp-shield em{font-style:normal;color:#ddd6fe}.pp-mini span{display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.08);padding:6px 0;font-size:11px}.pp-mini span:first-of-type{border-top:0}.pp-mini b{color:#c4b5fd}'+
      '.pp-panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;box-shadow:0 5px 18px rgba(15,23,42,.04)}.pp-panel h2{margin:0 0 12px;font-size:20px}.pp-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pp-list{display:grid;gap:7px}.pp-list>div{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:9px;align-items:center;border:1px solid #ede9fe;background:#faf9ff;border-radius:10px;padding:9px;font-size:12px}.pp-list small{color:#64748b}.pp-head{display:flex;justify-content:space-between;gap:12px}.pp-head p{margin:0;color:#64748b;font-size:12px}.pp-dim-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.pp-dimension{border:1px solid #e2e8f0;border-radius:13px;padding:13px;background:#fbfcff}.pp-dimension header{display:flex;justify-content:space-between}.pp-dimension h3{margin:0;font-size:14px}.pp-dimension header>div small{color:#64748b}.pp-dimension header>b{width:44px;height:44px;border:1px solid #c4b5fd;border-radius:11px;display:grid;place-items:center;color:#6d28d9}.pp-bar{height:5px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:9px 0}.pp-bar span{display:block;height:100%;background:linear-gradient(90deg,#7c3aed,#2563eb)}.pp-attribute{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid #eef2f7;font-size:11px}.pp-pips{display:flex;gap:3px}.pp-pips i{width:10px;height:10px;border:1px solid #cbd5e1;border-radius:3px}.pp-pips i.on{background:#7c3aed;border-color:#7c3aed}.pp-ne{font-size:10px;font-weight:900;color:#94a3b8}.pp-measure-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.pp-measure{border:1px solid #e2e8f0;border-radius:10px;padding:10px;display:grid;gap:3px}.pp-measure>span{font-size:9px;text-transform:uppercase;color:#64748b;font-weight:900}.pp-measure strong{font-size:18px}.pp-measure em{font-size:9px;color:#94a3b8;font-style:normal}'+
      '.pp-editor-shell{padding:0;overflow:hidden}.pp-toggle{width:100%;min-height:64px;border:0;background:#111827;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:14px 18px;text-align:left;cursor:pointer}.pp-toggle span{display:grid;gap:3px}.pp-toggle small{color:#cbd5e1}.pp-editor{padding:18px;display:grid;gap:13px}.pp-editor label{display:grid;gap:5px;font-size:11px;font-weight:850}.pp-editor input,.pp-editor select,.pp-editor textarea{width:100%;min-height:44px;border:1px solid #cbd5e1;border-radius:8px;padding:8px;font:inherit;background:#fff}.pp-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.pp-title{max-width:720px}.pp-note{border:1px solid #ddd6fe;background:#faf5ff;color:#5b21b6;border-radius:9px;padding:10px;font-size:11px}.pp-eval-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.pp-eval-card{border:1px solid #e2e8f0;border-radius:11px;padding:11px;display:grid;gap:9px}.pp-eval-card header{display:flex;justify-content:space-between}.pp-eval-card header small{color:#7c3aed;font-weight:900}.pp-eval-card h3{margin:2px 0 0;font-size:13px}.pp-eval-card>p{margin:0;color:#64748b;font-size:10px;line-height:1.45}.pp-help{width:44px;height:44px;border:1px solid #c4b5fd;border-radius:9px;background:#f5f3ff;color:#6d28d9;font-weight:950}.pp-score{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}.pp-score button{min-height:44px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-weight:900}.pp-score button.selected{background:#6d28d9;border-color:#6d28d9;color:#fff}.pp-evidence{display:grid;grid-template-columns:1fr 1fr;gap:7px}.pp-rubric{border-top:1px solid #e2e8f0;padding-top:8px}.pp-rubric>p{font-size:10px;color:#475569}.pp-rubric>div{display:grid;gap:2px;padding:6px 0;border-top:1px solid #f1f5f9}.pp-rubric b{font-size:10px;color:#6d28d9}.pp-rubric span{font-size:9px;color:#475569}.pp-save{display:flex;justify-content:flex-end;align-items:center;gap:10px}.pp-save span{font-size:11px;color:#b45309}.pp-save button{min-height:44px;border:0;border-radius:9px;background:#6d28d9;color:#fff;padding:9px 15px;font-weight:900}'+
      '.pp-picker{background:linear-gradient(135deg,#0f172a,#312e81);color:#fff;border-radius:18px;padding:24px}.pp-picker h1{margin:0;font-size:32px}.pp-picker p{color:#ddd6fe}.pp-pick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.pp-pick{min-height:76px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:10px;border:1px solid #e2e8f0;border-radius:11px;background:#fff;color:#0f172a;text-decoration:none}.pp-avatar{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#ede9fe;color:#6d28d9;font-weight:950}.pp-pick>span:nth-child(2){display:grid;gap:3px}.pp-pick small{color:#64748b}.pp-empty,.pp-error{border:1px dashed #cbd5e1;background:#f8fafc;border-radius:11px;padding:16px;color:#475569}.pp-error{border-style:solid;border-color:#fecaca;background:#fff7f7;color:#991b1b}.pp-loading{min-height:340px;display:flex;gap:12px;align-items:center;justify-content:center;color:#475569}.pp-spinner{width:28px;height:28px;border:3px solid #e2e8f0;border-top-color:#7c3aed;border-radius:50%;animation:ppspin .8s linear infinite}@keyframes ppspin{to{transform:rotate(360deg)}}'+
      '@media(max-width:1050px){.pp-hero{grid-template-columns:1fr .7fr}.pp-badges{grid-column:1/-1;grid-template-columns:repeat(3,1fr)}.pp-measure-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.pp-page{padding:12px;gap:12px}.pp-hero{min-height:0;padding:17px;grid-template-columns:1fr;border-radius:16px}.pp-art{min-height:210px}.pp-art img{max-height:260px}.pp-silhouette{width:160px;height:210px;font-size:52px}.pp-badges{grid-column:auto;grid-template-columns:1fr}.pp-two,.pp-dim-grid,.pp-eval-grid{grid-template-columns:1fr}.pp-measure-grid{grid-template-columns:repeat(2,1fr)}.pp-filters{grid-template-columns:1fr 1fr}.pp-pick-grid{grid-template-columns:1fr}.pp-head{display:grid}.pp-list>div{grid-template-columns:1fr auto}.pp-list small{grid-column:1/-1}.pp-save{display:grid}.pp-save button{width:100%}}@media(max-width:430px){.pp-filters,.pp-evidence,.pp-measure-grid{grid-template-columns:1fr}.pp-score{grid-template-columns:repeat(3,1fr)}.pp-meta{display:grid;grid-template-columns:1fr 1fr}.pp-identity h1{font-size:34px}}'+
    '</style>';
  }
}
export default PlayerPassportView;
