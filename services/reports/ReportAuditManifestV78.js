/**
 * @fileoverview Read-only, privacy-minimal export provenance for selected games.
 * @description Receives only fresh report objects authorized by the calling
 * ReportsView. No external calls, new DB tables or player names.
 */
const text=v=>String(v??"").trim();
const number=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const score=v=>{const n=number(v);return Number.isInteger(n)&&n>=0?n:null;};
export function buildReportAuditManifestV78(reports,{generatedAt=new Date().toISOString()}={}){
  if(!Array.isArray(reports)||!reports.length||reports.length>200)
    throw new Error("Debes seleccionar entre 1 y 200 partidos autorizados.");
  const seen=new Set(),games=[];
  let teamId=null,teamSeasonId=null;
  for(const report of reports){
    const g=report?.game;
    if(!g?.id||!g?.team_id||!g?.team_season_id||!Array.isArray(report.stats)||!Array.isArray(report.players))
      throw new Error("Partido sin identidad, temporada o acta verificable.");
    const gid=text(g.id),tid=text(g.team_id),sid=text(g.team_season_id);
    if(seen.has(gid))throw new Error("Un mismo partido aparece más de una vez.");
    if(teamId!==null&&(teamId!==tid||teamSeasonId!==sid))
      throw new Error("No se mezclan equipos o temporadas en una misma exportación.");
    teamId=tid;teamSeasonId=sid;seen.add(gid);
    const playerIds=new Set(),points=[];
    for(const row of report.stats){
      const pid=text(row?.player_id??row?.playerId);
      if(!pid||playerIds.has(pid))throw new Error("Filas de jugador duplicadas o incompletas.");
      playerIds.add(pid);
      points.push(score(row.points));
    }
    const roster=new Set(report.players.map(p=>text(p.id)));
    if([...playerIds].some(pid=>!roster.has(pid)))throw new Error("Acta con jugador fuera de la plantilla autorizada.");
    const teamScore=score(g.team_score);
    const sum=points.every(p=>p!==null)?points.reduce((a,b)=>a+b,0):null;
    games.push(Object.freeze({
      game_id:gid,date:text(g.date??g.game_date).slice(0,10)||null,
      status:text(g.status)||null,capture_revision:Number.isInteger(Number(g.capture_revision))?Number(g.capture_revision):null,
      team_score:teamScore,opponent_score:score(g.opponent_score),player_rows:points.length,
      players_with_recorded_points:points.filter(p=>p!==null).length,
      sum_player_points:sum,score_consistent:sum===null||teamScore===null?null:sum===teamScore
    }));
  }
  if(!Number.isFinite(Date.parse(generatedAt)))throw new Error("Fecha de exportación no válida.");
  return Object.freeze({schema:"IQB_REPORT_AUDIT_V78",generated_at:generatedAt,team_id:teamId,
    team_season_id:teamSeasonId,game_count:games.length,games:Object.freeze(games)});
}
export function serializeReportAuditManifestV78(reports,opts={}){
  return JSON.stringify(buildReportAuditManifestV78(reports,opts),null,2)+"\n";
}
