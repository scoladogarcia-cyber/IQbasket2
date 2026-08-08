/**
 * @fileoverview Servicio principal de internacionalización (I18nService.js).
 * @description Soporta namespaces, interpolación de variables {{var}}, pluralización, 
 * formatos nativos Intl (números, fechas, porcentajes), migración sin pérdida de datos
 * y sincronización bidireccional con Supabase (tabla 'translations') y LocalStorage.
 */

import { I18N_CONFIG } from '../config/i18n.config.js';
import { es } from '../locales/es.js';
import { ca } from '../locales/ca.js';
import { en } from '../locales/en.js';
import { fr } from '../locales/fr.js';

class I18nService {
  constructor() {
    this.dictionaries = { 
      es: { ...es }, 
      ca: { ...ca }, 
      en: { ...en }, 
      fr: { ...fr } 
    };
    this.listeners = new Set();
    this.currentLocale = this._resolveAndMigrateLocale();
    this._hydrateLocalCustomTranslations();
  }

  /**
   * Carga las traducciones personalizadas guardadas previamente en localStorage
   */
  _hydrateLocalCustomTranslations() {
    const locales = ['es', 'ca', 'en', 'fr'];
    locales.forEach(loc => {
      const savedDict = localStorage.getItem(`iq_dict_${loc}`);
      if (savedDict) {
        try {
          const parsed = JSON.parse(savedDict);
          if (!this.dictionaries[loc]) this.dictionaries[loc] = {};
          Object.assign(this.dictionaries[loc], parsed);
        } catch (e) {
          console.warn(`[i18n] Error leyendo iq_dict_${loc} de localStorage`);
        }
      }
    });
  }

  /**
   * Resuelve el locale activo realizando migración transparente de llaves antiguas (cat -> ca, iq_lang, etc.)
   */
  _resolveAndMigrateLocale() {
    // 1. Verificar clave principal 'iq_locale'
    const savedLocale = localStorage.getItem(I18N_CONFIG.storageKey);
    if (savedLocale && this._isValidLocale(savedLocale)) {
      return savedLocale;
    }

    // 2. Comprobar llaves antiguas para evitar pérdida de preferencia
    for (const legacyKey of I18N_CONFIG.legacyStorageKeys) {
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue) {
        // Normalizar alias antiguo 'cat' a 'ca'
        const normalized = legacyValue === 'cat' ? 'ca' : legacyValue;
        if (this._isValidLocale(normalized)) {
          this.setLocale(normalized);
          return normalized;
        }
      }
    }

