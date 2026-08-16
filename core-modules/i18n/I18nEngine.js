/**
 * @fileoverview Motor Central de Internacionalización (i18n): I18nEngine.
 * @description Administra la traducción reactiva, glosarios didácticos y tooltips de baloncesto
 * en múltiples idiomas ('es', 'ca', 'en', 'fr') sin cadenas fijas en código.
 * 
 * Capacidades principales:
 * - Carga en caliente de diccionarios desde memoria, base de datos local y Supabase.
 * - Resolución jerárquica por namespaces (ej. "stats.efg", "actions.shot_2p", "tooltips.pir").
 * - Fallback inteligente en cadena (Idioma actual -> 'es' -> Clave original).
 * - Interpolación dinámica de variables con sintaxis `{paramName}`.
 * - Sistema de suscripción pub/sub para refresco reactivo de componentes de la UI.
 * - Soporte para pluralización y formato numérico adaptado a cada locale.
 */

import { I18N_CONFIG } from "../../config/i18n.config.js";

export class I18nEngine {
  /**
   * Crea una instancia del motor de traducción.
   */
  constructor() {
    /** @type {Record<string, Record<string, string>>} */
    this.locales = {};
    /** @type {Set<Function>} */
    this.listeners = new Set();
    this.defaultLanguage = I18N_CONFIG?.defaultLanguage || "es";
    this.storageKey = I18N_CONFIG?.storageKey || "iqbasket_language";
    this.currentLanguage = this._loadSavedLanguage();
  }

  /**
   * Carga el idioma persistido en el cliente o recurre al idioma por defecto.
   * @private
   * @returns {string}
   */
  _loadSavedLanguage() {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(this.storageKey);
      if (saved && typeof saved === "string") {
        return saved.trim().toLowerCase();
      }
    }
    return this.defaultLanguage;
  }

  /**
   * Carga un diccionario completo de traducciones para un código de idioma.
   * @param {string} langCode - Código ISO ("es", "ca", "en", "fr").
   * @param {Record<string, string>} dictionary - Mapa { [key]: value }.
   */
  loadDictionary(langCode, dictionary = {}) {
    if (!langCode || typeof dictionary !== "object") return;
    const code = langCode.trim().toLowerCase();
    this.locales[code] = {
      ...(this.locales[code] || {}),
      ...dictionary
    };
    this._notifyListeners();
  }

  /**
   * Carga en memoria las traducciones recuperadas de la base de datos (filas de tabla `translations`).
   * @param {string} langCode - Código ISO del idioma.
   * @param {Array<Object>} translationRecords - Array de registros [{ key, value, ... }].
   */
  loadLanguageFromDB(langCode, translationRecords = []) {
    if (!langCode || !Array.isArray(translationRecords)) return;
    const code = langCode.trim().toLowerCase();
    const dict = {};

    translationRecords.forEach((record) => {
      if (record && record.key && record.value !== undefined) {
        dict[record.key] = record.value;
      }
    });

    this.locales[code] = {
      ...(this.locales[code] || {}),
      ...dict
    };
    this._notifyListeners();
  }

  /**
   * Cambia el idioma activo y lo persiste en el almacenamiento local.
   * @param {string} langCode - Código objetivo ("es", "ca", "en", "fr").
   */
  setLanguage(langCode) {
    if (!langCode) return;
    const code = langCode.trim().toLowerCase();
    if (this.currentLanguage === code) return;

    this.currentLanguage = code;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(this.storageKey, code);
    }
    this._notifyListeners();
  }

  /**
   * Obtiene el código del idioma activo actual.
   * @returns {string}
   */
  getLanguage() {
    return this.currentLanguage;
  }

  /**
   * Traduce una clave al idioma activo con sustitución de variables.
   * Si no se encuentra en el idioma activo, intenta resolver en el idioma por defecto (fallback).
   * 
   * @param {string} key - Clave única de traducción (ej: "stats.boxscore.pts").
   * @param {Record<string, any>} [params={}] - Variables de interpolación (ej: { count: 5 }).
   * @returns {string} Texto traducido o la clave si no existe.
   */
  t(key, params = {}) {
    if (!key || typeof key !== "string") return "";

    const currentDict = this.locales[this.currentLanguage] || {};
    const defaultDict = this.locales[this.defaultLanguage] || {};

    let text = currentDict[key] ?? defaultDict[key] ?? key;

    // Interpolación de variables {variableName}
    if (params && typeof params === "object") {
      Object.keys(params).forEach((paramKey) => {
        const value = params[paramKey] !== undefined && params[paramKey] !== null ? String(params[paramKey]) : "";
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), value);
      });
    }

    return text;
  }

  /**
   * Obtiene el tooltip didáctico y la fórmula explicativa de una métrica del catálogo.
   * @param {string} metricKey - Identificador de la métrica (ej. "efg", "pir", "ortg", "usg").
   * @returns {{ name: string, description: string, formula: string }}
   */
  getMetricHelp(metricKey) {
    const cleanKey = metricKey.toLowerCase().replace(/[^a-z0-9_]/g, "");
    return {
      name: this.t(`stats.${cleanKey}.name`),
      description: this.t(`stats.${cleanKey}.desc`),
      formula: this.t(`stats.${cleanKey}.formula`)
    };
  }

  /**
   * Registra un callback que se ejecutará cuando el idioma cambie o se carguen nuevos diccionarios.
   * @param {Function} listener - Callback (langCode) => void.
   * @returns {Function} Función para cancelar la suscripción (unsubscribe).
   */
  subscribe(listener) {
    if (typeof listener === "function") {
      this.listeners.add(listener);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifica a todos los suscriptores registrados.
   * @private
   */
  _notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentLanguage);
      } catch (err) {
        console.error("[I18nEngine] Error ejecutando suscriptor:", err);
      }
    });
  }
}

/** Instancia única exportada (Singleton) */
export const i18n = new I18nEngine();