/**
 * @fileoverview Almacén y Servicio de Gestión de Idiomas, Diccionarios y Traducciones: TranslationStore.js
 * @description Exporta tanto `TranslationStore` como `TranslationService` para máxima compatibilidad.
 * Conexión reactiva a Supabase (`translations`), persistencia local en `localStorage` y diccionarios de fallback (ES, CA/CAT, EN, FR).
 */

import { supabase } from "../config/database.config.js";
import { I18n } from "./I18nService.js";

export class TranslationStore {
  static defaultDictionary = {
    es: {
      dashboard: "Dashboard",
      team: "Equipo",
      players: "Jugadores",
      games: "Partidos",
      boxscore: "Registro Estadístico",
      advanced_stats: "Estadística Avanzada",
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
      confirm_delete_game: "¿Estás seguro de que deseas eliminar este partido? Se borrarán todas sus estadísticas y eventos asociados.",
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
      game_saved_msg: "Partido guardado exitosamente con cuartos, estadísticas y mapa de tiro sincronizados.",
      analytics_suite: "Estadística Avanzada & Cartas de Tiro",
      analytics_subtitle: "Rendimiento espacial, informe individual con radar y comparativa On/Off",
      tab_court_heatmap: "Pista & Zonas",
      tab_player_report: "Informe de Jugador",
      tab_on_off: "Comparativa On / Off & Rival",
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
      "heatmap.all_distances": "Todas las Distancias",
      "heatmap.paint": "Bajo el Aro / Pintura",
      "heatmap.mid_range": "Media Distancia",
      "heatmap.threes": "Línea de 3 Puntos",
      "heatmap.mode_zones": "Zonas",
      "heatmap.mode_density": "Calor",
      "heatmap.mode_shots": "Tiros",
      "heatmap.paint_badge": "PINTURA",
      "heatmap.mid_badge": "MEDIA DIST.",
      "heatmap.top_three_badge": "TRIPLE FRONTAL",
      "heatmap.left_corner_badge": "ESQ. IZQ",
      "heatmap.right_corner_badge": "ESQ. DER",
      "heatmap.summary_title": "Resumen de Lanzamiento",
      "heatmap.zones_title": "Distribución por Distancia",
      "heatmap.made_shots": "Anotados",
      "heatmap.missed_shots": "Fallados",
      "heatmap.pts_produced": "Puntos Producidos en Cancha",
      "heatmap.efficiency": "Eficiencia",
      "heatmap.made_legend": "Anotado",
      "heatmap.missed_legend": "Fallado",
      "heatmap.season_report": "Informe de Temporada",
      "heatmap.efficiency_profile": "Perfil de Eficiencia Ofensiva y Porcentajes de Tiro",
      "heatmap.skills_radar": "Radar de Habilidades (Advanced Radar)",
      "heatmap.shot_breakdown": "Desglose de Lanzamientos de",
      "heatmap.on_off_title": "Matriz de Rendimiento On / Off & Rival",
      "heatmap.on_off_subtitle": "Impacto diferencial en pista con el jugador presente (ON) vs descansando (OFF)",
      "heatmap.analyzed_players": "Jugadores Analizados"
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
      confirm_delete_game: "Segur que voleu eliminar aquest partit? S'esborraran totes les seves estadístiques i esdeveniments associats.",
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
      game_saved_msg: "Partit desat correctament amb quarts, estadístiques i mapa de tir sincronitzats.",
      analytics_suite: "Estadística Avançada & Cartes de Tir",
      analytics_subtitle: "Rendiment espacial, informe individual amb radar i comparativa On/Off",
      tab_court_heatmap: "Pista & Zones",
      tab_player_report: "Informe de Jugador",
      tab_on_off: "Comparativa On / Off & Rival",
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
      "heatmap.all_distances": "Totes les Distàncies",
      "heatmap.paint": "Sota la Canastra / Pintura",
      "heatmap.mid_range": "Mitja Distància",
      "heatmap.threes": "Línia de 3 Punts",
      "heatmap.mode_zones": "Zones",
      "heatmap.mode_density": "Calor",
      "heatmap.mode_shots": "Tirs",
      "heatmap.paint_badge": "PINTURA",
      "heatmap.mid_badge": "MITJA DIST.",
      "heatmap.top_three_badge": "TRIPLE FRONTAL",
      "heatmap.left_corner_badge": "ESQ. ESQ",
      "heatmap.right_corner_badge": "ESQ. DRE",
      "heatmap.summary_title": "Resum de Llançament",
      "heatmap.zones_title": "Distribució per Distància",
      "heatmap.made_shots": "Anotats",
      "heatmap.missed_shots": "Fallats",
      "heatmap.pts_produced": "Punts Produïts a Pista",
      "heatmap.efficiency": "Eficiència",
      "heatmap.made_legend": "Anotat",
      "heatmap.missed_legend": "Fallat",
      "heatmap.season_report": "Informe de Temporada",
      "heatmap.efficiency_profile": "Perfil d'Eficiència Ofensiva i Percentatges de Tir",
      "heatmap.skills_radar": "Radar d'Habilitats (Advanced Radar)",
      "heatmap.shot_breakdown": "Desglossament de Llançaments de",
      "heatmap.on_off_title": "Matriu de Rendiment On / Off & Rival",
      "heatmap.on_off_subtitle": "Impacte diferencial a pista amb el jugador present (ON) vs descansant (OFF)",
      "heatmap.analyzed_players": "Jugadors Analitzats"
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
      confirm_delete_game: "Are you sure you want to delete this game? All associated stats and events will be permanently removed.",
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
      analytics_suite: "Advanced Stats & Shot Charts",
      analytics_subtitle: "Spatial performance, individual report with radar, and On/Off comparison",
      tab_court_heatmap: "Court & Zones",
      tab_player_report: "Player Report",
      tab_on_off: "On / Off & Opponent Comparison",
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
      "heatmap.all_distances": "All Distances",
      "heatmap.paint": "Under Rim / Paint",
      "heatmap.mid_range": "Mid-Range",
      "heatmap.threes": "3-Point Line",
      "heatmap.mode_zones": "Zones",
      "heatmap.mode_density": "Heatmap",
      "heatmap.mode_shots": "Shots",
      "heatmap.paint_badge": "PAINT",
      "heatmap.mid_badge": "MID-RANGE",
      "heatmap.top_three_badge": "TOP THREE",
      "heatmap.left_corner_badge": "LEFT CORNER",
      "heatmap.right_corner_badge": "RIGHT CORNER",
      "heatmap.summary_title": "Shooting Summary",
      "heatmap.zones_title": "Distance Breakdown",
      "heatmap.made_shots": "Made",
      "heatmap.missed_shots": "Missed",
      "heatmap.pts_produced": "Points Produced on Court",
      "heatmap.efficiency": "Efficiency",
      "heatmap.made_legend": "Made",
      "heatmap.missed_legend": "Missed",
      "heatmap.season_report": "Season Report",
      "heatmap.efficiency_profile": "Offensive Efficiency Profile & Shooting Percentages",
      "heatmap.skills_radar": "Skills Radar (Advanced Radar)",
      "heatmap.shot_breakdown": "Shot Breakdown of",
      "heatmap.on_off_title": "On / Off & Opponent Performance Matrix",
      "heatmap.on_off_subtitle": "Differential on-court impact with player present (ON) vs resting (OFF)",
      "heatmap.analyzed_players": "Analyzed Players"
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
      "heatmap.analyzed_players": "Joueurs Analysés"
    }
  };

