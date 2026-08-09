/**
 * @fileoverview Servicio principal de internacionalización (I18nService.js).
 * @description Prioriza la lectura plana desde Supabase Cloud ('translations') sobre
 * las traducciones estáticas locales. Soporta detección automática del idioma del sistema/navegador,
 * cambio de idioma en vivo e interpolación.
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
   * Carga las traducciones personalizadas guardadas previamente en localStorage (versión BBDD)
   */
  _hydrateLocalCustomTranslations() {
    const locales = ['es', 'ca', 'en', 'fr'];
    locales.forEach(loc => {
      const savedDict = localStorage.getItem(`iq_dict_${loc}`);
      if (savedDict) {
        try {
          const parsed = JSON.parse(savedDict);
          if (!this.dictionaries[loc]) this.dictionaries[loc] = {};
          // Las traducciones de BBDD sobreescriben las estáticas locales
          Object.assign(this.dictionaries[loc], parsed);
        } catch (e) {
          console.warn(`[i18n] Error leyendo iq_dict_${loc} de localStorage`);
        }
      }
    });
  }

  /**
   * Resuelve el locale activo priorizando:
   * 1. Previa selección guardada en localStorage
   * 2. Idioma del sistema/navegador del usuario (navigator.languages / navigator.language)
   * 3. Fallback 'es'
   */
  _resolveAndMigrateLocale() {
    // 1. Verificar clave principal 'iq_locale' guardada anteriormente
    const savedLocale = localStorage.getItem(I18N_CONFIG.storageKey);
    if (savedLocale && this._isValidLocale(savedLocale)) {
      return savedLocale;
    }

    // 2. Comprobar llaves antiguas para evitar pérdida de preferencia
    for (const legacyKey of I18N_CONFIG.legacyStorageKeys) {
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue) {
        const normalized = legacyValue === 'cat' ? 'ca' : legacyValue;
        if (this._isValidLocale(normalized)) {
          this.setLocale(normalized);
          return normalized;
        }
      }
    }

    // 3. Detección automática del idioma del sistema/navegador/teclado del usuario
    const systemLangs = navigator.languages || [navigator.language || navigator.userLanguage || 'es'];
    for (const lang of systemLangs) {
      const code = String(lang).split('-')[0].toLowerCase();
      const normCode = code === 'cat' ? 'ca' : code;
      if (this._isValidLocale(normCode)) {
        this.setLocale(normCode);
        return normCode;
      }
    }

    // 4. Fallback al idioma por defecto (ES)
    const finalLocale = I18N_CONFIG.defaultLocale || 'es';
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
    I18N_CONFIG.legacyStorageKeys.forEach(key => localStorage.setItem(key, targetLocale));
    
    document.documentElement.lang = targetLocale;
    this._notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this._notify();
  }

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
   * Carga las traducciones de la tabla 'translations' en Supabase e inyecta los resultados en caliente
   */
  async loadRemoteTranslations(supabaseClient) {
    if (!supabaseClient) return;
    try {
      const currentLocale = this.getLocale();
      // Consultar tanto por 'ca' como por el alias 'cat' si aplica
      const queryLang = currentLocale === 'ca' ? 'cat' : currentLocale;
      
      const { data, error } = await supabaseClient
        .from("translations")
        .select("*")
        .or(`language_code.eq.${currentLocale},language_code.eq.${queryLang}`);

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

        // Guardar copia local limpia para disponibilidad offline a 0ms
        const existingLocal = JSON.parse(localStorage.getItem(`iq_dict_${currentLocale}`) || '{}');
        localStorage.setItem(`iq_dict_${currentLocale}`, JSON.stringify({ ...existingLocal, ...remoteDict }));

        this._notify();
      }
    } catch (err) {
      console.warn("[i18n] No se pudieron cargar las traducciones remotas de Supabase:", err);
    }
  }

  /**
   * Agrega/Sobreescribe un objeto de traducciones en tiempo real
   */
  addTranslations(locale, translationsObj) {
    const targetLocale = locale === 'cat' ? 'ca' : locale;
    if (!this.dictionaries[targetLocale]) {
      this.dictionaries[targetLocale] = {};
    }

    // Sobreescritura directa en memoria: BBDD manda sobre el local
    Object.assign(this.dictionaries[targetLocale], translationsObj);

    const existing = JSON.parse(localStorage.getItem(`iq_dict_${targetLocale}`) || '{}');
    localStorage.setItem(`iq_dict_${targetLocale}`, JSON.stringify({ ...existing, ...translationsObj }));

    if (targetLocale === this.currentLocale) {
      this._notify();
    }
  }

  /**
   * Búsqueda e interpretación de traducciones (Prioridad: 1. Clave plana BBDD, 2. Clave anidada)
   */
  t(key, params = {}, fallbackString = "") {
    if (!key) return "";

    let dict = this.dictionaries[this.currentLocale] || {};
    let result = undefined;

    // 1. PRIORIDAD MÁXIMA: Clave Plana de la BBDD Supabase (Ej: "team", "players", "market", "app_tagline")
    if (dict && dict[key] !== undefined) {
      result = dict[key];
    }

    // 2. Búsqueda por ruta anidada semántica (Ej: common.actions.save)
    if (result === undefined && dict) {
      const keys = key.split('.');
      result = keys.reduce((acc, curr) => (acc && acc[curr] !== undefined) ? acc[curr] : undefined, dict);
    }

    // 3. Fallback al idioma por defecto ES (primero plana, luego anidada)
    if (result === undefined && this.currentLocale !== I18N_CONFIG.fallbackLocale) {
      const fallbackDict = this.dictionaries[I18N_CONFIG.fallbackLocale] || {};
      if (fallbackDict[key] !== undefined) {
        result = fallbackDict[key];
      } else {
        const keys = key.split('.');
        result = keys.reduce((acc, curr) => (acc && acc[curr] !== undefined) ? acc[curr] : undefined, fallbackDict);
      }
    }

    if (result === undefined) {
      return fallbackString || key;
    }

    // Interpolación de variables {{param}}
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