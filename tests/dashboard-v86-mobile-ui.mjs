/**
 * @fileoverview Deterministic, read-only iPhone Dashboard locale regression.
 * Tests the actual rendered view and four language switches in a single session.
 */
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL=process.env.DASHBOARD_I18N_BASE_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await installBrowserNetworkStubs(page);
  await page.goto(BASE_URL,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>Boolean(window.iqApp),null,{timeout:20000});
  const results=await page.evaluate(async()=>{
    const {DataStore}=await import("/services/DataStore.js");
    const {TranslationStore}=await import("/services/TranslationStore.js");
    const {SeasonDashboardView}=await import("/views/SeasonDashboardView.js");
    const {StatsEngine}=await import("/engine/StatsEngine.js");
    const teamId="11111111-1111-4111-8111-111111111111";
    DataStore.getActiveTeamId=()=>teamId;
    DataStore.getActiveSeasonContext=()=>({team_id:teamId,team_season_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",name:"2026/2027"});
    DataStore.getActiveSeasonDisplayName=()=>"2026/2027";
    DataStore.getTeamById=()=>({id:teamId,name:"Club de Prova",category:"Cadete Masculino",competition:"B1"});
    const game={id:"22222222-2222-4222-8222-222222222222",date:"2026-10-18",opponent:"Rival de Prova",team_score:68,opponent_score:55,status:"COMPLETED",venue:"home"};
    DataStore.getGamesForActiveSeason=()=>[game];
    DataStore.getSeasonParticipantPlayers=()=>[];
    DataStore.getPlayerGameStats=()=>[];
    DataStore.getGamePeriodScores=()=>[];
    StatsEngine.calculateTeamDashboardKPIs=()=>({wins:1,losses:0,ppg:68,oppPpg:55,diffPpg:13,ortg:80,drtg:null,netRtg:null,pace:null,efg:null,tovPct:null});
    const container=document.createElement("div");container.id="dashboard-i18n-fixture";document.body.appendChild(container);
    const view=new SeasonDashboardView(null,{canPreview:()=>false});
    const rows={};
    for(const code of ["es","ca","en","fr"]){
      await TranslationStore.setLanguage(code);
      await view.render(container,teamId);
      rows[code]={
        kpis:[...container.querySelectorAll(".kpi-top-label > span")].map(x=>x.textContent.trim()),
        header:container.querySelector(".dash-meta-line")?.textContent?.trim(),
        table:container.querySelector(".clean-table-title")?.textContent?.trim(),
        action:container.querySelector(".clean-análisis-link")?.textContent?.trim(),
        audit:container.querySelector("#btn-sync-data")?.textContent?.trim(),
        team:container.querySelector(".dash-main-title")?.textContent?.trim(),
        category:container.querySelector(".dash-category-badge")?.textContent?.trim()
      };
    }
    return rows;
  });
  const labels={
    es:["Partidos jugados","Últimos partidos","Auditar estadísticas"],
    ca:["Partits jugats","Últims partits","Auditar estadístiques"],
    en:["Games played","Recent games","Audit statistics"],
    fr:["Matchs joués","Derniers matchs","Auditer les statistiques"]
  };
  for(const [lang,[kpi,table,audit]] of Object.entries(labels)){
    const row=results[lang];
    assert.ok(row?.kpis?.length>0,lang+" dashboard missing");
    assert.equal(row.kpis[0].toLocaleLowerCase(lang),kpi.toLocaleLowerCase(lang),lang+" KPI");
    assert.equal(row.table.toLocaleLowerCase(lang),table.toLocaleLowerCase(lang),lang+" table");
    assert.ok(row.audit.includes(audit),lang+" audit");
    assert.equal(row.team,"Club de Prova","Team names must not be translated");
  }
  assert.ok(!results.ca.kpis.some(k=>["PARTIDOS JUGADOS","VICTORIAS"].includes(k)));
  assert.equal(results.es.category,"Cadete Masculino");
  assert.equal(results.ca.category,"Cadet · masculí");
  assert.equal(results.en.category,"Cadet · boys");
  assert.equal(results.fr.category,"Cadet · garçons");
  assert.ok(results.ca.header.includes("partits"),"Catalan game count");
  assert.ok(results.en.action.includes("Analysis"),"English game action");
  assert.ok(results.fr.header.includes("matchs"),"French game count");
  console.log("PASS V86: iPhone dashboard language switch ES/CA/EN/FR");
} finally { await browser.close(); }
