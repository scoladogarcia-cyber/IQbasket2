/**
 * @fileoverview Fuente única del informe final bajo alcance de partido, RLS y RBAC.
 * @description Lectura fresca, sin escrituras ni estadísticas añadidas.
 */
import { refreshGameBoxScore } from "./GameBoxScoreFreshReadService.js";
import { ReportAccessPolicy, ReportType } from "../../security/ReportAccessPolicy.js";
import { renderFinalGameReportV49 } from "../../views/reports/GameFinalReportV49Renderer.js";

/** @param {{supabase:object,dataStore:object,auth:object,gameId:string}} input */
export async function loadAuthorizedFinalGameReport({ supabase, dataStore, auth, gameId }) {
  if (!supabase?.from || !dataStore?.getGames) throw new Error("Servicio de informes no disponible.");
  const localGame = (dataStore.getGames() || []).find(g => String(g.id) === String(gameId));
  if (!localGame) throw new Error("Partido no incluido en el contexto autorizado.");
  const context = { teamId: localGame.team_id || localGame.teamId, teamSeasonId: localGame.team_season_id || localGame.teamSeasonId, gameId: localGame.id };
  const policy = new ReportAccessPolicy(auth);
  if (!policy.canView(ReportType.GAME_STATS, context)) throw new Error("No tienes permiso para consultar este informe.");
  const { data: game, error: gameError } = await supabase.from("games").select("*").eq("id", gameId).single();
  if (gameError || !game || String(game.team_id) !== String(context.teamId)) throw new Error("No se pudo consultar el partido autorizado.");
  const gameContext = { ...context, teamSeasonId: game.team_season_id || context.teamSeasonId };
  if (!policy.canView(ReportType.GAME_STATS, gameContext)) throw new Error("El acceso a esta temporada no está autorizado.");
  const refreshed = await refreshGameBoxScore({ supabase, dataStore, gameId });
  if (!refreshed) throw new Error("No se pudo recuperar el acta persistida de este partido.");
  const allStats = dataStore.getPlayerGameStats(null, gameId) || [];
  const players = policy.filterPlayers(dataStore.getSeasonParticipantPlayers?.(context.teamId) || dataStore.getPlayers?.(context.teamId) || [], gameContext);
  const allowed = new Set(players.map(player => String(player.id)));
  const stats = allStats.filter(row => allowed.has(String(row.player_id ?? row.playerId)));
  if (allStats.length && stats.length === 0) throw new Error("No hay estadísticas de jugadores dentro del alcance autorizado.");
  const [{data: periods,error: periodsError},{data: aggregate,error: aggregateError}] = await Promise.all([
    supabase.from("game_period_scores").select("*").eq("game_id",gameId).order("period_number",{ascending:true}),
    supabase.from("team_game_stats").select("*").eq("game_id",gameId).maybeSingle()
  ]);
  if (periodsError) throw new Error("No se han podido recuperar los parciales; no se mostrará un informe incompleto.");
  if (aggregateError) throw new Error("No se han podido consultar los agregados rivales de este partido.");
  let events = [], eventsAvailable = true;
  try {
    const response = await supabase.from("game_events")
      .select("game_id,period,action_type,points,made,coord_x,coord_y,shot_zone")
      .eq("game_id",gameId).limit(5000);
    if (response.error || !Array.isArray(response.data) || response.data.length === 5000) throw new Error("Eventos no disponibles o incompletos");
    events = response.data;
  } catch (error) {
    console.warn("[FinalReport] Eventos espaciales no disponibles:",error);
    eventsAvailable = false;
  }
  const html = renderFinalGameReportV49({
    game, teamName: dataStore.getTeamById?.(context.teamId)?.name || "Nuestro equipo", players, stats,
    teamStats: aggregate || null, periods: periods || [], events, eventsAvailable,
    completeRoster: stats.length === allStats.length
  });
  return { html, game, context: gameContext, policy };
}
