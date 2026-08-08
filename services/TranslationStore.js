/**
 * @fileoverview Servicio de Gestión de Idiomas y Diccionario Completo (TranslationStore.js).
 * Refactorizado para conectar de forma transparente con I18nService.js sin romper llamadas existentes.
 * Soporta ES, CA (antes cat), EN y FR.
 */

import { I18n } from './I18nService.js';

export class TranslationStore {
  /** Obtiene el idioma actual o utiliza la migración inteligente */
  static get currentLang() {
    return I18n.getLocale();
  }

  static set currentLang(val) {
    const normalized = val === 'cat' ? 'ca' : val;
    I18n.setLocale(normalized);
  }

  /**
   * Diccionario multilingüe ampliado con términos de interfaz, partidos y nuevos idiomas (FR).
   * Mantiene todas las claves planas requeridas por las vistas existentes.
   */
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

      // Términos de Partidos, Equipos y Sedes
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
      record: "Balance",
      active_players: "Jugadores Activos",
      team_info: "Información del Equipo",
      roster: "Plantilla",
      no_players_loaded: "No hay jugadores cargados en la plantilla.",
      jersey: "Dorsal",
      position: "Posición",
      status: "Estado",
      height: "Altura",
      ppg_tooltip: "Puntos Por Partido promedio anotados por el jugador.",

      // Botones e Interfaz General
      save_changes: "Guardar Cambios",
      read_only: "Modo Solo Lectura",
      view_boxscore: "Análisis",
      edit: "Editar",
      search_player: "Buscar jugador...",
      all_positions: "Todas las Posiciones"
    },
    ca: {
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

      // Términos de Partidos, Equipos y Sedes
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
      record: "Balanç",
      active_players: "Jugadors Actius",
      team_info: "Informació de l'Equip",
      roster: "Plantilla",
      no_players_loaded: "No hi ha jugadors carregats a la plantilla.",
      jersey: "Dorsal",
      position: "Posició",
      status: "Estat",
      height: "Alçada",
      ppg_tooltip: "Punts per partit mitjans anotats pel jugador.",

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

      // Términos de Partidos, Equipos y Sedes
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
      record: "Record",
      active_players: "Active Players",
      team_info: "Team Information",
      roster: "Roster",
      no_players_loaded: "No players loaded in the roster.",
      jersey: "Jersey",
      position: "Position",
      status: "Status",
      height: "Height",
      ppg_tooltip: "Average points per game scored by the player.",

      // Botones e Interfaz General
      save_changes: "Save Changes",
      read_only: "Read-Only Mode",
      view_boxscore: "Analysis",
      edit: "Edit",
      search_player: "Search player...",
      all_positions: "All Positions"
    },
    fr: {
      // Menú y Navegación
      dashboard: "Tableau de Bord",
      team: "Équipe",
      players: "Joueurs",
      games: "Matchs",
      boxscore: "Registre Statistique",
      advanced_stats: "Statistiques Avancées",
      lineups: "Cinq Majeur",
      comparator: "Comparateur",
      reports: "Rapports",
      ask_ai: "Posez une question",
      profile: "Mon Profil",
      settings: "Paramètres",
      logout: "Déconnexion",
      language: "Langue",

      // Términos de Partidos, Equipos y Sedes
      local: "Domicile",
      visitor: "Extérieur",
      pending: "En attente",
      completed: "Terminé",
      opponent: "Adversaire",
      score: "Score",
      in_favor: "Pour",
      against: "Contre",
      actions: "Actions",
      season: "Saison",
      record: "Bilan",
      active_players: "Joueurs Actifs",
      team_info: "Informations sur l'équipe",
      roster: "Effectif",
      no_players_loaded: "Aucun joueur chargé dans l'effectif.",
      jersey: "Maillot",
      position: "Poste",
      status: "Statut",
      height: "Taille",
      ppg_tooltip: "Moyenne de points par match marqués par le joueur.",

      // Botones e Interfaz General
      save_changes: "Enregistrer los modifications",
      read_only: "Mode Lecture Seule",
      view_boxscore: "Analyse",
      edit: "Modifier",
      search_player: "Rechercher un joueur...",
      all_positions: "Toutes les Positions"
    }
  };

  /** Alias para retrocompatibilidad con la clave 'cat' */
  static get dictWithCatAlias() {
    return {
      ...TranslationStore.defaultDictionary,
      cat: TranslationStore.defaultDictionary.ca
    };
  }

  static getDictionary(lang = TranslationStore.currentLang) {
    const targetLang = lang === 'cat' ? 'ca' : lang;
    const saved = localStorage.getItem(`iq_dict_${targetLang}`);
    if (saved) {
      try {
        return { 
          ...TranslationStore.defaultDictionary[targetLang], 
          ...JSON.parse(saved) 
        };
      } catch (e) {
        console.warn("Error leyendo diccionario guardado, usando por defecto.");
      }
    }
    return TranslationStore.defaultDictionary[targetLang] || TranslationStore.defaultDictionary.es;
  }

  /**
   * Obtiene la traducción dada una clave.
   * Soporta tanto claves planas directas ("dashboard") como navegadas ("common.actions.save").
   */
  static t(key, fallback = "") {
    if (!key) return "";

    // 1. Intentar resolver mediante el nuevo I18nService
    const translated = I18n.t(key, {}, null);
    if (typeof translated === "string" && !translated.startsWith("[MISSING:")) {
      return translated;
    }

    // 2. Fallback al diccionario plano directo
    const currentDict = TranslationStore.getDictionary(TranslationStore.currentLang);
    if (currentDict && currentDict[key]) {
      return currentDict[key];
    }

    // 3. Devolver fallback o la clave original
    return fallback || key;
  }

  static saveDictionary(lang, newDict) {
    const targetLang = lang === 'cat' ? 'ca' : lang;
    localStorage.setItem(`iq_dict_${targetLang}`, JSON.stringify(newDict));
    if (I18n.dictionaries[targetLang]) {
      Object.assign(I18n.dictionaries[targetLang], newDict);
    }
  }

  static setLanguage(lang) {
    const targetLang = lang === 'cat' ? 'ca' : lang;
    I18n.setLocale(targetLang);
  }
}

export default TranslationStore;