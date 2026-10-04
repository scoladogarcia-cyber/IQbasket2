/**
 * @fileoverview Canonical basketball event catalog and ordering.
 * @description Keeps display/edit semantics independent from UI views. Legacy
 * event shapes are normalized without mutating historical rows.
 */

export const OWN_GAME_EVENT_ACTIONS = Object.freeze([
  Object.freeze({ code:"fg2_made", label:"T2 anotado", points:2, made:true }),
  Object.freeze({ code:"fg2_attempted", label:"T2 fallado", points:0, made:false }),
  Object.freeze({ code:"fg3_made", label:"T3 anotado", points:3, made:true }),
  Object.freeze({ code:"fg3_attempted", label:"T3 fallado", points:0, made:false }),
  Object.freeze({ code:"ft_made", label:"TL anotado", points:1, made:true }),
  Object.freeze({ code:"ft_attempted", label:"TL fallado", points:0, made:false }),
  Object.freeze({ code:"off_reb", label:"Rebote ofensivo", points:0, made:false }),
  Object.freeze({ code:"def_reb", label:"Rebote defensivo", points:0, made:false }),
  Object.freeze({ code:"assists", label:"Asistencia", points:0, made:false }),
  Object.freeze({ code:"steals", label:"Robo", points:0, made:false }),
  Object.freeze({ code:"blocks_made", label:"Tapón", points:0, made:false }),
  Object.freeze({ code:"blocks_received", label:"Tapón recibido", points:0, made:false }),
  Object.freeze({ code:"turnovers", label:"Pérdida", points:0, made:false }),
  Object.freeze({ code:"fouls_committed", label:"Falta cometida", points:0, made:false }),
  Object.freeze({ code:"fouls_drawn", label:"Falta recibida", points:0, made:false })
]);

export const OPPONENT_GAME_EVENT_ACTIONS = Object.freeze([
  Object.freeze({ code:"opp_ft_made", label:"TL rival anotado", points:1, made:true }),
  Object.freeze({ code:"opp_fg2_made", label:"T2 rival anotado", points:2, made:true }),
  Object.freeze({ code:"opp_fg3_made", label:"T3 rival anotado", points:3, made:true }),
  Object.freeze({ code:"opp_oreb", label:"Rebote ofensivo rival", points:0, made:false }),
  Object.freeze({ code:"opp_dreb", label:"Rebote defensivo rival", points:0, made:false }),
  Object.freeze({ code:"opp_tov", label:"Pérdida rival", points:0, made:false })
]);

const ownByCode = new Map(OWN_GAME_EVENT_ACTIONS.map(item=>[item.code,item]));
const opponentByCode = new Map(OPPONENT_GAME_EVENT_ACTIONS.map(item=>[item.code,item]));

export function isOpponentEvent(event={}) {
  const action=String(event.action_type||event.action||event.event_type||"").toLowerCase();
  return Boolean(event.is_opponent||event.isOpponent||action.startsWith("opp_"));
}

export function canonicalGameEventAction(event={}) {
  const raw=String(event.action_type||event.action||event.event_type||"").trim().toLowerCase();
  const points=Number(event.points||0);
  const made=Boolean(event.made);

  if(raw==="fg2_attempted"&&(made||points===2)) return "fg2_made";
  if(raw==="fg3_attempted"&&(made||points===3)) return "fg3_made";
  if(raw==="ft_attempted"&&(made||points===1)) return "ft_made";
  if(raw==="opp_points"||raw==="opp_pts"){
    if(points===1)return "opp_ft_made";
    if(points===3)return "opp_fg3_made";
    return "opp_fg2_made";
  }
  return raw;
}

export function gameEventDefinition(eventOrCode={}) {
  const code=typeof eventOrCode==="string"
    ? String(eventOrCode).trim().toLowerCase()
    : canonicalGameEventAction(eventOrCode);
  return ownByCode.get(code)||opponentByCode.get(code)||Object.freeze({
    code,label:code.replaceAll("_"," ")||"Jugada",points:Number(eventOrCode?.points||0),made:Boolean(eventOrCode?.made)
  });
}

export function gameEventLabel(event={}) {
  return gameEventDefinition(event).label;
}

export function gameClockSeconds(value="") {
  const match=String(value||"").match(/^(\d{1,2}):(\d{2})$/);
  if(!match)return 0;
  return Number(match[1])*60+Number(match[2]);
}

export function compareGameEventsChronological(a={},b={}) {
  const aSeq=Number(a.event_sequence), bSeq=Number(b.event_sequence);
  const aHasSeq=Number.isFinite(aSeq)&&aSeq>0, bHasSeq=Number.isFinite(bSeq)&&bSeq>0;
  if(aHasSeq&&bHasSeq&&aSeq!==bSeq)return aSeq-bSeq;

  const periodDiff=Number(a.period||1)-Number(b.period||1);
  if(periodDiff)return periodDiff;

  const clockDiff=gameClockSeconds(b.game_clock)-gameClockSeconds(a.game_clock);
  if(clockDiff)return clockDiff;

  if(aHasSeq!==bHasSeq)return aHasSeq?-1:1;
  const timeDiff=Date.parse(a.created_at||"")-Date.parse(b.created_at||"");
  if(Number.isFinite(timeDiff)&&timeDiff)return timeDiff;
  return String(a.id||"").localeCompare(String(b.id||""));
}

export function compareGameEventsLatestFirst(a={},b={}) {
  return -compareGameEventsChronological(a,b);
}
