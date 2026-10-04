/**
 * @fileoverview Deterministic team/player training intelligence.
 * @description Aggregates V55 training records without making causal or medical
 * claims. Focus exposure means participation in sessions containing that focus
 * unless explicit focus allocations are introduced later.
 */

import { buildTrainingFocusAnalytics } from "./TrainingFocusAnalytics.js";

function rows(v){return Array.isArray(v)?v:[];}
function n(v){const x=Number(v);return Number.isFinite(x)?x:null;}
function duration(s={}){
  const stored=n(s.duration_minutes); if(stored!==null&&stored>0)return stored;
  const parse=v=>{const m=String(v||"").match(/^(\d{2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null;};
  const a=parse(s.start_time),b=parse(s.end_time); return a!==null&&b!==null&&b>a?b-a:0;
}
function minutes(p={},sessionMinutes=0){
  const status=String(p.attendance_status||"").toUpperCase();
  if(["ABSENT","EXCUSED"].includes(status))return 0;
  const explicit=n(p.participated_minutes); if(explicit!==null)return Math.max(0,explicit);
  return status==="PRESENT"?Math.max(0,sessionMinutes):0;
}
function weekStart(value){
  const d=new Date(String(value||"")+"T12:00:00Z"); if(Number.isNaN(d.getTime()))return null;
  const shift=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-shift); return d.toISOString().slice(0,10);
}
function mean(values){const v=values.filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;}
function round(v,d=1){if(!Number.isFinite(v))return null;const f=10**d;return Math.round(v*f)/f;}
function rollingSummary(sessions=[],days=7,anchorDate=null){
  const anchor=anchorDate?new Date(String(anchorDate)+"T23:59:59Z"):null;
  if(!anchor||Number.isNaN(anchor.getTime()))return {days,sessions:0,sessionMinutes:0,participantMinutes:0,totalLoad:0,avgRpe:null};
  const from=new Date(anchor.getTime()-(Math.max(1,days)-1)*86400000);
  let sessionMinutes=0,participantMinutes=0,totalLoad=0;const rpes=[];let count=0;
  for(const session of sessions){
    const at=new Date(String(session.session_date||"")+"T12:00:00Z");
    if(Number.isNaN(at.getTime())||at<from||at>anchor)continue;
    count+=1;const mins=duration(session);sessionMinutes+=mins;
    for(const p of rows(session.participants)){
      const pmins=minutes(p,mins);participantMinutes+=pmins;
      const rpe=n(p.rpe),load=n(p.internal_load)??(rpe!==null?pmins*rpe:null);
      if(rpe!==null)rpes.push(rpe);if(load!==null)totalLoad+=load;
    }
  }
  return {days,sessions:count,sessionMinutes,participantMinutes,totalLoad:round(totalLoad,0),avgRpe:round(mean(rpes),1)};
}

export function buildTrainingIntelligence(sessions=[]){
  const active=rows(sessions).filter(s=>String(s?.status||"").toUpperCase()!=="ARCHIVED");
  const focus=buildTrainingFocusAnalytics(active);
  const players=new Map();
  const weekly=new Map();
  let participantRows=0,presentRows=0,totalLoad=0;
  const rpes=[];

  for(const session of active){
    const mins=duration(session);
    const week=weekStart(session.session_date);
    if(week){
      if(!weekly.has(week))weekly.set(week,{week,sessions:0,sessionMinutes:0,participantMinutes:0,load:0,rpe:[]});
      const w=weekly.get(week);w.sessions+=1;w.sessionMinutes+=mins;
    }
    for(const p of rows(session.participants)){
      const id=String(p.player_id||p.playerId||""); if(!id)continue;
      participantRows+=1;
      const status=String(p.attendance_status||"").toUpperCase();
      const pmins=minutes(p,mins);
      const rpe=n(p.rpe), load=n(p.internal_load) ?? (rpe!==null?pmins*rpe:null);
      if(["PRESENT","PARTIAL"].includes(status))presentRows+=1;
      if(rpe!==null)rpes.push(rpe);
      if(load!==null)totalLoad+=load;

      if(!players.has(id))players.set(id,{playerId:id,scheduled:0,attended:0,minutes:0,rpe:[],load:0});
      const row=players.get(id);row.scheduled+=1;
      if(pmins>0){row.attended+=1;row.minutes+=pmins;}
      if(rpe!==null)row.rpe.push(rpe);
      if(load!==null)row.load+=load;

      if(week){
        const w=weekly.get(week);w.participantMinutes+=pmins;if(load!==null)w.load+=load;if(rpe!==null)w.rpe.push(rpe);
      }
    }
  }

  const focusClassified=active.filter(s=>{
    const codes=s?.metadata?.training_focus_codes;
    return Array.isArray(codes)&&codes.length>0;
  }).length;

  const focusByPlayer=new Map(focus.players.map(p=>[String(p.playerId),p]));
  const playerRows=[...players.values()].map(p=>({
    playerId:p.playerId,
    sessions:p.scheduled,
    attended:p.attended,
    attendancePct:p.scheduled?round((p.attended/p.scheduled)*100):null,
    participatedMinutes:p.minutes,
    avgRpe:round(mean(p.rpe),1),
    totalLoad:round(p.load,0),
    focuses:focusByPlayer.get(p.playerId)?.focuses||[]
  })).sort((a,b)=>(b.participatedMinutes-a.participatedMinutes)||a.playerId.localeCompare(b.playerId));

  const weeks=[...weekly.values()].sort((a,b)=>a.week.localeCompare(b.week)).map(w=>({
    week:w.week,sessions:w.sessions,sessionMinutes:w.sessionMinutes,participantMinutes:w.participantMinutes,
    totalLoad:round(w.load,0),avgRpe:round(mean(w.rpe),1)
  }));

  return Object.freeze({
    semantics:focus.semantics,
    totals:Object.freeze({
      sessions:active.length,
      sessionMinutes:focus.totals.sessionMinutes,
      participantRows,
      attendancePct:participantRows?round((presentRows/participantRows)*100):null,
      avgRpe:round(mean(rpes),1),
      totalLoad:round(totalLoad,0),
      focusClassified,
      focusCoveragePct:active.length?round((focusClassified/active.length)*100):0,
      explicitFocusAllocationCoveragePct:focus.totals.explicitAllocationCoveragePct
    }),
    focuses:focus.focuses,
    players:Object.freeze(playerRows),
    weeks:Object.freeze(weeks),
    rolling:Object.freeze((()=>{
      const dates=active.map(s=>String(s.session_date||"")).filter(Boolean).sort();
      const anchor=dates.at(-1)||null;
      return {
        anchorDate:anchor,
        last7:Object.freeze(rollingSummary(active,7,anchor)),
        last14:Object.freeze(rollingSummary(active,14,anchor)),
        last28:Object.freeze(rollingSummary(active,28,anchor))
      };
    })()),
    unclassifiedSessionIds:Object.freeze(active.filter(s=>!Array.isArray(s?.metadata?.training_focus_codes)||!s.metadata.training_focus_codes.length).map(s=>String(s.id)))
  });
}
export default buildTrainingIntelligence;
