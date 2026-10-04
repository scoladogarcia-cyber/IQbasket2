/**
 * @fileoverview Canonical Excel workbook export for IQBasket match data.
 * @description Builds a real .xlsx with Acta, BoxScore and Jugadas from the
 * same fresh authorized reports used by the UI/PDF. No synthetic rows.
 */

import { createXlsxWorkbook } from "./SimpleXlsxWorkbook.js";
import {
  canonicalGameEventAction,
  compareGameEventsChronological,
  gameEventLabel,
  isOpponentEvent
} from "../../domain/games/GameEventCatalog.js";

const id=value=>String(value??"");
const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
const optional=value=>{const n=Number(value);return Number.isFinite(n)?n:null;};
const percent=(made,attempted)=>num(attempted)>0?Number(((100*num(made))/num(attempted)).toFixed(1)):0;

function playerDisplay(player={}) {
  return [player.first_name,player.last_name].filter(Boolean).join(" ")||player.name||"Jugador";
}
function jerseyOf(player={}) {
  return player.jersey ?? player.number ?? "";
}
function statsValue(row,field,...aliases) {
  const direct=row?.[field];
  if(direct!==undefined&&direct!==null)return num(direct);
  for(const alias of aliases){
    if(row?.[alias]!==undefined&&row?.[alias]!==null)return num(row[alias]);
  }
  return 0;
}
function periodText(periods=[],regulation=4) {
  return [...periods].sort((a,b)=>num(a.period_number)-num(b.period_number)).map(row=>{
    const n=num(row.period_number);
    const label=n>regulation?"PR"+(n-regulation):"Q"+n;
    return label+" "+num(row.team_score)+"-"+num(row.opponent_score);
  }).join(" | ");
}
function teamTotals(stats=[]) {
  const fields=[
    "minutes","points","fg2_made","fg2_attempted","fg3_made","fg3_attempted",
    "ft_made","ft_attempted","off_reb","def_reb","assists","steals",
    "blocks_made","blocks_received","turnovers","fouls_committed","fouls_drawn",
    "evaluation","plus_minus"
  ];
  const out=Object.fromEntries(fields.map(field=>[field,0]));
  for(const row of stats||[]){
    for(const field of fields){
      const aliases=field==="blocks_made"?["blocks"]:
        field==="off_reb"?["rebounds_offensive"]:
        field==="def_reb"?["rebounds_defensive"]:
        field==="fouls_drawn"?["fouls_received"]:[];
      out[field]+=statsValue(row,field,...aliases);
    }
  }
  return out;
}

const ACTA_HEADERS=Object.freeze([
  "game_id","fecha","rival","estado","marcador_equipo","marcador_rival","parciales",
  "jugadores_con_acta","minutos","puntos","T2_C","T2_I","T2_%","T3_C","T3_I","T3_%",
  "TL_C","TL_I","TL_%","REB_O","REB_D","REB_T","AST","ROB","TAP","TAP_REC","PER","FC","FR",
  "VAL","mas_menos","eFG_%","coherencia_puntos",
  "rival_T2_C","rival_T2_I","rival_T3_C","rival_T3_I","rival_TL_C","rival_TL_I",
  "rival_REB_O","rival_REB_D","rival_PER",
  "posesiones_est","pace","ORtg","DRtg","NetRtg"
]);

export const BOXSCORE_XLSX_HEADERS=Object.freeze([
  "game_id","fecha","rival","team_season_id","player_id","dorsal","jugador","titular",
  "MIN","PTS","T2_C","T2_I","T2_%","T3_C","T3_I","T3_%","TL_C","TL_I","TL_%",
  "REB_O","REB_D","REB_T","AST","ROB","TAP","TAP_REC","PER","FC","FR","+/-","VAL",
  "GameScore","eFG_%","TS_%","ORtg","DRtg","USG_%",
  "aro_C","aro_I","media_C","media_I","esquina3_C","esquina3_I",
  "tiros_asistidos","asistencias_potenciales","asistencias_secundarias","penetraciones",
  "toques_pintura","desvios","faltas_ataque_recibidas","rebotes_disputados","box_outs"
]);

