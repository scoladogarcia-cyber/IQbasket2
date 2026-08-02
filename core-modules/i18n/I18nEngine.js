/**
 * @fileoverview Motor de Internacionalización Dinámico para IQ Basket.
 * @description Inicia por defecto en Inglés ('en') y permite cargar diccionarios 
 * personalizados directamente desde la base de datos sin cadenas hardcodeadas.
 */

import { I18N_CONFIG } from "../../config/i18n.config.js";

export class I18nEngine {
  constructor() {
    /** Diccionarios cargados en memoria */
    this.locales = {};
    this.currentLanguage = this._loadSavedLanguage();
  }

  /**
   * Carga el idioma guardado en el navegador o asigna 'en' por defecto.
   * @private
   * @returns {string}
   */
  _loadSavedLanguage() {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(I18N_CONFIG.storageKey) || I18N_CONFIG.defaultLanguage;
    }
    return I18N_CONFIG.defaultLanguage;
  }

  /**
   * Carga en memoria las traducciones recuperadas dinámicamente desde BBDD.
   * @param {string} langCode - Código ISO del idioma (ej. 'es', 'en', 'ca').
   * @param {Array<Object>} translationRecords - Registros { key, value } traídos de BBDD.
   */
  loadLanguageFromDB(langCode, translationRecords) {
    const dict = {};
    translationRecords.forEach((record) => {
      dict[record.key] = record.value;
    });
    this.locales[langCode] = dict;
  }

  /**
   * Cambia el idioma activo de la aplicación.
   * @param {string} langCode - Código del idioma objetivo.
   */
  setLanguage(langCode) {
    this.currentLanguage = langCode;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(I18N_CONFIG.storageKey, langCode);
    }
  }

  /**
   * Traduce una clave al idioma activo reemplazando parámetros dinámicos.
   * @param {string} key - Clave del texto.
   * @param {Object} [params={}] - Parámetros de sustitución ({ number: 1 }).
   * @returns {string} Texto traducido o la clave si aún no está registrada.
   */
  t(key, params = {}) {
    const dict = this.locales[this.currentLanguage] || this.locales[I18N_CONFIG.defaultLanguage] || {};
    let text = dict[key] || key;

    Object.keys(params).forEach((paramKey) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), params[paramKey]);
    });

    return text;
  }
}

/** Instancia única exportada (Singleton) */
export const i18n = new I18nEngine();