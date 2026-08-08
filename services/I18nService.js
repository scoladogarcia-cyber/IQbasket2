/**
 * @fileoverview Servicio principal de internacionalización (I18nService.js).
 * @description Soporta namespaces, interpolación de variables {{var}}, pluralización, 
 * formatos nativos Intl (números, fechas, porcentajes) y migración sin pérdida de datos.
 */

import { I18N_CONFIG } from '../config/i18n.config.js';
import { es } from '../locales/es.js';
import { ca } from '../locales/ca.js';
import { en } from '../locales/en.js';
import { fr } from '../locales/fr.js';

class I18nService {
  constructor() {
    this.dictionaries = { es, ca, en, fr };
    this.listeners = new Set();
    this.currentLocale = this._resolveAndMigrateLocale();
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

  _notify() {
    this.listeners.forEach(fn => fn(this.currentLocale));
  }

  /**
   * Traduce una clave semántica (ej. 'dashboard.games.played') con interpolación de parámetros.
   */
  t(key, params = {}, fallbackString = "") {
    if (!key) return "";

    const keys = key.split('.');
    let dict = this.dictionaries[this.currentLocale];
    let result = undefined;

    if (dict) {
      result = keys.reduce((acc, curr) => (acc && acc[curr] !== undefined) ? acc[curr] : undefined, dict);
    }

    // Intento de fallback al locale por defecto
    if (result === undefined && this.currentLocale !== I18N_CONFIG.fallbackLocale) {
      const fallbackDict = this.dictionaries[I18N_CONFIG.fallbackLocale];
      result = keys.reduce((acc, curr) => (acc && acc[curr] !== undefined) ? acc[curr] : undefined, fallbackDict);
    }

    // Si aún no se encuentra, buscar en nivel raíz (soporte para llamadas legacy simples como t("dashboard"))
    if (result === undefined) {
      const rootDict = this.dictionaries[this.currentLocale] || this.dictionaries[I18N_CONFIG.fallbackLocale];
      result = rootDict ? rootDict[key] : undefined;
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