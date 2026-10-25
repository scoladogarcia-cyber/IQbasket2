/** Independent V55 delete action: the browser never deletes training table rows directly.
 * Session, team-season, immutable revision, permission and linked evidence are
 * all revalidated by the database in the SAME transaction.
 */
import { TrainingCompleteEditV54Service } from './TrainingCompleteEditV54Service.js';

export class TrainingHistoryV55Service extends TrainingCompleteEditV54Service {
  async deleteSession({session, teamSeasonId, revision, confirmed = false} = {}) {
    if (!this.client?.rpc || !session?.id || !teamSeasonId || !revision || confirmed !== true) {
      throw new Error('Falta una confirmación expresa o el contexto de eliminación.');
    }
    const {data,error}=await this.client.rpc('iq_v55_delete_training',{
      p_session_id:session.id,
      p_team_season_id:teamSeasonId,
      p_revision:revision,
      p_confirm:true
    });
    if (error) throw new Error(error.message || 'No se ha podido eliminar el entrenamiento.');
    if (data?.deleted !== true || String(data?.session_id) !== String(session.id)) {
      throw new Error('El servidor no confirmó la eliminación de la sesión solicitada.');
    }
    return data;
  }
}

export default TrainingHistoryV55Service;
