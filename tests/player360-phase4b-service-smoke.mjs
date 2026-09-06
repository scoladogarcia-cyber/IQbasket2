import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TrainingService } from "../services/player360/TrainingService.js";

function buildQuery(table, rows, callLog) {
  const state = {
    table,
    rows: [...rows],
    filters: [],
    updatePayload: null,
    insertPayload: null
  };

  const query = {
    error: null,
    get data() {
      let result = [...state.rows];
      for (const filter of state.filters) {
        if (filter.type === "eq") result = result.filter(row => String(row[filter.key]) === String(filter.value));
        if (filter.type === "neq") result = result.filter(row => String(row[filter.key]) !== String(filter.value));
        if (filter.type === "in") {
          const allowed = new Set(filter.values.map(String));
          result = result.filter(row => allowed.has(String(row[filter.key])));
        }
      }
      return result;
    },
    select(columns) { callLog.push({ op: "select", table, columns }); return this; },
    update(payload) {
      state.updatePayload = structuredClone(payload);
      callLog.push({ op: "update", table, payload: structuredClone(payload) });
      return this;
    },
    insert(payload) {
      state.insertPayload = structuredClone(payload);
      callLog.push({ op: "insert", table, payload: structuredClone(payload) });
      return this;
    },
    delete() {
      callLog.push({ op: "delete", table });
      return this;
    },
    eq(key, value) { state.filters.push({ type: "eq", key, value }); return this; },
    neq(key, value) { state.filters.push({ type: "neq", key, value }); return this; },
    gte() { return this; },
    lte() { return this; },
    in(key, values) { state.filters.push({ type: "in", key, values }); return this; },
    order() { return this; },
    limit() { return this; },
    async single() {
      const row = this.data[0] || null;
      const data = state.insertPayload
        ? { id: "inserted-id", ...state.insertPayload }
        : (row && state.updatePayload ? { ...row, ...state.updatePayload } : row);
      return {
        data,
        error: data ? null : { message: "not found" }
      };
    }
  };

  return query;
}

const calls = [];
const tables = {
  training_sessions: [
    {
      id: "session-1",
      team_season_id: "ts-1",
      session_date: "2026-09-01",
      title: "Técnica",
      duration_minutes: 60,
      start_time: "18:00",
      end_time: "19:00",
      status: "PLANNED"
    },
    {
      id: "session-archived",
      team_season_id: "ts-1",
      session_date: "2026-08-20",
      title: "Archivada",
      status: "ARCHIVED"
    }
  ],
  training_blocks: [
    {
      id: "block-1",
      training_session_id: "session-1",
      block_order: 1,
      title: "Tiro"
    }
  ],
  training_participants: [
    {
      id: "participant-1",
      training_session_id: "session-1",
      team_season_id: "ts-1",
      player_id: "player-1",
      attendance_status: "PRESENT",
      participated_minutes: 60,
      rpe: 6,
      internal_load: 360
    }
  ],
  external_development_sessions: [
    {
      id: "external-1",
      team_season_id: "ts-1",
      player_id: "player-1",
      activity_date: "2026-09-02",
      title: "Tecnificación"
    }
  ],
  player360_activity_types: [
    {
      id: "type-1",
      team_season_id: "ts-1",
      module: "TRAINING",
      code: "SHOOTING",
      name: "Tiro",
      is_active: true
    }
  ]
};

