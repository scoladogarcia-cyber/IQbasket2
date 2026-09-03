/**
 * Controlled manual boxscore correction service.
 *
 * Manual correction is intentionally isolated behind a SECURITY DEFINER RPC.
 * The backend rejects locked games, unauthorized scopes, ineligible players
 * and games that already contain Play-by-Play events.
 */
function required(value,label) {
  if (value===null || value===undefined || value==="") {
    throw new Error(`BoxScoreCorrectionService: ${label} es obligatorio.`);
  }
  return value;
}

export class BoxScoreCorrectionService {
  constructor(supabaseClient=null) {
    this.supabase=supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  _assertReady() {
    if (!this.supabase || typeof this.supabase.rpc!=="function") {
      throw new Error("BoxScoreCorrectionService: cliente de datos no disponible.");
    }
  }

  async saveManualBoxScore({
    gameId,
    starterIds=[],
    stats=[]
  }={}) {
    this._assertReady();
    required(gameId,"gameId");

    const normalizedStats=(Array.isArray(stats) ? stats : []).map(row => ({
      player_id:row.player_id || row.playerId,
      starter:Boolean(row.starter),
      minutes:Number(row.minutes || 0),
      points:Number(row.points || 0),
      fg2_made:Number(row.fg2_made || 0),
      fg2_attempted:Number(row.fg2_attempted || 0),
      fg3_made:Number(row.fg3_made || 0),
      fg3_attempted:Number(row.fg3_attempted || 0),
      ft_made:Number(row.ft_made || 0),
      ft_attempted:Number(row.ft_attempted || 0),
      off_reb:Number(row.off_reb || 0),
      def_reb:Number(row.def_reb || 0),
      assists:Number(row.assists || 0),
      steals:Number(row.steals || 0),
      blocks:Number(row.blocks ?? row.blocks_made ?? 0),
      turnovers:Number(row.turnovers || 0),
      fouls_committed:Number(row.fouls_committed || 0),
      fouls_drawn:Number(row.fouls_drawn ?? row.fouls_received ?? 0)
    })).filter(row => row.player_id);

    const {data,error}=await this.supabase.rpc(
      "iq_v7_save_manual_boxscore",
      {
        p_game_id:gameId,
        p_starter_ids:Array.isArray(starterIds) ? starterIds : [],
        p_stats:normalizedStats
      }
    );

    if (error) throw error;
    return data;
  }
}

export default BoxScoreCorrectionService;
