/**
 * Read-only player training workload repository.
 * The database view is SECURITY INVOKER and is governed by underlying table RLS.
 * Values are calculated from actual attendance, never by incrementing counters.
 */
export class PlayerTrainingHoursService {
  constructor(client) { this.client = client?.supabase || client?.default || client; }

  async forPlayer(playerId) {
    if (!playerId || !this.client?.from) throw new Error('TRAINING_HOURS_ARGUMENT_INVALID');
    const result = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await this.client
        .from('iq_training_player_hours_v64')
        .select('player_id,training_session_id,session_date,session_kind,accredited_minutes,classification_review')
        .eq('player_id', playerId).order('session_date', { ascending: false })
        .range(from, from + 499);
      if (error) throw error;
      result.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    return {
      playerId,
      totalMinutes: result.reduce((sum, row) => sum + Number(row.accredited_minutes || 0), 0),
      byType: result.reduce((acc, row) => {
        const type = row.session_kind || 'TEAM';
        acc[type] = (acc[type] || 0) + Number(row.accredited_minutes || 0);
        return acc;
      }, {}),
      pendingClassificationCount: result.filter(row => row.classification_review === 'PENDING').length,
      sessions: result
    };
  }

  /** Correction is privileged and audited in PostgreSQL, not done by direct UPDATE. */
  async correctSessionType({ sessionId, teamSeasonId, kind }) {
    if (!this.client?.rpc) throw new Error('TRAINING_HOURS_CLIENT_UNAVAILABLE');
    const { data, error } = await this.client.rpc('iq_v64_correct_training_kind', {
      p_session_id: sessionId, p_team_season_id: teamSeasonId, p_kind: kind
    });
    if (error) throw error;
    return data;
  }
}
export default PlayerTrainingHoursService;
