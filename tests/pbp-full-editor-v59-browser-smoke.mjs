import assert from "node:assert/strict";
import { chromium, webkit } from "@playwright/test";

const baseUrl=process.env.CORE_USER_FLOWS_BASE_URL||"http://127.0.0.1:4173/";
const browserName=process.env.QA_BROWSER||"chromium";
const browserType=browserName==="webkit"?webkit:chromium;
const browser=await browserType.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});

await page.goto(baseUrl,{waitUntil:"domcontentloaded"});

const result=await page.evaluate(async()=>{
  const {ScopedGameBoxScoreLiveV59View}=await import("/views/games/ScopedGameBoxScoreLiveV59View.js");

  document.body.innerHTML='<main id="dashboard-content-area"><div data-v38-live-game-center></div></main>';

  const p1="11111111-1111-4111-8111-111111111111";
  const p2="22222222-2222-4222-8222-222222222222";
  const gameId="33333333-3333-4333-8333-333333333333";
  const events=[
    {id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",event_sequence:3,period:1,game_clock:"06:00",action_type:"ft_attempted",points:0,made:false,player_id:p1},
    {id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",event_sequence:1,period:1,game_clock:"09:10",action_type:"fg2_made",points:2,made:true,player_id:p1},
    {id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",event_sequence:4,period:2,game_clock:"09:50",action_type:"fg3_attempted",points:0,made:false,player_id:p2},
    {id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",event_sequence:2,period:1,game_clock:"08:20",action_type:"assists",points:0,made:false,player_id:p2}
  ];
  const snapshot={
    game:{id:gameId,periods_count:4,edit_state:"OPEN",play_state:"FINISHED"},
    players:[
      {id:p1,jersey:10,first_name:"Víctor",last_name:"Colado"},
      {id:p2,jersey:5,first_name:"Víctor",last_name:"Gabriel"}
    ],
    events
  };

  let editArgs=null;
  let rerenders=0;
  const view=new ScopedGameBoxScoreLiveV59View(null,null);
  view.captureService={
    getSnapshot:async()=>snapshot,
    editEvent:async args=>{editArgs=args;return snapshot;}
  };
  view._canEdit=()=>true;
  view.render=async()=>{rerenders+=1;};

  await view._mountEventAudit("dashboard-content-area",gameId);

  const rows=[...document.querySelectorAll(".v59-event-row")];
  const order=rows.map(row=>row.dataset.eventId);
  const text=document.body.textContent;
  rows[2]?.querySelector("[data-v59-edit-event]")?.click();
  await new Promise(resolve=>setTimeout(resolve,0));

  const modal=document.querySelector("#v59-event-editor");
  const playerSelect=modal?.querySelector("[data-v59-player]");
  const actionSelect=modal?.querySelector("[data-v59-action]");
  if(playerSelect)playerSelect.value=p2;
  if(actionSelect)actionSelect.value="ft_made";
  modal?.querySelector("[data-v59-editor-form]")?.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,0));

  return {
    rowCount:rows.length,
    order,
    hasQ1:text.includes("Q1"),
    hasQ2:text.includes("Q2"),
    hasEditButtons:rows.every(row=>Boolean(row.querySelector("[data-v59-edit-event]"))),
    modalVisible:Boolean(modal),
    editArgs,
    rerenders
  };
});

assert.equal(result.rowCount,4);
assert.deepEqual(result.order,[
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3"
]);
assert.equal(result.hasQ1,true);
assert.equal(result.hasQ2,true);
assert.equal(result.hasEditButtons,true);
assert.equal(result.modalVisible,true);
assert.equal(result.editArgs?.newPlayerId,"22222222-2222-4222-8222-222222222222");
assert.equal(result.editArgs?.newActionType,"ft_made");
assert.equal(result.rerenders,1);

await browser.close();
console.log(`V59 ordered PBP editor browser smoke OK (${browserName})`);
