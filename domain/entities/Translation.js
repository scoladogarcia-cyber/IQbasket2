/**
 * @fileoverview Entidad del Dominio: Translation (Traducción Dinámica).
 * @description Mapeo exacto con la tabla `translations` de Supabase/PostgreSQL.
 * 
 * Columnas de persistencia:
 * - `key` (PK compuesta): Clave única jerárquica o semántica.
 * - `language_code` (PK compuesta): Código de idioma ISO ('es', 'ca', 'en', 'fr') con resolución de alias ('cat' -> 'ca').
 * - `translation`: Texto traducido final.
 * - `created_at` / `updated_at`: Marcas de tiempo de auditoría.
 */

export class Translation {
  /**
   * Crea una instancia de Translation.
   * @param {Object} params - Parámetros de inicialización.
   * @param {string} [params.key=""] - Clave del texto (ej. "stats.pir", "heatmap.filter_period").
   * @param {string} [params.languageCode="es"] - Código de idioma ISO ('es', 'ca', 'cat', 'en', 'fr').
   * @param {string|null} [params.langCode=null] - Alias de compatibilidad para languageCode.
   * @param {string} [params.translation=""] - Texto traducido.
   * @param {string|null} [params.value=null] - Alias de compatibilidad para translation.
   * @param {string|null} [params.createdAt=null] - Timestamp ISO de creación.
   * @param {string|null} [params.updatedAt=null] - Timestamp ISO de actualización.
   */
  constructor({
    key = "",
    languageCode = "es",
    langCode = null,
    translation = "",
    value = null,
    createdAt = null,
    updatedAt = null
  } = {}) {
    this.key = key ? String(key).trim() : "";

    // Normalización de código de idioma (mapeo 'cat' -> 'ca')
    const rawCode = (languageCode || langCode || "es").trim().toLowerCase();
    this.languageCode = rawCode === "cat" ? "ca" : rawCode;

    // Asignación segura del texto con soporte de alias
    const rawText = translation !== undefined && translation !== null 
      ? translation 
      : (value !== null && value !== undefined ? value : "");
    this.translation = String(rawText);

    // Auditoría temporal
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  // =========================================================================
  // GETTERS & SETTERS DE COMPATIBILIDAD
  // =========================================================================

  /**
   * Retorna el texto traducido (alias de compatibilidad con código heredado).
   * @returns {string}
   */
  get value() {
    return this.translation;
  }

  /**
   * Actualiza el texto traducido y refresca el timestamp.
   * @param {string} val
   */
  set value(val) {
    this.translation = String(val ?? "");
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Retorna el código de idioma normalizado.
   * @returns {string}
   */
  get langCode() {
    return this.languageCode;
  }

  /**
   * Deriva la categoría o namespace a partir del prefijo de la clave (ej: "heatmap.paint" -> "heatmap").
   * @returns {string}
   */
  get category() {
    if (!this.key || !this.key.includes(".")) return "general";
    return this.key.split(".")[0];
  }

  /**
   * Actualiza el valor traducido.
   * @param {string} newText
   */
  setTranslation(newText) {
    this.translation = String(newText ?? "");
    this.updatedAt = new Date().toISOString();
  }

  // =========================================================================
  // SERIALIZACIÓN Y PARSEO (SUPABASE & LOCAL STORAGE)
  // =========================================================================

  /**
   * Serializa la entidad al formato exacto de la tabla `translations` de Supabase.
   * @returns {Object} { key, language_code, translation, created_at, updated_at }
   */
  toJSON() {
    return {
      key: this.key,
      language_code: this.languageCode,
      translation: this.translation,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  /**
   * Reconstruye una instancia de Translation desde una fila de base de datos o JSON.
   * @param {Object} row - Fila con columnas en snake_case o camelCase.
   * @returns {Translation}
   */
  static fromJSON(row = {}) {
    return new Translation({
      key: row.key,
      languageCode: row.language_code ?? row.languageCode ?? row.lang_code ?? row.langCode,
      translation: row.translation ?? row.value,
      createdAt: row.created_at ?? row.createdAt,
      updatedAt: row.updated_at ?? row.updatedAt
    });
  }
}