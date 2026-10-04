import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { LiveOfflineStore } from "../services/games/LiveOfflineStore.js";
import { buildTrainingIntelligence } from "../domain/player360/TrainingIntelligenceAnalytics.js";
import { buildTeamBenchmark, buildSelfBenchmark, networkReliability } from "../domain/stats/BenchmarkEngine.js";
import { Player360ObservationAssembler } from "../services/player360/Player360ObservationAssembler.js";

class MemoryStorage {
  constructor(){this.map=new Map();}
  get length(){return this.map.size;}
  key(index){return [...this.map.keys()][index] ?? null;}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
}

// Offline outbox must survive without IndexedDB through the localStorage fallback.
{
  const storage=new MemoryStorage();
  const first=new LiveOfflineStore({indexedDB:null,localStorage:storage});
  const op1=await first.enqueue("g1",{events:[{id:"e1"}]},{baseRevision:4,operationId:"11111111-1111-4111-8111-111111111111"});
  await first.enqueue("g1",{events:[{id:"e1"},{id:"e2"}]},{baseRevision:4,operationId:"22222222-2222-4222-8222-222222222222"});
  assert.equal(op1.baseRevision,4);
  assert.equal((await first.list("g1")).length,2);

  const reopened=new LiveOfflineStore({indexedDB:null,localStorage:storage});
  const recovered=await reopened.list("g1");
  assert.equal(recovered.length,2);
  assert.equal(recovered.at(-1).payload.events.length,2);
  assert.equal((await reopened.loadDraft("g1")).payload.events.length,2);

  await reopened.remove(recovered[0].operationId);
  assert.equal((await reopened.list("g1")).length,1);
}

// Training intelligence: deterministic totals, attendance, RPE/load and focus coverage.
{
  const sessions=[
    {
      id:"s1",session_date:"2026-09-07",status:"COMPLETED",duration_minutes:60,
      metadata:{training_focus_codes:["TECHNICAL","SHOOT_FINISH"]},
      participants:[
        {player_id:"p1",attendance_status:"PRESENT",participated_minutes:60,rpe:5,internal_load:300},
        {player_id:"p2",attendance_status:"ABSENT",participated_minutes:0,rpe:null,internal_load:null}
      ]
    },
    {
      id:"s2",session_date:"2026-09-14",status:"COMPLETED",duration_minutes:80,
      metadata:{},
      participants:[
        {player_id:"p1",attendance_status:"PARTIAL",participated_minutes:40,rpe:6,internal_load:240},
        {player_id:"p2",attendance_status:"PRESENT",participated_minutes:80,rpe:4,internal_load:320}
      ]
    }
  ];
  const analytics=buildTrainingIntelligence(sessions);
  assert.equal(analytics.totals.sessions,2);
  assert.equal(analytics.totals.sessionMinutes,140);
  assert.equal(analytics.totals.focusClassified,1);
  assert.equal(analytics.totals.focusCoveragePct,50);
  assert.equal(analytics.totals.attendancePct,75);
  assert.equal(analytics.unclassifiedSessionIds[0],"s2");
  const p1=analytics.players.find(p=>p.playerId==="p1");
  assert.equal(p1.participatedMinutes,100);
  assert.equal(p1.totalLoad,540);
}

// Team benchmarking: no percentile below five eligible players; P50 for median target.
{
  const game=(player,points,tov=2)=>[
    {player_id:player,game_id:"g1",minutes:40,points,turnovers:tov,fg2_made:5,fg2_attempted:10,fg3_made:1,fg3_attempted:3,ft_made:0,ft_attempted:0},
    {player_id:player,game_id:"g2",minutes:40,points,turnovers:tov,fg2_made:5,fg2_attempted:10,fg3_made:1,fg3_attempted:3,ft_made:0,ft_attempted:0},
    {player_id:player,game_id:"g3",minutes:40,points,turnovers:tov,fg2_made:5,fg2_attempted:10,fg3_made:1,fg3_attempted:3,ft_made:0,ft_attempted:0}
  ];
  const four=new Map([["p1",game("p1",10)],["p2",game("p2",20)],["p3",game("p3",30)],["p4",game("p4",40)]]);
  assert.equal(buildTeamBenchmark({targetPlayerId:"p3",statsByPlayer:four}).metrics.find(m=>m.code==="PTS_PER40").percentile,null);

  const five=new Map([...four,["p5",game("p5",50)]]);
  const points=buildTeamBenchmark({targetPlayerId:"p3",statsByPlayer:five}).metrics.find(m=>m.code==="PTS_PER40");
  assert.equal(points.percentile,50);
  assert.equal(points.sampleSize,5);

  const self=buildSelfBenchmark({earlyStats:game("p3",20),recentStats:game("p3",30)});
  assert.equal(self.find(m=>m.code==="PTS_PER40").change,10);
  assert.equal(networkReliability(19),"HIDDEN");
  assert.equal(networkReliability(20),"PROVISIONAL");
  assert.equal(networkReliability(100),"ROBUST");
}


