/**
 * @fileoverview Servicio Principal de Internacionalización: I18nService.
 * @description Orquesta la resolución, detección de locale del sistema, sincronización con
 * Supabase Cloud (`translations`) e interpolación de variables.
 * 
 * Reglas de diseño:
 * 1. Prioridad en cascada: BBDD Supabase/LocalStorage (0ms) -> Diccionarios Estáticos -> Fallback 'es' -> Clave.
 * 2. Soporte nativo para esquemas planos y rutas anidadas (`stats.pir`, `heatmap.paint_badge`).
 * 3. Normalización transparente de alias `cat` y `ca`.
 * 4. Formateo reactivo nativo de números, porcentajes y fechas según el locale activo.
 */

import { I18N_CONFIG } from "../config/i18n.config.js";
import { i18n } from "../core-modules/i18n/I18nEngine.js";

class I18nService {
  constructor() {
    this.dictionaries = {
      es: {},
      ca: {},
      en: {},
      fr: {}
    };
    this.listeners = new Set();
    this.currentLocale = this._resolveAndMigrateLocale();
    this._hydrateLocalCustomTranslations();
  }

  // =========================================================================
  // 1. RESOLUCIÓN DE IDIOMA Y DETECCIÓN AUTOMÁTICA
  // =========================================================================

  /**
   * Resuelve el locale activo priorizando:
   * 1. Selección guardada en localStorage (`iq_locale`).
   * 2. Claves heredadas (`iq_language`, `language`, `locale`).
   * 3. Detección automática del navegador (`navigator.languages`).
   * 4. Fallback por defecto ('es').
   * @private
   * @returns {string}
   */
  _resolveAndMigrateLocale() {
    const storageKey = I18N_CONFIG?.storageKey || "iq_locale";

    if (typeof localStorage !== "undefined") {
      // 1. Clave principal
      const savedLocale = localStorage.getItem(storageKey);
      if (savedLocale && this._isValidLocale(this._normalizeLocale(savedLocale))) {
        return this._normalizeLocale(savedLocale);
      }

      // 2. Claves legacy
      const legacyKeys = I18N_CONFIG?.legacyStorageKeys || ["iq_language", "language", "locale", "iq_dict_lang"];
      for (const legKey of legacyKeys) {
        const legacyValue = localStorage.getItem(legKey);
        if (legacyValue) {
          const norm = this._normalizeLocale(legacyValue);
          if (this._isValidLocale(norm)) {
            this.setLocale(norm);
            return norm;
          }
        }
      }
    }

    // 3. Detección por navegador/sistema
    if (typeof navigator !== "undefined") {
      const systemLangs = navigator.languages || [navigator.language || navigator.userLanguage || "es"];
      for (const lang of systemLangs) {
        const code = String(lang).split("-")[0].toLowerCase();
        const normCode = this._normalizeLocale(code);
        if (this._isValidLocale(normCode)) {
          this.setLocale(normCode);
          return normCode;
        }
      }
    }

    // 4. Fallback por defecto
    const defaultLocale = I18N_CONFIG?.defaultLocale || "es";
    this.setLocale(defaultLocale);
    return defaultLocale;
  }

  /**
   * Normaliza 'cat' a 'ca'.
   * @private
   */
  _normalizeLocale(code) {
    const c = String(code || "es").trim().toLowerCase();
    return c === "cat" ? "ca" : c;
  }

  /**
   * Valida si el locale está soportado.
   * @private
   */
  _isValidLocale(code) {
    const supported = I18N_CONFIG?.supportedLocales?.map((l) => l.code) || ["es", "ca", "en", "fr"];
    return supported.includes(code);
  }

  // =========================================================================
  // 2. CACHÉ Y CARGA DE TRADUCCIONES
  // =========================================================================

  /**
   * Carga las traducciones guardadas en localStorage (copia de la BBDD).
   * @private
   */
  _hydrateLocalCustomTranslations() {
    if (typeof localStorage === "undefined") return;
    const locales = ["es", "ca", "en", "fr"];

    locales.forEach((loc) => {
      const savedDict = localStorage.getItem(`iq_dict_${loc}`);
      if (savedDict) {
        try {
          const parsed = JSON.parse(savedDict);
          if (!this.dictionaries[loc]) this.dictionaries[loc] = {};
          Object.assign(this.dictionaries[loc], parsed);
          // Inyecta en I18nEngine
          i18n.loadDictionary(loc, parsed);
        } catch {
          console.warn(`[I18nService] Error parseando iq_dict_${loc}`);
        }
      }
    });
  }

  /**
   * Carga las traducciones desde la tabla `translations` de Supabase en caliente.
   * @param {Object} supabaseClient - Cliente Supabase activo.
   */
  async loadRemoteTranslations(supabaseClient) {
    if (!supabaseClient) return;

    try {
      const current = this.getLocale();
      const queryLang = current === "ca" ? "cat" : current;

      const { data, error } = await supabaseClient
        .from("translations")
        .select("*")
        .or(`language_code.eq.${current},language_code.eq.${queryLang}`);

      if (!error && Array.isArray(data) && data.length > 0) {
        if (!this.dictionaries[current]) {
          this.dictionaries[current] = {};
        }

        const remoteDict = {};
        data.forEach((item) => {
          if (item.key && item.translation !== undefined) {
            this.dictionaries[current][item.key] = item.translation;
            remoteDict[item.key] = item.translation;
          }
        });

        // Actualizar caché de localStorage
        if (typeof localStorage !== "undefined") {
          const existing = JSON.parse(localStorage.getItem(`iq_dict_${current}`) || "{}");
          localStorage.setItem(`iq_dict_${current}`, JSON.stringify({ ...existing, ...remoteDict }));
        }

        i18n.loadDictionary(current, remoteDict);
        this.notify();
      }
    } catch (err) {
      console.warn("[I18nService] No se pudieron sincronizar traducciones desde Supabase:", err.message);
    }
  }

