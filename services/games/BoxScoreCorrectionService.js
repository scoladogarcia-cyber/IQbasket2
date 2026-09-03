import { StatsEngine, GameEventType } from "../../engine/StatsEngine.js";

const EVENT_TYPE_VALUES = new Set(Object.values(GameEventType));

const LEGACY_EVENT_MAP = Object.freeze({
  fg2_made: GameEventType.SHOT_2P_MADE,
  fg2_attempted: GameEventType.SHOT_2P_MISSED,
  fg2_missed: GameEventType.SHOT_2P_MISSED,
  shot_2p_made: GameEventType.SHOT_2P_MADE,
  shot_2p_missed: GameEventType.SHOT_2P_MISSED,
  fg3_made: GameEventType.SHOT_3P_MADE,
  fg3_attempted: GameEventType.SHOT_3P_MISSED,
  fg3_missed: GameEventType.SHOT_3P_MISSED,
  shot_3p_made: GameEventType.SHOT_3P_MADE,
  shot_3p_missed: GameEventType.SHOT_3P_MISSED,
  ft_made: GameEventType.FREE_THROW_MADE,
  ft_attempted: GameEventType.FREE_THROW_MISSED,
  ft_missed: GameEventType.FREE_THROW_MISSED,
  free_throw_made: GameEventType.FREE_THROW_MADE,
  free_throw_missed: GameEventType.FREE_THROW_MISSED,
  off_reb: GameEventType.REBOUND_OFFENSIVE,
  rebound_offensive: GameEventType.REBOUND_OFFENSIVE,
  def_reb: GameEventType.REBOUND_DEFENSIVE,
  rebound_defensive: GameEventType.REBOUND_DEFENSIVE,
  assists: GameEventType.ASSIST,
  assist: GameEventType.ASSIST,
  steals: GameEventType.STEAL,
  steal: GameEventType.STEAL,
  blocks_made: GameEventType.BLOCK_MADE,
  block_made: GameEventType.BLOCK_MADE,
  blocks_received: GameEventType.BLOCK_RECEIVED,
  block_received: GameEventType.BLOCK_RECEIVED,
  turnovers: GameEventType.TURNOVER,
  turnover: GameEventType.TURNOVER,
  fouls_committed: GameEventType.FOUL_PERSONAL,
  foul_personal: GameEventType.FOUL_PERSONAL,
  fouls_drawn: GameEventType.FOUL_DRAWN,
  foul_drawn: GameEventType.FOUL_DRAWN,
  period_start: GameEventType.PERIOD_START,
  period_end: GameEventType.PERIOD_END,
  substitution: GameEventType.SUBSTITUTION,
  opponent_score_2p: GameEventType.OPPONENT_SCORE_2P,
  opponent_score_3p: GameEventType.OPPONENT_SCORE_3P,
  opponent_score_ft: GameEventType.OPPONENT_SCORE_FT,
  opponent_miss_2p: GameEventType.OPPONENT_MISS_2P,
  opponent_miss_3p: GameEventType.OPPONENT_MISS_3P,
  opponent_miss_ft: GameEventType.OPPONENT_MISS_FT,
  opponent_reb_off: GameEventType.OPPONENT_REB_OFF,
  opponent_reb_def: GameEventType.OPPONENT_REB_DEF,
  opponent_turnover: GameEventType.OPPONENT_TURNOVER,
  opponent_foul: GameEventType.OPPONENT_FOUL
});

