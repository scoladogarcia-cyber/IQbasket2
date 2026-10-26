/**
 * @fileoverview Guarded training attendance import gateway V77.
 * @description A V76 plan is read-only until the separately reviewed SQL
 * transaction and explicit per-season import grant are installed. The client
 * never upserts participants or bypasses a revoked permission.
 */
import {verifyTrainingImportPreflightV76} from "./TrainingImportPreflightV76.js";
import {Permission} from "../../security/permissions.js";

export const TRAINING_IMPORT_V77_CONFIG=Object.freeze({
  // Keep disabled until an external backup, SQL rehearsal, privilege audit,
  // release checklist and controlled schema deployment have been completed.
  enabled:false,
  rpc:"iq_v77_apply_training_attendance_import",
  confirmation:"APLICAR_ASISTENCIA"
});
export function toTrainingImportPayloadV77(plan) {
  if(plan?.status!=="PREVIEW_ONLY"||plan.canWrite!==false||
    !Array.isArray(plan.changes)||plan.changed!==plan.changes.length||
    plan.changes.length<1||plan.changes.length>500||!plan.teamSeasonId)
    throw new Error("No existe una vista previa V76 válida con cambios.");
  return plan.changes.map(item=>{
    const {sessionId,playerId,participantId,sessionUpdatedAt,participantUpdatedAt,expected,proposed}=item;
    if(![sessionId,playerId,participantId,sessionUpdatedAt,participantUpdatedAt].every(Boolean) ||
      !expected||!proposed) throw new Error("Importación sin IDs, versiones o valores explícitos.");
    return {
      sessionId,playerId,participantId,sessionUpdatedAt,participantUpdatedAt,
      expected:{attendance:expected.attendance,minutes:expected.minutes},
      proposed:{attendance:proposed.attendance,minutes:proposed.minutes}
    };
  });
}
export class TrainingAttendanceImportServiceV77 {
  constructor({client,auth,config=TRAINING_IMPORT_V77_CONFIG}={}) {
    this.client=client?.supabase||client?.default||client;
    this.auth=auth;
    this.config=config;
  }
  async apply({plan,freshSessions,confirmed=false,teamId=null}={}) {
    if(!this.config?.enabled)throw new Error("La importación masiva aún no está habilitada.");
    if(!confirmed)throw new Error("Debes confirmar expresamente la modificación masiva.");
    const scope={teamId,teamSeasonId:plan?.teamSeasonId};
    if(!this.auth?.can?.(Permission.IMPORT_TRAINING_ATTENDANCE,scope) ||
      !this.auth?.can?.(Permission.EDIT_TRAINING,scope))
      throw new Error("Sin permisos independientes para importar y editar entrenamientos.");
    if(!this.client?.rpc)throw new Error("Servicio seguro de importación no disponible.");
    verifyTrainingImportPreflightV76(plan,freshSessions);
    const changes=toTrainingImportPayloadV77(plan);
    // A protected RPC is the only write boundary: server re-locks/revalidates
    // scopes, membership, import grant and every row/version atomically.
    const {data,error}=await this.client.rpc(this.config.rpc,{
      p_team_season_id:plan.teamSeasonId,
      p_changes:changes,
      p_confirmation:this.config.confirmation
    });
    if(error)throw error;
    if(!data||data.changed!==changes.length||data.status!=="APPLIED")
      throw new Error("El servidor no ha confirmado una importación completa.");
    return data;
  }
}
