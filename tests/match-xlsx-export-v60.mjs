import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  buildActaRows,
  buildBoxScoreRows,
  buildEventRows,
  buildMatchWorkbookModel,
  buildMatchWorkbookXlsx
} from "../services/reports/MatchWorkbookExportV60.js";

function unzipStored(bytes){
  const out=new Map();
  const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const decoder=new TextDecoder();
  let offset=0;
  while(offset+4<=bytes.length){
    const sig=dv.getUint32(offset,true);
    if(sig!==0x04034b50)break;
    const nameLen=dv.getUint16(offset+26,true);
    const extraLen=dv.getUint16(offset+28,true);
    const size=dv.getUint32(offset+18,true);
    const name=decoder.decode(bytes.slice(offset+30,offset+30+nameLen));
    const dataStart=offset+30+nameLen+extraLen;
    out.set(name,bytes.slice(dataStart,dataStart+size));
    offset=dataStart+size;
  }
  return out;
}

const game={
  id:"33333333-3333-4333-8333-333333333333",
  team_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  team_season_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  date:"2026-10-03",opponent:"AESE B",team_score:5,opponent_score:4,
  periods_count:4,play_state:"FINISHED"
};
const players=[
  {id:"11111111-1111-4111-8111-111111111111",first_name:"Víctor",last_name:"Colado",jersey:10},
  {id:"22222222-2222-4222-8222-222222222222",first_name:"Víctor",last_name:"Gabriel",jersey:5}
];
const stats=[
  {
    game_id:game.id,player_id:players[0].id,starter:true,minutes:25,points:3,
    fg2_made:1,fg2_attempted:2,fg3_made:0,fg3_attempted:1,ft_made:1,ft_attempted:2,
    off_reb:1,def_reb:2,assists:2,steals:1,blocks_made:1,blocks_received:0,
    turnovers:1,fouls_committed:2,fouls_drawn:3,plus_minus:4,evaluation:8,
    game_score:5.4,efg_pct:33.3,true_shooting_pct:41.2,offensive_rating:101.4,
    defensive_rating:96.2,usage_pct:18.7
  },
  {
    game_id:game.id,player_id:players[1].id,starter:false,minutes:15,points:2,
    fg2_made:1,fg2_attempted:1,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,
    off_reb:0,def_reb:1,assists:0,steals:0,blocks_made:0,blocks_received:0,
    turnovers:0,fouls_committed:1,fouls_drawn:0,plus_minus:1,evaluation:3
  }
];
const periods=[
  {period_number:1,team_score:2,opponent_score:2},
  {period_number:2,team_score:3,opponent_score:2}
];
const events=[
  {id:"e3",game_id:game.id,event_sequence:3,period:2,game_clock:"08:20",player_id:players[1].id,action_type:"fg2_made",points:2,made:true,coord_x:42,coord_y:55},
  {id:"e1",game_id:game.id,event_sequence:1,period:1,game_clock:"09:15",player_id:players[0].id,action_type:"fg2_attempted",points:2,made:true,coord_x:50,coord_y:80,shot_zone:"RIM"},
  {id:"e2",game_id:game.id,event_sequence:2,period:1,game_clock:"01:10",player_id:null,action_type:"opp_pts",points:2,made:true}
];
const report={
  game,players,stats,periods,events,eventsAvailable:true,
  teamStats:{opp_fg2_made:2,opp_fg2_attempted:3,opp_fg3_made:0,opp_fg3_attempted:1,opp_ft_made:0,opp_ft_attempted:0,opp_off_reb:1,opp_def_reb:2,opp_turnovers:1,efg:40,estimated_possessions:58.2,pace:61.3,ortg:92.1,drtg:88.2,net_rating:3.9}
};

const acta=buildActaRows([report]);
assert.equal(acta.length,2);
assert.equal(acta[1][acta[0].indexOf("coherencia_puntos")],"OK");
assert.equal(acta[1][acta[0].indexOf("parciales")],"Q1 2-2 | Q2 3-2");
assert.equal(acta[1][acta[0].indexOf("rival_T2_C")],2);

const box=buildBoxScoreRows([report]);
assert.equal(box.length,3);
assert.equal(box[1][box[0].indexOf("jugador")],"Víctor Colado");
assert.equal(box[1][box[0].indexOf("REB_T")],3);
assert.equal(box[1][box[0].indexOf("T2_%")],50);
assert.equal(box[1][box[0].indexOf("TS_%")],41.2);

const plays=buildEventRows([report]);
assert.equal(plays.length,4);
assert.deepEqual(plays.slice(1).map(row=>row[plays[0].indexOf("event_id")]),["e1","e2","e3"]);
assert.equal(plays[1][plays[0].indexOf("accion_codigo")],"fg2_made");
assert.equal(plays[1][plays[0].indexOf("accion")],"T2 anotado");
assert.equal(plays[2][plays[0].indexOf("lado")],"Rival");

const model=buildMatchWorkbookModel([report]);
assert.deepEqual(model.map(sheet=>sheet.name),["Acta","BoxScore","Jugadas"]);

const bytes=buildMatchWorkbookXlsx([report]);
assert.ok(bytes instanceof Uint8Array);
assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
assert.ok(bytes.length>3000);
const files=unzipStored(bytes);
for(const name of ["[Content_Types].xml","_rels/.rels","xl/workbook.xml","xl/styles.xml","xl/worksheets/sheet1.xml","xl/worksheets/sheet2.xml","xl/worksheets/sheet3.xml"]){
  assert.ok(files.has(name),"missing "+name);
}
const decoder=new TextDecoder();
const workbook=decoder.decode(files.get("xl/workbook.xml"));
assert.match(workbook,/name="Acta"/);assert.match(workbook,/name="BoxScore"/);assert.match(workbook,/name="Jugadas"/);
const sheet3=decoder.decode(files.get("xl/worksheets/sheet3.xml"));
assert.match(sheet3,/Víctor Colado/);assert.match(sheet3,/T2 anotado/);assert.match(sheet3,/AESE B/);

const eventsOnly=buildMatchWorkbookXlsx([report],{eventsOnly:true});
const eventsFiles=unzipStored(eventsOnly);
assert.ok(eventsFiles.has("xl/worksheets/sheet1.xml"));
assert.equal(eventsFiles.has("xl/worksheets/sheet2.xml"),false);

assert.throws(()=>buildMatchWorkbookModel([{...report,eventsAvailable:false}]),/incompleto/);

const reportsSource=await readFile(new URL("../views/ReportsViewV53.js",import.meta.url),"utf8");
assert.match(reportsSource,/Excel completo · Acta \+ BoxScore \+ Jugadas/);
assert.match(reportsSource,/Jugadas Excel \.xlsx/);
assert.match(reportsSource,/application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
assert.doesNotMatch(reportsSource,/Exportar BoxScore Excel \.xls/);

const readSource=await readFile(new URL("../services/games/GameFinalReportReadService.js",import.meta.url),"utf8");
assert.match(readSource,/event_sequence/);
assert.match(readSource,/game_clock/);
assert.match(readSource,/teamStats: aggregate \|\| null/);

console.log("V60 real XLSX Acta + BoxScore + all plays contract OK");
