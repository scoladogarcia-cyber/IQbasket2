/**
 * Training V54. Extends the stable training view rather than rewriting its
 * creation, attendance or external-development flows. Full editing saves once
 * through the V54 transactional RPC; existing records are never recreated.
 */
import { TrainingView } from '../TrainingView.js';
import { DataStore } from '../../services/DataStore.js';
import { Permission } from '../../security/PermissionService.js';
import { TrainingCompleteEditV54Service } from '../../services/player360/TrainingCompleteEditV54Service.js';
import { TRAINING_TYPE_OPTIONS, BLOCK_PARTICIPATION_OPTIONS, BLOCK_EXCEPTION_OPTIONS } from '../../config/trainingEditV54.config.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const num = value => value === '' || value === null || value === undefined ? null : Number(value);
const selected = (options, value) => options.map(([code,label]) => `<option value="${esc(code)}" ${String(code)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
const sameId = (a,b) => String(a)===String(b);
const personName = p => p?.name || [p?.first_name || p?.firstName,p?.last_name || p?.lastName].filter(Boolean).join(' ') || 'Jugador';
function duration(start,end) {
  if(!/^\d\d:\d\d$/.test(start||'')||!/^\d\d:\d\d$/.test(end||''))return null;
  const parse = text => Number(text.slice(0,2))*60+Number(text.slice(3));
  const diff=parse(end)-parse(start);
  return diff>=1 && diff<=600 ? diff : null;
}

export class TrainingCompleteEditV54View extends TrainingView {
  constructor(client=null,auth=null) {
    super(client,auth);
    this.completeService=new TrainingCompleteEditV54Service(this.supabase);
    this.blockAssignments=[];
    this.completeEditReady=false;
    this.editRevisions=new Map();
    this.nextDraftBlock=0;
  }

  async _load() {
    await super._load();
    this.completeEditReady=false;
    this.blockAssignments=[];
    if(!this._can(Permission.EDIT_TRAINING) || !this.capabilities?.training_core)return;
    try {
      this.blockAssignments=await this.completeService.listBlockParticipation(this.sessions);
      this.completeEditReady=true;
    } catch(error) {
      this.lastError=error;
      console.warn('[Training V54] Sin edición completa; lectura de bloques denegada o no disponible:',error);
    }
  }

  _renderAttendanceEditor(session,directory) {
    return sameId(this.editingTrainingId,session.id) ? '' : super._renderAttendanceEditor(session,directory);
  }

  _assignmentRow(assignment={},block={}) {
    const key=block.key || block.id;
    const current=assignment.participation_status || 'NONE';
    return `<div class="v54-assignment" data-block-key="${esc(key)}">
      <span class="v54-assignment-title">${esc(block.title || 'Bloque nuevo')}</span>
      <label>Participación<select class="v54-part-status">${selected(BLOCK_PARTICIPATION_OPTIONS,current)}</select></label>
      <label>Minutos de este bloque<input class="v54-part-block-minutes" type="number" min="0" max="300" step="1" value="${esc(assignment.participated_minutes ?? '')}" placeholder="Sin registrar" /></label>
      <label>Excepcionalidad<select class="v54-part-reason">${selected(BLOCK_EXCEPTION_OPTIONS,assignment.exception_reason || '')}</select></label>
    </div>`;
  }

  _blockRow(block={},index=1) {
    const key=block.key || block.id || `draft-${++this.nextDraftBlock}`;
    return `<div class="v54-block" data-block-key="${esc(key)}" data-block-id="${esc(block.id || '')}">
      <label>Bloque<input class="v54-block-title" maxlength="140" required value="${esc(block.title || '')}" placeholder="Ej. Finalizaciones" /></label>
      <label>Tipo / código<input class="v54-block-code" maxlength="80" value="${esc(block.activity_code || '')}" /></label>
      <label>Minutos<input class="v54-block-minutes" type="number" min="1" max="300" required value="${esc(block.duration_minutes ?? '')}" /></label>
      <label>Intensidad (0–10)<input class="v54-block-intensity" type="number" min="0" max="10" step="0.5" value="${esc(block.intensity ?? '')}" /></label>
      <label>Objetivo<input class="v54-block-objective" maxlength="500" value="${esc(block.objective || '')}" /></label>
      <button class="p360-danger-link v54-remove-block" type="button">Eliminar bloque</button>
    </div>`;
  }

  _participantRow(player,participant,blocks) {
    const pid=String(player.id),current=Boolean(participant);
    const assignments=this.blockAssignments.filter(row=>sameId(row.participant_id,participant?.id));
    const assigned=new Map(assignments.map(row=>[String(row.block_id),row]));
    const status=current?participant.attendance_status:'PLANNED';
    return `<div class="v54-person" data-player-id="${esc(pid)}">
      <label class="v54-person-heading"><input class="v54-person-included" type="checkbox" ${current?'checked':''} />
        <strong>#${esc(player.jersey ?? player.number ?? '—')} · ${esc(personName(player))}</strong></label>
      <div class="v54-person-details" ${current?'':'hidden'}>
        <div class="v54-person-fields">
          <label>Asistencia<select class="v54-person-status">${selected([
            ['PLANNED','Pendiente'],['PRESENT','Presente'],['PARTIAL','Parcial'],
            ['ABSENT','Ausente'],['EXCUSED','Justificada']
          ],status)}</select></label>
          <label>Minutos reales<input class="v54-person-minutes" type="number" min="0" max="600" step="1" value="${esc(participant?.participated_minutes ?? '')}" placeholder="Sin registrar" /></label>
          <label>RPE individual<input class="v54-person-rpe" type="number" min="0" max="10" step="0.5" value="${esc(participant?.rpe ?? '')}" placeholder="Sin registrar" /></label>
          <label>Observación breve<input class="v54-person-note" maxlength="240" value="${esc(participant?.notes || '')}" placeholder="Ej. Llegó tarde; sin datos médicos" /></label>
        </div>
        <details class="v54-exceptions"><summary>Participación por bloque y excepcionalidades (opcional)</summary>
          <p>Sin detalle no equivale a asistencia completa. Registra únicamente lo que sepas. Evita anotar diagnósticos médicos.</p>
          <div class="v54-assignment-list">${blocks.map(block=>this._assignmentRow(assigned.get(String(block.id)) || {},{...block,key:block.id})).join('')}</div>
          <button class="p360-secondary-btn v54-calculate-minutes" type="button">Sumar minutos registrados de los bloques</button>
        </details>
      </div>
    </div>`;
  }

  /** One complete editable form, replacing the fragmented metadata-only editor. */
  _renderTrainingEditForm(session={}) {
    if(!this._can(Permission.EDIT_TRAINING))return '';
    if(!this.completeEditReady)return `<div class="p360-error">No se ha podido verificar el detalle de participantes y bloques. Recarga la pantalla antes de editar; no se guardará parcialmente.</div>`;
    const bounds=this._dateInputBounds();
    const directory=this._playerDirectory();
    const roster=new Map([...this._eligiblePlayers(session.session_date),...directory.values()].filter(p=>p?.id).map(p=>[String(p.id),p]));
    const participants=new Map((session.participants||[]).map(p=>[String(p.player_id),p]));
    // Preserve a historical participant in the editor even when their roster has since changed.
    for(const pid of participants.keys())if(!roster.has(pid))roster.set(pid,{id:pid,name:'Jugador histórico · '+pid.slice(0,8)});
    const blocks=[...(session.blocks||[])].sort((a,b)=>Number(a.block_order)-Number(b.block_order));
    this.editRevisions.set(String(session.id),this.completeService.revision(session,this.blockAssignments));
    return `<form class="p360-form p360-inline-editor v54-complete-form" data-session-id="${esc(session.id)}">
      <div class="p360-info-note"><strong>Edición completa en una sola operación.</strong> Corrige fecha, tipo, horarios, bloques y jugadores. Los cambios solo se aplican al pulsar Guardar. Si otro usuario editó algo, se cancela para que recargues.</div>
      <div class="p360-form-grid">
        <label>Fecha<input class="v54-date" type="date" required value="${esc(session.session_date)}" ${bounds.min?`min="${esc(bounds.min)}"`:''} ${bounds.max?`max="${esc(bounds.max)}"`:''}/></label>
        <label>Tipo de entrenamiento<select class="v54-type">${selected(TRAINING_TYPE_OPTIONS,session.metadata?.training_type || 'GENERAL')}</select></label>
        <label class="p360-span-2">Nombre<input class="v54-title" required maxlength="140" value="${esc(session.title)}" /></label>
        <label>Inicio<input class="v54-start" type="time" required value="${esc(String(session.start_time||'').slice(0,5))}" /></label>
        <label>Fin<input class="v54-end" type="time" required value="${esc(String(session.end_time||'').slice(0,5))}" /></label>
        <label>Duración automática (min)<input class="v54-duration" type="number" readonly aria-readonly="true" value="${esc(this._sessionDuration(session) ?? '')}" /></label>
        <label>Intensidad 0–10<input class="v54-intensity" type="number" min="0" max="10" step="0.5" value="${esc(session.intensity ?? '')}" /></label>
        <label class="p360-span-2">Objetivo<textarea class="v54-objective" maxlength="500" rows="2">${esc(session.objective||'')}</textarea></label>
        <label class="p360-span-2">Notas de la sesión<textarea class="v54-notes" maxlength="1000" rows="2">${esc(session.notes||'')}</textarea></label>
      </div>
      <section class="p360-subsection"><div class="p360-subsection-head"><div><strong>Bloques · editar, añadir o quitar</strong><small>Los bloques existentes conservan su identidad. Las eliminaciones se confirman al guardar.</small></div><button type="button" class="p360-secondary-btn v54-add-block">＋ Añadir bloque</button></div>
        <div class="v54-block-list">${blocks.map((block,i)=>this._blockRow(block,i+1)).join('')}</div></section>
      <section class="p360-subsection"><div><strong>Jugadores · asistencia y excepciones</strong><p class="p360-card-text">Desmarca a quien añadiste por error. Para ausencias reales utiliza «Ausente» o «Justificada». Las correcciones que eliminan participantes requieren confirmación.</p></div>
        <div class="v54-roster-tools"><button type="button" class="p360-secondary-btn v54-all-players">Seleccionar elegibles</button><button type="button" class="p360-secondary-btn v54-no-players">Desmarcar todos</button></div>
        <p class="v54-eligibility-warning p360-error" role="alert" hidden></p>
        <div class="v54-roster">${[...roster.values()].sort((a,b)=>personName(a).localeCompare(personName(b))).map(player=>this._participantRow(player,participants.get(String(player.id)),blocks)).join('')}</div>
      </section>
      <div class="p360-form-actions"><button type="button" class="p360-secondary-btn p360-cancel-training-edit">Cancelar sin cambios</button><button type="submit" class="p360-primary-btn">Guardar entrenamiento completo</button></div>
      <p class="v54-save-status" role="status" aria-live="polite"></p>
    </form>`;
  }

  _eligibility(form) {
    const eligible=new Set(this._eligiblePlayers(form.querySelector('.v54-date')?.value).map(p=>String(p.id)));
    const invalid=[];
    form.querySelectorAll('.v54-person').forEach(row=>{
      const box=row.querySelector('.v54-person-included'),allowed=eligible.has(row.dataset.playerId);
      box.disabled=!allowed&&!box.checked;
      row.classList.toggle('v54-ineligible',!allowed);
      if(box.checked&&!allowed)invalid.push(row.querySelector('strong')?.textContent||row.dataset.playerId);
    });
    const warning=form.querySelector('.v54-eligibility-warning');
    warning.hidden=!invalid.length;
    warning.textContent=invalid.length?`La nueva fecha no corresponde a la inscripción de: ${invalid.join(', ')}. Desmárcalos o escoge una fecha válida antes de guardar.`:'';
    return !invalid.length;
  }

  _collectComplete(form,session) {
    const date=form.querySelector('.v54-date').value,title=form.querySelector('.v54-title').value.trim();
    const start=form.querySelector('.v54-start').value,end=form.querySelector('.v54-end').value;
    const total=duration(start,end);
    if(!date||!title||total===null||!form.reportValidity()||!this._eligibility(form))throw new Error('Revisa fecha, participantes, título y horario (fin posterior al inicio).');
    const blocks=[...form.querySelectorAll('.v54-block')].map((row,i)=>{
      const minutes=num(row.querySelector('.v54-block-minutes').value);
      const intensity=num(row.querySelector('.v54-block-intensity').value);
      const block={key:row.dataset.blockKey,id:row.dataset.blockId||null,order:i+1,
        title:row.querySelector('.v54-block-title').value.trim(),
        activity_code:row.querySelector('.v54-block-code').value.trim(),
        duration_minutes:minutes,intensity,objective:row.querySelector('.v54-block-objective').value.trim()};
      if(!block.title||!Number.isInteger(minutes)||minutes<1||minutes>300||
        (intensity!==null&&(!Number.isFinite(intensity)||intensity<0||intensity>10)))throw new Error(`Comprueba el bloque ${i+1} y sus minutos.`);
      return block;
    });
    const byKey=new Map(blocks.map(block=>[block.key,block]));
    const participants=[...form.querySelectorAll('.v54-person')].filter(row=>row.querySelector('.v54-person-included').checked).map(row=>{
      const status=row.querySelector('.v54-person-status').value;
      const minutes=num(row.querySelector('.v54-person-minutes').value);
      const rpe=num(row.querySelector('.v54-person-rpe').value);
      if(minutes!==null&&(!Number.isInteger(minutes)||minutes<0||minutes>total))throw new Error('Minutos individuales fuera de la duración del entrenamiento.');
      if(rpe!==null&&(!Number.isFinite(rpe)||rpe<0||rpe>10))throw new Error('RPE individual inválido.');
      if(['ABSENT','EXCUSED'].includes(status)&&minutes!==null&&minutes>0)throw new Error('Una ausencia no puede sumar minutos. Usa asistencia parcial.');
      if(status==='PARTIAL'&&minutes===null)throw new Error('Indica los minutos del jugador con asistencia parcial.');
      const assignments=[...row.querySelectorAll('.v54-assignment')].map(item=>{
        const kind=item.querySelector('.v54-part-status').value;
        if(kind==='NONE')return null;
        const block=byKey.get(item.dataset.blockKey);
        if(!block)throw new Error('Un bloque ha cambiado. Revisa sus excepcionalidades.');
        const value=num(item.querySelector('.v54-part-block-minutes').value);
        if(kind==='PARTIAL'&&(!Number.isInteger(value)||value<1||value>=block.duration_minutes))throw new Error('En un bloque parcial indica minutos mayores que cero y menores que su duración.');
        if(kind==='FULL'&&value!==null&&value!==block.duration_minutes)throw new Error('En un bloque completo los minutos deben coincidir con su duración.');
        if(kind==='NOT_ATTENDED'&&value!==null&&value!==0)throw new Error('Un bloque no realizado tiene cero minutos.');
        if(['ABSENT','EXCUSED'].includes(status)&&kind!=='NOT_ATTENDED')throw new Error('Una ausencia no puede tener bloques realizados.');
        return {key:block.key,status:kind,minutes:kind==='NOT_ATTENDED'?0:kind==='FULL'?block.duration_minutes:value,reason:item.querySelector('.v54-part-reason').value||null};
      }).filter(Boolean);
      return {player_id:row.dataset.playerId,status,minutes,rpe,notes:row.querySelector('.v54-person-note').value.trim(),blocks:assignments};
    });
    const existing=new Set((session.participants||[]).map(p=>String(p.player_id)));
    const kept=new Set(participants.map(p=>p.player_id));
    const removed=[...existing].filter(pid=>!kept.has(pid));
    const intensity=num(form.querySelector('.v54-intensity').value);
    if(intensity!==null&&(!Number.isFinite(intensity)||intensity<0||intensity>10))throw new Error('Intensidad fuera de 0–10.');
    return {date,title,trainingType:form.querySelector('.v54-type').value,
      objective:form.querySelector('.v54-objective').value.trim(),notes:form.querySelector('.v54-notes').value.trim(),
      start,end,intensity,blocks,participants,removed};
  }

  async _bindEvents(container) {
    await super._bindEvents(container);
    const form=container.querySelector('.v54-complete-form');
    if(!form)return;
    const session=this.sessions.find(row=>sameId(row.id,form.dataset.sessionId));
    if(!session)return;
    const sync=()=>{const value=duration(form.querySelector('.v54-start').value,form.querySelector('.v54-end').value);
      form.querySelector('.v54-duration').value=value===null?'':String(value);};
    form.querySelector('.v54-date').addEventListener('change',()=>this._eligibility(form));
    form.querySelector('.v54-start').addEventListener('input',sync);
    form.querySelector('.v54-end').addEventListener('input',sync);
    const visible=row=>{row.querySelector('.v54-person-details').hidden=!row.querySelector('.v54-person-included').checked;};
    form.querySelectorAll('.v54-person').forEach(row=>row.querySelector('.v54-person-included').addEventListener('change',()=>{visible(row);this._eligibility(form);}));
    form.querySelector('.v54-all-players').addEventListener('click',()=>{
      form.querySelectorAll('.v54-person').forEach(row=>{const input=row.querySelector('.v54-person-included');if(!input.disabled){input.checked=true;visible(row);}});
      this._eligibility(form);
    });
    form.querySelector('.v54-no-players').addEventListener('click',()=>{
      form.querySelectorAll('.v54-person').forEach(row=>{row.querySelector('.v54-person-included').checked=false;visible(row);});this._eligibility(form);
    });
    form.addEventListener('click',event=>{
      if(event.target.closest('.v54-add-block')) {
        const index=form.querySelectorAll('.v54-block').length+1;
        const placeholder=document.createElement('div');placeholder.innerHTML=this._blockRow({},index);
        const row=placeholder.firstElementChild;
        form.querySelector('.v54-block-list').append(row);
        form.querySelectorAll('.v54-assignment-list').forEach(list=>list.insertAdjacentHTML('beforeend',this._assignmentRow({},{key:row.dataset.blockKey,title:'Bloque nuevo'})));
      }
      const remove=event.target.closest('.v54-remove-block');
      if(remove) {
        const row=remove.closest('.v54-block'),key=row?.dataset.blockKey;
        if(row&&key){row.remove();form.querySelectorAll('.v54-assignment').forEach(item=>{if(item.dataset.blockKey===key)item.remove();});}
      }
      const calculate=event.target.closest('.v54-calculate-minutes');
      if(calculate){
        const parent=calculate.closest('.v54-person');let sum=0,count=0;
        parent.querySelectorAll('.v54-assignment').forEach(item=>{
          const state=item.querySelector('.v54-part-status').value;
          if(state==='NONE')return;
          const block=[...form.querySelectorAll('.v54-block')].find(b=>b.dataset.blockKey===item.dataset.blockKey);
          const value=state==='NOT_ATTENDED'?0:state==='FULL'?num(block?.querySelector('.v54-block-minutes').value):num(item.querySelector('.v54-part-block-minutes').value);
          if(value!==null&&Number.isFinite(value)){sum+=value;count++;}
        });
        if(!count){alert('Registra primero la participación en algún bloque.');return;}
        parent.querySelector('.v54-person-minutes').value=String(sum);
        if(sum>0&&sum<duration(form.querySelector('.v54-start').value,form.querySelector('.v54-end').value))parent.querySelector('.v54-person-status').value='PARTIAL';
      }
    });
    form.addEventListener('input',event=>{
      if(event.target.matches('.v54-block-title')){
        const block=event.target.closest('.v54-block');
        form.querySelectorAll('.v54-assignment').forEach(item=>{
          if(item.dataset.blockKey===block.dataset.blockKey)item.querySelector('.v54-assignment-title').textContent=event.target.value||'Bloque nuevo';
        });
      }
    });
    this._eligibility(form);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const status=form.querySelector('.v54-save-status'),save=form.querySelector('button[type="submit"]');
      if(save.disabled)return;
      try {
        const input=this._collectComplete(form,session);
        const names=new Map([...this._playerDirectory().values()].map(player=>[String(player.id),personName(player)]));
        if(input.removed.length&&!confirm(`Vas a quitar del entrenamiento a ${input.removed.map(pid=>names.get(pid)||pid).join(', ')}. Se eliminarán sus registros de asistencia y participación por bloque de ESTA sesión. ¿Confirmas expresamente la corrección?`))return;
        save.disabled=true;status.textContent='Guardando entrenamiento completo…';
        if(!this._can(Permission.EDIT_TRAINING)||!sameId(this.teamSeasonId,session.team_season_id))throw new Error('Permiso o temporada cambiados.');
        await this.completeService.saveComplete({session,teamSeasonId:this.teamSeasonId,
          revision:this.editRevisions.get(String(session.id)),...input,confirmedRemovals:input.removed.length>0});
        this.editingTrainingId=null;
        await this.render(this.containerId,this.teamId);
      }catch(error){console.error('[Training V54] Guardado cancelado:',error);status.textContent=`No se ha guardado nada: ${error.message||error}`;save.disabled=false;}
    });
  }

  _renderStyles() {
    return super._renderStyles().replace('</style>',`
      .v54-complete-form{border:2px solid #1d4ed8;border-radius:14px;margin:12px 0;padding:16px;min-width:0;background:#fff}
      .v54-block-list,.v54-roster,.v54-assignment-list{display:grid;gap:10px;min-width:0}
      .v54-block,.v54-person{border:1px solid #cbd5e1;border-radius:11px;padding:12px;background:#f8fafc;min-width:0}
      .v54-block,.v54-person-fields,.v54-assignment{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;align-items:end}
      .v54-block label,.v54-person-fields label,.v54-assignment label{display:grid;gap:5px;font-size:12px;min-width:0}
      .v54-block input,.v54-person-fields input,.v54-person-fields select,.v54-assignment input,.v54-assignment select{width:100%;min-width:0;min-height:44px;background:#fff;color:#0f172a;border:1px solid #94a3b8;border-radius:8px;padding:8px}
      .v54-person-heading{display:flex!important;align-items:center;gap:10px;font-size:13px;min-height:44px}
      .v54-person-heading input{width:20px;height:20px;flex:none}
      .v54-person-details{display:grid;gap:12px;margin-top:12px}
      .v54-person-details[hidden],.v54-eligibility-warning[hidden]{display:none!important}
      .v54-exceptions{border-top:1px solid #cbd5e1;padding-top:8px}
      .v54-exceptions summary{font-size:12px;font-weight:800;cursor:pointer;min-height:44px;padding:8px}
      .v54-exceptions p{font-size:11px;color:#475569}
      .v54-assignment{background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:9px;align-items:center}
      .v54-assignment-title{font-weight:800;font-size:12px;overflow-wrap:anywhere}
      .v54-ineligible{border-color:#f59e0b}.v54-roster-tools{display:flex;gap:8px;flex-wrap:wrap}
      .v54-save-status{font-size:12px;font-weight:700;color:#9a3412}
      @media(max-width:640px){.v54-complete-form{padding:10px}.v54-block,.v54-person-fields,.v54-assignment{grid-template-columns:1fr}}
    </style>`);
  }
}

export default TrainingCompleteEditV54View;
