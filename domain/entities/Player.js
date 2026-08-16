/**
 * @fileoverview Entidad del Dominio: Player (Jugador).
 * @description Mapeo de la tabla `players` con soporte multiclub, multiequipo y multitemporada.
 * Desacoplado de cálculos estadísticos (centralizados en StatsEngine), almacena el perfil
 * biométrico, roles de posición, metadatos y control de sincronización/auditoría.
 */

/**
 * Estados del jugador en la plantilla.
 * @readonly
 * @enum {string}
 */
export const PlayerStatus = {
  ACTIVE: "ACTIVE",       // Activo y disponible
  INJURED: "INJURED",     // Lesionado
  INACTIVE: "INACTIVE",   // No disponible / Desconvocado
  TRANSFERRED: "TRANSFERRED" // Baja / Traspasado
};

/**
 * Posiciones tácticas de baloncesto.
 * @readonly
 * @enum {string}
 */
export const BasketballPosition = {
  PG: "PG", // Base (Point Guard)
  SG: "SG", // Escolta (Shooting Guard)
  SF: "SF", // Alero (Small Forward)
  PF: "PF", // Ala-Pívot (Power Forward)
  C: "C"    // Pívot (Center)
};

export class Player {
  /**
   * Crea una instancia de Jugador.
   * @param {Object} params - Parámetros de inicialización.
   * @param {string|null} [params.id=null] - UUID único del jugador.
   * @param {string|null} [params.teamId=null] - ID del equipo al que pertenece.
   * @param {string|null} [params.seasonId=null] - ID de la temporada activa.
   * @param {string|null} [params.clubId=null] - ID del club para aislamiento multitenant.
   * @param {string} [params.firstName=""] - Nombre de pila.
   * @param {string} [params.lastName=""] - Apellidos.
   * @param {string} [params.nickname=""] - Nombre deportivo / alias (opcional).
   * @param {number} [params.jersey=0] - Número de dorsal.
   * @param {string} [params.primaryPosition=""] - Posición principal (PG, SG, SF, PF, C).
   * @param {Array<string>} [params.secondaryPositions=[]] - Posiciones secundarias.
   * @param {string|null} [params.birthDate=null] - Fecha de nacimiento (YYYY-MM-DD).
   * @param {number|null} [params.heightCm=null] - Altura en centímetros.
   * @param {number|null} [params.weightKg=null] - Peso en kilogramos.
   * @param {string} [params.dominantHand="Right"] - Mano dominante: "Right" | "Left" | "Ambidextrous".
   * @param {string|null} [params.photoUrl=null] - URL de la fotografía de perfil.
   * @param {string} [params.notes=""] - Notas privadas del cuerpo técnico.
   * @param {string} [params.status=PlayerStatus.ACTIVE] - Estado del jugador.
   * @param {string|null} [params.joinedAt=null] - Fecha de incorporación al equipo.
   * @param {string} [params.syncStatus="LOCAL_DRAFT"] - Estado de sincronización cloud.
   * @param {number} [params.version=1] - Versión de control de concurrencia.
   * @param {string|null} [params.lastModifiedBy=null] - ID del último usuario editor.
   * @param {string|null} [params.serverUpdatedAt=null] - Timestamp ISO de validación en servidor.
   * @param {string|null} [params.localUpdatedAt=null] - Timestamp ISO de modificación local.
   * @param {string|null} [params.createdAt=null] - Timestamp ISO de creación.
   * @param {string|null} [params.updatedAt=null] - Timestamp ISO de actualización.
   */
  constructor({
    id = null,
    teamId = null,
    seasonId = null,
    clubId = null,
    firstName = "",
    lastName = "",
    nickname = "",
    jersey = 0,
    primaryPosition = "",
    secondaryPositions = [],
    birthDate = null,
    heightCm = null,
    weightKg = null,
    dominantHand = "Right",
    photoUrl = null,
    notes = "",
    status = PlayerStatus.ACTIVE,
    joinedAt = null,
    syncStatus = "LOCAL_DRAFT",
    version = 1,
    lastModifiedBy = null,
    serverUpdatedAt = null,
    localUpdatedAt = null,
    createdAt = null,
    updatedAt = null
  } = {}) {
    this.id = id;
    this.teamId = teamId;
    this.seasonId = seasonId;
    this.clubId = clubId;

    this.firstName = firstName || "";
    this.lastName = lastName || "";
    this.nickname = nickname || "";
    this.jersey = Number(jersey) || 0;
    this.primaryPosition = primaryPosition || "";

    // Parseo seguro de posiciones secundarias
    if (typeof secondaryPositions === "string") {
      try {
        const parsed = JSON.parse(secondaryPositions);
        this.secondaryPositions = Array.isArray(parsed) ? parsed : [];
      } catch {
        this.secondaryPositions = [];
      }
    } else {
      this.secondaryPositions = Array.isArray(secondaryPositions) ? secondaryPositions : [];
    }

    this.birthDate = birthDate;
    this.heightCm = heightCm !== null ? Number(heightCm) : null;
    this.weightKg = weightKg !== null ? Number(weightKg) : null;
    this.dominantHand = dominantHand;
    this.photoUrl = photoUrl;
    this.notes = notes || "";
    this.status = status;
    this.joinedAt = joinedAt;

    // Sincronización y control de versiones
    this.syncStatus = syncStatus;
    this.version = Number(version) || 1;
    this.lastModifiedBy = lastModifiedBy;
    this.serverUpdatedAt = serverUpdatedAt;
    this.localUpdatedAt = localUpdatedAt || new Date().toISOString();
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  /**
   * Nombre completo formal del jugador.
   * @returns {string} Nombre y apellidos concatenados.
   */
  get fullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  /**
   * Nombre para displays compactos en HUD, Box Scores y botones táctiles (#Dorsal Nombre/Alias).
   * @returns {string} Ejemplo: "#30 Stephen" o "#30 S. Curry".
   */
  get displayName() {
    const name = this.nickname || this.firstName || this.lastName || "Jugador";
    return `#${this.jersey} ${name}`.trim();
  }

  /**
   * Comprueba si el jugador está disponible para ser convocado.
   * @returns {boolean} True si el estado es ACTIVE.
   */
  get isActive() {
    return this.status === PlayerStatus.ACTIVE || this.status === "Activo";
  }

  /**
   * Actualiza la marca de tiempo local al modificar datos del jugador.
   */
  touchLocal() {
    this.localUpdatedAt = new Date().toISOString();
    this.updatedAt = this.localUpdatedAt;
    if (this.syncStatus === "SYNCHRONIZED") {
      this.syncStatus = "LOCAL_DRAFT";
    }
  }

  /**
   * Convierte la entidad a un objeto serializable en snake_case para persistencia (SQLite, Supabase).
   * @returns {Object} Representación serializable del jugador.
   */
  toJSON() {
    return {
      id: this.id,
      team_id: this.teamId,
      season_id: this.seasonId,
      club_id: this.clubId,
      first_name: this.firstName,
      last_name: this.lastName,
      nickname: this.nickname,
      jersey: this.jersey,
      primary_position: this.primaryPosition,
      secondary_positions: JSON.stringify(this.secondaryPositions),
      birth_date: this.birthDate,
      height_cm: this.heightCm,
      weight_kg: this.weightKg,
      dominant_hand: this.dominantHand,
      photo_url: this.photoUrl,
      notes: this.notes,
      status: this.status,
      joined_at: this.joinedAt,
      sync_status: this.syncStatus,
      version: this.version,
      last_modified_by: this.lastModifiedBy,
      server_updated_at: this.serverUpdatedAt,
      local_updated_at: this.localUpdatedAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  /**
   * Reconstruye una instancia de Player a partir de una fila de BD o JSON.
   * @param {Object} row - Fila en camelCase o snake_case.
   * @returns {Player} Nueva instancia de Player.
   */
  static fromJSON(row = {}) {
    return new Player({
      id: row.id,
      teamId: row.team_id ?? row.teamId,
      seasonId: row.season_id ?? row.seasonId,
      clubId: row.club_id ?? row.clubId,
      firstName: row.first_name ?? row.firstName,
      lastName: row.last_name ?? row.lastName,
      nickname: row.nickname,
      jersey: row.jersey,
      primaryPosition: row.primary_position ?? row.primaryPosition,
      secondaryPositions: row.secondary_positions ?? row.secondaryPositions,
      birthDate: row.birth_date ?? row.birthDate,
      heightCm: row.height_cm ?? row.heightCm,
      weightKg: row.weight_kg ?? row.weightKg,
      dominantHand: row.dominant_hand ?? row.dominantHand,
      photoUrl: row.photo_url ?? row.photoUrl,
      notes: row.notes,
      status: row.status,
      joinedAt: row.joined_at ?? row.joinedAt,
      syncStatus: row.sync_status ?? row.syncStatus,
      version: row.version,
      lastModifiedBy: row.last_modified_by ?? row.lastModifiedBy,
      serverUpdatedAt: row.server_updated_at ?? row.serverUpdatedAt,
      localUpdatedAt: row.local_updated_at ?? row.localUpdatedAt,
      createdAt: row.created_at ?? row.createdAt,
      updatedAt: row.updated_at ?? row.updatedAt
    });
  }
}