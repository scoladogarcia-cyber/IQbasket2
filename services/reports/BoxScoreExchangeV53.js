/**
 * @fileoverview Intercambio reutilizable de BoxScore por CSV y Excel XML 2003.
 * @description Formatos sin dependencias ni datos sintéticos. Importar exige
 * el archivo completo de UN partido y una confirmación separada. Los XLS
 * binarios y XLSX externos deben convertirse previamente a CSV UTF-8.
 */
import { Permission } from "../../security/permissions.js";
import { GameLockService } from "../games/GameLockService.js";

const escapeXml = text => String(text ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[c]);
const safeCell = text => /^[=+@\-\t\r]/.test(String(text ?? "")) ? `'${text}` : String(text ?? "");
const id = value => String(value ?? "");
export const BOX_FIELDS = Object.freeze(["minutes","points","fg2_made","fg2_attempted","fg3_made","fg3_attempted","ft_made","ft_attempted","off_reb","def_reb","assists","steals","blocks","turnovers","fouls_committed","fouls_drawn"]);
export const BOX_HEADERS = Object.freeze(["game_id","team_season_id","player_id","jugador","starter",...BOX_FIELDS]);
const valueOf = (row, field) => {
  const aliases = {blocks:["blocks_made"],off_reb:["rebounds_offensive"],def_reb:["rebounds_defensive"],fouls_drawn:["fouls_received"]};
  return row?.[field] ?? (aliases[field] || []).map(key=>row?.[key]).find(value=>value!==undefined && value!==null) ?? 0;
};
const canonical = row => Object.fromEntries(BOX_FIELDS.map(field=>[field, Number(valueOf(row,field))]));
export const snapshotRows = rows => JSON.stringify((rows || []).map(row => ({player_id:id(row.player_id ?? row.playerId),starter:Boolean(row.starter),...canonical(row)})).sort((a,b)=>a.player_id.localeCompare(b.player_id)));

/** Solo filas autorizadas que ya constan en el partido consultado. */
export function buildBoxScoreExchangeRows(reports = []) {
  if (!Array.isArray(reports) || !reports.length) throw new Error("No hay partidos seleccionados.");
  const result = [];
  const gameIds = new Set();
  for (const report of reports) {
    const game = report.game;
    if (!game?.id || gameIds.has(id(game.id)) || !Array.isArray(report.stats) || !Array.isArray(report.players)) {
      throw new Error("No se dispone del BoxScore actualizado y completo de un partido.");
    }
    gameIds.add(id(game.id));
    const byPlayer = new Map(report.players.map(p => [id(p.id),p]));
    const seen = new Set();
    for (const row of report.stats) {
      const pid = id(row.player_id ?? row.playerId);
      if (!pid || seen.has(pid) || !byPlayer.has(pid)) throw new Error("El partido contiene un jugador sin autorización o acta duplicada.");
      seen.add(pid);
      const player = byPlayer.get(pid);
      result.push({game_id:id(game.id),team_season_id:id(game.team_season_id ?? game.teamSeasonId),player_id:pid,
        jugador:safeCell([player.first_name,player.last_name].filter(Boolean).join(" ") || player.name || "Jugador"),
        starter:row.starter ? "1":"0",...canonical(row)});
    }
    if (!seen.size) throw new Error("No se exporta un BoxScore sin actas individuales.");
  }
  return result;
}

export function serializeBoxScoreCsv(rows) {
  const cell = value => `"${String(value ?? "").replace(/"/g,'""')}"`;
  return "\uFEFF" + [BOX_HEADERS.join(","),...rows.map(row=>BOX_HEADERS.map(key=>cell(row[key])).join(","))].join("\r\n") + "\r\n";
}
/** Excel XML Spreadsheet 2003 .xls: Excel puede mostrar aviso de compatibilidad. */
export function serializeBoxScoreExcel(rows) {
  const all = [BOX_HEADERS,...rows.map(row=>BOX_HEADERS.map(key=>row[key]))];
  const body = all.map(cells=>`<Row>${cells.map(cell=>`<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join("")}</Row>`).join("");
  return `<?xml version="1.0" encoding="utf-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="BoxScore"><Table>${body}</Table></Worksheet></Workbook>`;
}