const METRICS = Object.freeze([
  ["fg2_made", "fg2Made", "T2C"],
  ["fg2_attempted", "fg2Attempted", "T2I"],
  ["fg3_made", "fg3Made", "T3C"],
  ["fg3_attempted", "fg3Attempted", "T3I"],
  ["ft_made", "ftMade", "TLC"],
  ["ft_attempted", "ftAttempted", "TLI"],
  ["off_reb", "offReb", "RO"],
  ["def_reb", "defReb", "RD"],
  ["assists", "assists", "AST"],
  ["steals", "steals", "ROB"],
  ["blocks_made", "blocksMade", "TAP"],
  ["blocks_received", "blocksReceived", "TAP REC"],
  ["turnovers", "turnovers", "PER"],
  ["fouls_committed", "foulsCommitted", "FC"],
  ["fouls_drawn", "foulsDrawn", "FR"]
]);

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseClockToElapsedSeconds(gameClock, periodMinutes = 10) {
  const match = String(gameClock || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  const remaining = Number(match[1]) * 60 + Number(match[2]);
  return Math.max(0, Number(periodMinutes || 10) * 60 - remaining);
}

export class BoxScoreCorrectionService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  _assertReady() {
    if (!this.supabase || typeof this.supabase.rpc !== "function") {
      throw new Error("BoxScoreCorrectionService: cliente de datos no disponible.");
    }
  }

  async canEdit(gameId) {
    this._assertReady();
    if (!gameId) return false;
    const { data, error } = await this.supabase.rpc(
      "iq_core_ux_can_edit_boxscore",
      { p_game_id: gameId }
    );
    if (error) throw error;
    return Boolean(data);
  }

  normalizeEvents(events = [], game = {}) {
    const periodMinutes = number(game.period_minutes ?? game.periodMinutes ?? 10) || 10;

    return normalizeArray(events)
      .map((event) => {
        const raw = String(
          event.type || event.action_type || event.action || event.event_type || ""
        ).trim();
        const canonical = EVENT_TYPE_VALUES.has(raw)
          ? raw
          : LEGACY_EVENT_MAP[raw.toLowerCase()];

        if (!canonical) return null;

        return {
          ...event,
          type: canonical,
          playerId: event.playerId || event.player_id || null,
          period: number(event.period || 1) || 1,
          timestampSec: event.timestampSec
            ?? event.timestamp_sec
            ?? parseClockToElapsedSeconds(
              event.game_clock || event.timeRemaining,
              periodMinutes
            ),
          playerInId: event.playerInId || event.player_in_id || null,
          playerOutId: event.playerOutId || event.player_out_id || null,
          lineupIds: event.lineupIds || event.lineup_ids || null
        };
      })
      .filter(Boolean);
  }

  compareWithEvents({ game = {}, stats = [], events = [] } = {}) {
    const normalizedEvents = this.normalizeEvents(events, game);
    if (!normalizedEvents.length) {
      return {
        hasEvents: false,
        discrepancies: [],
        eventStats: []
      };
    }

    const starters = Array.isArray(game.starter_ids || game.starterIds)
      ? (game.starter_ids || game.starterIds)
      : [];

    const computed = StatsEngine.processGameEvents(normalizedEvents, {
      periodMinutes: game.period_minutes || game.periodMinutes || 10,
      overtimeMinutes: game.overtime_minutes || game.overtimeMinutes || 5,
      starterIds: starters
    });

    const eventStats = normalizeArray(computed.playerStatsList);
    const eventByPlayer = new Map(
      eventStats.map(row => [String(row.playerId || row.player_id || ""), row])
    );

    const discrepancies = [];
    normalizeArray(stats).forEach(row => {
      const playerId = String(row.player_id || row.playerId || "");
      if (!playerId) return;

      const eventRow = eventByPlayer.get(playerId) || {};
      METRICS.forEach(([manualField, eventField, label]) => {
        const boxscoreValue = number(row[manualField]);
        const playByPlayValue = number(eventRow[eventField]);
        if (boxscoreValue === playByPlayValue) return;

        discrepancies.push({
          player_id: playerId,
          metric: manualField,
          label,
          boxscore_value: boxscoreValue,
          play_by_play_value: playByPlayValue
        });
      });
    });

    return {
      hasEvents: true,
      discrepancies,
      eventStats,
      computedTeamScore: number(computed.teamScore)
    };
  }

  async saveCorrection({
    gameId,
    starterIds = [],
    stats = [],
    reason = null,
    sourceMode = "PRIMARY_BOXSCORE",
    discrepancies = []
  } = {}) {
    this._assertReady();
    if (!gameId) throw new Error("BoxScoreCorrectionService: gameId obligatorio.");

    const { data, error } = await this.supabase.rpc(
      "iq_core_ux_save_boxscore_correction",
      {
        p_game_id: gameId,
        p_starter_ids: normalizeArray(starterIds),
        p_stats: normalizeArray(stats),
        p_reason: reason,
        p_source_mode: String(sourceMode || "PRIMARY_BOXSCORE").toUpperCase(),
        p_discrepancies: normalizeArray(discrepancies)
      }
    );

    if (error) throw error;
    return Boolean(data);
  }
}

export default BoxScoreCorrectionService;
