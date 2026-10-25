/**
 * @fileoverview Exportable federation-compatible CSV worksheet for a single game.
 * @description Generates a spreadsheet-friendly template tied to the *authorized*
 * roster and persisted boxscore; never turns missing observations into a zero.
 * The resulting CSV can be edited and imported through FederationCsvAdapterV70.
 * No club/season/player reads are made here: all inputs come from the caller's
 * scoped and revalidated game report.
 */
export const FEDERATION_TEMPLATE_HEADERS_V72=Object.freeze([
  "Dorsal","Jugador","MIN","PTS","T2C","T2I","T3C","T3I","TLC","TLI",
  "RO","RD","AST","REC","TAP","PER","FP","FR"
]);
const METRICS=Object.freeze([
  "minutes","points","fg2_made","fg2_attempted","fg3_made","fg3_attempted",
  "ft_made","ft_attempted","off_reb","def_reb","assists","steals",
  "blocks","turnovers","fouls_committed","fouls_drawn"
]);
const FIELD_ALIASES=Object.freeze({
  off_reb:["rebounds_offensive"],
  def_reb:["rebounds_defensive"],
  blocks:["blocks_made"],
  fouls_drawn:["fouls_received"]
});
const required=v=>v!==null&&v!==undefined&&String(v).trim()!=="";
const protectSpreadsheet=v=>/^[=+\-@\t\r]/.test(String(v??""))?"'"+String(v):String(v??"");
const csv=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
const same=(a,b)=>String(a??"")===String(b??"");
function rosterId(row){return String(row?.id??"");}
function uniqueJersey(row){return row?.jersey??row?.number??row?.jersey_number??row?.dorsal;}
function playerName(row) {
  return [row?.first_name,row?.last_name].filter(Boolean).join(" ").trim()||
    String(row?.name??"").trim();
}
function recorded(row,key){
  const choices=[key,...(FIELD_ALIASES[key]||[])];
  for(const candidate of choices){
    const v=row?.[candidate];
    if(required(v)&&Number.isFinite(Number(v)))return String(v);
  }
  return ""; // Blank means not recorded; never invent a zero.
}
export function createFederationWorksheetV72({game,eligiblePlayers=[],stats=[]}={}) {
  if(!game?.id||!game?.team_season_id||!Array.isArray(eligiblePlayers)||!Array.isArray(stats)||!stats.length){
    throw new Error("Selecciona un partido con acta y plantilla autorizadas.");
  }
  const players=new Map();
  for(const row of eligiblePlayers){
    const id=rosterId(row);
    if(!id||players.has(id))throw new Error("Plantilla con identificadores ausentes o duplicados.");
    players.set(id,row);
  }
  const seenIds=new Set(),seenJerseys=new Set();
  const matrix=[FEDERATION_TEMPLATE_HEADERS_V72];
  for(const stat of stats){
    const playerId=String(stat?.player_id??stat?.playerId??"");
    const player=players.get(playerId);
    if(!player||seenIds.has(playerId)||!same(stat.game_id??game.id,game.id)){
      throw new Error("Acta sin correspondencia única con los jugadores elegibles.");
    }
    const dorsal=uniqueJersey(player),name=playerName(player);
    if(!required(dorsal)||!name||seenJerseys.has(String(dorsal))){
      throw new Error("Se necesita un dorsal único y nombre para cada jugador.");
    }
    seenJerseys.add(String(dorsal));seenIds.add(playerId);
    matrix.push([String(dorsal),protectSpreadsheet(name),...METRICS.map(metric=>recorded(stat,metric))]);
  }
  const csvText="\uFEFF"+matrix.map(row=>row.map(csv).join(",")).join("\r\n")+"\r\n";
  return Object.freeze({
    content:csvText,
    rows:stats.length,
    missingCells:matrix.slice(1).reduce((n,row)=>n+row.filter((v,i)=>i>=2&&v==="").length,0),
    filename:"IQBasket_Plantilla_Acta_"+String(game.id).replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64)+".csv"
  });
}
