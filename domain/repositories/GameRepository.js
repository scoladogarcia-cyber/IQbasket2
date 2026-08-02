import { DATABASE_CONFIG } from "../../config/database.config.js";
import { Game } from "../entities/Game.js";
import { PlayerGameStats } from "../entities/PlayerGameStats.js";

export class GameRepository {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.gamesCollection = DATABASE_CONFIG.collections.GAMES;
    this.playerStatsCollection = DATABASE_CONFIG.collections.PLAYER_GAME_STATS;
  }

  async getAll() {
    const rawItems = await this.db.getAll(this.gamesCollection);
    return rawItems.map((item) => new Game(item));
  }

  async getById(id) {
    const item = await this.db.getById(this.gamesCollection, id);
    return item ? new Game(item) : null;
  }

  async save(gameInstance) {
    const data = gameInstance.toJSON();
    const savedData = await this.db.save(this.gamesCollection, data);
    return new Game(savedData);
  }

  async update(id, gameInstance) {
    const data = gameInstance.toJSON();
    const updatedData = await this.db.update(this.gamesCollection, id, data);
    return new Game(updatedData);
  }

  async delete(id) {
    return await this.db.delete(this.gamesCollection, id);
  }

  // --- Métodos para estadísticas individuales de jugador por partido ---

  async savePlayerStats(playerStatsInstance) {
    const data = playerStatsInstance.toJSON();
    const savedData = await this.db.save(this.playerStatsCollection, data);
    return new PlayerGameStats(savedData);
  }

  async getPlayerStatsByGame(gameId) {
    const rawItems = await this.db.query(this.playerStatsCollection, { game_id: gameId });
    return rawItems.map((item) => new PlayerGameStats(item));
  }

  async getPlayerStatsByPlayer(playerId) {
    const rawItems = await this.db.query(this.playerStatsCollection, { player_id: playerId });
    return rawItems.map((item) => new PlayerGameStats(item));
  }
}