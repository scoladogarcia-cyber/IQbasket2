/**
 * Training V54 persistence boundary. No direct browser writes to training tables:
 * the database validates RBAC, season, roster, revision and all child rows in
 * a single transaction. Block detail is staff-only via row-level security.
 */
export class TrainingCompleteEditV54Service {
  constructor(client) { this.client = client?.supabase || client?.default || client; }

  async listBlockParticipation(sessions = []) {
    if (!this.client?.from) throw new Error('Cliente de datos no disponible.');
    const ids = new Set(sessions.flatMap(session => (session.blocks || []).map(block => String(block.id))));
    if (!ids.size) return [];
    const rows = [];
    const ordered = [...ids];
    for (let batch = 0; batch < ordered.length; batch += 35) {
      const blockIds = ordered.slice(batch, batch + 35);
      for (let offset = 0; ; offset += 750) {
        const { data, error } = await this.client.from('training_block_participation')
          .select('id,block_id,participant_id,participation_status,participated_minutes,exception_reason,updated_at')
          .in('block_id', blockIds).order('id', { ascending: true }).range(offset, offset + 749);
        if (error || !Array.isArray(data)) throw new Error('No se pueden consultar las excepcionalidades del entrenamiento.');
        if (data.some(row => !ids.has(String(row.block_id)))) throw new Error('Datos de bloques fuera del equipo/temporada.');
        rows.push(...data);
        if (data.length < 750) break;
      }
    }
    return rows;
  }

  /** Snapshot sent by the UI; server compares parent and all child timestamps. */
  revision(session, assignments = []) {
    const normalize = rows => rows.map(row => ({ id: row.id, updated_at: row.updated_at }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const participantIds = new Set((session.participants || []).map(p => String(p.id)));
    return {
      session: session.updated_at,
      blocks: normalize(session.blocks || []),
      participants: normalize(session.participants || []),
      assignments: normalize(assignments.filter(row => participantIds.has(String(row.participant_id))))
    };
  }

  async saveComplete({ session, teamSeasonId, revision, date, title, trainingType,
    objective, notes, start, end, intensity, blocks, participants, confirmedRemovals = false }) {
    if (!this.client?.rpc || !session?.id || !teamSeasonId || !revision || !date || !title) {
      throw new Error('Datos obligatorios del entrenamiento no disponibles.');
    }
    const { data, error } = await this.client.rpc('iq_v54_update_training_complete', {
      p_session_id: session.id, p_team_season_id: teamSeasonId,
      p_revision: revision, p_session_date: date, p_title: title,
      p_training_type: trainingType || 'GENERAL', p_objective: objective || null,
      p_notes: notes || null, p_start_time: start, p_end_time: end,
      p_intensity: intensity, p_blocks: blocks, p_participants: participants,
      p_confirm_removals: Boolean(confirmedRemovals)
    });
    if (error) throw new Error(error.message || 'No se ha guardado el entrenamiento.');
    if (String(data) !== String(session.id)) throw new Error('La base de datos no confirmó la sesión esperada.');
    return data;
  }
}

export default TrainingCompleteEditV54Service;
