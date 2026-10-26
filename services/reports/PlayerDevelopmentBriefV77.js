/**
 * @fileoverview Player-specific, authorized selection report for games and season.
 * @description Pure renderer; source is fresh reports filtered by a caller's
 * GAME_STATS and PLAYER_STATS export permissions. Never exports another player,
 * never fabricates minutes, shots or performance improvements.
 */
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=v=>String(v??"");
const numeric=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const display=(v,d=0)=>numeric(v)?Number(v).toLocaleString("es-ES",{maximumFractionDigits:d}):"N/D";
const shots=(m,a)=>numeric(m)&&numeric(a)&&Number(a)>0&&Number(m)>=0&&Number(m)<=Number(a)
  ? 100*Number(m)/Number(a):null;
const gameDate=g=>String(g?.date??g?.game_date??"").slice(0,10);
export function filterPlayerReportGamesV77(reports,{fromDate="",toDate=""}={}){
  if(!Array.isArray(reports)||!reports.length||reports.length>150)
    throw new Error("Se necesita una selección de partidos autorizados.");
  const date=/^\d{4}-\d{2}-\d{2}$/;
  if((fromDate&&!date.test(fromDate))||(toDate&&!date.test(toDate))||(fromDate&&toDate&&fromDate>toDate))
    throw new Error("Rango de fechas de informe no válido.");
  const seen=new Set();
  return reports.filter(row=>{
    const g=row?.game,gid=key(g?.id),d=gameDate(g);
    if(!gid||seen.has(gid)||!Array.isArray(row?.stats)||!Array.isArray(row?.players))
      throw new Error("Datos del partido incompletos o duplicados.");
    seen.add(gid);
    if((fromDate||toDate)&&!date.test(d))
      throw new Error("Hay partidos sin fecha verificable en la selección.");
    return (!fromDate||d>=fromDate)&&(!toDate||d<=toDate);
  });
}
function field(row,alias){for(const k of alias){if(numeric(row?.[k]))return Number(row[k]);}return null;}
const get=(s,key)=>field(s,({points:["points"],minutes:["minutes"],
  made2:["fg2_made"],attempt2:["fg2_attempted"],made3:["fg3_made"],attempt3:["fg3_attempted"],
  ftm:["ft_made"],fta:["ft_attempted"],assists:["assists"],rebOff:["off_reb","rebounds_offensive"],
  rebDef:["def_reb","rebounds_defensive"],steals:["steals"],turnovers:["turnovers"]})[key]||[key]);
const entries=["points","minutes","made2","attempt2","made3","attempt3","ftm","fta","assists","rebOff","rebDef","steals","turnovers"];
function summaryOf(stats){
  const totals={},coverage={};let total=stats.length;
  for(const metric of entries){
    const values=stats.map(s=>s?get(s,metric):null),valid=values.filter(numeric);
    totals[metric]=valid.length===total?valid.reduce((a,v)=>a+v,0):null;
    coverage[metric]=valid.length;
  }
  return {totals,coverage,total};
}
/**
 * Profile is scoped to exactly one player ID. Records outside the current
 * game roster cannot contribute; absence of a boxscore remains N/D, not DNP.
 */