export const EVENTS_XLSX_HEADERS=Object.freeze([
  "game_id","fecha","rival","orden_export","secuencia","periodo","periodo_label","reloj",
  "lado","player_id","dorsal","jugador","accion_codigo","accion","puntos","anotado",
  "coord_x","coord_y","zona_tiro","event_id","client_event_key","registrado_en"
]);

export function buildActaRows(reports=[]) {
  return [ACTA_HEADERS,...reports.map(report=>{
    const game=report.game||{};
    const totals=teamTotals(report.stats||[]);
    const team=report.teamStats||{};
    const regulation=num(game.periods_count)||4;
    const efg=optional(team.efg) ?? (
      (totals.fg2_attempted+totals.fg3_attempted)>0
        ? Number((100*(totals.fg2_made+1.5*totals.fg3_made)/(totals.fg2_attempted+totals.fg3_attempted)).toFixed(1))
        : 0
    );
    return [
      id(game.id),game.date||"",game.opponent||"Rival",game.play_state||game.status||"",
      num(game.team_score),num(game.opponent_score),periodText(report.periods||[],regulation),
      (report.stats||[]).length,totals.minutes,totals.points,
      totals.fg2_made,totals.fg2_attempted,percent(totals.fg2_made,totals.fg2_attempted),
      totals.fg3_made,totals.fg3_attempted,percent(totals.fg3_made,totals.fg3_attempted),
      totals.ft_made,totals.ft_attempted,percent(totals.ft_made,totals.ft_attempted),
      totals.off_reb,totals.def_reb,totals.off_reb+totals.def_reb,totals.assists,totals.steals,
      totals.blocks_made,totals.blocks_received,totals.turnovers,totals.fouls_committed,
      totals.fouls_drawn,totals.evaluation,totals.plus_minus,efg,
      totals.points===num(game.team_score)?"OK":("REVISAR · acta "+totals.points+" / marcador "+num(game.team_score)),
      statsValue(team,"opp_fg2_made"),statsValue(team,"opp_fg2_attempted"),
      statsValue(team,"opp_fg3_made"),statsValue(team,"opp_fg3_attempted"),
      statsValue(team,"opp_ft_made"),statsValue(team,"opp_ft_attempted"),
      statsValue(team,"opp_off_reb"),statsValue(team,"opp_def_reb"),statsValue(team,"opp_turnovers"),
      optional(team.estimated_possessions),optional(team.pace),optional(team.ortg),
      optional(team.drtg),optional(team.net_rating)
    ];
  })];
}

