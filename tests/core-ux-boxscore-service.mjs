import assert from "node:assert/strict";
import { BoxScoreCorrectionService } from "../services/games/BoxScoreCorrectionService.js";

const calls=[];
const client={
  async rpc(name,args={}) {
    calls.push({name,args:structuredClone(args)});
    if(name==="iq_core_ux_can_edit_boxscore") return {data:true,error:null};
    if(name==="iq_core_ux_save_boxscore_correction") return {data:true,error:null};
    return {data:null,error:{message:"Unexpected RPC "+name}};
  }
};

const service=new BoxScoreCorrectionService(client);
assert.equal(await service.canEdit("game-1"),true);

const game={
  id:"game-1",
  period_minutes:10,
  overtime_minutes:5,
  starter_ids:[]
};

const events=[
  {action_type:"fg2_made",player_id:"p1",period:1,game_clock:"09:30"},
  {action_type:"fg2_attempted",player_id:"p1",period:1,game_clock:"09:00"},
  {action_type:"assists",player_id:"p1",period:1,game_clock:"08:40"},
  {action_type:"turnovers",player_id:"p1",period:1,game_clock:"08:00"}
];

const equalStats=[{
  player_id:"p1",
  fg2_made:1,
  fg2_attempted:2,
  fg3_made:0,
  fg3_attempted:0,
  ft_made:0,
  ft_attempted:0,
  off_reb:0,
  def_reb:0,
  assists:1,
  steals:0,
  blocks_made:0,
  blocks_received:0,
  turnovers:1,
  fouls_committed:0,
  fouls_drawn:0
}];

let comparison=service.compareWithEvents({game,stats:equalStats,events});
assert.equal(comparison.hasEvents,true);
assert.equal(comparison.discrepancies.length,0);

comparison=service.compareWithEvents({
  game,
  stats:[{...equalStats[0],assists:2}],
  events
});
assert.equal(comparison.discrepancies.length,1);
assert.equal(comparison.discrepancies[0].metric,"assists");
assert.equal(comparison.discrepancies[0].boxscore_value,2);
assert.equal(comparison.discrepancies[0].play_by_play_value,1);

const noEvents=service.compareWithEvents({game,stats:equalStats,events:[]});
assert.equal(noEvents.hasEvents,false);
assert.equal(noEvents.discrepancies.length,0);

assert.equal(await service.saveCorrection({
  gameId:"game-1",
  starterIds:["p1"],
  stats:equalStats,
  reason:"Acta oficial",
  sourceMode:"MANUAL_OVERRIDE",
  discrepancies:comparison.discrepancies
}),true);

const saveCall=calls.find(call=>call.name==="iq_core_ux_save_boxscore_correction");
assert.equal(saveCall.args.p_game_id,"game-1");
assert.equal(saveCall.args.p_source_mode,"MANUAL_OVERRIDE");
assert.equal(saveCall.args.p_reason,"Acta oficial");
assert.equal(saveCall.args.p_discrepancies.length,1);

console.log("CORE_UX_BOXSCORE_SERVICE_OK");
