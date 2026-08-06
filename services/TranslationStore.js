/**
 * @fileoverview Servicio de Gestión de Idiomas y Diccionario Completo (TranslationStore.js).
 * Incluye traducciones para menús, sedes, estados de partidos y etiquetas de interfaz.
 */

export class TranslationStore {
  static currentLang = localStorage.getItem("iq_lang") || "es";

  // Diccionario multilingüe ampliado con términos de interfaz y partidos
  static defaultDictionary = {
    es: {
      // Menú y Navegación
      dashboard: "Dashboard",
      team: "Equipo",
      players: "Jugadores",
      games: "Partidos",
      boxscore: "Registro estadístico",
      advanced_stats: "Estadística avanzada",
      lineups: "Quintetos",
      comparator: "Comparador",
      reports: "Informes",
      ask_ai: "Pregúntale a tus datos",
      profile: "Mi Perfil",
      settings: "Configuración",
      logout: "Cerrar sesión",
      language: "Idioma",

      // Términos de Partidos y Sedes
      local: "Local",
      visitor: "Visitante",
      pending: "Pendiente",
      completed: "Finalizado",
      opponent: "Rival",
      score: "Resultado",
      in_favor: "A favor",
      against: "En contra",
      actions: "Acciones",
      season: "Temporada",

      // Botones e Interfaz General
      save_changes: "Guardar Cambios",
      read_only: "Modo Solo Lectura",
      view_boxscore: "Análisis",
      edit: "Editar",
      search_player: "Buscar jugador...",
      all_positions: "Todas las Posiciones"
    },
    cat: {
      // Menú y Navegación
      dashboard: "Tauler Principal",
      team: "Equip",
      players: "Jugadors",
      games: "Partits",
      boxscore: "Registre Estadístic",
      advanced_stats: "Estadística Avançada",
      lineups: "Quintets",
      comparator: "Comparador",
      reports: "Informes",
      ask_ai: "Pregunta a les dades",
      profile: "El meu Perfil",
      settings: "Configuració",
      logout: "Tancar sessió",
      language: "Idioma",

      // Términos de Partidos y Sedes
      local: "Local",
      visitor: "Visitant",
      pending: "Pendent",
      completed: "Finalitzat",
      opponent: "Rival",
      score: "Resultat",
      in_favor: "A favor",
      against: "En contra",
      actions: "Accions",
      season: "Temporada",

      // Botones e Interfaz General
      save_changes: "Desar Canvis",
      read_only: "Mode Només Lectura",
      view_boxscore: "Anàlisi",
      edit: "Editar",
      search_player: "Cercar jugador...",
      all_positions: "Totes les Posicions"
    },
    en: {
      // Menú y Navegación
      dashboard: "Dashboard",
      team: "Team",
      players: "Players",
      games: "Games",
      boxscore: "Box Score Register",
      advanced_stats: "Advanced Stats",
      lineups: "Lineups",
      comparator: "Comparator",
      reports: "Reports",
      ask_ai: "Ask your Data",
      profile: "My Profile",
      settings: "Settings",
      logout: "Log Out",
      language: "Language",

      // Términos de Partidos y Sedes
      local: "Home",
      visitor: "Away",
      pending: "Pending",
      completed: "Final",
      opponent: "Opponent",
      score: "Score",
      in_favor: "For",
      against: "Against",
      actions: "Actions",
      season: "Season",

      // Botones e Interfaz General
      save_changes: "Save Changes",
      read_only: "Read-Only Mode",
      view_boxscore: "Analysis",
      edit: "Edit",
      search_player: "Search player...",
      all_positions: "All Positions"
    }
  };

  static getDictionary(lang = TranslationStore.currentLang) {
    const saved = localStorage.getItem(`iq_dict_${lang}`);
    if (saved) {
      try {
        return { ...TranslationStore.defaultDictionary[lang], ...JSON.parse(saved) };
      } catch (e) {
        console.warn("Error leyendo diccionario guardado, usando por defecto.");
      }
    }
    return TranslationStore.defaultDictionary[lang] || TranslationStore.defaultDictionary.es;
  }

  static t(key, fallback = "") {
    const dict = TranslationStore.getDictionary(TranslationStore.currentLang);
    return dict[key] || fallback || key;
  }

  static saveDictionary(lang, newDict) {
    localStorage.setItem(`iq_dict_${lang}`, JSON.stringify(newDict));
  }

  static setLanguage(lang) {
    TranslationStore.currentLang = lang;
    localStorage.setItem("iq_lang", lang);
  }
}