export function buildBoxScoreRows(reports=[]) {
  const rows=[BOXSCORE_XLSX_HEADERS];
  for(const report of reports){
    const game=report.game||{};
    const players=new Map((report.players||[]).map(player=>[id(player.id),player]));
    for(const stat of report.stats||[]){
      const pid=id(stat.player_id??stat.playerId);
      const player=players.get(pid)||{};
      const fg2m=statsValue(stat,"fg2_made"),fg2a=statsValue(stat,"fg2_attempted");
      const fg3m=statsValue(stat,"fg3_made"),fg3a=statsValue(stat,"fg3_attempted");
      const ftm=statsValue(stat,"ft_made"),fta=statsValue(stat,"ft_attempted");
      const oreb=statsValue(stat,"off_reb","rebounds_offensive");
      const dreb=statsValue(stat,"def_reb","rebounds_defensive");
      rows.push([
        id(game.id),game.date||"",game.opponent||"Rival",id(game.team_season_id??game.teamSeasonId),
        pid,jerseyOf(player),playerDisplay(player),Boolean(stat.starter),
        statsValue(stat,"minutes"),statsValue(stat,"points"),
        fg2m,fg2a,percent(fg2m,fg2a),fg3m,fg3a,percent(fg3m,fg3a),ftm,fta,percent(ftm,fta),
        oreb,dreb,oreb+dreb,statsValue(stat,"assists"),statsValue(stat,"steals"),
        statsValue(stat,"blocks_made","blocks"),statsValue(stat,"blocks_received"),
        statsValue(stat,"turnovers"),statsValue(stat,"fouls_committed"),
        statsValue(stat,"fouls_drawn","fouls_received"),statsValue(stat,"plus_minus"),
        statsValue(stat,"evaluation"),optional(stat.game_score),optional(stat.efg_pct),
        optional(stat.true_shooting_pct),optional(stat.offensive_rating),optional(stat.defensive_rating),
        optional(stat.usage_pct),statsValue(stat,"fg_rim_made"),statsValue(stat,"fg_rim_attempted"),
        statsValue(stat,"fg_mid_made"),statsValue(stat,"fg_mid_attempted"),
        statsValue(stat,"fg_corner3_made"),statsValue(stat,"fg_corner3_attempted"),
        statsValue(stat,"assisted_fg_made"),statsValue(stat,"potential_assists"),
        statsValue(stat,"secondary_assists"),statsValue(stat,"drives"),statsValue(stat,"paint_touches"),
        statsValue(stat,"deflections"),statsValue(stat,"charges_drawn"),
        statsValue(stat,"contested_rebounds"),statsValue(stat,"box_outs")
      ]);
    }
  }
  return rows;
}

export function buildEventRows(reports=[]) {
  const rows=[EVENTS_XLSX_HEADERS];
  for(const report of reports){
    const game=report.game||{};
    const regulation=num(game.periods_count)||4;
    const players=new Map((report.players||[]).map(player=>[id(player.id),player]));
    const ordered=[...(report.events||[])].sort(compareGameEventsChronological);
    ordered.forEach((event,index)=>{
      const opponent=isOpponentEvent(event);
      const pid=id(event.player_id??event.playerId);
      const player=players.get(pid)||{};
      const period=num(event.period)||1;
      rows.push([
        id(game.id),game.date||"",game.opponent||"Rival",index+1,optional(event.event_sequence),
        period,period>regulation?"PR"+(period-regulation):"Q"+period,event.game_clock||"",
        opponent?"Rival":"Equipo",opponent?"":pid,opponent?"":jerseyOf(player),
        opponent?"Rival":playerDisplay(player),canonicalGameEventAction(event),gameEventLabel(event),
        num(event.points),Boolean(event.made),optional(event.coord_x),optional(event.coord_y),
        event.shot_zone||"",id(event.id),event.client_event_key||"",event.created_at||""
      ]);
    });
  }
  return rows;
}

export function buildMatchWorkbookModel(reports=[],{eventsOnly=false}={}) {
  if(!Array.isArray(reports)||!reports.length) throw new Error("No hay partidos para exportar.");
  if(reports.some(report=>report?.eventsAvailable===false)) {
    throw new Error("No se exportará un Excel incompleto: no se han podido recuperar todas las jugadas.");
  }
  if(eventsOnly){
    return [{name:"Jugadas",rows:buildEventRows(reports),widths:[38,12,24,12,12,9,12,10,10,38,9,24,24,26,9,10,10,10,18,38,26,24]}];
  }
  return [
    {name:"Acta",rows:buildActaRows(reports),widths:[38,12,24,14,15,15,36,16,10,10]},
    {name:"BoxScore",rows:buildBoxScoreRows(reports),widths:[38,12,24,38,38,9,24,10,8,8]},
    {name:"Jugadas",rows:buildEventRows(reports),widths:[38,12,24,12,12,9,12,10,10,38,9,24,24,26,9,10,10,10,18,38,26,24]}
  ];
}

export function buildMatchWorkbookXlsx(reports=[],options={}) {
  return createXlsxWorkbook(buildMatchWorkbookModel(reports,options));
}

export default buildMatchWorkbookXlsx;
