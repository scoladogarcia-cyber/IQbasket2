import assert from "node:assert/strict";
import {readFile,rm} from "node:fs/promises";
import {chromium,webkit} from "@playwright/test";

const baseUrl=process.env.CORE_USER_FLOWS_BASE_URL||"http://127.0.0.1:4173/";
const browserName=process.env.QA_BROWSER||"chromium";
const browserType=browserName==="webkit"?webkit:chromium;
const browser=await browserType.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
await page.goto(baseUrl,{waitUntil:"domcontentloaded"});

const fixture={
  game:{id:"33333333-3333-4333-8333-333333333333",team_season_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",date:"2026-10-03",opponent:"AESE B",team_score:2,opponent_score:0,periods_count:4,play_state:"FINISHED"},
  players:[{id:"11111111-1111-4111-8111-111111111111",first_name:"Víctor",last_name:"Colado",jersey:10}],
  stats:[{player_id:"11111111-1111-4111-8111-111111111111",minutes:20,points:2,fg2_made:1,fg2_attempted:1,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,off_reb:0,def_reb:1,assists:1,steals:0,turnovers:0,fouls_committed:0,fouls_drawn:0}],
  periods:[{period_number:1,team_score:2,opponent_score:0}],
  events:[{id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",event_sequence:1,period:1,game_clock:"09:45",player_id:"11111111-1111-4111-8111-111111111111",action_type:"fg2_made",points:2,made:true}],
  eventsAvailable:true,
  teamStats:null
};

const downloadPromise=page.waitForEvent("download");
await page.evaluate(async fixture=>{
  const {buildMatchWorkbookXlsx}=await import("/services/reports/MatchWorkbookExportV60.js");
  const bytes=buildMatchWorkbookXlsx([fixture]);
  const blob=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  if(blob.size<1000)throw new Error("XLSX demasiado pequeño");
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="IQBasket_Prueba.xlsx";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
},fixture);
const download=await downloadPromise;
assert.equal(download.suggestedFilename(),"IQBasket_Prueba.xlsx");
const path=await download.path();
assert.ok(path);
const bytes=await readFile(path);
assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
assert.ok(bytes.length>1000);
await rm(path,{force:true}).catch(()=>{});

await browser.close();
console.log(`V60 XLSX browser download OK (${browserName})`);
