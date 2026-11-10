/**
 * @fileoverview Indicadores accionables del entrenamiento V83.
 * @description Separa planes de sesiones validadas: nunca contabiliza minutos
 * planificados como entrenamiento acreditado ni inventa RPE o asistencia.
 */
import { trainingTodayLocalV83, trainingValidationIssuesV83 } from "./TrainingValidationPreflightV83.js";

const rows = value => Array.isArray(value) ? value : [];
const state = session => String(session?.status || "").toUpperCase();
const positiveMinutes = value => {
  if (value == null || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};
const dateIso = value => String(value || "").slice(0, 10);
function mondayUtc(iso) {
  const date = new Date(iso + "T12:00:00Z");
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
function previousWeek(iso, offset) {
  const date = new Date(iso + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() - offset * 7);
  return date.toISOString().slice(0, 10);
}

/**
 * @param {object[]} sessions - Sesiones visibles según RLS.
 * @param {string} today - Fecha local (inyectable para pruebas).
 */
export function buildTrainingOverviewV83(sessions = [], today = trainingTodayLocalV83(), canEdit = () => true) {
  const relevant = rows(sessions).filter(s => !["ARCHIVED", "CANCELLED"].includes(state(s)));
  const completed = relevant.filter(s => state(s) === "COMPLETED" && dateIso(s.session_date) <= today);
  const due = relevant.filter(s => state(s) === "PLANNED" && dateIso(s.session_date) <= today);
  const upcoming = relevant.filter(s => state(s) === "PLANNED" && dateIso(s.session_date) > today);
  const actionableDue = due.filter(s => canEdit(s));
  const ready = actionableDue.filter(s => trainingValidationIssuesV83(s, today).length === 0);
  const needsReview = actionableDue.filter(s => trainingValidationIssuesV83(s, today).length > 0);
  let creditedPlayerMinutes = 0, attended = 0, confirmed = 0;
  const focuses = new Map();

  for (const session of completed) {
    for (const row of rows(session.participants)) {
      const presence = String(row.attendance_status || "").toUpperCase();
      if (presence === "PLANNED") continue;
      confirmed += 1;
      if (presence === "PRESENT" || presence === "PARTIAL") {
        attended += 1;
        creditedPlayerMinutes += positiveMinutes(row.participated_minutes);
      }
    }
    for (const code of new Set(rows(session?.metadata?.training_focus_codes).map(x => String(x || "").trim().toUpperCase()).filter(Boolean))) {
      focuses.set(code, (focuses.get(code) || 0) + 1);
    }
  }

  const currentWeek = mondayUtc(today);
  const weeks = currentWeek ? Array.from({ length: 6 }, (_, i) => ({
    week: previousWeek(currentWeek, 5 - i),
    validated: 0,
    pending: 0
  })) : [];
  const weekIndex = new Map(weeks.map((w, i) => [w.week, i]));
  for (const session of [...completed, ...due]) {
    const week = mondayUtc(dateIso(session.session_date));
    const index = weekIndex.get(week);
    if (index === undefined) continue;
    if (state(session) === "COMPLETED") weeks[index].validated += 1;
    else weeks[index].pending += 1;
  }

  return {
    total: relevant.length,
    validated: completed.length,
    pending: due.length,
    ready: ready.length,
    needsReview: needsReview.length,
    readonlyPending: due.length - actionableDue.length,
    upcoming: upcoming.length,
    unclassifiedValidated: completed.filter(s => rows(s?.metadata?.training_focus_codes).length === 0).length,
    sessionMinutesValidated: completed.reduce((sum, s) => sum + positiveMinutes(s.duration_minutes), 0),
    playerMinutesValidated: creditedPlayerMinutes,
    attendancePct: confirmed ? Math.round((attended / confirmed) * 1000) / 10 : null,
    focusCoveragePct: completed.length
      ? Math.round(completed.filter(s => rows(s?.metadata?.training_focus_codes).length > 0).length / completed.length * 100)
      : null,
    focuses: [...focuses].map(([code, sessions]) => ({ code, sessions })).sort((a, b) => b.sessions - a.sessions || a.code.localeCompare(b.code)),
    weeks,
    readyIds: ready.map(s => String(s.id)),
    reviewIds: needsReview.map(s => String(s.id)),
    lastUpdated: today
  };
}
