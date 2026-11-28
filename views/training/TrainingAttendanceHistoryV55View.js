/** V55 training UI: roster inclusion, actual attendance and history are distinct.
 * Reuses the V54 atomic editor and delegates deletion exclusively to an
 * independently authorized database RPC. No direct table writes from UI.
 */
import { TrainingCompleteEditV54View } from './TrainingCompleteEditV54View.js';
import { TrainingHistoryV55Service } from '../../services/player360/TrainingHistoryV55Service.js';
import { attendedTraining, trainingAttendanceImpact } from '../../domain/training/TrainingAttendanceV55.js';
import { Permission } from '../../security/PermissionService.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export class TrainingAttendanceHistoryV55View extends TrainingCompleteEditV54View {
  constructor(client=null,auth=null) {
    super(client,auth);
    this.deleteService = new TrainingHistoryV55Service(this.supabase);
  }

  /** Preserve registered absences for staff, but show which players really count. */
  _participantRow(player,participant,blocks) {
    const participated=attendedTraining(participant);
    return `<div class="v55-player-entry">${super._participantRow(player,participant,blocks)}
      <div class="v55-attendance-controls">
        <span class="v55-history-impact" role="status">${participant ? (participated ? '✓ Cuenta en el desarrollo individual' : '— No cuenta como entrenamiento realizado') : '— No incluido en la sesión'}</span>
        <button type="button" class="p360-secondary-btn v55-mark-present">✓ Estuvo</button>
        <button type="button" class="p360-secondary-btn v55-mark-absent">No estuvo</button>
      </div></div>`;
  }

  _renderTrainingEditForm(session={}) {
    const html=super._renderTrainingEditForm(session);
    if(!html.includes('v54-roster-tools'))return html;
    const summary=trainingAttendanceImpact(session.participants || []);
    return html.replace('<div class="v54-roster-tools">',
      `<div class="p360-info-note v55-attendance-help"><strong>¿Quién estuvo realmente?</strong> Usa «Estuvo» o «No estuvo» junto a cada jugador, o cambia Asistencia y Minutos reales. Solo PRESENTE/PARCIAL con minutos mayores de cero cuenta en su historial. Pendiente, ausente y justificado no suman sesiones, minutos ni carga. Desmarcar a alguien lo retira de ESTA sesión por completo.</div>
       <p class="v55-roster-summary" role="status">Actualmente: ${summary.attended} asistentes reales · ${summary.minutes} minutos de jugador · ${summary.listed} personas registradas.</p>
       <div class="v54-roster-tools">`);
  }

  /** Replace the legacy ARCHIVE action; archiving retained rows in family histories. */
  _renderSessionCard(session,directory) {
    const html=super._renderSessionCard(session,directory);
    return html.replace('class="p360-danger-link p360-archive-session"',
      'class="p360-danger-link v55-delete-session"')
      .replace('Archivar sesión','Eliminar entrenamiento');
  }

  _syncAttendanceImpact(form) {
    form.querySelectorAll('.v55-player-entry').forEach(entry=>{
      const row=entry.querySelector('.v54-person');
      const box=row?.querySelector('.v54-person-included');
      const badge=entry.querySelector('.v55-history-impact');
      if(!box||!badge)return;
      const status=row.querySelector('.v54-person-status')?.value;
      const minutes=Number(row.querySelector('.v54-person-minutes')?.value || 0);
      const yes=box.checked && ['PRESENT','PARTIAL'].includes(status) && minutes>0;
      badge.textContent=!box.checked?'— No incluido en la sesión':yes?'✓ Cuenta en el desarrollo individual':'— No cuenta como entrenamiento realizado';
      badge.classList.toggle('v55-attended',yes);
    });
    const registered=[...form.querySelectorAll('.v54-person')].filter(r=>r.querySelector('.v54-person-included')?.checked);
    const attended=registered.filter(r=>['PRESENT','PARTIAL'].includes(r.querySelector('.v54-person-status')?.value) && Number(r.querySelector('.v54-person-minutes')?.value||0)>0);
    const minutes=attended.reduce((sum,r)=>sum+Number(r.querySelector('.v54-person-minutes').value),0);
    const summary=form.querySelector('.v55-roster-summary');
    if(summary)summary.textContent=`Al guardar: ${attended.length} asistentes reales · ${minutes} minutos de jugador · ${registered.length} personas registradas.`;
  }

  async _bindEvents(container) {
    await super._bindEvents(container);
    const form=container.querySelector('.v54-complete-form');
    if(form){
      form.addEventListener('change',()=>this._syncAttendanceImpact(form));
      form.addEventListener('input',()=>this._syncAttendanceImpact(form));
      form.addEventListener('click',event=>{
        const present=event.target.closest('.v55-mark-present');
        const absent=event.target.closest('.v55-mark-absent');
        if(!present&&!absent)return;
        const row=event.target.closest('.v55-player-entry')?.querySelector('.v54-person');
        if(!row)return;
        const included=row.querySelector('.v54-person-included');
        if(included.disabled && !included.checked)return;
        included.checked=true;
        row.querySelector('.v54-person-details').hidden=false;
        const status=row.querySelector('.v54-person-status');
        const minutes=row.querySelector('.v54-person-minutes');
        if(present){
          status.value='PRESENT';
          minutes.value=String(Number(form.querySelector('.v54-duration')?.value||0));
        }else{
          status.value='ABSENT';minutes.value='0';
          row.querySelector('.v54-person-rpe').value='';
          // An absent player cannot retain contradictory block participation.
          row.querySelectorAll('.v54-assignment').forEach(block=>{
            block.querySelector('.v54-part-status').value='NONE';
            block.querySelector('.v54-part-block-minutes').value='';
            block.querySelector('.v54-part-reason').value='';
          });
        }
        this._eligibility(form);
        this._syncAttendanceImpact(form);
      });
      this._syncAttendanceImpact(form);
    }
    container.querySelectorAll('.v55-delete-session').forEach(button=>button.addEventListener('click',async()=>{
      if(button.disabled||!this._can(Permission.DELETE_TRAINING)||!this.completeEditReady)return;
      const session=this.sessions.find(row=>String(row.id)===String(button.dataset.sessionId));
      if(!session||String(session.team_season_id)!==String(this.teamSeasonId))return;
      const impact=trainingAttendanceImpact(session.participants||[]);
      const message=`¿ELIMINAR DEFINITIVAMENTE «${session.title}» (${session.session_date})?\n\nSe borrará esta sesión, sus ${session.blocks?.length||0} bloques y los registros de ${session.participants?.length||0} jugadores (${impact.attended} asistentes reales) de sus historiales. NO afecta a otros entrenamientos. No se puede deshacer.`;
      if(!confirm(message))return;
      button.disabled=true;
      try{
        const revision=this.completeService.revision(session,this.blockAssignments);
        const result=await this.deleteService.deleteSession({session,teamSeasonId:this.teamSeasonId,revision,confirmed:true});
        this.editingTrainingId=null;
        await this.render(this.containerId,this.teamId);
        alert(`Entrenamiento eliminado. ${result.participants_removed} registros de participantes retirados de esta sesión.`);
      }catch(error){
        console.error('[Training V55] Eliminación cancelada:',error);
        alert(String(error?.message||error).includes('TRAINING_LINKED_DEVELOPMENT_EVIDENCE')
          ? 'Este entrenamiento está vinculado a un plan de desarrollo. Desvincula primero esa evidencia antes de eliminarlo.'
          : `No se ha eliminado nada: ${error?.message||error}`);
        button.disabled=false;
      }
    }));
  }

  _renderStyles(){return super._renderStyles()+`<style>
    .v55-player-entry{display:grid;gap:6px;min-width:0}
    .v55-attendance-controls{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:0 8px 8px}
    .v55-history-impact{font-size:12px;font-weight:800;color:#92400e;margin-right:auto}
    .v55-history-impact.v55-attended{color:#166534}
    .v55-attendance-controls button{font-size:12px;min-height:42px}
    .v55-roster-summary{font-size:12px;font-weight:800;color:#1e3a8a}
    .v55-attendance-help{margin:10px 0}
    @media(max-width:640px){.v55-attendance-controls{display:grid;grid-template-columns:1fr 1fr}.v55-history-impact{grid-column:1/-1}}
  </style>`;}
}
export default TrainingAttendanceHistoryV55View;