const fakeSupabase = {
  from(table) {
    assert.ok(table in tables, `Tabla inesperada: ${table}`);
    return buildQuery(table, tables[table], calls);
  },
  async rpc(name, args = undefined) {
    calls.push({ op: "rpc", name, args });
    if (name === "iq_v4_training_capabilities") {
      return {
        data: {
          ready: true,
          training_core: true,
          external_development: true,
          activity_catalog: true
        },
        error: null
      };
    }
    if (name === "iq_v4_create_training_session") {
      return { data: "created-session-id", error: null };
    }
    if (name === "iq_v15_update_training_session") {
      const session = tables.training_sessions.find(row => row.id === args.p_training_session_id);
      const previousDuration = Number(session?.duration_minutes);
      const [startHour, startMinute] = String(args.p_start_time || "0:0").split(":").map(Number);
      const [endHour, endMinute] = String(args.p_end_time || "0:0").split(":").map(Number);
      const derivedDuration = args.p_start_time && args.p_end_time
        ? ((endHour * 60 + endMinute) - (startHour * 60 + startMinute))
        : args.p_duration_minutes;
      Object.assign(session, {
        session_date: args.p_session_date,
        title: args.p_title,
        objective: args.p_objective,
        start_time: args.p_start_time,
        end_time: args.p_end_time,
        duration_minutes: derivedDuration,
        intensity: args.p_intensity
      });
      for (const participant of tables.training_participants) {
        if (
          participant.training_session_id === args.p_training_session_id
          && participant.attendance_status === "PRESENT"
          && Number(participant.participated_minutes) === previousDuration
        ) participant.participated_minutes = derivedDuration;
      }
      return { data: args.p_training_session_id, error: null };
    }
    if (name === "iq_v4_set_training_participant") {
      return { data: "participant-id", error: null };
    }
    if (name === "iq_v4_archive_training_session") {
      return { data: true, error: null };
    }
    if (name === "iq_v4_create_external_development") {
      return { data: "external-id", error: null };
    }
    throw new Error(`RPC inesperada: ${name}`);
  }
};

const service = new TrainingService(fakeSupabase);

const capabilities = await service.getCapabilities();
assert.equal(capabilities.training_core, true);

const sessions = await service.listSessions({ teamSeasonId: "ts-1" });
assert.equal(sessions.length, 1);
assert.equal(sessions[0].id, "session-1");
assert.equal(sessions[0].blocks.length, 1);
assert.equal(sessions[0].participants.length, 1);
assert.equal(sessions[0].participants[0].internal_load, 360);

const external = await service.listExternalDevelopment({ teamSeasonId: "ts-1" });
assert.equal(external.length, 1);
assert.equal(external[0].player_id, "player-1");

const activityTypes = await service.listActivityTypes({
  teamSeasonId: "ts-1",
  module: "TRAINING"
});
assert.equal(activityTypes.length, 1);
assert.equal(activityTypes[0].code, "SHOOTING");

const created = await service.createSession({
  teamSeasonId: "ts-1",
  sessionDate: "2026-09-03",
  title: "Sesión",
  objective: "Objetivo",
  durationMinutes: 90,
  intensity: 7,
  blocks: [{ title: "Tiro" }],
  participants: [{ player_id: "player-1", attendance_status: "PLANNED" }]
});
assert.equal(created, "created-session-id");

const createCall = calls.find(call => call.name === "iq_v4_create_training_session");
assert.deepEqual(createCall.args, {
  p_team_season_id: "ts-1",
  p_session_date: "2026-09-03",
  p_title: "Sesión",
  p_objective: "Objetivo",
  p_duration_minutes: 90,
  p_intensity: 7,
  p_start_time: null,
  p_end_time: null,
  p_blocks: [{ title: "Tiro" }],
  p_participants: [{ player_id: "player-1", attendance_status: "PLANNED" }]
});

const corrected = await service.updateSession({
  trainingSessionId: "session-1",
  teamSeasonId: "ts-1",
  sessionDate: "2026-09-01",
  title: "Técnica corregida",
  objective: "Corregir finalizaciones",
  durationMinutes: 75,
  intensity: 7,
  startTime: "18:00",
  endTime: "19:15"
});
assert.equal(corrected.title, "Técnica corregida");
assert.equal(corrected.duration_minutes, 75);
const updateCall = calls.find(call => call.name === "iq_v15_update_training_session");
assert.ok(updateCall, "La correcci?n debe cruzar la frontera RPC de edici?n.");
assert.equal(updateCall.args.p_team_season_id, "ts-1");
assert.equal(updateCall.args.p_duration_minutes, null, "Con inicio/fin la duraci?n la deriva el servidor.");
assert.equal(tables.training_participants[0].participated_minutes, 75);
assert.equal(
  calls.some(call => call.op === "update" && call.table === "training_sessions"),
  false,
  "El servicio no debe escribir directamente training_sessions."
);

