/**
 * Provider-agnostic repository for the global season catalog (v3).
 * Not wired into runtime until the v3 migration is validated.
 */
import { DATABASE_CONFIG } from "../../config/database.config.js";

export class SeasonCatalogRepository {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.collection = DATABASE_CONFIG.collections.SEASON_CATALOG;
  }

  async list({ status = null, includeTest = true } = {}) {
    const criteria = {};
    if (status) criteria.status = status;
    if (!includeTest) criteria.is_test = false;

    return this.db.query(this.collection, criteria, {
      orderBy: "start_date",
      ascending: false
    });
  }

  async getById(id) {
    if (!id) return null;
    return this.db.getById(this.collection, id);
  }

  async getByCode(code) {
    if (!code) return null;
    const rows = await this.db.query(this.collection, { code }, { limit: 1 });
    return rows[0] || null;
  }

  async save(season) {
    if (!season?.code || !season?.name) {
      throw new Error("SeasonCatalogRepository: code y name son obligatorios.");
    }
    return this.db.upsert(this.collection, season, "code");
  }
}

export default SeasonCatalogRepository;
