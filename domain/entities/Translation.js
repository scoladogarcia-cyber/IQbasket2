/**
 * @fileoverview Entidad del Dominio: Traducción Dinámica.
 * @description Guarda la traducción individual de una clave para un idioma dado.
 */

export class Translation {
  constructor({
    id = null,
    langCode = "en",
    langName = "English",
    key = "",
    value = "",
    createdAt = null,
    updatedAt = null
  } = {}) {
    this.id = id;
    this.langCode = langCode;
    this.langName = langName;
    this.key = key;
    this.value = value;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  toJSON() {
    return {
      id: this.id,
      lang_code: this.langCode,
      lang_name: this.langName,
      key: this.key,
      value: this.value,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }
}