import { DATABASE_CONFIG } from "../../config/database.config.js";
import { Player } from "../entities/Player.js";

export class PlayerRepository {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.collection = DATABASE_CONFIG.collections.PLAYERS;
  }

  async getAll() {
    const rawItems = await this.db.getAll(this.collection);
    return rawItems.map((item) => new Player(item));
  }

  async getById(id) {
    const item = await this.db.getById(this.collection, id);
    return item ? new Player(item) : null;
  }

  async getByTeamId(teamId) {
    const rawItems = await this.db.query(this.collection, { team_id: teamId });
    return rawItems.map((item) => new Player(item));
  }

  async save(playerInstance) {
    const data = playerInstance.toJSON();
    const savedData = await this.db.save(this.collection, data);
    return new Player(savedData);
  }

  async update(id, playerInstance) {
    const data = playerInstance.toJSON();
    const updatedData = await this.db.update(this.collection, id, data);
    return new Player(updatedData);
  }

  async delete(id) {
    return await this.db.delete(this.collection, id);
  }
}