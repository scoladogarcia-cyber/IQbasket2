/**
 * @fileoverview Benchmark application service.
 * @description Builds self/team comparisons from authorized DataStore rows and
 * reads only anonymized network snapshot aggregates from Supabase.
 */

import { DataStore } from "../DataStore.js";
import { BENCHMARK_METRICS, buildTeamBenchmark, buildSelfBenchmark, estimateNetworkPercentile } from "../../domain/stats/BenchmarkEngine.js";

function id(v){return String(v||"");}
function gameDate(game={}){return String(game.date||game.game_date||"").slice(0,10);}
function ageOn(date,birth){
  if(!date||!birth)return null;const d=new Date(date+"T12:00:00Z"),b=new Date(String(birth).slice(0,10)+"T12:00:00Z");
  if(Number.isNaN(d.getTime())||Number.isNaN(b.getTime()))return null;
  let a=d.getUTCFullYear()-b.getUTCFullYear();const md=d.getUTCMonth()-b.getUTCMonth();
  if(md<0||(md===0&&d.getUTCDate()<b.getUTCDate()))a--;return a;
}

export class BenchmarkService {
  constructor(client=null){this.client=client?.supabase||client?.default||client;}

  _seasonGames(teamId,teamSeasonId){
    return (DataStore.getGames?.()||[]).filter(g=>{
      const sameTeam=!teamId||id(g.team_id||g.teamId)===id(teamId);
      const sameSeason=!teamSeasonId||id(g.team_season_id||g.teamSeasonId)===id(teamSeasonId);
      return sameTeam&&sameSeason;
    });
  }

  _statsMap(players,games){
    const gameIds=new Set(games.map(g=>id(g.id)));
    const map=new Map();
    for(const p of players||[]){
      const stats=(DataStore.getPlayerGameStats?.(p.id)||[]).filter(s=>gameIds.has(id(s.game_id||s.gameId)));
      map.set(id(p.id),stats);
    }
    return map;
  }

  _cohortKey({player,team,games}={}){
    const dates=games.map(gameDate).filter(Boolean).sort();
    const mid=dates.length?dates[Math.floor(dates.length/2)]:new Date().toISOString().slice(0,10);
    const age=ageOn(mid,player?.birth_date);
    const category=String(team?.category||"ALL").trim().toUpperCase().replace(/\s+/g,"_");
    const competition=String(team?.competition||"ALL").trim().toUpperCase().replace(/\s+/g,"_");
    const pos=String(player?.primary_position||player?.position||"ALL").trim().toUpperCase().replace(/\s+/g,"_");
    return `CATEGORY:${category}|COMP:${competition}|POS:${pos}|AGE:${age??"NA"}`;
  }

  async getPlayerBenchmark({playerId,teamId,teamSeasonId}={}){
    const players=DataStore.getSeasonParticipantPlayers?.(teamId)||DataStore.getTeamPlayers?.(teamId)||[];
    const target=players.find(p=>id(p.id)===id(playerId))||DataStore.getPlayerById?.(playerId)||null;
    const team=DataStore.getTeamById?.(teamId)||{};
    const games=this._seasonGames(teamId,teamSeasonId).sort((a,b)=>gameDate(a).localeCompare(gameDate(b)));
    const statsMap=this._statsMap(players,games);
    const teamBenchmark=buildTeamBenchmark({targetPlayerId:playerId,statsByPlayer:statsMap});

    const targetStats=statsMap.get(id(playerId))||[];
    const gameById=new Map(games.map(g=>[id(g.id),g]));
    const ordered=[...targetStats].sort((a,b)=>gameDate(gameById.get(id(a.game_id||a.gameId))).localeCompare(gameDate(gameById.get(id(b.game_id||b.gameId)))));
    const split=Math.floor(ordered.length/2);
    const selfBenchmark=buildSelfBenchmark({earlyStats:ordered.slice(0,split),recentStats:ordered.slice(split)});

    const cohortKey=this._cohortKey({player:target,team,games});
    let network=[];
    if(this.client?.rpc){
      const {data,error}=await this.client.rpc("iq_v58_network_benchmark_snapshot",{
        p_team_season_id:teamSeasonId,p_cohort_key:cohortKey,p_metric_codes:BENCHMARK_METRICS.map(m=>m.code)
      });
      if(!error&&Array.isArray(data)){
        const targetMetrics=new Map((teamBenchmark.metrics||[]).map(metric=>[metric.code,metric]));
        network=data.map(snapshot=>{
          const definition=BENCHMARK_METRICS.find(metric=>metric.code===snapshot.metric_code);
          const targetMetric=targetMetrics.get(snapshot.metric_code);
          const value=Number(targetMetric?.value);
          return {
            ...snapshot,
            label:definition?.label||snapshot.metric_code,
            value:Number.isFinite(value)?value:null,
            percentile:Number.isFinite(value)
              ? estimateNetworkPercentile(snapshot,value,definition?.higher!==false)
              : null
          };
        });
      }
    }

    return {player:target,team,gamesCount:games.length,teamBenchmark,selfBenchmark,network,cohortKey};
  }
}
export default BenchmarkService;
