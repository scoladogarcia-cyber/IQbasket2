import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { refreshGameBoxScore } from "../services/games/GameBoxScoreFreshReadService.js";

const GAME_ID = "b91d2b4a-5cd7-4f0e-854c-fbecda9e6cce";
const OTHER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const liveGame = { id: GAME_ID, team_score: 52, opponent_score: 46 };

function store(game = liveGame) {
  return {
    playerGameStats: [{ game_id: OTHER_ID, player_id: PLAYER_ID, points: 6 }],
    getGames() { return [game]; },
    getPlayerGameStats(_playerId, id) {
      return this.playerGameStats.filter(row => row.game_id === id);
    },
    _normalizeStat(row) { return { ...row, normalized: true }; }
  };
}
function client(result) {
  const reads = [];
  return {
    reads,
    from(table) {
      reads.push({ table });
      return {
        select(columns) {
          reads[0].columns = columns;
          return {
            async eq(field, value) {
              reads[0].filter = { field, value };
              return result;
            }
          };
        }
      };
    }
  };
}

// El partido real tiene 10 filas y 52 puntos; el refresco sustituye sólo las
// filas de ese game_id y mantiene la estadística de otro partido sin tocarla.
const tenStats = Array.from({ length: 10 }, (_, index) => ({
  game_id: GAME_ID,
  player_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  points: index === 0 ? 52 : 0,
  minutes: 20
}));
const current = store();
current.playerGameStats.push({ game_id: GAME_ID, player_id: PLAYER_ID, points: 0 });
const source = client({ data: tenStats, error: null });
assert.equal(await refreshGameBoxScore({ supabase: source, dataStore: current, gameId: GAME_ID }), true);
assert.deepEqual(source.reads, [{ table: "player_game_stats", columns: "*", filter: { field: "game_id", value: GAME_ID } }]);
assert.equal(current.playerGameStats.filter(row => row.game_id === GAME_ID).length, 10);
assert.equal(current.playerGameStats.filter(row => row.game_id === GAME_ID).reduce((sum, row) => sum + row.points, 0), 52);
assert.equal(current.playerGameStats.find(row => row.game_id === OTHER_ID).points, 6);
assert.equal(current.playerGameStats.find(row => row.game_id === GAME_ID).normalized, true);

// Una lectura fallida, o una respuesta vacía que contradice el tanteo de un
// partido con puntos, NO puede borrar las estadísticas que ya estén en caché.
for (const result of [
  { data: null, error: { message: "network" } },
  { data: [], error: null }
]) {
  const protectedStore = store();
  protectedStore.playerGameStats.push(...tenStats);
  const before = structuredClone(protectedStore.playerGameStats);
  await assert.rejects(() => refreshGameBoxScore({
    supabase: client(result), dataStore: protectedStore, gameId: GAME_ID
  }));
  assert.deepEqual(protectedStore.playerGameStats, before);
}

// Un partido sin puntos ni estadísticas sí admite cero filas de forma legítima.
const unplayed = store({ ...liveGame, team_score: 0 });
assert.equal(await refreshGameBoxScore({
  supabase: client({ data: [], error: null }), dataStore: unplayed, gameId: GAME_ID
}), true);
assert.equal(unplayed.playerGameStats.length, 1);

// Un partido ajeno al contexto no dispara una consulta transversal: el flujo
// de snapshot delegado del BoxScore mantiene la autorización existente.
const outside = store();
const outsideClient = client({ data: tenStats, error: null });
assert.equal(await refreshGameBoxScore({
  supabase: outsideClient, dataStore: outside, gameId: OTHER_ID
}), false);
assert.equal(outsideClient.reads.length, 0);

const sourceView = await readFile(new URL("../views/games/GameBoxScoreIntelligenceV46View.js", import.meta.url), "utf8");
assert.match(sourceView, /await refreshGameBoxScore\(/);
assert.match(sourceView, /return super\.render\(containerId, targetGameId\)/);
assert.match(sourceView, /No se ha modificado ningún dato/);
assert.match(sourceView, /isConfirmedBoxScoreSaveRerender/);
console.log("V47 persisted acta read-only freshness regression OK");
