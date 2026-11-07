/**
 * @fileoverview Strict date-scoped report selection without changing saved games.
 * @description Filters the already authorized game set. Never silently includes
 * undated games when a date filter is active; callers must show the error.
 */
const d=v=>String(v??"").trim();
const validDate=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const dt=new Date(value+"T00:00:00.000Z");
  return !Number.isNaN(dt.getTime())&&dt.toISOString().slice(0,10)===value;
};
export function filterReportGamesByDateV78(games,{fromDate="",toDate=""}={}){
  if(!Array.isArray(games)||games.length>200)throw new Error("Selección de partidos no válida.");
  const from=d(fromDate),to=d(toDate);
  if((from&&!validDate(from))||(to&&!validDate(to))||(from&&to&&from>to))
    throw new Error("Rango de fechas de informe no válido.");
  const seen=new Set();
  return games.filter(game=>{
    const id=d(game?.id);
    if(!id||seen.has(id))throw new Error("Partidos sin identificador o duplicados.");
    seen.add(id);
    const gameDate=d(game?.date??game?.game_date).slice(0,10);
    if((from||to)&&!validDate(gameDate))
      throw new Error("Partido sin fecha verificable dentro de la selección.");
    return (!from||gameDate>=from)&&(!to||gameDate<=to);
  });
}