  /**
   * Agrega o sobrescribe un diccionario en tiempo real.
   * @param {string} locale - 'es', 'ca', 'cat', 'en', 'fr'.
   * @param {Record<string, string>} translationsObj
   */
  addTranslations(locale, translationsObj = {}) {
    const target = this._normalizeLocale(locale);
    if (!this.dictionaries[target]) {
      this.dictionaries[target] = {};
    }

    Object.assign(this.dictionaries[target], translationsObj);
    i18n.loadDictionary(target, translationsObj);

    if (typeof localStorage !== "undefined") {
      const existing = JSON.parse(localStorage.getItem(`iq_dict_${target}`) || "{}");
      localStorage.setItem(`iq_dict_${target}`, JSON.stringify({ ...existing, ...translationsObj }));
    }

    if (target === this.currentLocale) {
      this.notify();
    }
  }

  // =========================================================================
  // 3. GESTIÓN DEL LOCALE ACTIVO Y REACTIVIDAD
  // =========================================================================

  getLocale() {
    return this.currentLocale;
  }

  setLocale(locale) {
    const target = this._normalizeLocale(locale);
    if (!this._isValidLocale(target)) return;

    this.currentLocale = target;
    i18n.setLanguage(target);

    if (typeof localStorage !== "undefined") {
      const storageKey = I18N_CONFIG?.storageKey || "iq_locale";
      localStorage.setItem(storageKey, target);

      const legacyKeys = I18N_CONFIG?.legacyStorageKeys || ["iq_language", "language", "locale"];
      legacyKeys.forEach((k) => localStorage.setItem(k, target));
    }

    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.lang = target;
    }

    this.notify();
  }

  subscribe(listener) {
    if (typeof listener === "function") {
      this.listeners.add(listener);
    }
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.currentLocale);
      } catch (err) {
        console.error("[I18nService] Error en listener:", err);
      }
    });
  }

  // =========================================================================
  // 4. TRADUCCIÓN E INTERPOLACIÓN
  // =========================================================================

  /**
   * Traduce una clave con resolución por clave plana o anidada e interpolación.
   * @param {string} key - Clave (ej: "team", "stats.pir", "heatmap.filter_period").
   * @param {Record<string, any>} [params={}] - Parámetros dinámicos.
   * @param {string} [fallbackString=""] - Fallback textual si no existe.
   * @returns {string}
   */
  t(key, params = {}, fallbackString = "") {
    if (!key) return "";

    const dict = this.dictionaries[this.currentLocale] || {};
    let result = undefined;

    // 1. Clave plana directa (esquema BBDD)
    if (dict[key] !== undefined) {
      result = dict[key];
    }

    // 2. Búsqueda por ruta anidada semántica
    if (result === undefined && key.includes(".")) {
      const keys = key.split(".");
      result = keys.reduce((acc, curr) => (acc && acc[curr] !== undefined ? acc[curr] : undefined), dict);
    }

    // 3. Fallback a través de I18nEngine
    if (result === undefined) {
      const engineRes = i18n.t(key, params);
      if (engineRes && engineRes !== key) {
        return engineRes;
      }
    }

    // 4. Fallback al idioma base 'es'
    if (result === undefined && this.currentLocale !== "es") {
      const fallbackDict = this.dictionaries["es"] || {};
      if (fallbackDict[key] !== undefined) {
        result = fallbackDict[key];
      } else if (key.includes(".")) {
        const keys = key.split(".");
        result = keys.reduce((acc, curr) => (acc && acc[curr] !== undefined ? acc[curr] : undefined), fallbackDict);
      }
    }

    if (result === undefined) {
      return fallbackString || key;
    }

    // Interpolación de variables con sintaxis {{param}} o {param}
    if (typeof result === "string" && params && Object.keys(params).length > 0) {
      return Object.keys(params).reduce((acc, p) => {
        const val = params[p] !== undefined && params[p] !== null ? String(params[p]) : "";
        return acc
          .replace(new RegExp(`{{\\s*${p}\\s*}}`, "g"), val)
          .replace(new RegExp(`\\{${p}\\}`, "g"), val);
      }, result);
    }

    return String(result);
  }

  // =========================================================================
  // 5. FORMATEADORES NATIVOS SEGÚN LOCALE
  // =========================================================================

  formatNumber(value, options = {}) {
    if (value === null || value === undefined || isNaN(Number(value))) return "-";
    return new Intl.NumberFormat(this.currentLocale, options).format(Number(value));
  }

  formatPercent(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(Number(value))) return "-";
    return new Intl.NumberFormat(this.currentLocale, {
      style: "percent",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(Number(value) / 100);
  }

  formatDate(date, options = { year: "numeric", month: "short", day: "numeric" }) {
    if (!date) return "-";
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat(this.currentLocale, options).format(d);
  }
}

export const I18n = new I18nService();
export default I18n;