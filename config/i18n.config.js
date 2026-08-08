/**
 * @fileoverview Configuración unificada de internacionalización (i18n) para IQ Basket.
 * @description Elimina inconsistencias de almacenamiento, establece 'es' como idioma principal y fallback,
 * define los locales oficiales ES, CA, EN, FR e implementa la clave única 'iq_locale'.
 */

export const I18N_CONFIG = Object.freeze({
  /** Idioma por defecto de la aplicación */
  defaultLocale: "es",

  /** Idioma de respaldo en caso de clave faltante */
  fallbackLocale: "es",

  /** Clave única de preferencia en localStorage */
  storageKey: "iq_locale",

  /** Claves heredadas para migración automática y preservación de preferencias previas */
  legacyStorageKeys: ["iq_lang", "iq_basket_lang"],

  /** Locales oficiales soportados */
  supportedLocales: [
    { code: "es", name: "Español", flag: "🇪🇸" },
    { code: "ca", name: "Català", flag: "🏴󠁡󠁱󠁣󠁡󠁴󠁿" },
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "fr", name: "Français", flag: "🇫🇷" }
  ]
});

export default I18N_CONFIG;