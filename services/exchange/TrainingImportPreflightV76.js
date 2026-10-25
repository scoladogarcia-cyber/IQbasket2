/**
 * @fileoverview Version-aware training attendance CSV preflight (read-only).
 * @description Produces a minimal, deterministic diff with optimistic concurrency
 * stamps. A preview is NOT permission to write: it must be rechecked atomically
 * by a separately deployed, RBAC/ABAC-protected server RPC.
 */
const string=value=>String(value??"").trim();
const stamp=value=>string(value);
const validMinute=value=>value===null || (Number.isInteger(value)&&value>=0&&value<=600);
const statuses=new Set(["PRESENT","PARTIAL","ABSENT","EXCUSED","PLANNED","PENDING",""]);
const key=(sid,pid)=>sid+"|"+pid;
const rejection=(message)=>{throw new Error("TrainingImportPreflightV76: "+message);};

function buildIndex(sessions,teamSeasonId){
  if(!teamSeasonId||!Array.isArray(sessions)||!sessions.length||sessions.length>500)
    rejection("equipo/temporada o sesiones no válidos.");
  const bySession=new Map(),byParticipant=new Map();
  for(const session of sessions){
    const sid=string(session?.id),scope=string(session?.team_season_id);
    if(!sid||scope!==teamSeasonId||bySession.has(sid))
      rejection("sesión duplicada o fuera del ámbito.");
    if(!stamp(session?.updated_at))rejection("sesión sin versión; recarga los datos.");
    if(!Array.isArray(session?.participants))rejection("participantes sin cargar.");
    bySession.set(sid,session);
    for(const p of session.participants){
      const pid=string(p?.player_id),k=key(sid,pid);
      if(!pid||byParticipant.has(k))rejection("participante duplicado o sin ID.");
      if(!string(p?.id)||!stamp(p?.updated_at))rejection("participante sin versión; recarga los datos.");
      byParticipant.set(k,p);
    }
  }
  return {bySession,byParticipant};
}

/** A plan only; it must never be sent to direct table upserts. */
export function buildTrainingImportPreflightV76({preview,sessions=[],teamSeasonId,seasonStatus="ACTIVE"}={}){
  const scope=string(teamSeasonId);
  if(string(seasonStatus).toUpperCase()!=="ACTIVE")rejection("temporada cerrada o no activa.");
  if(preview?.writable!==false||!Array.isArray(preview.changes)||preview.changed!==preview.changes.length)
    rejection("primero valida el CSV completo con TrainingEvidenceExchangeV75.");
  const {bySession,byParticipant}=buildIndex(sessions,scope);
  if(preview.sessions!==bySession.size)rejection("cantidad de sesiones distinta a la vista previa.");
  const seen=new Set(),items=[];
  for(const change of preview.changes){
    const sid=string(change?.sessionId),pid=string(change?.playerId),k=key(sid,pid);
    const session=bySession.get(sid),participant=byParticipant.get(k);
    if(!session||!participant||seen.has(k))rejection("cambio duplicado o fuera del ámbito.");
    seen.add(k);
    const before=change.before||{},after=change.after||{};
    const oldState=string(participant.attendance_status).toUpperCase();
    const current=participant.participated_minutes==null?null:Number(participant.participated_minutes);
    if(oldState!==before.attendance||current!==before.minutes)
      rejection("la asistencia ya ha cambiado; repite la vista previa.");
    if(!statuses.has(after.attendance)||!validMinute(after.minutes))
      rejection("estado o minutos no admitidos.");
    const duration=session.duration_minutes;
    if(after.minutes!==null&&duration!=null&&after.minutes>Number(duration))
      rejection("minutos superiores a la sesión.");
    if(["ABSENT","EXCUSED"].includes(after.attendance)&&after.minutes!==null&&after.minutes!==0)
      rejection("una ausencia no admite minutos positivos.");
    // Do not silently convert unknown minutes to zero.
    items.push(Object.freeze({
      sessionId:sid,playerId:pid,participantId:string(participant.id),
      sessionUpdatedAt:stamp(session.updated_at),participantUpdatedAt:stamp(participant.updated_at),
      expected:Object.freeze({attendance:oldState,minutes:current}),
      proposed:Object.freeze({attendance:after.attendance,minutes:after.minutes})
    }));
  }
  items.sort((a,b)=>key(a.sessionId,a.playerId).localeCompare(key(b.sessionId,b.playerId)));
  return Object.freeze({
    teamSeasonId:scope,sessionCount:bySession.size,changed:items.length,
    changes:Object.freeze(items),canWrite:false,
    requires:Object.freeze(["IMPORT_TRAINING_ATTENDANCE","EDIT_TRAINING"]),
    status:"PREVIEW_ONLY",
    warning:"Sin escritura. El servidor debe revalidar versiones, permisos y toda la operación en una transacción."
  });
}

/** Prevents presenting a stale draft as if it still matched the current read. */
export function verifyTrainingImportPreflightV76(plan,freshSessions=[]){
  if(plan?.status!=="PREVIEW_ONLY"||plan.canWrite!==false)rejection("plan de importación no confiable.");
  const {bySession,byParticipant}=buildIndex(freshSessions,string(plan.teamSeasonId));
  if(bySession.size!==plan.sessionCount)rejection("el conjunto de sesiones ha cambiado.");
  for(const item of plan.changes){
    const session=bySession.get(item.sessionId),participant=byParticipant.get(key(item.sessionId,item.playerId));
    if(!session||!participant||stamp(session.updated_at)!==item.sessionUpdatedAt||
      stamp(participant.updated_at)!==item.participantUpdatedAt||
      string(participant.id)!==item.participantId)
      rejection("datos actualizados por otra persona. Recarga y revisa el CSV.");
    const minutes=participant.participated_minutes==null?null:Number(participant.participated_minutes);
    if(string(participant.attendance_status).toUpperCase()!==item.expected.attendance||
      minutes!==item.expected.minutes)rejection("asistencia modificada. Recarga el CSV.");
  }
  return true;
}
