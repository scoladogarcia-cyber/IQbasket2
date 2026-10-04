/**
 * @fileoverview Basketball benchmarking engine.
 * @description Produces objective, performance-oriented percentiles. It never
 * converts a small sample into a network claim and never benchmarks subjective
 * Passport scores here.
 */

export const BENCHMARK_METRICS=Object.freeze([
  {code:"PTS_PER40",label:"Puntos / 40",higher:true,minGames:3,minMinutes:30},
  {code:"REB_PER40",label:"Rebotes / 40",higher:true,minGames:3,minMinutes:30},
  {code:"AST_PER40",label:"Asistencias / 40",higher:true,minGames:3,minMinutes:30},
  {code:"STL_PER40",label:"Robos / 40",higher:true,minGames:3,minMinutes:30},
  {code:"TOV_PER40",label:"Control de pérdidas",higher:false,minGames:3,minMinutes:30},
  {code:"EFG_PCT",label:"eFG%",higher:true,minGames:3,minAttempts:15},
  {code:"TS_PCT",label:"TS%",higher:true,minGames:3,minAttempts:15},
  {code:"THREE_PCT",label:"3P%",higher:true,minGames:3,minThreeAttempts:8}
]);

function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function round(v,d=1){if(!Number.isFinite(v))return null;const f=10**d;return Math.round(v*f)/f;}
function percentile(values,target,higher=true){
  const clean=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!clean.length||!Number.isFinite(target))return null;
  const below=clean.filter(v=>v<target).length;
  const equal=clean.filter(v=>v===target).length;
  const raw=((below+(equal-1)/2)/Math.max(1,clean.length-1))*100;
  const clipped=Math.max(0,Math.min(100,raw));
  return round(higher?clipped:100-clipped,0);
}

export function aggregatePlayerStats(stats=[]){
  const rows=Array.isArray(stats)?stats:[];
  const t=rows.reduce((a,s)=>{
    a.games+=1;a.minutes+=num(s.minutes);a.points+=num(s.points);
    a.reb+=num(s.off_reb??s.rebounds_offensive)+num(s.def_reb??s.rebounds_defensive);
    a.ast+=num(s.assists);a.stl+=num(s.steals);a.tov+=num(s.turnovers);
    a.fg2m+=num(s.fg2_made);a.fg2a+=num(s.fg2_attempted);a.fg3m+=num(s.fg3_made);a.fg3a+=num(s.fg3_attempted);
    a.ftm+=num(s.ft_made);a.fta+=num(s.ft_attempted);return a;
  },{games:0,minutes:0,points:0,reb:0,ast:0,stl:0,tov:0,fg2m:0,fg2a:0,fg3m:0,fg3a:0,ftm:0,fta:0});
  const fga=t.fg2a+t.fg3a, per40=v=>t.minutes>0?(v/t.minutes)*40:null;
  const efg=fga>0?((t.fg2m+1.5*t.fg3m)/fga)*100:null;
  const tsa=fga+0.44*t.fta, ts=tsa>0?(t.points/(2*tsa))*100:null;
  const three=t.fg3a>0?(t.fg3m/t.fg3a)*100:null;
  return {totals:t,values:{
    PTS_PER40:round(per40(t.points),1),REB_PER40:round(per40(t.reb),1),AST_PER40:round(per40(t.ast),1),
    STL_PER40:round(per40(t.stl),1),TOV_PER40:round(per40(t.tov),1),EFG_PCT:round(efg,1),TS_PCT:round(ts,1),THREE_PCT:round(three,1)
  }};
}

function eligible(metric,agg){
  const t=agg.totals;
  if(t.games<(metric.minGames||0)||t.minutes<(metric.minMinutes||0))return false;
  const attempts=t.fg2a+t.fg3a;
  if(metric.minAttempts&&attempts<metric.minAttempts)return false;
  if(metric.minThreeAttempts&&t.fg3a<metric.minThreeAttempts)return false;
  return Number.isFinite(agg.values[metric.code]);
}

export function buildTeamBenchmark({targetPlayerId,statsByPlayer=new Map()}={}){
  const aggregates=new Map();
  for(const [id,stats] of statsByPlayer.entries())aggregates.set(String(id),aggregatePlayerStats(stats));
  const target=aggregates.get(String(targetPlayerId));
  if(!target)return {metrics:[],sampleSize:0};

  const metrics=BENCHMARK_METRICS.map(metric=>{
    if(!eligible(metric,target))return {...metric,value:null,percentile:null,sampleSize:0,status:"INSUFFICIENT_PLAYER_SAMPLE"};
    const cohort=[...aggregates.values()].filter(a=>eligible(metric,a)).map(a=>a.values[metric.code]);
    return {...metric,value:target.values[metric.code],percentile:percentile(cohort,target.values[metric.code],metric.higher),sampleSize:cohort.length,
      status:cohort.length>=5?"READY":"SMALL_TEAM_SAMPLE"};
  });
  return {metrics,sampleSize:aggregates.size};
}

export function buildSelfBenchmark({earlyStats=[],recentStats=[]}={}){
  const early=aggregatePlayerStats(earlyStats),recent=aggregatePlayerStats(recentStats);
  return BENCHMARK_METRICS.map(metric=>({
    ...metric,early:eligible(metric,early)?early.values[metric.code]:null,recent:eligible(metric,recent)?recent.values[metric.code]:null,
    change:eligible(metric,early)&&eligible(metric,recent)?round(recent.values[metric.code]-early.values[metric.code],1):null
  }));
}

export function networkReliability(n){
  const size=Number(n)||0;
  if(size<20)return "HIDDEN";
  if(size<50)return "PROVISIONAL";
  if(size<100)return "REASONABLE";
  return "ROBUST";
}
export default {BENCHMARK_METRICS,aggregatePlayerStats,buildTeamBenchmark,buildSelfBenchmark,networkReliability};
