/**
 * Training Player Directory V56.
 *
 * Provides a paginated, permission-aware player search for training selection.
 * The backend owns scope and ordering. The client never assumes that visibility
 * in another UI grants permission to browse unrelated players.
 */

export const TRAINING_PLAYER_PAGE_SIZE = 15;

export class TrainingPlayerDirectoryService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  async resolve({ teamSeasonId, playerIds = [] } = {}) {
    if (!teamSeasonId) throw new Error("TEAM_SEASON_REQUIRED");
    const ids = [...new Set((playerIds || []).map(String).filter(Boolean))];
    if (!ids.length || !this.supabase) return [];

    const { data, error } = await this.supabase.rpc("iq_v57_resolve_training_players", {
      p_team_season_id: teamSeasonId,
      p_player_ids: ids
    });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async search({
    teamSeasonId,
    query = "",
    page = 1,
    pageSize = TRAINING_PLAYER_PAGE_SIZE
  } = {}) {
    if (!teamSeasonId) throw new Error("TEAM_SEASON_REQUIRED");
    if (!this.supabase) return { rows: [], page: 1, pageSize: TRAINING_PLAYER_PAGE_SIZE, total: 0, pages: 0 };

    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(TRAINING_PLAYER_PAGE_SIZE, Math.max(1, Number(pageSize) || TRAINING_PLAYER_PAGE_SIZE));

    const { data, error } = await this.supabase.rpc("iq_v56_search_training_players", {
      p_team_season_id: teamSeasonId,
      p_query: String(query || "").trim(),
      p_page: safePage,
      p_page_size: safePageSize
    });

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const total = Number(rows[0]?.total_count || 0);
    return {
      rows,
      page: safePage,
      pageSize: safePageSize,
      total,
      pages: total > 0 ? Math.ceil(total / safePageSize) : 0
    };
  }
}

export default TrainingPlayerDirectoryService;
