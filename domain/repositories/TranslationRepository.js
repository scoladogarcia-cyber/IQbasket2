/**
 * @fileoverview Repositorio del Dominio: TranslationRepository (Internacionalización y Diccionarios Dinámicos).
 * @description Capa de acceso a datos para la entidad `Translation`.
 * Permite cargar, sincronizar y almacenar en caché traducciones dinámicas, glosarios y tooltips
 * tácticos para soportar multiidioma (`es`, `ca`, `en`, `fr`) sin necesidad de hardcode.
 * 
 * Diseñado con soporte para:
 * - Consultas por idioma y namespace/categoría (`stats`, `actions`, `tooltips`, `ui`).
 * - Carga en lote eficiente (`saveBatch`) para sincronizaciones masivas.
 * - Soporte para traducciones personalizadas por club (`clubId`).
 * - Estrategia Local-First con control de versiones y marcas de tiempo.
 */

import { DATABASE_CONFIG } from "../../config/database.config.js";
import { Translation } from "../entities/Translation.js";

export class TranslationRepository {
  /**
   * Crea una instancia de TranslationRepository.
   * @param {Object} dbAdapter - Adaptador de base de datos (LocalStorageAdapter o SupabaseAdapter).
   */
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.collection = DATABASE_CONFIG.collections.TRANSLATIONS;
  }

  // =========================================================================
  // 1. MÉTODOS DE CONSULTA (FILTRADO POR IDIOMA, CATEGORÍA Y CLUB)
  // =========================================================================

  /**
   * Obtiene todas las traducciones registradas para un código de idioma.
   * @param {string} langCode - Código ISO del idioma ("es", "en", "ca", "fr").
   * @param {string|null} [clubId=null] - ID opcional del club para obtener traducciones personalizadas.
   * @returns {Promise<Array<Translation>>} Lista de instancias Translation.
   */
  async getByLanguage(langCode, clubId = null) {
    if (!langCode) return [];
    const normalizedCode = langCode.trim().toLowerCase();
    
    // Consulta base por código de idioma
    const criteria = { lang_code: normalizedCode };
    const rawItems = await this.db.query(this.collection, criteria);
    const allTranslations = (rawItems || []).map((item) => Translation.fromJSON(item));

    // Si se especifica un clubId, prioriza las traducciones personalizadas del club
    if (clubId) {
      const generalMap = new Map();
      const customList = [];

      for (const t of allTranslations) {
        if (t.clubId === clubId) {
          customList.push(t);
        } else if (!t.clubId) {
          generalMap.set(t.key, t);
        }
      }

      // Sobrescribe claves generales con las personalizadas del club
      for (const custom of customList) {
        generalMap.set(custom.key, custom);
      }

      return Array.from(generalMap.values());
    }

    return allTranslations;
  }

  /**
   * Obtiene un mapa clave-valor optimizado { [key]: value } para inyección rápida en I18nEngine.
   * @param {string} langCode - Código ISO del idioma.
   * @param {string|null} [clubId=null] - ID del club opcional.
   * @returns {Promise<Record<string, string>>} Diccionario clave-valor.
   */
  async getDictionaryByLanguage(langCode, clubId = null) {
    const list = await this.getByLanguage(langCode, clubId);
    const dictionary = {};
    for (const item of list) {
      dictionary[item.key] = item.value;
    }
    return dictionary;
  }

  /**
   * Obtiene traducciones filtradas por categoría/namespace (ej. "tooltips", "stats").
   * @param {string} langCode - Código ISO del idioma.
   * @param {string} category - Categoría a consultar.
   * @returns {Promise<Array<Translation>>}
   */
  async getByCategory(langCode, category) {
    if (!langCode || !category) return [];
    const normalizedCode = langCode.trim().toLowerCase();
    const rawItems = await this.db.query(this.collection, {
      lang_code: normalizedCode,
      category: category
    });
    return (rawItems || []).map((item) => Translation.fromJSON(item));
  }

  /**
   * Obtiene una traducción específica por clave e idioma.
   * @param {string} langCode - Código ISO del idioma.
   * @param {string} key - Clave jerárquica (ej. "stats.pir_tooltip").
   * @returns {Promise<Translation|null>}
   */
  async getByKey(langCode, key) {
    if (!langCode || !key) return null;
    const normalizedCode = langCode.trim().toLowerCase();
    const rawItems = await this.db.query(this.collection, {
      lang_code: normalizedCode,
      key: key.trim()
    });
    return rawItems && rawItems.length > 0 ? Translation.fromJSON(rawItems[0]) : null;
  }

  // =========================================================================
  // 2. MÉTODOS DE PERSISTENCIA Y SINCRONIZACIÓN
  // =========================================================================

  /**
   * Guarda o actualiza una traducción individual.
   * @param {Translation} translationInstance - Instancia de Translation.
   * @returns {Promise<Translation>} Instancia guardada.
   */
  async save(translationInstance) {
    if (!(translationInstance instanceof Translation)) {
      throw new Error("TranslationRepository.save: Se requiere una instancia válida de Translation");
    }
    const data = translationInstance.toJSON();
    const savedData = await this.db.save(this.collection, data);
    return Translation.fromJSON(savedData);
  }

  /**
   * Guarda o actualiza un conjunto de traducciones en lote (batch) de forma atómica y optimizada.
   * @param {Array<Translation>} translationsArray - Lista de instancias a persistir.
   * @returns {Promise<Array<Translation>>} Lista de traducciones guardadas.
   */
  async saveBatch(translationsArray = []) {
    if (!Array.isArray(translationsArray) || translationsArray.length === 0) {
      return [];
    }

    const serializedData = translationsArray.map((t) => (t instanceof Translation ? t.toJSON() : t));

    // Si el adaptador de base de datos soporta inserción por lotes nativa, se ejecuta en una única llamada
    if (typeof this.db.saveBatch === "function") {
      const saved = await this.db.saveBatch(this.collection, serializedData);
      return saved.map((item) => Translation.fromJSON(item));
    }

    // Fallback concurrente con Promise.all
    const promises = serializedData.map((data) => this.db.save(this.collection, data));
    const results = await Promise.all(promises);
    return results.map((item) => Translation.fromJSON(item));
  }

  /**
   * Elimina una traducción por su identificador único.
   * @param {string} id - UUID de la traducción.
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    if (!id) return false;
    return await this.db.delete(this.collection, id);
  }
}