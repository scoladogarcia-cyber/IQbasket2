/**
 * @fileoverview Offline-first decorator for DataStore.saveGameAndStats.
 * @description Keeps DataStore permission/lifecycle validation and local save as
 * the authority, then converts connectivity-only remote failures into a durable
 * outbox item. Authorization/validation failures are always re-thrown.
 */

import { DataStore } from "../../services/DataStore.js";
import { GameSyncOutboxService, isTransientSyncError, GAME_SYNC_STATUS } from "../../services/offline/GameSyncOutboxService.js";

const PATCH_FLAG = Symbol.for("iqbasket.offlineGameSave.v1");

function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0;
    const value = char === "x" ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

function dispatch(detail) {
  window.dispatchEvent(new CustomEvent("iqbasket:game-sync-status", { detail }));
}

export function installOfflineFirstGameSave(dataStore = DataStore) {
  if (!dataStore || dataStore[PATCH_FLAG]) return dataStore?.offlineGameOutbox || null;
  if (typeof dataStore.saveGameAndStats !== "function") return null;

  const persistAggregate = dataStore.saveGameAndStats.bind(dataStore);
  const outbox = new GameSyncOutboxService({ persistAggregate });
  dataStore.offlineGameOutbox = outbox;
  dataStore[PATCH_FLAG] = true;

  dataStore.saveGameAndStats = async (gameData, statsList = [], periodScores = [], liveEvents = []) => {
    const preparedGame = {
      ...(gameData || {}),
      id: gameData?.id || uuid()
    };

    try {
      const gameId = await persistAggregate(preparedGame, statsList, periodScores, liveEvents);
      dispatch({ gameId, status: GAME_SYNC_STATUS.SYNCED, pending: false });
      // A successful foreground write is a good time to flush older pending games.
      void outbox.process();
      return gameId;
    } catch (error) {
      if (!isTransientSyncError(error)) throw error;

      await outbox.enqueue({
        game: preparedGame,
        playerStats: statsList,
        periodScores,
        gameEvents: liveEvents,
        error
      });

      // DataStore persists local state before entering the remote block. Notify
      // subscribers because the original method exits early when cloud fails.
      dataStore._notifyListeners?.();
      return preparedGame.id;
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      dispatch({ status: GAME_SYNC_STATUS.PENDING, pending: true, connectivity: "ONLINE" });
      void outbox.process({ force: true });
    });
    window.addEventListener("offline", () => {
      dispatch({ status: GAME_SYNC_STATUS.OFFLINE, pending: true, connectivity: "OFFLINE" });
    });
    queueMicrotask(() => void outbox.process());
  }

  return outbox;
}

if (typeof window !== "undefined") installOfflineFirstGameSave();

export default installOfflineFirstGameSave;
