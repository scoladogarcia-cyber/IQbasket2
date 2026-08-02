/**
 * @fileoverview Entidad del Dominio: Jugador.
 * @description Mapeo de la tabla `players` de Supabase, incluyendo mano dominante, foto, notas y estado.
 */

export class Player {
  constructor({
    id = null,
    teamId = null,
    seasonId = null,
    firstName = "",
    lastName = "",
    jersey = 0,
    primaryPosition = "",
    secondaryPositions = [],
    birthDate = null,
    heightCm = null,
    weightKg = null,
    dominantHand = "",
    photoUrl = null,
    notes = "",
    status = "Activo",
    joinedAt = null,
    createdAt = null,
    updatedAt = null
  } = {}) {
    this.id = id;
    this.teamId = teamId;
    this.seasonId = seasonId;
    this.firstName = firstName;
    this.lastName = lastName;
    this.jersey = Number(jersey);
    this.primaryPosition = primaryPosition;

    if (typeof secondaryPositions === "string") {
      try {
        this.secondaryPositions = JSON.parse(secondaryPositions);
      } catch (e) {
        this.secondaryPositions = [];
      }
    } else {
      this.secondaryPositions = Array.isArray(secondaryPositions) ? secondaryPositions : [];
    }

    this.birthDate = birthDate;
    this.heightCm = heightCm ? Number(heightCm) : null;
    this.weightKg = weightKg ? Number(weightKg) : null;
    this.dominantHand = dominantHand;
    this.photoUrl = photoUrl;
    this.notes = notes;
    this.status = status;
    this.joinedAt = joinedAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  get isActive() {
    return this.status === "Activo";
  }

  toJSON() {
    return {
      id: this.id,
      team_id: this.teamId,
      season_id: this.seasonId,
      first_name: this.firstName,
      last_name: this.lastName,
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
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }
}