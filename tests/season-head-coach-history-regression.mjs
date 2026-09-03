import assert from "node:assert/strict";

import { resolveHeadCoachName } from "../domain/staff/resolveHeadCoach.js";
import {
  StaffAssignmentService,
  StaffRole
} from "../services/StaffAssignmentService.js";

const TEAM_ID = "team-manyanet";
const TS_2025 = "ts-2025";
const TS_2026 = "ts-2026";

// -----------------------------------------------------------------------------
// Regression 1: canonical staff must win over stale legacy coach_name.
// Exact case reported from mobile:
// 2025/2026 = Teo, 2026/2027 = Miriam.
// -----------------------------------------------------------------------------
const team = {
  id: TEAM_ID,
  name: "JMJ Manyanet Sant Andreu",
  coach_name: "Teo Raichman"
};

const seasons = [
  {
    id: TS_2026,
    team_id: TEAM_ID,
    team_season_id: TS_2026,
    name: "2026/2027",
    source: "v3",
    coach_name: "Teo Raichman"
  },
  {
    id: TS_2025,
    team_id: TEAM_ID,
    team_season_id: TS_2025,
    name: "2025/2026",
    source: "v3",
    coach_name: "Teo Raichman"
  }
];

const canonicalAssignments = [
  {
    id: "staff-2025",
    team_season_id: TS_2025,
    team_id: TEAM_ID,
    season_name: "2025/2026",
    staff_role: "HEAD_COACH",
    external_name: "Teo Raichman",
    status: "ACTIVE"
  },
  {
    id: "staff-2026",
    team_season_id: TS_2026,
    team_id: TEAM_ID,
    season_name: "2026/2027",
    staff_role: "HEAD_COACH",
    external_name: "Miriam",
    status: "ACTIVE"
  }
];

assert.equal(
  resolveHeadCoachName({
    teamId: TEAM_ID,
    seasonName: "2025/2026",
    staffAssignments: canonicalAssignments,
    seasons,
    team
  }),
  "Teo Raichman"
);

assert.equal(
  resolveHeadCoachName({
    teamId: TEAM_ID,
    seasonName: "2026/2027",
    staffAssignments: canonicalAssignments,
    seasons,
    team
  }),
  "Miriam",
  "El editor debe mostrar Miriam y no resucitar seasons.coach_name"
);

assert.equal(
  resolveHeadCoachName({
    teamId: TEAM_ID,
    seasonName: "2026/2027",
    staffAssignments: [{
      id: "staff-2026-old",
      team_id: TEAM_ID,
      season_name: "2026/2027",
      staff_role: "HEAD_COACH",
      external_name: "Miriam",
      status: "INACTIVE"
    }],
    seasons,
    team
  }),
  "Por definir",
  "Una baja canónica no puede resucitar el entrenador legacy"
);

assert.equal(
  resolveHeadCoachName({
    teamId: TEAM_ID,
    seasonName: "2025/2026",
    staffAssignments: [],
    seasons,
    team
  }),
  "Teo Raichman",
  "Legacy solo queda como fallback para scopes no migrados"
);

// -----------------------------------------------------------------------------
// Regression 2: save HEAD_COACH must use v3 team-season RPC, never seasons table.
// -----------------------------------------------------------------------------
const calls = [];

function makeQuery(table) {
  const filters = [];
  const rowsByTable = {
    team_season_staff_assignments: [{
      id: "staff-2026",
      team_season_id: TS_2026,
      staff_role: "HEAD_COACH",
      user_id: null,
      external_name: "Miriam",
      status: "ACTIVE"
    }],
    season_catalog: [],
    team_seasons: []
  };

  const api = {
    select(columns) {
      calls.push({ type: "select", table, columns });
      return this;
    },
    eq(key, value) {
      filters.push([key, value]);
      calls.push({ type: "eq", table, key, value });
      return this;
    },
    in() { return this; },
    or() { return this; },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null });
    },
    update() { return this; },
    single() {
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve, reject) {
      let rows = [...(rowsByTable[table] || [])];
      for (const [key, value] of filters) {
        rows = rows.filter(row => String(row[key]) === String(value));
      }
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    }
  };

  return api;
}

const fakeSupabase = {
  from(table) {
    calls.push({ type: "from", table });
    if (table === "seasons") {
      throw new Error("REGRESSION: HEAD_COACH no debe consultar seasons");
    }
    return makeQuery(table);
  },
  async rpc(name, args) {
    calls.push({ type: "rpc", name, args });
    if (name === "iq_v3_assign_team_season_staff") {
      return {
        data: {
          id: "staff-2026-new",
          team_season_id: args.p_team_season_id,
          staff_role: args.p_staff_role,
          external_name: args.p_external_name,
          status: "ACTIVE"
        },
        error: null
      };
    }
    if (name === "iq_v3_remove_team_season_staff") {
      return { data: { id: args.p_assignment_id, status: "INACTIVE" }, error: null };
    }
    throw new Error("RPC inesperada: " + name);
  }
};

const contextStore = {
  getSeasons(teamId) {
    assert.equal(teamId, TEAM_ID);
    return [
      {
        team_season_id: TS_2025,
        team_id: TEAM_ID,
        name: "2025/2026",
        source: "v3"
      },
      {
        team_season_id: TS_2026,
        team_id: TEAM_ID,
        name: "2026/2027",
        source: "v3"
      }
    ];
  }
};

const service = new StaffAssignmentService(fakeSupabase, contextStore);

const saved = await service.upsertAssignment({
  teamId: TEAM_ID,
  seasonName: "2026/2027",
  role: StaffRole.HEAD_COACH,
  staffName: "Miriam Nueva"
});

assert.equal(saved.team_season_id, TS_2026);
assert.equal(saved.season_name, "2026/2027");
assert.equal(saved.staff_name, "Miriam Nueva");

const assignCall = calls.find(
  call => call.type === "rpc" && call.name === "iq_v3_assign_team_season_staff"
);
assert.ok(assignCall, "Debe usar iq_v3_assign_team_season_staff");
assert.equal(assignCall.args.p_team_season_id, TS_2026);
assert.equal(assignCall.args.p_staff_role, "HEAD_COACH");
assert.equal(assignCall.args.p_user_id, null);
assert.equal(assignCall.args.p_external_name, "Miriam Nueva");
assert.equal(
  calls.some(call => call.type === "from" && call.table === "seasons"),
  false
);

// Clearing the field retires only the active assignment in 2026/2027.
calls.length = 0;
const removed = await service.upsertAssignment({
  teamId: TEAM_ID,
  seasonName: "2026/2027",
  role: StaffRole.HEAD_COACH,
  staffName: ""
});

assert.equal(removed.removed, true);
const removeCall = calls.find(
  call => call.type === "rpc" && call.name === "iq_v3_remove_team_season_staff"
);
assert.ok(removeCall, "Vaciar entrenador debe usar la RPC de retirada");
assert.equal(removeCall.args.p_assignment_id, "staff-2026");
assert.equal(
  calls.some(call =>
    call.type === "rpc"
    && call.name === "iq_v3_assign_team_season_staff"
    && call.args?.p_team_season_id === TS_2025
  ),
  false,
  "Editar 2026/2027 no puede modificar 2025/2026"
);

console.log("SEASON_HEAD_COACH_HISTORY_REGRESSION_OK");