export function renderPlayerDevelopmentBriefV77({reports=[],player,fromDate="",toDate="",teamName="",seasonName=""}={}){
  const pid=key(player?.id);
  if(!pid)throw new Error("Jugador autorizado obligatorio.");
  const games=filterPlayerReportGamesV77(reports,{fromDate,toDate});
  if(!games.length)throw new Error("Ningún partido dentro del periodo seleccionado.");
  const rows=games.map(({game,stats,players})=>{
    const roster=players.find(x=>key(x.id)===pid);
    const matches=stats.filter(s=>key(s.player_id??s.playerId)===pid);
    if(matches.length>1)throw new Error("Estadística individual duplicada en el partido.");
    if(matches.length&&!roster)throw new Error("Estadística fuera de la plantilla autorizada.");
    return {game,stat:roster?matches[0]||null:null};
  });
  if(!rows.some(x=>x.stat))throw new Error("No hay actas individuales del jugador en esta selección.");
  const statList=rows.map(x=>x.stat);
  const {totals,coverage,total}=summaryOf(statList),percentage=(m,a)=>{
    if(!numeric(totals[m])||!numeric(totals[a]))return "N/D";
    return display(shots(totals[m],totals[a]),1)==="N/D"?"N/D":display(shots(totals[m],totals[a]),1)+" %";
  };
  const name=[player.first_name,player.last_name].filter(Boolean).join(" ").trim()||
    String(player.name||"Jugador");
  const maxPoints=Math.max(1,...rows.map(x=>x.stat?get(x.stat,"points"):null).filter(numeric));
  const tableRows=rows.map(({game,stat})=>{
    const p=stat?get(stat,"points"):null,m=stat?get(stat,"minutes"):null;
    const minutes=numeric(m)&&Number(m)===0?"0*":display(m,1);
    const bar=numeric(p)?'<span style="display:inline-block;background:#2563eb;height:7px;width:'+Math.max(0,Math.min(100,p/maxPoints*100))+'%;border-radius:4px" role="img" aria-label="'+escape(display(p))+' puntos"></span>':"";
    return '<tr><td>'+escape(gameDate(game)||"N/D")+'</td><td>'+escape(game.opponent||"Rival")+'</td>'+
      '<td>'+escape(display(p))+'</td><td>'+escape(minutes)+'</td>'+
      '<td>'+escape(stat?display(shots(get(stat,"made2"),get(stat,"attempt2")),1)+" %":"N/D").replace("N/D %","N/D")+'</td>'+
      '<td>'+escape(stat?display(shots(get(stat,"made3"),get(stat,"attempt3")),1)+" %":"N/D").replace("N/D %","N/D")+'</td>'+
      '<td style="min-width:70px">'+bar+'</td></tr>';
  }).join("");
  const metric=(label,value,source)=>'<article style="padding:12px;border:1px solid #cbd5e1;border-radius:12px"><small>'+escape(label)+'</small><strong style="display:block;font-size:22px">'+escape(value)+'</strong><small>Datos en '+source+"/"+total+" partidos</small></article>";
  const kpis=[
    metric("Puntos registrados",display(totals.points),coverage.points),
    metric("Minutos registrados",display(totals.minutes,1),coverage.minutes),
    metric("T2 acumulado",percentage("made2","attempt2"),Math.min(coverage.made2,coverage.attempt2)),
    metric("T3 acumulado",percentage("made3","attempt3"),Math.min(coverage.made3,coverage.attempt3)),
    metric("Tiros libres",percentage("ftm","fta"),Math.min(coverage.ftm,coverage.fta)),
    metric("Asistencias",display(totals.assists),coverage.assists)
  ].join("");
  return '<section class="iq-v77-player-report" style="font:14px system-ui,sans-serif;color:#0f172a;max-width:1100px;margin:auto;padding:20px">'+
    '<header style="border-bottom:3px solid #1e40af;padding-bottom:12px"><h1>Seguimiento individual · '+escape(name)+'</h1>'+
    '<p>'+escape(teamName)+' · '+escape(seasonName)+' · '+games.length+' partidos autorizados</p>'+
    '<p>Periodo: '+escape(fromDate||"Inicio de selección")+' → '+escape(toDate||"Fin de selección")+'</p></header>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:18px 0">'+kpis+'</div>'+
    '<h2>Partidos y producción</h2><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left">'+
    '<thead><tr><th>Fecha</th><th>Rival</th><th>PTS</th><th>MIN</th><th>T2 %</th><th>T3 %</th><th>PTS visual</th></tr></thead>'+
    '<tbody>'+tableRows+'</tbody></table></div>'+
    '<p style="font-size:12px;color:#475569">N/D significa dato ausente o porcentaje no definido por falta de intentos. '+ 
    'El 0* de minutos puede provenir de un histórico sin procedencia confirmada; compruébalo antes de interpretar participación. '+ 
    'La serie es descriptiva y no acredita por sí sola una mejora técnica ni causalidad con los entrenamientos.</p>'+
    '<style>@media print{.iq-v77-player-report{padding:3mm!important;font-size:11px!important}.iq-v77-player-report table{font-size:9px!important}}'+
    '.iq-v77-player-report td,.iq-v77-player-report th{padding:8px;border-bottom:1px solid #cbd5e1}</style></section>';
}
