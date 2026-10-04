/**
 * @fileoverview Application service for Training Intelligence V58.
 * @description Keeps historical focus classification behind an authoritative RPC.
 */
export class TrainingIntelligenceService {
  constructor(client=null){ this.client=client?.supabase||client?.default||client; }
  _assert(){ if(!this.client?.rpc) throw new Error("Cliente de datos no disponible."); }

  async setFocusCodes({sessionId,teamSeasonId,focusCodes=[]}={}){
    this._assert();
    if(!sessionId||!teamSeasonId) throw new Error("Sesión y equipo-temporada son obligatorios.");
    const codes=[...new Set((focusCodes||[]).map(v=>String(v||"").trim().toUpperCase()).filter(Boolean))];
    if(!codes.length) throw new Error("Selecciona al menos un foco.");
    const {data,error}=await this.client.rpc("iq_v58_set_training_focus_codes",{
      p_session_id:sessionId,p_team_season_id:teamSeasonId,p_focus_codes:codes
    });
    if(error) throw error;
    return data;
  }
}
export default TrainingIntelligenceService;