const correctedBlock = await service.saveBlock({
  trainingSessionId: "session-1",
  blockId: "block-1",
  blockOrder: 1,
  title: "Tiro corregido",
  durationMinutes: 25,
  intensity: 6
});
assert.equal(correctedBlock.title, "Tiro corregido");
assert.ok(
  calls.some(call =>
    call.op === "update"
    && call.table === "training_blocks"
    && call.payload.title === "Tiro corregido"
  )
);

const newBlock = await service.saveBlock({
  trainingSessionId: "session-1",
  blockOrder: 2,
  title: "Finalizaciones",
  durationMinutes: 20
});
assert.equal(newBlock.id, "inserted-id");
assert.ok(calls.some(call => call.op === "insert" && call.table === "training_blocks"));

assert.equal(
  await service.deleteBlock({ trainingSessionId: "session-1", blockId: "block-1" }),
  true
);

await service.setParticipant({
  trainingSessionId: "session-1",
  playerId: "player-1",
  attendanceStatus: "partial",
  participatedMinutes: 45,
  rpe: 7,
  notes: "Carga controlada"
});
const participantCall = calls.find(call => call.name === "iq_v4_set_training_participant");
assert.equal(participantCall.args.p_attendance_status, "PARTIAL");
assert.equal(participantCall.args.p_participated_minutes, 45);
assert.equal(participantCall.args.p_rpe, 7);

assert.equal(
  await service.removeParticipant({
    trainingSessionId: "session-1",
    teamSeasonId: "ts-1",
    playerId: "player-1"
  }),
  true
);
assert.ok(calls.some(call => call.op === "delete" && call.table === "training_participants"));

assert.equal(await service.archiveSession("session-1"), true);

const externalId = await service.createExternalDevelopment({
  teamSeasonId: "ts-1",
  playerId: "player-1",
  activityDate: "2026-09-03",
  title: "Tiro externo",
  durationMinutes: 60,
  rpe: 5,
  provenance: { source: "test" }
});
assert.equal(externalId, "external-id");

const correctedExternal = await service.updateExternalDevelopment({
  externalSessionId: "external-1",
  teamSeasonId: "ts-1",
  playerId: "player-1",
  activityDate: "2026-09-02",
  title: "Tecnificación corregida",
  durationMinutes: 70,
  intensity: 6,
  rpe: 5,
  notes: "Corrección"
});
assert.equal(correctedExternal.title, "Tecnificación corregida");
assert.ok(
  calls.some(call =>
    call.op === "update"
    && call.table === "external_development_sessions"
    && call.payload.title === "Tecnificación corregida"
  )
);

const trainingViewSource = readFileSync(
  new URL("../views/TrainingView.js", import.meta.url),
  "utf8"
);
assert.match(trainingViewSource, /p360-edit-session/);
assert.match(trainingViewSource, /p360-edit-external/);
assert.match(trainingViewSource, /updateSession\(/);
assert.match(trainingViewSource, /updateExternalDevelopment\(/);
assert.match(trainingViewSource, /p360-save-edit-block/);
assert.match(trainingViewSource, /p360-remove-participant/);
assert.match(trainingViewSource, /saveBlock\(/);
assert.match(trainingViewSource, /deleteBlock\(/);
assert.match(trainingViewSource, /removeParticipant\(/);

const externalCall = calls.find(call => call.name === "iq_v4_create_external_development");
assert.equal(externalCall.args.p_team_season_id, "ts-1");
assert.equal(externalCall.args.p_player_id, "player-1");
assert.equal(externalCall.args.p_source_type, "EXTERNAL_COACH");
assert.deepEqual(externalCall.args.p_provenance, { source: "test" });

await assert.rejects(
  () => service.createSession({
    sessionDate: "2026-09-03",
    title: "Falta scope"
  }),
  /teamSeasonId es obligatorio/
);

console.log("PLAYER360_PHASE4B_SERVICE_OK");
