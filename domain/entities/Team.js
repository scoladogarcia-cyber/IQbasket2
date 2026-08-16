/**
 * @fileoverview Entidad del Dominio: Team (Equipo).
 * @description Representa la configuración, identidad y metadatos de un equipo en iqbasket.
 * Compatible con la tabla `teams` de Supabase y SQLite/IndexedDB local.
 * Desacoplado de cálculos estadísticos (centralizados en StatsEngine.js).
 * 
 * Soporta:
 * - Aislamiento multi-club (clubId) y multi-equipo.
 * - Configuración reglamentaria por defecto (cuartos, minutos, prórrogas).
 * - Identidad visual corporativa (colores primario y secundario, logo).
 * - Control de sincronización local-first y auditoría.
 */

export class Team {
  /**
   * Crea una instancia de Team.
   * @param {Object} params - Parámetros de inicialización del equipo.
   * @param {string|null} [params.id=null] - UUID único del equipo.
   * @param {string|null} [params.clubId=null] - ID del club o tenant para aislamiento multiclub.
   * @param {string} [params.name=""] - Nombre oficial del equipo.
   * @param {string} [params.shortName=""] - Abreviatura o nombre corto (ej. "LAL", "FCB", "RM").
   * @param {string} [params.category=""] - Categoría de edad / nivel (Senior, Junior, Cadete, etc.).
   * @param {string} [params.gender="M"] - Rama: "M" (Masculino), "F" (Femenino), "MIXED" (Mixto).
   * @param {string} [params.competition=""] - Competición o liga principal.
   * @param {string} [params.color="#1E3A8A"] - Color primario en formato HEX.
   * @param {string} [params.secondaryColor="#F59E0B"] - Color secundario o de acento en formato HEX.
   * @param {string|null} [params.logoUrl=null] - URL de la imagen del escudo/logo.
   * @param {number} [params.periodsCount=4] - Número reglamentario de periodos estándar.
   * @param {number} [params.periodMinutes=10] - Duración reglamentaria de cada cuarto en minutos.
   * @param {number} [params.overtimeMinutes=5] - Duración de periodos de prórroga en minutos.
   * @param {string} [params.coachName=""] - Nombre del primer entrenador / Head Coach.
   * @param {Array<string>} [params.assistantCoaches=[]] - Nombres o IDs del cuerpo técnico asistente.
   * @param {string} [params.syncStatus="LOCAL_DRAFT"] - Estado de sincronización cloud.
   * @param {number} [params.version=1] - Versión incremental para control de concurrencia.
   * @param {string|null} [params.lastModifiedBy=null] - ID del último usuario editor.
   * @param {string|null} [params.serverUpdatedAt=null] - Timestamp ISO de validación en servidor.
   * @param {string|null} [params.localUpdatedAt=null] - Timestamp ISO de modificación en local.
   * @param {string|null} [params.createdAt=null] - Timestamp ISO de creación.
   * @param {string|null} [params.updatedAt=null] - Timestamp ISO de actualización.
   */
  constructor({
    id = null,
    clubId = null,
    name = "",
    shortName = "",
    category = "",
    gender = "M",
    competition = "",
    color = "#1E3A8A",
    secondaryColor = "#F59E0B",
    logoUrl = null,
    periodsCount = 4,
    periodMinutes = 10,
    overtimeMinutes = 5,
    coachName = "",
    assistantCoaches = [],
    syncStatus = "LOCAL_DRAFT",
    version = 1,
    lastModifiedBy = null,
    serverUpdatedAt = null,
    localUpdatedAt = null,
    createdAt = null,
    updatedAt = null
  } = {}) {
    // Identificadores relacionales
    this.id = id;
    this.clubId = clubId;

    // Identidad y denominación
    this.name = name || "";
    this.shortName = shortName || (this.name ? this.name.substring(0, 3).toUpperCase() : "");
    this.category = category || "";
    this.gender = gender || "M";
    this.competition = competition || "";

    // Identidad visual
    this.color = color || "#1E3A8A";
    this.secondaryColor = secondaryColor || "#F59E0B";
    this.logoUrl = logoUrl || null;

    // Configuración reglamentaria predeterminada de los partidos del equipo
    this.periodsCount = Number(periodsCount) || 4;
    this.periodMinutes = Number(periodMinutes) || 10;
    this.overtimeMinutes = Number(overtimeMinutes) || 5;

    // Cuerpo técnico
    this.coachName = coachName || "";
    
    // Parseo seguro de entrenadores asistentes
    if (typeof assistantCoaches === "string") {
      try {
        const parsed = JSON.parse(assistantCoaches);
        this.assistantCoaches = Array.isArray(parsed) ? parsed : [];
      } catch {
        this.assistantCoaches = [];
      }
    } else {
      this.assistantCoaches = Array.isArray(assistantCoaches) ? assistantCoaches : [];
    }

    // Control de sincronización y concurrencia
    this.syncStatus = syncStatus;
    this.version = Number(version) || 1;
    this.lastModifiedBy = lastModifiedBy;
    this.serverUpdatedAt = serverUpdatedAt;
    this.localUpdatedAt = localUpdatedAt || new Date().toISOString();
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  /**
   * Nombre corto para marcadores y espacios reducidos (ej. en mobile).
   * @returns {string} Nombre corto o primeros 3 caracteres en mayúsculas.
   */
  get displayCode() {
    return this.shortName || (this.name ? this.name.substring(0, 3).toUpperCase() : "TM");
  }

  /**
   * Actualiza la marca de tiempo local al modificar datos del equipo.
   */
  touchLocal() {
    this.localUpdatedAt = new Date().toISOString();
    this.updatedAt = this.localUpdatedAt;
    if (this.syncStatus === "SYNCHRONIZED") {
      this.syncStatus = "LOCAL_DRAFT";
    }
  }

  /**
   * Convierte la entidad a un objeto plano en snake_case para persistencia (SQLite, Supabase).
   * @returns {Object} Representación serializable del equipo.
   */
  toJSON() {
    return {
      id: this.id,
      club_id: this.clubId,
      name: this.name,
      short_name: this.shortName,
      category: this.category,
      gender: this.gender,
      competition: this.competition,
      color: this.color,
      secondary_color: this.secondaryColor,
      logo_url: this.logoUrl,
      periods_count: this.periodsCount,
      period_minutes: this.periodMinutes,
      overtime_minutes: this.overtimeMinutes,
      coach_name: this.coachName,
      assistant_coaches: JSON.stringify(this.assistantCoaches),
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
   * Reconstruye una instancia de Team desde una fila de base de datos o JSON.
   * @param {Object} row - Fila en camelCase o snake_case.
   * @returns {Team} Nueva instancia de Team.
   */
  static fromJSON(row = {}) {
    return new Team({
      id: row.id,
      clubId: row.club_id ?? row.clubId,
      name: row.name,
      shortName: row.short_name ?? row.shortName,
      category: row.category,
      gender: row.gender,
      competition: row.competition,
      color: row.color,
      secondaryColor: row.secondary_color ?? row.secondaryColor,
      logoUrl: row.logo_url ?? row.logoUrl,
      periodsCount: row.periods_count ?? row.periodsCount,
      periodMinutes: row.period_minutes ?? row.periodMinutes,
      overtimeMinutes: row.overtime_minutes ?? row.overtimeMinutes,
      coachName: row.coach_name ?? row.coachName,
      assistantCoaches: row.assistant_coaches ?? row.assistantCoaches,
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