/**
 * @fileoverview Federation CSV adapter for controlled IQBasket boxscore import.
 * @description Explicit, documented CSV schema, not a proprietary FCBQ parser or API.
 * Never guesses missing metrics or matches players by name alone. The existing
 * BoxScoreExchangeV53 validation, game lock and RBAC/RLS remain authoritative.
 */
import { BOX_FIELDS, BOX_HEADERS } from "./BoxScoreExchangeV53.js";

const aliases=Object.freeze({
  jersey:["dorsal","numero","num","number","jersey"],
  player:["jugador","jugadora","player","nom","nombre"],
  minutes:["min","minutos","minutes","temps"],
  points:["pts","puntos","punts","points"],
  fg2_made:["t2c","2pm","2ptm","t2anotados","t2convertidos"],
  fg2_attempted:["t2i","2pa","2pta","t2intentados","t2intentos"],
  fg3_made:["t3c","3pm","3ptm","t3anotados","t3convertidos"],
  fg3_attempted:["t3i","3pa","3pta","t3intentados","t3intentos"],
  ft_made:["tlc","ftm","tlm","libresanotados"],
  ft_attempted:["tli","fta","libresintentados"],
  off_reb:["ro","reboteofensivo","rebotsatac","orb"],
  def_reb:["rd","rebotedefensivo","rebotsdefensa","drb"],
  assists:["ast","asis","asistencias","assistencies"],
  steals:["rec","recuperaciones","robos","pilotesrecuperades","stl"],
  blocks:["tap","tapones","taps","blk"],
  turnovers:["per","perdidas","perdues","tov"],
  fouls_committed:["fp","faltas","faltascometidas","faltescomeses"],
  fouls_drawn:["fr","faltasrecibidas","faltesrebudes"]
});
const normalized=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
function indexHeaders(header) {
  const used=new Set(), result={};
  for(const [field,names] of Object.entries(aliases)) {
    const matches=header.map((value,index)=>names.includes(normalized(value))?index:-1).filter(index=>index>=0);
    if(matches.length!==1 || used.has(matches[0]))throw new Error("Acta CSV: falta una columna obligatoria o hay encabezados ambiguos: "+field+".");
    result[field]=matches[0];used.add(matches[0]);
  }
  return result;
}
export function isFederationCsv(matrix) {
  if(!Array.isArray(matrix)||!Array.isArray(matrix[0]))return false;
  const h=matrix[0].map(normalized);
  return h.includes("dorsal") && (h.includes("pts")||h.includes("puntos")||h.includes("punts"));
}
function minutesOf(value,row) {
  const str=String(value??"").trim();
  if(/^\d{1,3}:\d{2}$/.test(str)){
    const [m,s]=str.split(":").map(Number);
    if(s>59)throw new Error("Fila "+row+": segundos inválidos.");
    return Math.round((m+s/60)*100)/100;
  }
  const n=Number(str.replace(",","."));
  if(!str || !Number.isFinite(n))throw new Error("Fila "+row+": minutos no válidos.");
  return n;
}
function numberOf(value,row,field) {
  const str=String(value??"").trim(), n=Number(str.replace(",","."));
  if(!str || !Number.isInteger(n) || n<0)throw new Error("Fila "+row+": "+field+" no válido o ausente. No se rellenan vacíos con cero.");
  return n;
}
const safeName=v=>String(v??"").trim().replace(/^[=+\-@]/,"");

/** Only exact single-jersey matches in the selected eligible squad are accepted. */
export function adaptFederationCsv(matrix,{game,eligiblePlayers=[],stats=[]}={}) {
  if(!isFederationCsv(matrix)||matrix.length<2||matrix.length>1001||!game?.id||!Array.isArray(stats)) {
    throw new Error("Acta CSV incompatible o partido sin información suficiente.");
  }
  const header=indexHeaders(matrix[0]);
  const byJersey=new Map(), statsById=new Map(stats.map(row=>[String(row.player_id??row.playerId),row]));
  for(const player of eligiblePlayers){
    const jersey=String(player?.jersey ?? player?.number ?? player?.jersey_number ?? player?.dorsal ?? "").trim();
    if(!jersey)continue;
    if(byJersey.has(jersey))throw new Error("Dos jugadores comparten dorsal; no se permite emparejamiento automático.");
    byJersey.set(jersey,player);
  }
  const seen=new Set();
  const result=matrix.slice(1).map((cells,i)=>{
    const n=i+2;
    if(!Array.isArray(cells)||cells.length!==matrix[0].length)throw new Error("Fila "+n+": columnas incorrectas.");
    const jersey=String(cells[header.jersey]??"").trim();
    const player=byJersey.get(jersey);
    const pid=String(player?.id||"");
    if(!pid||!statsById.has(pid)||seen.has(pid))throw new Error("Fila "+n+": dorsal no único, duplicado o no presente en el acta seleccionada.");
    seen.add(pid);
    const sourceName=safeName(cells[header.player]);
    if(!sourceName)throw new Error("Fila "+n+": nombre de jugador obligatorio.");
    // Dorsal can be recycled or changed: when the roster includes a verified name,
    // require name agreement as a second identity factor. Never guess or silently map.
    const rosterName=[player.first_name,player.last_name].filter(Boolean).join(" ").trim()||String(player.name||"").trim();
    const tokens=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean).sort().join(" ");
    if(rosterName&&tokens(sourceName)!==tokens(rosterName))
      throw new Error("Fila "+n+": el dorsal coincide pero el nombre no. Verifica identidad y plantilla antes de importar.");
    const raw={game_id:String(game.id),team_season_id:String(game.team_season_id??game.teamSeasonId),
      player_id:pid,jugador:sourceName,starter:statsById.get(pid).starter?"1":"0"};
    for(const field of BOX_FIELDS){
      raw[field]=field==="minutes"
        ? minutesOf(cells[header[field]],n)
        : numberOf(cells[header[field]],n,field);
    }
    return BOX_HEADERS.map(field=>String(raw[field]??""));
  });
  if(result.length!==stats.length)throw new Error("El CSV debe incluir la plantilla estadística completa del partido.");
  return [BOX_HEADERS,...result];
}
