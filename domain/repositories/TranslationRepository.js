import { DATABASE_CONFIG } from "../../config/database.config.js";
import { Translation } from "../entities/Translation.js";

export class TranslationRepository {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.collection = DATABASE_CONFIG.collections.TRANSLATIONS;
  }

  async getByLanguage(langCode) {
    const rawItems = await this.db.query(this.collection, { lang_code: langCode });
    return rawItems.map((item) => new Translation(item));
  }

  async save(translationInstance) {
    const data = translationInstance.toJSON();
    const savedData = await this.db.save(this.collection, data);
    return new Translation(savedData);
  }

  async saveBatch(translationsArray) {
    for (const item of translationsArray) {
      await this.save(item);
    }
    return true;
  }
}