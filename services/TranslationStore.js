/**
 * @fileoverview Servicio de Gestión de Idiomas y Diccionario Completo (TranslationStore.js).
 * Refactorizado para conectar con Supabase de forma transparente y sincronizarse con I18nService.js.
 * Soporta ES, CA (alias cat), EN y FR con sincronización bidireccional en caliente.
 * Incluye el diccionario completo para la Suite Analítica, Mapa de Calor, Shot Chart y Comparativa On/Off.
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
      all_positions: "Todas las Posiciones",
      all: "Todos",
      quarters: "CUARTOS",
      track_live: "Toma Gráfica / Pista",
      report: "Informe",
      delete_game: "Eliminar partido",
      confirm_delete_game: "¿Estás seguro de que deseas eliminar este partido? Se borrarán todas sus estadísticas, cuartos y jugadas asociadas.",
      team_games: "Partidos del Equipo",
      registered_games: "partidos registrados",
      register_new_game: "Registrar Nuevo Partido",
      sort: "ORDENAR",
      no_games_recorded: "No hay partidos registrados.",
      edit_game: "Toma de Datos en Vivo",
      cancel: "Volver al Listado",
      date: "Fecha",
      matchday: "Jornada",
      venue: "Sede",
      arena: "Pabellón / Arena",
      starting_five: "QUINTETO TITULAR",
      game_saved_msg: "Partido guardado exitosamente con cuartos, estadísticas y mapa de calor sincronizados.",

      // Suite Analítica, Mapa de Calor y Cartas de Tiro
      analytics_suite: "Estadística Avanzada & Cartas de Tiro",
      analytics_subtitle: "Rendimiento espacial, informe individual con radar y comparativa On/Off",
      tab_court_heatmap: "Pista & Zonas",
      tab_player_report: "Informe de Jugador",
      tab_on_off: "Comparativa On / Off & Rival",

      // Filtros
      "heatmap.filter_game": "PARTIDO",
      "heatmap.all_games": "Todos los partidos",
      "heatmap.filter_player": "JUGADOR",
      "heatmap.all_players": "Todo el equipo",
      "heatmap.filter_period": "PERIODO",
      "heatmap.all_periods": "Todos los cuartos",
      "heatmap.filter_outcome": "RESULTADO DE TIRO",
      "heatmap.all_outcomes": "Anotados y Fallados",
      "heatmap.only_made": "Solo Anotados",
      "heatmap.only_missed": "Solo Fallados",

      // Rangos de distancia y modos de vista
      "heatmap.all_distances": "Todas las Distancias",
      "heatmap.paint": "Bajo el Aro / Pintura",
      "heatmap.mid_range": "Media Distancia",
      "heatmap.threes": "Línea de 3 Puntos",
      "heatmap.mode_zones": "Zonas",
      "heatmap.mode_density": "Calor",
      "heatmap.mode_shots": "Tiros",

      // Badges sobre pista
      "heatmap.paint_badge": "PINTURA",
      "heatmap.mid_badge": "MEDIA DIST.",
      "heatmap.top_three_badge": "TRIPLE FRONTAL",
      "heatmap.left_corner_badge": "ESQ. IZQ",
      "heatmap.right_corner_badge": "ESQ. DER",

      // Resumen y métricas de tiro
      "heatmap.summary_title": "Resumen de Lanzamiento",
      "heatmap.zones_title": "Distribución por Distancia",
      "heatmap.made_shots": "Anotados",
      "heatmap.missed_shots": "Fallados",
      "heatmap.pts_produced": "Puntos Producidos en Cancha",
      "heatmap.efficiency": "Eficiencia",
      "heatmap.made_legend": "Anotado",
      "heatmap.missed_legend": "Fallado",

      // Informe de Jugador con Radar
      "heatmap.season_report": "Informe de Temporada",
      "heatmap.efficiency_profile": "Perfil de Eficiencia Ofensiva y Porcentajes de Tiro",
      "heatmap.skills_radar": "Radar de Habilidades (Advanced Radar)",
      "heatmap.shot_breakdown": "Desglose de Lanzamientos de",

      // Matriz On / Off
      "heatmap.on_off_title": "Matriz de Rendimiento On / Off & Rival",
      "heatmap.on_off_subtitle": "Impacto diferencial en pista con el jugador presente (ON) vs descansando (OFF)",
      "heatmap.analyzed_players": "Jugadores Analizados",
      player: "JUGADOR",
      minutes: "MIN",
      possessions: "POSS"
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
      all_positions: "Totes les Posicions",
      all: "Tots",
      quarters: "QUARTS",
      track_live: "Presa Gràfica / Pista",
      report: "Informe",
      delete_game: "Eliminar partit",
      confirm_delete_game: "Segur que voleu eliminar aquest partit? S'esborraran totes les seves estadístiques, quarts i jugades associades.",
      team_games: "Partits de l'Equip",
      registered_games: "partits registrats",
      register_new_game: "Registrar Nou Partit",
      sort: "ORDENAR",
      no_games_recorded: "No hi ha partits registrats.",
      edit_game: "Presa de Dades en Viu",
      cancel: "Tornar al Llistat",
      date: "Data",
      matchday: "Jornada",
      venue: "Seu",
      arena: "Pavelló / Arena",
      starting_five: "QUINTET TITULAR",
      game_saved_msg: "Partit desat correctament amb quarts, estadístiques i mapa de calor sincronitzats.",

      // Suite Analítica, Mapa de Calor i Cartes de Tir
      analytics_suite: "Estadística Avançada & Cartes de Tir",
      analytics_subtitle: "Rendiment espacial, informe individual amb radar i comparativa On/Off",
      tab_court_heatmap: "Pista & Zones",
      tab_player_report: "Informe de Jugador",
      tab_on_off: "Comparativa On / Off & Rival",

      // Filtres
      "heatmap.filter_game": "PARTIT",
      "heatmap.all_games": "Tots els partits",
      "heatmap.filter_player": "JUGADOR",
      "heatmap.all_players": "Tot l'equip",
      "heatmap.filter_period": "PERÍODE",
      "heatmap.all_periods": "Tots els quarts",
      "heatmap.filter_outcome": "RESULTAT DE TIR",
      "heatmap.all_outcomes": "Anotats i Fallats",
      "heatmap.only_made": "Només Anotats",
      "heatmap.only_missed": "Només Fallats",

      // Rangs de distància i modes de vista
      "heatmap.all_distances": "Totes les Distàncies",
      "heatmap.paint": "Sota la Canastra / Pintura",
      "heatmap.mid_range": "Mitja Distància",
      "heatmap.threes": "Línia de 3 Punts",
      "heatmap.mode_zones": "Zones",
      "heatmap.mode_density": "Calor",
      "heatmap.mode_shots": "Tirs",

      // Badges sobre pista
      "heatmap.paint_badge": "PINTURA",
      "heatmap.mid_badge": "MITJA DIST.",
      "heatmap.top_three_badge": "TRIPLE FRONTAL",
      "heatmap.left_corner_badge": "ESQ. ESQ",
      "heatmap.right_corner_badge": "ESQ. DRE",

      // Resum i mètriques de tir
      "heatmap.summary_title": "Resum de Llançament",
      "heatmap.zones_title": "Distribució per Distància",
      "heatmap.made_shots": "Anotats",
      "heatmap.missed_shots": "Fallats",
      "heatmap.pts_produced": "Punts Produïts a Pista",
      "heatmap.efficiency": "Eficiència",
      "heatmap.made_legend": "Anotat",
      "heatmap.missed_legend": "Fallat",

      // Informe de Jugador amb Radar
      "heatmap.season_report": "Informe de Temporada",
      "heatmap.efficiency_profile": "Perfil d'Eficiència Ofensiva i Percentatges de Tir",
      "heatmap.skills_radar": "Radar d'Habilitats (Advanced Radar)",
      "heatmap.shot_breakdown": "Desglossament de Llançaments de",

      // Matriu On / Off
      "heatmap.on_off_title": "Matriu de Rendiment On / Off & Rival",
      "heatmap.on_off_subtitle": "Impacte diferencial a pista amb el jugador present (ON) vs descansant (OFF)",
      "heatmap.analyzed_players": "Jugadors Analitzats",
      player: "JUGADOR",
      minutes: "MIN",
      possessions: "POSS"
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
      all_positions: "All Positions",
      all: "All",
      quarters: "QUARTERS",
      track_live: "Graphical Tracking / Court",
      report: "Report",
      delete_game: "Delete Game",
      confirm_delete_game: "Are you sure you want to delete this game? All associated stats, periods, and plays will be permanently removed.",
      team_games: "Team Games",
      registered_games: "registered games",
      register_new_game: "Register New Game",
      sort: "SORT",
      no_games_recorded: "No games recorded.",
      edit_game: "Live Game Data Entry",
      cancel: "Back to List",
      date: "Date",
      matchday: "Round",
      venue: "Venue",
      arena: "Arena / Gym",
      starting_five: "STARTING FIVE",
      game_saved_msg: "Game saved successfully with periods, stats, and shot chart synchronized.",

      // Analytics Suite & Heatmap
      analytics_suite: "Advanced Stats & Shot Charts",
      analytics_subtitle: "Spatial performance, individual report with radar, and On/Off comparison",
      tab_court_heatmap: "Court & Zones",
      tab_player_report: "Player Report",
      tab_on_off: "On / Off & Opponent Comparison",

      // Filters
      "heatmap.filter_game": "GAME",
      "heatmap.all_games": "All Games",
      "heatmap.filter_player": "PLAYER",
      "heatmap.all_players": "All Team",
      "heatmap.filter_period": "PERIOD",
      "heatmap.all_periods": "All Quarters",
      "heatmap.filter_outcome": "SHOT OUTCOME",
      "heatmap.all_outcomes": "Made & Missed",
      "heatmap.only_made": "Only Made",
      "heatmap.only_missed": "Only Missed",

      // Distance ranges and view modes
      "heatmap.all_distances": "All Distances",
      "heatmap.paint": "Under Rim / Paint",
      "heatmap.mid_range": "Mid-Range",
      "heatmap.threes": "3-Point Line",
      "heatmap.mode_zones": "Zones",
      "heatmap.mode_density": "Heatmap",
      "heatmap.mode_shots": "Shots",

      // Badges
      "heatmap.paint_badge": "PAINT",
      "heatmap.mid_badge": "MID-RANGE",
      "heatmap.top_three_badge": "TOP THREE",
      "heatmap.left_corner_badge": "LEFT CORNER",
      "heatmap.right_corner_badge": "RIGHT CORNER",

      // Summary & Shot Metrics
      "heatmap.summary_title": "Shooting Summary",
      "heatmap.zones_title": "Distance Breakdown",
      "heatmap.made_shots": "Made",
      "heatmap.missed_shots": "Missed",
      "heatmap.pts_produced": "Points Produced on Court",
      "heatmap.efficiency": "Efficiency",
      "heatmap.made_legend": "Made",
      "heatmap.missed_legend": "Missed",

      // Player Report (Radar)
      "heatmap.season_report": "Season Report",
      "heatmap.efficiency_profile": "Offensive Efficiency Profile & Shooting Percentages",
      "heatmap.skills_radar": "Skills Radar (Advanced Radar)",
      "heatmap.shot_breakdown": "Shot Breakdown of",

      // On / Off Matrix
      "heatmap.on_off_title": "On / Off & Opponent Performance Matrix",
      "heatmap.on_off_subtitle": "Differential on-court impact with player present (ON) vs resting (OFF)",
      "heatmap.analyzed_players": "Analyzed Players",
      player: "PLAYER",
      minutes: "MIN",
      possessions: "POSS"
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
      all_positions: "Toutes les Positions",
      all: "Tous",
      quarters: "QUARTS-TEMPS",
      track_live: "Prise Graphique / Terrain",
      report: "Rapport",
      delete_game: "Supprimer le match",
      confirm_delete_game: "Êtes-vous sûr de vouloir supprimer ce match ?",
      team_games: "Matchs de l'Équipe",
      registered_games: "matchs enregistrés",
      register_new_game: "Enregistrer un Nouveau Match",
      sort: "TRIER",
      no_games_recorded: "Aucun match enregistré.",
      edit_game: "Saisie de Données en Direct",
      cancel: "Retour à la Liste",
      date: "Date",
      matchday: "Journée",
      venue: "Lieu",
      arena: "Gymnase / Salle",
      starting_five: "CINQ MAJEUR",
      game_saved_msg: "Match enregistré avec succès.",

      analytics_suite: "Statistiques Avancées & Cartes de Tir",
      analytics_subtitle: "Performance spatiale, rapport individuel avec radar et On/Off",
      tab_court_heatmap: "Terrain & Zones",
      tab_player_report: "Rapport Joueur",
      tab_on_off: "Comparatif On / Off & Adversaire",

      "heatmap.filter_game": "MATCH",
      "heatmap.all_games": "Tous les matchs",
      "heatmap.filter_player": "JOUEUR",
      "heatmap.all_players": "Toute l'équipe",
      "heatmap.filter_period": "PÉRIODE",
      "heatmap.all_periods": "Tous les quarts-temps",
      "heatmap.filter_outcome": "RÉSULTAT DU TIR",
      "heatmap.all_outcomes": "Réussis et Manqués",
      "heatmap.only_made": "Seulement Réussis",
      "heatmap.only_missed": "Seulement Manqués",

      "heatmap.all_distances": "Toutes les Distances",
      "heatmap.paint": "Sous le Panier / Raquette",
      "heatmap.mid_range": "Mi-Distance",
      "heatmap.threes": "Ligne à 3 Points",
      "heatmap.mode_zones": "Zones",
      "heatmap.mode_density": "Chaleur",
      "heatmap.mode_shots": "Tirs",

      "heatmap.paint_badge": "RAQUETTE",
      "heatmap.mid_badge": "MI-DISTANCE",
      "heatmap.top_three_badge": "3 PTS EN TÊTE",
      "heatmap.left_corner_badge": "COIN GAUCHE",
      "heatmap.right_corner_badge": "COIN DROIT",

      "heatmap.summary_title": "Résumé des Tirs",
      "heatmap.zones_title": "Répartition par Distance",
      "heatmap.made_shots": "Réussis",
      "heatmap.missed_shots": "Manqués",
      "heatmap.pts_produced": "Points Marqués sur le Terrain",
      "heatmap.efficiency": "Efficacité",
      "heatmap.made_legend": "Réussi",
      "heatmap.missed_legend": "Manqué",

      "heatmap.season_report": "Rapport de Saison",
      "heatmap.efficiency_profile": "Profil d'Efficacité Offensive et Pourcentages de Tir",
      "heatmap.skills_radar": "Radar de Compétences (Advanced Radar)",
      "heatmap.shot_breakdown": "Détail des Tirs de",

      "heatmap.on_off_title": "Matrice de Rendement On / Off & Adversaire",
      "heatmap.on_off_subtitle": "Impact différentiel sur le terrain avec le joueur (ON) vs au repos (OFF)",
      "heatmap.analyzed_players": "Joueurs Analysés",
      player: "JOUEUR",
      minutes: "MIN",
      possessions: "POSS"
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
    if (typeof translated === "string" && !translated.startsWith("[MISSING:") && translated !== key) {
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