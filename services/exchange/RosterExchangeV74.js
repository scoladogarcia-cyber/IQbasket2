/**
 * @fileoverview Authorized roster CSV exchange: full export + non-mutating validation.
 * @description Identity is stable UUID, not name or number; previews NEVER write.
 * Writes need a separately permission-checked, versioned transactional backend.
 */
import {parseBoxScoreCsv} from "../reports/BoxScoreExchangeV53.js";
export const ROSTER_HEADERS_V74=Object.freeze(["player_id","nombre","apellidos","dorsal","posicion"]);
const csv=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
const safe=v=>/^[=+\-@\t\r]/.test(String(v??""))?"'"+String(v):String(v??"");
const id=v=>String(v??"").trim();
const pos=v=>String(v??"").trim();
export function exportRosterCsvV74(players=[]){
  if(!Array.isArray(players)||!players.length||players.length>500)throw new Error("Plantilla autorizada vacía o excesiva.");
  const ids=new Set(),out=[ROSTER_HEADERS_V74];
  for(const row of players){
    const pid=id(row?.id??row?.player_id);
    if(!pid||ids.has(pid))throw new Error("Identificadores ausentes o duplicados.");
    ids.add(pid);
    out.push([pid,safe(row?.first_name??""),safe(row?.last_name??""),safe(row?.jersey??row?.number??""),safe(row?.primary_position??row?.position??"")]);
  }
  return "\uFEFF"+out.map(r=>r.map(csv).join(",")).join("\r\n")+"\r\n";
}
export function previewRosterCsvV74(text,{authorizedPlayers=[]}={}){
  const matrix=parseBoxScoreCsv(text);
  if(matrix.length<2||matrix.length>501||matrix[0].length!==ROSTER_HEADERS_V74.length||
    !ROSTER_HEADERS_V74.every((x,i)=>x===matrix[0][i]))throw new Error("Plantilla incompatible o vacía.");
  const allowed=new Map(authorizedPlayers.map(p=>[id(p.id??p.player_id),p]));
  const seen=new Set(),rows=[];
  for(let i=1;i<matrix.length;i++){
    const cells=matrix[i],pid=id(cells[0]);
    if(cells.length!==ROSTER_HEADERS_V74.length||!allowed.has(pid)||seen.has(pid))
      throw new Error("Fila "+(i+1)+": jugador duplicado, nuevo o fuera de la plantilla autorizada.");
    if(cells.slice(1).some(v=>String(v).length>120)||cells.slice(1).some(v=>/^[=+\-@]/.test(String(v))))
      throw new Error("Fila "+(i+1)+": valor inseguro o demasiado largo.");
    seen.add(pid);
    const old=allowed.get(pid);
    const next={player_id:pid,first_name:cells[1],last_name:cells[2],jersey:cells[3],primary_position:pos(cells[4])};
    const original=[old.first_name??"",old.last_name??"",old.jersey??old.number??"",old.primary_position??old.position??""].map(String);
    rows.push({...next,changed:JSON.stringify(cells.slice(1))!==JSON.stringify(original)});
  }
  if(seen.size!==allowed.size)throw new Error("Faltan jugadores: la importación nunca elimina miembros omitidos.");
  return Object.freeze({rows,changed:rows.filter(row=>row.changed).length,writable:false,
    reason:"Vista previa solamente. La escritura masiva requiere RPC, permisos por recurso y confirmación."});
}
