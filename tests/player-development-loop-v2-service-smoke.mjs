import assert from "node:assert/strict";
import { DevelopmentCycleService } from "../services/player360/DevelopmentCycleService.js";

const calls = [];
const fakeSupabase = {
  async rpc(name, args = {}) {
    calls.push({ name, args });
    if (name === "iq_v16_development_cycle_capabilities") return { data: { ready: true, can_view: true, can_create: true }, error: null };
    if (name === "iq_v16_development_cycle_snapshot") return { data: { current_cycle: null, available_evidence: [] }, error: null };
    if (name === "iq_v16_start_development_cycle") return { data: "cycle-1", error: null };
    if (name === "iq_v16_set_development_action_state") return { data: "action-1", error: null };
    if (name === "iq_v16_link_development_evidence") return { data: "evidence-1", error: null };
    if (name === "iq_v16_review_development_cycle") return { data: "cycle-1", error: null };
    return { data: null, error: { message: `RPC inesperada: ${name}` } };
  }
};

const service = new DevelopmentCycleService(fakeSupabase);
const scope = { teamSeasonId: "ts-1", playerId: "player-1" };
assert.equal((await service.getCapabilities(scope)).can_view, true);
assert.equal((await service.snapshot(scope)).current_cycle, null);

const cycleId = await service.startCycle({
  ...scope,
  objectiveProfileId: "objective-1",
  actions: [
    { actionType: "training", title: "Atacar closeout", successCriterion: "Registrar una situación real." },
    { actionType: "game", title: "Leer ventaja", successCriterion: "Vincular una evidencia del partido." },
    { title: "" }
  ]
});
assert.equal(cycleId, "cycle-1");
const start = calls.find(call => call.name === "iq_v16_start_development_cycle");
assert.equal(start.args.p_actions.length, 2);
assert.equal(start.args.p_actions[0].action_type, "TRAINING");

assert.equal(await service.setActionState({ actionId: "action-1", targetState: "COMPLETED" }), "action-1");
assert.equal(await service.linkEvidence({ actionId: "action-1", evidenceType: "GAME", evidenceId: "game-1" }), "evidence-1");
assert.equal(await service.reviewCycle({ cycleId: "cycle-1", outcome: "CONTINUE" }), "cycle-1");
assert.equal(calls.some(call => call.name.includes("v16")), true);

await assert.rejects(
  service.startCycle({ ...scope, objectiveProfileId: "objective-1", actions: [] }),
  /al menos una acción semanal/i
);

console.log("PLAYER_DEVELOPMENT_LOOP_V2_SERVICE_OK");
