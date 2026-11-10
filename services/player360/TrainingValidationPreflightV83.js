/**
 * @fileoverview Prevalidación explicativa de entrenamientos (V83).
 * @description Refleja las comprobaciones de iq_v65_set_training_validation sin
 * alterar registros. La RPC del servidor continúa siendo la única autoridad.
 */

/** Fecha local ISO, evitando desfases UTC en la medianoche del dispositivo. */
export function trainingTodayLocalV83(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

/**
 * @param {object} session - Sesión y participantes recibidos del servidor.
 * @param {string} today - Fecha local YYYY-MM-DD.
 * @returns {Array<{code:string,count:number}>} Incidencias para mostrar, no guardar.
 */
export function trainingValidationIssuesV83(session, today = trainingTodayLocalV83()) {
  if (!session) return [{ code: "NOT_FOUND", count: 1 }];
  const issues = [];
  const status = String(session.status || "").toUpperCase();
  const date = String(session.session_date || "").slice(0, 10);
  const duration = session.duration_minutes == null ? NaN : Number(session.duration_minutes);
  const participants = Array.isArray(session.participants) ? session.participants : [];

  if (status === "ARCHIVED" || status === "CANCELLED") {
    return [{ code: "NOT_VALIDATABLE", count: 1 }];
  }
  if (status !== "PLANNED" && status !== "COMPLETED") {
    issues.push({ code: "NOT_VALIDATABLE", count: 1 });
  }
  if (!date || date > today) issues.push({ code: "FUTURE", count: 1 });
  if (!Number.isFinite(duration) || duration < 1) issues.push({ code: "DURATION", count: 1 });
  if (!participants.length) issues.push({ code: "NO_PARTICIPANTS", count: 1 });

  let pending = 0, invalidMinutes = 0;
  for (const row of participants) {
    const attendance = String(row.attendance_status || "").toUpperCase();
    const rawMinutes = row.participated_minutes;
    const mins = rawMinutes == null || rawMinutes === "" ? NaN : Number(rawMinutes);
    if (attendance === "PLANNED") pending += 1;
    if (attendance === "PRESENT" || attendance === "PARTIAL") {
      if (!Number.isFinite(mins) || mins < 0 || (Number.isFinite(duration) && mins > duration)) {
        invalidMinutes += 1;
      }
    } else if (attendance === "ABSENT" || attendance === "EXCUSED") {
      if (Number.isFinite(mins) && mins !== 0) invalidMinutes += 1;
    }
  }
  if (pending) issues.push({ code: "ATTENDANCE_PENDING", count: pending });
  if (invalidMinutes) issues.push({ code: "INVALID_MINUTES", count: invalidMinutes });
  return issues;
}

/** Traduce códigos de error devueltos por la RPC a los mismos motivos de prevalidación. */
export function trainingValidationErrorCodeV83(error) {
  const message = String(error?.message || error || "").toUpperCase();
  const names = {
    TRAINING_CANNOT_VALIDATE_FUTURE: "FUTURE",
    TRAINING_DURATION_REQUIRED: "DURATION",
    TRAINING_PARTICIPANTS_NEED_CONFIRMATION: "ATTENDANCE_PENDING",
    TRAINING_NO_PARTICIPANTS: "NO_PARTICIPANTS",
    TRAINING_NOT_VALIDATABLE: "NOT_VALIDATABLE",
    TRAINING_MANAGE_DENIED: "PERMISSION",
    TRAINING_NOT_FOUND: "NOT_FOUND",
    AUTH_REQUIRED: "PERMISSION"
  };
  return Object.entries(names).find(([name]) => message.includes(name))?.[1] || "SERVER";
}