/** CSV RFC4180: maneja saltos de línea y comillas en campos. */
export function parseBoxScoreCsv(text) {
  if (typeof text !== "string" || text.length > 4_000_000) throw new Error("CSV no válido o demasiado grande.");
  const input = text.replace(/^\uFEFF/,"");
  const rows = []; let row=[], token="", quoted=false, closed=false;
  for (let i=0; i<input.length; i++) {
    const c=input[i];
    if (quoted) {
      if (c==='"' && input[i+1]==='"') {token+='"';i++;}
      else if (c==='"') {quoted=false;closed=true;}
      else token+=c;
    } else if (c==='"') {
      if (token || closed) throw new Error("CSV con comillas mal formadas.");
      quoted=true;
    } else if (c===",") {row.push(token);token="";closed=false;}
    else if (c==="\n" || c==="\r") {
      if (c==="\r" && input[i+1]==="\n") i++;
      row.push(token); if (row.some(v=>v!=="")) rows.push(row);
      row=[];token="";closed=false;
    } else {if(closed && c!==" ") throw new Error("CSV inválido tras una comilla de cierre.");token+=c;}
  }
  if (quoted) throw new Error("CSV con comillas sin cerrar.");
  row.push(token);if(row.some(v=>v!=="")) rows.push(row);
  return rows;
}

