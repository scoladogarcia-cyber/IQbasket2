import { DATABASE_CONFIG } from "../../config/database.config.js";
import { Team } from "../entities/Team.js";

export class TeamRepository {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.collection = DATABASE_CONFIG.collections.TEAMS;
  }

  async getAll() {
    const rawItems = await this.db.getAll(this.collection);
    return rawItems.map((item) => new Team(item));
  }

  async getById(id) {
    const item = await this.db.getById(this.collection, id);
    return item ? new Team(item) : null;
  }

  async save(teamInstance) {
    const data = teamInstance.toJSON();
    const savedData = await this.db.save(this.collection, data);
    return new Team(savedData);
  }

  async update(id, teamInstance) {
    const data = teamInstance.toJSON();
    const updatedData = await this.db.update(this.collection, id, data);
    return new Team(updatedData);
  }

  async delete(id) {
    return await this.db.delete(this.collection, id);
  }
}