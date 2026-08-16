/**
 * @fileoverview Configuración Unificada de Internacionalización (i18n): I18N_CONFIG.
 * @description Define los locales oficiales soportados ('es', 'ca', 'en', 'fr'),
 * resuelve alias comunes ('cat' -> 'ca'), establece claves de almacenamiento consistentes
 * y asegura compatibilidad con `I18nEngine.js`, `I18nService.js` y `TranslationService.js`.
 */

export const I18N_CONFIG = Object.freeze({
  /** Idioma principal por defecto */
  defaultLanguage: "es",
  defaultLocale: "es",

  /** Idioma de respaldo en caso de clave no encontrada */
  fallbackLanguage: "es",
  fallbackLocale: "es",

  /** Clave principal de preferencia en almacenamiento local */
  storageKey: "iq_locale",

  /** Claves heredadas para migración transparente de sesiones previas */
  legacyStorageKeys: [
    "iq_lang",
    "iq_basket_lang",
    "iqbasket_language",
    "iq_language",
    "language",
    "locale"
  ],

  /** Mapeo de alias a código ISO estándar */
  localeAliases: {
    cat: "ca"
  },

  /** Catálogo de locales oficiales soportados con metadatos descriptivos */
  supportedLocales: [
    { code: "es", name: "Español", flag: "🇪🇸", nativeName: "Español" },
    { code: "ca", name: "Català", flag: "🏴󠁡󠁱󠁣󠁡󠁴󠁿", nativeName: "Català" },
    { code: "en", name: "English", flag: "🇬🇧", nativeName: "English" },
    { code: "fr", name: "Français", flag: "🇫🇷", nativeName: "Français" }
  ]
});

export default I18N_CONFIG;