/** Importa SOLO Excel XML 2003 emitido por esta aplicación, no binario .xls. */
export function parseBoxScoreExcel(xml, parser = typeof DOMParser === "function" ? new DOMParser() : null) {
  if (!parser || typeof xml!=="string" || xml.length>4_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Excel XML no válido o formato no admitido.");
  const doc=parser.parseFromString(xml,"application/xml");
  if (doc.getElementsByTagName("parsererror").length || doc.documentElement?.localName!=="Workbook" || doc.documentElement?.namespaceURI!=="urn:schemas-microsoft-com:office:spreadsheet") throw new Error("El archivo no es Excel XML 2003. Convierte otro Excel a CSV UTF-8.");
  const ns="urn:schemas-microsoft-com:office:spreadsheet";
  return [...doc.getElementsByTagNameNS(ns,"Row")].map(row=>[...row.getElementsByTagNameNS(ns,"Cell")].map(cell=>cell.getElementsByTagNameNS(ns,"Data")[0]?.textContent ?? ""));
}

/** Rechazo completo en vez de importar silenciosamente filas incorrectas. */
export function validateBoxScoreImport(matrix, {game,stats,eligiblePlayers}={}) {
  if (!game?.id || !Array.isArray(stats) || !Array.isArray(eligiblePlayers) || !Array.isArray(matrix) || matrix.length<2 || matrix.length>1001) throw new Error("El archivo debe contener un partido completo y válido (máximo 1000 jugadores).");
  if (matrix[0].length!==BOX_HEADERS.length || !BOX_HEADERS.every((head,i)=>matrix[0][i]===head)) throw new Error("Columnas incompatibles. Utiliza la plantilla CSV/Excel exportada desde Informes.");
  const validIds=new Set(eligiblePlayers.map(row=>id(row.id)));
  const existing=new Map(stats.map(row=>[id(row.player_id ?? row.playerId),row]));
  const seen=new Set();const rows=[];
  for (const [index,cells] of matrix.slice(1).entries()) {
    if (cells.length!==BOX_HEADERS.length) throw new Error(`Fila ${index+2}: número de columnas incorrecto.`);
    const obj=Object.fromEntries(BOX_HEADERS.map((key,i)=>[key,cells[i]]));
    const pid=id(obj.player_id);
    if (id(obj.game_id)!==id(game.id) || id(obj.team_season_id)!==id(game.team_season_id ?? game.teamSeasonId) || !validIds.has(pid) || !existing.has(pid) || seen.has(pid)) throw new Error(`Fila ${index+2}: partido, temporada o jugador no válido/duplicado.`);
    if (!/^[01]$/.test(obj.starter)) throw new Error(`Fila ${index+2}: titular debe ser 0 o 1.`);
    const row={game_id:id(game.id),player_id:pid,starter:obj.starter==="1"};
    for (const field of BOX_FIELDS) {
      const raw=String(obj[field] ?? "").trim(); const n=Number(raw);
      if (!raw || !Number.isFinite(n) || n<0 || n>10000 || (field!=="minutes" && !Number.isInteger(n)) || (field==="minutes" && n>240)) throw new Error(`Fila ${index+2}: valor inválido en ${field}.`);
      row[field]=n;
    }
    if (row.fg2_made>row.fg2_attempted || row.fg3_made>row.fg3_attempted || row.ft_made>row.ft_attempted || row.points!==2*row.fg2_made+3*row.fg3_made+row.ft_made) throw new Error(`Fila ${index+2}: tiros/aciertos/puntos no concuerdan.`);
    seen.add(pid);rows.push(row);
  }
  if (rows.length!==existing.size || [...existing.keys()].some(pid=>!seen.has(pid))) throw new Error("El archivo debe incluir exactamente las filas existentes. No se importan plantillas parciales ni se eliminan jugadores.");
  const points=rows.reduce((s,row)=>s+row.points,0),gamePoints=Number(game.team_score ?? game.teamScore);
  if (!Number.isFinite(gamePoints) || points!==gamePoints) throw new Error(`Suma de puntos (${points}) distinta del marcador guardado (${gamePoints}). Corrige primero el acta o el marcador mediante el editor autorizado.`);
  const differences=rows.filter(row=>JSON.stringify({starter:row.starter,...canonical(row)})!==JSON.stringify({starter:Boolean(existing.get(row.player_id).starter),...canonical(existing.get(row.player_id))})).length;
  return {rows,points,differences,baseline:snapshotRows(stats),gameId:id(game.id),teamSeasonId:id(game.team_season_id ?? game.teamSeasonId)};
}

/** Una sola transacción PostgREST; nunca toca juegos, períodos, eventos ni PPG histórico. */
export async function commitBoxScoreImport({preview,client,auth,game,eligiblePlayers,seasonStatus="ACTIVE"}={}) {
  if (!client?.from || !preview?.rows?.length || !game?.id || id(game.id)!==id(preview.gameId) || id(game.team_season_id ?? game.teamSeasonId)!==id(preview.teamSeasonId)) throw new Error("Vista previa inválida o fuera de temporada.");
  const scope={teamId:game.team_id ?? game.teamId,teamSeasonId:preview.teamSeasonId,gameId:preview.gameId};
  if (!auth?.can?.(Permission.EDIT_BOXSCORE,scope) || !auth?.can?.(Permission.EDIT_GAME,scope)) throw new Error("No tienes permisos para importar y modificar esta acta.");
  if (GameLockService.isLocked(game) || String(seasonStatus).toUpperCase()==="FROZEN") throw new Error("El partido o la temporada están bloqueados.");
  const {data:freshGame,error:gameError}=await client.from("games").select("*").eq("id",game.id).single();
  if (gameError || !freshGame || id(freshGame.team_id)!==id(scope.teamId) || id(freshGame.team_season_id)!==preview.teamSeasonId || GameLockService.isLocked(freshGame) || Number(freshGame.team_score)!==preview.points) throw new Error("El partido ha cambiado, no se importa.");
  const {data:events,error:eventsError}=await client.from("game_events").select("id").eq("game_id",game.id).limit(1);
  if (eventsError || !Array.isArray(events)) throw new Error("No se ha podido comprobar el play-by-play; importación cancelada.");
  if (events.length) throw new Error("Este partido tiene jugadas registradas. Modifica el play-by-play para mantener coherente el BoxScore; la importación no lo sobrescribe.");
  const {data:latest,error:latestError}=await client.from("player_game_stats").select("*").eq("game_id",game.id).limit(1001);
  if (latestError || !Array.isArray(latest) || latest.length===1001 || snapshotRows(latest)!==preview.baseline) throw new Error("El acta ha cambiado desde la vista previa. Vuelve a importar el archivo.");
  validateBoxScoreImport([BOX_HEADERS,...preview.rows.map(row=>BOX_HEADERS.map(key=>key==="jugador"?"Jugador":key==="starter"?(row.starter?"1":"0"):key==="team_season_id"?preview.teamSeasonId:row[key] ?? ""))],{game:freshGame,stats:latest,eligiblePlayers});
  // Guardado de filas por lote: PostgREST/RLS y triggers siguen siendo la autoridad.
  if (!auth.can(Permission.EDIT_BOXSCORE,scope) || !auth.can(Permission.EDIT_GAME,scope)) throw new Error("Permisos revocados: importación cancelada.");
  const {error}=await client.from("player_game_stats").upsert(preview.rows,{onConflict:"game_id,player_id"});
  if (error) throw new Error(`No se ha importado el BoxScore: ${error.message}`);
  return {count:preview.rows.length,gameId:preview.gameId};
}