  static dictionaries = {
    es: { ...TranslationStore.defaultDictionary.es },
    ca: { ...TranslationStore.defaultDictionary.ca },
    en: { ...TranslationStore.defaultDictionary.en },
    fr: { ...TranslationStore.defaultDictionary.fr }
  };

  static currentLang = localStorage.getItem("iq_lang") || "es";

  static normalizeLang(langCode = "es") {
    const code = String(langCode || "es").trim().toLowerCase();
    return code === "cat" ? "ca" : code;
  }

  static t(key, fallbackOrParams = "", maybeFallback = "") {
    if (!key) return "";
    let fallback = typeof fallbackOrParams === "string" ? fallbackOrParams : maybeFallback;
    const lang = this.normalizeLang(this.currentLang);
    const dict = this.dictionaries[lang] || this.dictionaries.es || {};
    const res = dict[key];
    if (res !== undefined && res !== null && res !== "") {
      return res;
    }
    return fallback || key;
  }

  static getDictionary(langCode = null) {
    const code = this.normalizeLang(langCode || this.currentLang);
    return this.dictionaries[code] || this.defaultDictionary[code] || this.defaultDictionary.es;
  }

  static saveDictionary(langCode, dict) {
    const code = this.normalizeLang(langCode);
    this.dictionaries[code] = { ...(this.dictionaries[code] || {}), ...dict };
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`iq_dict_${code}`, JSON.stringify(this.dictionaries[code]));
    }
  }

  static async setLanguage(langCode) {
    const code = this.normalizeLang(langCode);
    this.currentLang = code;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("iq_lang", code);
      const cached = localStorage.getItem(`iq_dict_${code}`);
      if (cached) {
        try {
          this.dictionaries[code] = { ...this.dictionaries[code], ...JSON.parse(cached) };
        } catch {
          // continuar
        }
      }
    }
    if (I18n && typeof I18n.setLocale === "function") {
      I18n.setLocale(code);
    }
  }

  static async initAllTranslations() {
    try {
      // 1. Cargar caché de LocalStorage primero
      if (typeof localStorage !== "undefined") {
        for (const lang of ["es", "ca", "en", "fr"]) {
          const cached = localStorage.getItem(`iq_dict_${lang}`);
          if (cached) {
            try {
              this.dictionaries[lang] = { ...this.dictionaries[lang], ...JSON.parse(cached) };
            } catch {
              // continuar
            }
          }
        }
      }

      // 2. Sincronizar desde Supabase
      if (supabase) {
        const { data, error } = await supabase.from("translations").select("*");
        if (!error && data) {
          data.forEach(item => {
            const lang = this.normalizeLang(item.language_code);
            if (!this.dictionaries[lang]) this.dictionaries[lang] = {};
            this.dictionaries[lang][item.key] = item.translation;
          });

          if (typeof localStorage !== "undefined") {
            Object.keys(this.dictionaries).forEach(lang => {
              localStorage.setItem(`iq_dict_${lang}`, JSON.stringify(this.dictionaries[lang]));
            });
          }
        }
      }
    } catch (err) {
      console.warn("[TranslationStore] Inicialización offline:", err.message);
    }
  }
}

// Alias de exportación para total compatibilidad
export const TranslationService = TranslationStore;
export default TranslationStore;