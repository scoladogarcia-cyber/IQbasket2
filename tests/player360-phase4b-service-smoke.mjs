import assert from "node:assert/strict";
import { TrainingService } from "../services/player360/TrainingService.js";

function buildQuery(table, rows, callLog) {
  const state = {
    table,
    rows: [...rows],
    filters: []
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
    eq(key, value) { state.filters.push({ type: "eq", key, value }); return this; },
    neq(key, value) { state.filters.push({ type: "neq", key, value }); return this; },
    gte() { return this; },
    lte() { return this; },
    in(key, values) { state.filters.push({ type: "in", key, values }); return this; },
    order() { return this; },
    limit() { return this; }
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
    if (name === "iq_core_ux_training_edit_capabilities") {
      return {
        data: {
          ready: true,
          update_training: true,
          update_external_development: true,
          frozen_season_guard: true
        },
        error: null
      };
    }
    if (name === "iq_v4_create_training_session") {
      return { data: "created-session-id", error: null };
    }
    if (name === "iq_v4_update_training_session") {
      return { data: "session-1", error: null };
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
    if (name === "iq_v4_update_external_development") {
      return { data: "external-1", error: null };
    }
    throw new Error(`RPC inesperada: ${name}`);
  }
};

const service = new TrainingService(fakeSupabase);

const capabilities = await service.getCapabilities();
assert.equal(capabilities.training_core, true);
assert.equal(capabilities.update_training, true);
assert.equal(capabilities.update_external_development, true);
assert.equal(capabilities.frozen_season_guard, true);

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

const updatedSessionId = await service.updateSession({
  trainingSessionId: "session-1",
  sessionDate: "2026-09-04",
  title: "Sesión corregida",
  objective: "Objetivo corregido",
  durationMinutes: 60,
  intensity: 6,
  startTime: "18:00",
  endTime: "19:00",
  blocks: [{ title: "Finalizaciones", duration_minutes: 20 }],
  participantIds: ["player-1"]
});
assert.equal(updatedSessionId, "session-1");
const updateCall = calls.find(call => call.name === "iq_v4_update_training_session");
assert.deepEqual(updateCall.args, {
  p_training_session_id: "session-1",
  p_session_date: "2026-09-04",
  p_title: "Sesión corregida",
  p_objective: "Objetivo corregido",
  p_duration_minutes: 60,
  p_intensity: 6,
  p_start_time: "18:00",
  p_end_time: "19:00",
  p_blocks: [{ title: "Finalizaciones", duration_minutes: 20 }],
  p_participant_ids: ["player-1"]
});

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

const externalCall = calls.find(call => call.name === "iq_v4_create_external_development");
assert.equal(externalCall.args.p_team_season_id, "ts-1");
assert.equal(externalCall.args.p_player_id, "player-1");
assert.equal(externalCall.args.p_source_type, "EXTERNAL_COACH");
assert.deepEqual(externalCall.args.p_provenance, { source: "test" });

const updatedExternalId = await service.updateExternalDevelopment({
  externalDevelopmentId: "external-1",
  playerId: "player-1",
  activityDate: "2026-09-04",
  title: "Tecnificación corregida",
  providerName: "Academia corregida",
  durationMinutes: 55,
  rpe: 6,
  provenance: { source: "edit-test" }
});
assert.equal(updatedExternalId, "external-1");
const updateExternalCall = calls.find(call => call.name === "iq_v4_update_external_development");
assert.equal(updateExternalCall.args.p_external_development_id, "external-1");
assert.equal(updateExternalCall.args.p_title, "Tecnificación corregida");
assert.equal(updateExternalCall.args.p_provider_name, "Academia corregida");
assert.deepEqual(updateExternalCall.args.p_provenance, { source: "edit-test" });

await assert.rejects(
  () => service.createSession({
    sessionDate: "2026-09-03",
    title: "Falta scope"
  }),
  /teamSeasonId es obligatorio/
);

console.log("PLAYER360_PHASE4B_SERVICE_OK");
