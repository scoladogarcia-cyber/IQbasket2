/**
 * @fileoverview Configuración global del sistema de internacionalización (i18n) para IQ Basket.
 * @description Define el idioma base por defecto (Inglés) y la clave de preferencia del usuario.
 */

export const I18N_CONFIG = {
  /** Idioma por defecto del sistema antes de cargar configuraciones de usuario */
  defaultLanguage: "en",
  
  /** Clave para guardar el código de idioma activo en el almacenamiento local */
  storageKey: "iq_basket_lang"
};