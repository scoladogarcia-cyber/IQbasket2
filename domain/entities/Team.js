/**
 * @fileoverview Entidad del Dominio: Equipo.
 * @description Mapeo directo con la tabla `teams` de Supabase.
 */

export class Team {
  constructor({
    id = null,
    clubId = null,
    name = "",
    category = "",
    competition = "",
    color = "#000000",
    logoUrl = null,
    periodsCount = 4,
    periodMinutes = 10,
    coachName = "",
    createdAt = null,
    updatedAt = null
  } = {}) {
    this.id = id;
    this.clubId = clubId;
    this.name = name;
    this.category = category;
    this.competition = competition;
    this.color = color;
    this.logoUrl = logoUrl;
    this.periodsCount = Number(periodsCount);
    this.periodMinutes = Number(periodMinutes);
    this.coachName = coachName;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  toJSON() {
    return {
      id: this.id,
      club_id: this.clubId,
      name: this.name,
      category: this.category,
      competition: this.competition,
      color: this.color,
      logo_url: this.logoUrl,
      periods_count: this.periodsCount,
      period_minutes: this.periodMinutes,
      coach_name: this.coachName,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }
}