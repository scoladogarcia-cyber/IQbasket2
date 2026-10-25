/**
 * @fileoverview Round-trippable training attendance workbook (CSV UTF-8).
 * @description The source is an already RLS-authorized single team-season.
 * Parsing is an offline, read-only preview. No writes to training tables.
 * IDs—not names, dates, jersey numbers or the current club—define identity.
 */
import {parseBoxScoreCsv} from "../reports/BoxScoreExchangeV53.js";
export const TRAINING_CSV_HEADERS_V75=Object.freeze([
  "session_id","team_season_id","fecha","titulo","tipo","duracion_min",
  "player_id","asistencia","minutos_jugador"
]);
const TYPES=new Set(["TEAM","TECHNIFICATION","PERSONAL","COGNITIVE",""]);
const ATTENDANCE=new Set(["PRESENT","PARTIAL","ABSENT","EXCUSED","PLANNED","PENDING",""]);
const cell=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
const spreadsheetText=v=>/^[=+\-@\t\r]/.test(String(v??""))?"'"+String(v):String(v??"");
const key=v=>String(v??"").trim();
function minute(value,label,{allowBlank=false}={}){
  const raw=key(value);
  if(!raw&&allowBlank)return null;
  const n=Number(raw);
  if(!raw||!Number.isInteger(n)||n<0||n>600)throw new Error(label+": minutos inválidos o desconocidos; deja vacío si no están registrados.");
  return n;
}
function asType(raw){
  const type=key(raw).toUpperCase();
  if(!TYPES.has(type))throw new Error("Tipo de entrenamiento desconocido.");
  return type;
}
function asAttendance(raw){
  const status=key(raw).toUpperCase();
  if(!ATTENDANCE.has(status))throw new Error("Estado de asistencia desconocido.");
  return status;
}
function checkSession(session,scope){
  const sid=key(session?.id),tsid=key(session?.team_season_id);
  if(!sid||!tsid||tsid!==scope)throw new Error("Entrenamiento ajeno a la temporada o sin ID estable.");
  const players=session?.participants;
  if(!Array.isArray(players))throw new Error("Participantes no cargados. No se exporta una asistencia incompleta.");
  if(players.length>500)throw new Error("Demasiados participantes.");
  const seen=new Set();
  for(const p of players){
    const pid=key(p?.player_id);
    if(!pid||seen.has(pid))throw new Error("Participantes con identificadores ausentes o repetidos.");
    seen.add(pid);
  }
}
function expectedRows(sessions,teamSeasonId){
  const scope=key(teamSeasonId);
  if(!scope||!Array.isArray(sessions)||!sessions.length||sessions.length>500)throw new Error("Selecciona sesiones autorizadas de una temporada.");
  const sessionsById=new Map(),reference=new Map();
  for(const session of sessions){
    checkSession(session,scope);
    const sid=key(session.id);
    if(sessionsById.has(sid))throw new Error("Entrenamientos duplicados.");
    sessionsById.set(sid,session);
    const participants=session.participants.length?session.participants:[null];
    for(const p of participants){
      const pid=key(p?.player_id),k=sid+"|"+pid;
      reference.set(k,{session,participant:p});
    }
  }
  return {scope,reference};
}
/** Excel/LibreOffice-compatible CSV with explicit blank for unrecorded minutes. */
export function exportTrainingEvidenceCsvV75({sessions=[],teamSeasonId}={}){
  const {scope,reference}=expectedRows(sessions,teamSeasonId),matrix=[TRAINING_CSV_HEADERS_V75];
  for(const {session,participant:p} of reference.values()){
    const duration=session.duration_minutes;
    const playerMinutes=p?.participated_minutes;
    matrix.push([key(session.id),scope,String(session.session_date||"").slice(0,10),
      spreadsheetText(session.title||""),asType(session.metadata?.session_kind||""),
      duration==null?"":String(duration),
      key(p?.player_id),p?asAttendance(p.attendance_status):"",
      !p||playerMinutes==null?"":String(playerMinutes)]);
  }
  return Object.freeze({content:"\uFEFF"+matrix.map(row=>row.map(cell).join(",")).join("\r\n")+"\r\n",
    sessionCount:sessions.length,rows:reference.size,
    filename:"IQBasket_Asistencia_"+scope.replace(/[^a-zA-Z0-9_-]/g,"")+".csv"});
}
/** Entire original roster/session matrix is mandatory. Returns a diff, never writes. */
export function previewTrainingEvidenceCsvV75(csvText,{sessions=[],teamSeasonId}={}){
  const {scope,reference}=expectedRows(sessions,teamSeasonId);
  const matrix=parseBoxScoreCsv(csvText);
  if(matrix.length!==reference.size+1||matrix[0]?.length!==TRAINING_CSV_HEADERS_V75.length
    ||!TRAINING_CSV_HEADERS_V75.every((h,i)=>matrix[0][i]===h))
    throw new Error("Plantilla incompleta o incompatible. Se requieren todos los entrenamientos y participantes.");
  const seen=new Set(),changes=[],warnings=[];
  for(let i=1;i<matrix.length;i++){
    const row=matrix[i],sid=key(row[0]),pid=key(row[6]),k=sid+"|"+pid,entry=reference.get(k);
    if(row.length!==TRAINING_CSV_HEADERS_V75.length||seen.has(k)||!entry||key(row[1])!==scope)
      throw new Error("Fila "+(i+1)+": temporada, entrenamiento o jugador ajeno, duplicado o alterado.");
    seen.add(k);
    const {session,participant:p}=entry;
    // Metadata is context, not editable in this attendance-only exchange.
    const expectedDate=String(session.session_date||"").slice(0,10);
    const expectedTitle=spreadsheetText(session.title||"");
    const duration=session.duration_minutes==null?"":String(session.duration_minutes);
    if(row[2]!==expectedDate||row[3]!==expectedTitle||row[4]!==asType(session.metadata?.session_kind||"")||row[5]!==duration)
      throw new Error("Fila "+(i+1)+": fecha, título, tipo o duración modificados. Usa el editor autorizado.");
    const state=asAttendance(row[7]),minutes=minute(row[8],"Fila "+(i+1),{allowBlank:true});
    if(!p){
      if(pid||state||minutes!=null)throw new Error("Fila "+(i+1)+": sesión sin participantes no admite atribuciones.");
      continue;
    }
    if(["ABSENT","EXCUSED"].includes(state)&&minutes!=null&&minutes!==0)
      throw new Error("Fila "+(i+1)+": ausencias no pueden tener minutos de participación.");
    const recordedMinutes=p.participated_minutes==null?null:Number(p.participated_minutes);
    const oldState=asAttendance(p.attendance_status);
    if(state!==oldState||minutes!==recordedMinutes){
      if(["PRESENT","PARTIAL"].includes(state)&&minutes==null)
        warnings.push("Fila "+(i+1)+": presente/parcial sin minutos registrados (N/D).");
      const sessionMinutes=Number(session.duration_minutes);
      if(minutes!=null&&session.duration_minutes!=null&&Number.isFinite(sessionMinutes)&&minutes>sessionMinutes)
        throw new Error("Fila "+(i+1)+": minutos individuales superiores a los de sesión.");
      changes.push(Object.freeze({sessionId:sid,playerId:pid,
        before:Object.freeze({attendance:oldState,minutes:recordedMinutes}),
        after:Object.freeze({attendance:state,minutes})}));
    }
  }
  if(seen.size!==reference.size)throw new Error("Faltan entrenamientos/participantes: no se admite importar un fichero parcial.");
  return Object.freeze({sessions:sessions.length,participants:reference.size,
    changed:changes.length,changes:Object.freeze(changes),warnings:Object.freeze(warnings),
    writable:false,message:"Revisión de fichero exclusivamente. Para modificar datos utiliza el editor autorizado."});
}
