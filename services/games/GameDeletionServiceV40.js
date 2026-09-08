/**
 * @fileoverview Confirmed server-side game deletion for V40.
 * @description Never performs optimistic deletion. The UI is updated only after
 * PostgreSQL confirms that the whole destructive transaction succeeded.
 */

function requireUuid(value, label = "gameId") {
  const id = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error(`GameDeletionServiceV40: ${label} inválido.`);
  }
  return id;
}

function friendlyDeleteError(error) {
  const message = String(error?.message || error || "");
  if (/GAME_DELETE_REFERENCED/i.test(message)) {
    return new Error("Este partido está vinculado a informes o evidencias de desarrollo. Desvincula esos elementos antes de eliminarlo.");
  }
  if (/GAME_DELETE_DENIED|permission denied|42501/i.test(message)) {
    return new Error("No tienes permiso para eliminar este partido o su temporada está bloqueada.");
  }
  if (/GAME_DELETE_NOT_FOUND|P0002/i.test(message)) {
    return new Error("El partido ya no existe o no está disponible en tu ámbito.");
  }
  if (/GAME_DELETE_REASON_TOO_LONG/i.test(message)) {
    return new Error("El motivo de eliminación es demasiado largo.");
  }
  return new Error(`No se pudo eliminar el partido: ${message || "error desconocido"}`);
}

export class GameDeletionServiceV40 {
  constructor(supabaseClient) {
    this.supabase = supabaseClient || null;
  }

  async deleteGame({ gameId, reason = null }) {
    if (!this.supabase?.rpc) {
      throw new Error("No hay conexión disponible para confirmar la eliminación del partido.");
    }

    const id = requireUuid(gameId);
    const normalizedReason = String(reason || "").trim().slice(0, 500) || null;
    const { data, error } = await this.supabase.rpc("iq_v40_delete_game", {
      p_game_id: id,
      p_reason: normalizedReason
    });

    if (error) throw friendlyDeleteError(error);
    if (!data?.deleted || String(data?.game_id || "") !== id) {
      throw new Error("El servidor no confirmó la eliminación del partido.");
    }

    return data;
  }
}

export default GameDeletionServiceV40;
