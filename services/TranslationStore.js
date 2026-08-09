/**
 * @fileoverview Servicio de Gestión de Idiomas y Diccionario Completo (TranslationStore.js).
 * Refactorizado para conectar con Supabase de forma transparente y sincronizarse con I18nService.js.
 * Soporta ES, CA (alias cat), EN y FR con sincronización bidireccional en caliente.
 */

import { I18n } from './I18nService.js';
import { supabase } from '../config/database.config.js';

export class TranslationStore {
  /** Obtiene el idioma actual */
  static get currentLang() {
    return I18n.getLocale();
  }

  static set currentLang(val) {
    const normalized = val === 'cat' ? 'ca' : val;
    I18n.setLocale(normalized);
  }

  /**
   * Diccionario por defecto multilingüe (Fallback local en caso de fallo de red)
   */
  static defaultDictionary = {
    es: {
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
      save_changes: "Guardar Cambios",
      read_only: "Modo Solo Lectura",
      view_boxscore: "Análisis",
      edit: "Editar",
      search_player: "Buscar jugador...",
      all_positions: "Todas las Posiciones"
    },
    ca: {
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
      save_changes: "Desar Canvis",
      read_only: "Mode Només Lectura",
      view_boxscore: "Anàlisi",
      edit: "Editar",
      search_player: "Cercar jugador...",
      all_positions: "Totes les Posicions"
    },
    en: {
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
      save_changes: "Save Changes",
      read_only: "Read-Only Mode",
      view_boxscore: "Analysis",
      edit: "Edit",
      search_player: "Search player...",
      all_positions: "All Positions"
    },
    fr: {
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
      save_changes: "Enregistrer les modifications",
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

  /**
   * Carga el diccionario desde Supabase para el idioma dado e integra las claves en I18n
   */
  static async loadFromSupabase(lang = TranslationStore.currentLang) {
    const targetLang = lang === 'cat' ? 'ca' : lang;
    try {
      // Consulta buscando tanto por 'ca' como por el alias 'cat' si aplica
      const { data, error } = await supabase
        .from("translations")
        .select("*")
        .or(`language_code.eq.${targetLang},language_code.eq.${lang}`);

      if (!error && data && data.length > 0) {
        const remoteDict = {};
        data.forEach(item => {
          if (item.key && item.translation) {
            remoteDict[item.key] = item.translation;
          }
        });

        // 1. Guardar copia local para acceso inmediato offline (0ms)
        localStorage.setItem(`iq_dict_${targetLang}`, JSON.stringify(remoteDict));

        // 2. Inyectar sobreescribiendo en I18n
        I18n.addTranslations(targetLang, remoteDict);

        // 3. Notificar cambios a la vista
        I18n.notify();
      }
    } catch (e) {
      console.warn("⚠️ [TranslationStore] Error cargando diccionario de Supabase:", e);
    }
  }

  /**
   * Inicialización masiva al arrancar la aplicación
   */
  static async initAllTranslations() {
    const activeLang = TranslationStore.currentLang;
    await TranslationStore.loadFromSupabase(activeLang);
  }

  /**
   * Obtiene el diccionario en memoria/localStorage mezclado con los valores por defecto
   */
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
        console.warn("[TranslationStore] Error leyendo diccionario guardado, usando por defecto.");
      }
    }
    return TranslationStore.defaultDictionary[targetLang] || TranslationStore.defaultDictionary.es;
  }

  /**
   * Obtiene la traducción dada una clave semántica o plana.
   */
  static t(key, fallback = "") {
    if (!key) return "";

    // 1. Intentar resolver mediante I18nService
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

  /**
   * Guarda un diccionario completo local y notifica al motor
   */
  static saveDictionary(lang, newDict) {
    const targetLang = lang === 'cat' ? 'ca' : lang;
    localStorage.setItem(`iq_dict_${targetLang}`, JSON.stringify(newDict));
    if (I18n.dictionaries[targetLang]) {
      Object.assign(I18n.dictionaries[targetLang], newDict);
    }
    I18n.notify();
  }

  /**
   * Cambia el idioma activo y recarga desde Supabase
   */
  static async setLanguage(lang) {
    const targetLang = lang === 'cat' ? 'ca' : lang;
    I18n.setLocale(targetLang);
    await TranslationStore.loadFromSupabase(targetLang);
  }
}

export default TranslationStore;