// V55 focus exposure must become longitudinal evidence with 0/1/2/4-week outcome lags.
{
  const playerId="11111111-1111-4111-8111-111111111111";
  const teamSeasonId="22222222-2222-4222-8222-222222222222";
  const gameId="33333333-3333-4333-8333-333333333333";
  const assembled=Player360ObservationAssembler.assemble({
    playerId,teamSeasonId,
    eligibleGames:[{id:gameId,date:"2026-09-14"}],
    playerGameStats:[{
      player_id:playerId,game_id:gameId,minutes:30,points:12,evaluation:10,
      assists:4,turnovers:2,efg_pct:52.5,true_shooting_pct:55
    }],
    trainingSessions:[{
      id:"44444444-4444-4444-8444-444444444444",session_date:"2026-09-07",
      metadata:{training_focus_codes:["SHOOT_FINISH"]},
      participants:[{player_id:playerId,participated_minutes:60,rpe:5,internal_load:300}]
    }],
    externalSessions:[],evaluations:[],evaluationMetrics:[]
  });
  assert.ok(assembled.metricDefinitions.some(x=>x.module==="training"&&x.metric_code==="FOCUS_SHOOT_FINISH_MINUTES"));
  assert.ok(assembled.observations.some(x=>x.module==="training"&&x.metric_code==="FOCUS_SHOOT_FINISH_MINUTES"&&x.value===60));
  const focusToEfg=assembled.associationDefinitions.filter(x=>
    x.left==="training.FOCUS_SHOOT_FINISH_MINUTES"&&x.right==="competition.EFG_PCT"
  );
  assert.deepEqual(focusToEfg.map(x=>x.lag_buckets),[0,1,2,4]);
}

// Wiring and SQL safety contracts.
{
  const [registry,liveView,trainingView,player360View,migration,permissions,indexHtml,serviceWorker,entitlements,commercialMigration]=await Promise.all([
    readFile(new URL("../services/LazyViewRegistry.js",import.meta.url),"utf8"),
    readFile(new URL("../views/LiveScoreHUDViewV58.js",import.meta.url),"utf8"),
    readFile(new URL("../views/training/TrainingCompleteEditV54View.js",import.meta.url),"utf8"),
    readFile(new URL("../views/Player360View.js",import.meta.url),"utf8"),
    readFile(new URL("../supabase/migrations/20261004211500_live_offline_training_benchmark_v58.sql",import.meta.url),"utf8"),
    readFile(new URL("../security/permissions.js",import.meta.url),"utf8"),
    readFile(new URL("../index.html",import.meta.url),"utf8"),
    readFile(new URL("../public/iqbasket-sw.js",import.meta.url),"utf8"),
    readFile(new URL("../security/entitlements.js",import.meta.url),"utf8"),
    readFile(new URL("../supabase/migrations/20261004214500_v58_commercial_entitlements.sql",import.meta.url),"utf8")
  ]);
  assert.match(registry,/LiveScoreHUDViewV58/);
  assert.match(registry,/TrainingCompleteEditV54View/);
  assert.match(registry,/new Player360View\(supabase, authController\)/);
  assert.match(trainingView,/TrainingIntelligencePanelV58/);
  assert.match(player360View,/Player360BenchmarkPanelV58/);
  assert.match(liveView,/_beforeFinishLiveCapture/);
  assert.match(liveView,/liveConflict/);
  assert.match(migration,/create schema if not exists iq_v58_private/i);
  assert.match(migration,/client_operation_id uuid not null/i);
  assert.match(migration,/GAME_CAPTURE_CONFLICT/i);
  assert.match(migration,/revoke all on schema iq_v58_private from public, anon, authenticated/i);
  assert.match(migration,/sample_size < 20 then 'HIDDEN'/i);
  assert.match(migration,/iq_v4_can_view_longitudinal_analytics\(p_team_season_id\)/i);
  assert.match(migration,/from public, anon/i);
  assert.match(permissions,/VIEW_TRAINING_ANALYTICS/);
  assert.match(permissions,/VIEW_BENCHMARKS/);
  assert.match(indexHtml,/OfflineAppShellBootstrap\.js/);
  assert.match(serviceWorker,/request\.mode==="navigate"/);
  assert.match(serviceWorker,/release\.json/);
  assert.match(serviceWorker,/cache:"no-store"/);
  assert.match(serviceWorker,/CACHE_NAME="iqbasket-shell-v58-1"/);
  assert.match(entitlements,/TRAINING_ANALYTICS/);
  assert.match(entitlements,/BENCHMARKING/);
  assert.match(commercialMigration,/FAMILY_PRO/);
  assert.match(commercialMigration,/INTERNAL_FULL/);
  assert.match(commercialMigration,/on conflict \(plan_id,entitlement_code\)/i);
}

console.log("V58 offline + Training Intelligence + Benchmark contracts: OK");
