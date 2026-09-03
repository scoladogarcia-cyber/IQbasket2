/**
 * Resolve the display head coach for one team-season.
 *
 * Canonical v3 staff assignments always win over legacy coach fields.
 * If canonical history exists but no assignment is active, legacy data must not
 * resurrect a removed/replaced coach.
 */

export function normalizeSeasonDisplayName(value = "") {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})\s*[-\/]\s*(\d{4})$/);
  return match ? match[1] + "/" + match[2] : raw;
}

export function resolveHeadCoachName({
  teamId,
  seasonName,
  staffAssignments = [],
  seasons = [],
  team = null,
  fallback = "Por definir"
} = {}) {
  const targetTeamId = String(teamId || "");
  const targetSeasonName = normalizeSeasonDisplayName(seasonName)
    .trim()
    .toLowerCase();

  const canonicalRows = (staffAssignments || []).filter((assignment) => {
    const sameTeam = String(assignment.team_id || assignment.teamId || "")
      === targetTeamId;
    const sameSeason = normalizeSeasonDisplayName(
      assignment.season_name || assignment.seasonName || ""
    ).trim().toLowerCase() === targetSeasonName;
    const headCoach = String(
      assignment.staff_role || assignment.staffRole || ""
    ).toUpperCase() === "HEAD_COACH";

    return sameTeam && sameSeason && headCoach;
  });

  const activeCanonical = canonicalRows.find(
    assignment => String(assignment.status || "ACTIVE").toUpperCase() === "ACTIVE"
  );

  if (activeCanonical) {
    return activeCanonical.staff_name
      || activeCanonical.staffName
      || activeCanonical.external_name
      || activeCanonical.externalName
      || fallback;
  }

  if (canonicalRows.length > 0) {
    return fallback;
  }

  const legacySeason = (seasons || []).find((season) => {
    const sameTeam = String(season.team_id || season.teamId || "") === targetTeamId;
    const normalizedName = normalizeSeasonDisplayName(season.name || "")
      .trim()
      .toLowerCase();

    return sameTeam
      && (!targetSeasonName || normalizedName === targetSeasonName);
  });

  if (legacySeason?.coach_name || legacySeason?.coachName) {
    return legacySeason.coach_name || legacySeason.coachName;
  }

  return team?.coach_name
    || team?.coachName
    || team?.coach
    || fallback;
}

export default resolveHeadCoachName;
