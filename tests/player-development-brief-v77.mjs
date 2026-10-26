import assert from "node:assert/strict";
import {renderPlayerDevelopmentBriefV77,filterPlayerReportGamesV77} from "../services/reports/PlayerDevelopmentBriefV77.js";
const players=[{id:"p1",first_name:"Ana",last_name:"<Uno>"},{id:"p2",first_name:"Ona",last_name:"Dos"}];
const r=(gid,date,points,minutes,withStat=true)=>({
 game:{id:gid,date,opponent:"<Bad>"},players,
 stats:withStat?[
  {game_id:gid,player_id:"p1",points,minutes,fg2_made:0,fg2_attempted:0,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,assists:0},
  {game_id:gid,player_id:"p2",points:30,minutes:40,fg2_made:8,fg2_attempted:10}
 ]:[{game_id:gid,player_id:"p2",points:30,minutes:40}]
});
const rows=[r("g1","2026-10-01",0,0),r("g2","2026-10-09",null,null),r("g3","2026-10-20",4,15)];
assert.equal(filterPlayerReportGamesV77(rows,{fromDate:"2026-10-09"}).length,2);
assert.throws(()=>filterPlayerReportGamesV77(rows,{fromDate:"2026-11-01",toDate:"2026-10-01"}),/Rango/);
assert.throws(()=>filterPlayerReportGamesV77([rows[0],rows[0]]),/duplicados/);
const html=renderPlayerDevelopmentBriefV77({reports:rows,player:players[0],teamName:"Club",seasonName:"2026-27"});
assert.match(html,/Ana &lt;Uno&gt;/);
assert.doesNotMatch(html,/Ona Dos/);
assert.match(html,/0\*/);
assert.match(html,/N\/D/);
assert.match(html,/0 puntos|0/);
assert.doesNotMatch(html,/<Bad>/);
assert.doesNotMatch(html,/N\/D %/);
assert.throws(()=>renderPlayerDevelopmentBriefV77({reports:rows,player:players[0],fromDate:"2026-12-01"}),/Ningún/);
assert.throws(()=>renderPlayerDevelopmentBriefV77({reports:[r("g4","2026-10-22",0,0,false)],player:players[0]}),/No hay actas/);
assert.throws(()=>renderPlayerDevelopmentBriefV77({reports:[{...rows[0],stats:[rows[0].stats[0],rows[0].stats[0]]}],player:players[0]}),/duplicada/);
const leak=renderPlayerDevelopmentBriefV77({reports:rows,player:players[1]});
assert.doesNotMatch(leak,/Ana &lt;Uno&gt;/);
console.log("PASS V77 player reporting: scoped identity, dates, zero/N-D, PDF HTML and no other-player exposure");