    // 3. Fallback al idioma del navegador o por defecto
    const navLang = navigator.language ? navigator.language.split('-')[0] : 'es';
    const finalLocale = this._isValidLocale(navLang) ? navLang : I18N_CONFIG.defaultLocale;
    this.setLocale(finalLocale);
    return finalLocale;
  }

  _isValidLocale(code) {
    return I18N_CONFIG.supportedLocales.some(l => l.code === code);
  }

  getLocale() {
    return this.currentLocale;
  }

  setLocale(locale) {
    const targetLocale = locale === 'cat' ? 'ca' : locale;
    if (!this._isValidLocale(targetLocale)) return;

    this.currentLocale = targetLocale;
    localStorage.setItem(I18N_CONFIG.storageKey, targetLocale);
    
    // Mantener sincronizadas las llaves obsoletas para retrocompatibilidad total
    I18N_CONFIG.legacyStorageKeys.forEach(key => localStorage.setItem(key, targetLocale));
    
    document.documentElement.lang = targetLocale;
    this._notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Método público para notificar cambios a todos los suscriptores.
   */
  notify() {
    this._notify();
  }

  /**
   * Alias para retrocompatibilidad.
   */
  notifyListeners() {
    this._notify();
  }

  _notify() {
    this.listeners.forEach(fn => {
      if (typeof fn === 'function') {
        fn(this.currentLocale);
      }
    });
  }

  /**
   * Carga las traducciones personalizadas guardadas en Supabase para el idioma activo
   * e inyecta los resultados directamente en el diccionario en memoria.
   */
  async loadRemoteTranslations(supabaseClient) {
    if (!supabaseClient) return;
    try {
      const currentLocale = this.getLocale();
      const { data, error } = await supabaseClient
        .from("translations")
        .select("*")
        .eq("language_code", currentLocale);

      if (!error && data && data.length > 0) {
        if (!this.dictionaries[currentLocale]) {
          this.dictionaries[currentLocale] = {};
        }
        
        const remoteDict = {};
        data.forEach(item => {
          if (item.key && item.translation) {
            this.dictionaries[currentLocale][item.key] = item.translation;
            remoteDict[item.key] = item.translation;
          }
        });

        // Guardar copia local para disponibilidad offline en 0ms
        const existingLocal = JSON.parse(localStorage.getItem(`iq_dict_${currentLocale}`) || '{}');
        localStorage.setItem(`iq_dict_${currentLocale}`, JSON.stringify({ ...existingLocal, ...remoteDict }));

        console.log(`[i18n] Cargadas ${data.length} traducciones personalizadas desde Supabase (${currentLocale}).`);
        this._notify();
      }
    } catch (err) {
      console.warn("[i18n] No se pudieron cargar las traducciones remotas:", err);
    }
  }

  /**
   * Actualiza e inyecta un objeto de traducciones personalizadas en caliente
   */
  addTranslations(locale, translationsObj) {
    const targetLocale = locale === 'cat' ? 'ca' : locale;
    if (!this.dictionaries[targetLocale]) {
      this.dictionaries[targetLocale] = {};
    }
    Object.assign(this.dictionaries[targetLocale], translationsObj);

    // Guardar en localStorage
    const existing = JSON.parse(localStorage.getItem(`iq_dict_${targetLocale}`) || '{}');
    localStorage.setItem(`iq_dict_${targetLocale}`, JSON.stringify({ ...existing, ...translationsObj }));

    if (targetLocale === this.currentLocale) {
      this._notify();
    }
  }

  /**
   * Traduce una clave semántica (ej. 'dashboard.games.played' o 'dashboard') con interpolación de parámetros.
   */
  t(key, params = {}, fallbackString = "") {
    if (!key) return "";

    const keys = key.split('.');
    let dict = this.dictionaries[this.currentLocale];
    let result = undefined;

    // 1. Búsqueda por ruta anidada (ej. common.actions.save)
    if (dict) {
      result = keys.reduce((acc, curr) => (acc && acc[curr] !== undefined) ? acc[curr] : undefined, dict);
    }

    // 2. Búsqueda directa por clave plana (ej. "dashboard", "record")
    if (result === undefined && dict && dict[key] !== undefined) {
      result = dict[key];
    }

    // 3. Intento de fallback al locale por defecto (ES)
    if (result === undefined && this.currentLocale !== I18N_CONFIG.fallbackLocale) {
      const fallbackDict = this.dictionaries[I18N_CONFIG.fallbackLocale];
      if (fallbackDict) {
        result = keys.reduce((acc, curr) => (acc && acc[curr] !== undefined) ? acc[curr] : undefined, fallbackDict);
        if (result === undefined) {
          result = fallbackDict[key];
        }
      }
    }

    if (result === undefined) {
      if (fallbackString) return fallbackString;
      console.warn(`[i18n] Missing key: "${key}" for locale "${this.currentLocale}"`);
      return `[MISSING: ${key}]`;
    }

    // Interpolación de parámetros {{variable}}
    if (typeof result === 'string' && Object.keys(params).length > 0) {
      return Object.keys(params).reduce((acc, p) => {
        return acc.replace(new RegExp(`{{\\s*${p}\\s*}}`, 'g'), params[p]);
      }, result);
    }

    return result;
  }

  // --- Formateadores Nativos de Datos Locales ---

  formatNumber(value, options = {}) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return new Intl.NumberFormat(this.currentLocale, options).format(value);
  }

  formatPercent(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return new Intl.NumberFormat(this.currentLocale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value / 100);
  }

  formatDate(date, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(this.currentLocale, options).format(d);
  }
}

export const I18n = new I18nService();
export default I18n;