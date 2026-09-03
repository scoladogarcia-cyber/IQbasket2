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
      approval_center: "Solicitudes",
      "approvals.title": "Bandeja de Solicitudes",
      "approvals.subtitle": "Centraliza accesos, cierres y traspasos, mostrando sólo las acciones permitidas por tu rol y contexto.",
      "approvals.refresh": "Actualizar",
      "approvals.total": "Total",
      "approvals.pending": "Pendientes",
      "approvals.resolved": "Resueltas",
      "approvals.history": "Historial",
      "approvals.all": "Todas",
      "approvals.type_game_lock": "Cierre de partido",
      "approvals.type_team_access": "Acceso a equipo",
      "approvals.status_pending": "Pendiente",
      "approvals.status_approved": "Aprobada",
      "approvals.status_rejected": "Rechazada",
      "approvals.status_cancelled": "Cancelada",
      "approvals.view_context": "Ver contexto",
      "approvals.approve": "Aprobar",
      "approvals.reject": "Rechazar",
      "approvals.loading": "Cargando solicitudes...",
      "approvals.partial": "La bandeja se ha cargado parcialmente.",
      "approvals.empty_pending": "No tienes solicitudes pendientes",
      "approvals.empty_filter": "No hay solicitudes en este filtro",
      "approvals.empty_help": "La bandeja se actualizará al entrar de nuevo o al pulsar Actualizar.",
      "approvals.restricted": "Acceso restringido",
      "approvals.restricted_body": "Tu perfil no puede consultar la Bandeja de Solicitudes.",
      "approvals.game_title": "Cerrar partido vs {opponent}",
      "approvals.access_subtitle": "Acceso a {team} como {role}",
      "approvals.approve_lock_confirm": "¿Aprobar y cerrar este partido? Quedará bloqueado hasta que un Admin/Superadmin lo reabra.",
      "approvals.approve_access_confirm": "¿Aprobar esta solicitud de acceso?",
      "approvals.reject_reason": "Motivo del rechazo (opcional):",
      "approvals.action_error": "No se pudo completar la acción.",
      "approvals.type_transfer": "Traspaso",
      "approvals.transfer_title": "Traspaso · {player}",
      "approvals.transfer_route": "{origin} → {destination}",
      "approvals.transfer_source": "Origen",
      "approvals.transfer_destination": "Destino",
      "approvals.transfer_pending": "Pendiente",
      "approvals.transfer_approved": "Aprobado",
      "approvals.transfer_rejected": "Rechazado",
      "approvals.transfer_last_day_source": "Último día en origen",
      "approvals.transfer_first_day_destination": "Primer día en destino",
      "approvals.transfer_requested_start": "Alta solicitada",
      "approvals.transfer_reason_optional": "Motivo / nota (opcional)",
      "approvals.transfer_reason_placeholder": "Añade contexto si es necesario",
      "approvals.transfer_approve_side": "Aprobar",
      "approvals.transfer_ready": "Lista para finalizar",
      "approvals.transfer_finalize": "Finalizar traspaso",
      "approvals.transfer_finalize_help": "Origen y destino están aprobados. La finalización aplicará el cambio temporal de plantilla con las fechas acordadas.",
      "approvals.transfer_finalize_confirm": "¿Finalizar el traspaso con las fechas aprobadas por origen y destino? Esta acción actualizará la elegibilidad histórica del jugador.",
      "approvals.transfer_date_required": "Selecciona una fecha válida antes de aprobar.",
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
      approval_center: "Sol·licituds",
      "approvals.title": "Safata de Sol·licituds",
      "approvals.subtitle": "Centralitza accessos, tancaments i traspassos, mostrant només les accions permeses pel teu rol i context.",
      "approvals.refresh": "Actualitzar",
      "approvals.total": "Total",
      "approvals.pending": "Pendents",
      "approvals.resolved": "Resoltes",
      "approvals.history": "Historial",
      "approvals.all": "Totes",
      "approvals.type_game_lock": "Tancament de partit",
      "approvals.type_team_access": "Accés a equip",
      "approvals.status_pending": "Pendent",
      "approvals.status_approved": "Aprovada",
      "approvals.status_rejected": "Rebutjada",
      "approvals.status_cancelled": "Cancel·lada",
      "approvals.view_context": "Veure context",
      "approvals.approve": "Aprovar",
      "approvals.reject": "Rebutjar",
      "approvals.loading": "Carregant sol·licituds...",
      "approvals.partial": "La safata s’ha carregat parcialment.",
      "approvals.empty_pending": "No tens sol·licituds pendents",
      "approvals.empty_filter": "No hi ha sol·licituds en aquest filtre",
      "approvals.empty_help": "La safata s’actualitzarà en tornar a entrar o en prémer Actualitzar.",
      "approvals.restricted": "Accés restringit",
      "approvals.restricted_body": "El teu perfil no pot consultar la Safata de Sol·licituds.",
      "approvals.game_title": "Tancar partit vs {opponent}",
      "approvals.access_subtitle": "Accés a {team} com a {role}",
      "approvals.approve_lock_confirm": "Aprovar i tancar aquest partit? Quedarà bloquejat fins que un Admin/Superadmin el reobri.",
      "approvals.approve_access_confirm": "Aprovar aquesta sol·licitud d’accés?",
      "approvals.reject_reason": "Motiu del rebuig (opcional):",
      "approvals.action_error": "No s’ha pogut completar l’acció.",
      "approvals.type_transfer": "Traspàs",
      "approvals.transfer_title": "Traspàs · {player}",
      "approvals.transfer_route": "{origin} → {destination}",
      "approvals.transfer_source": "Origen",
      "approvals.transfer_destination": "Destí",
      "approvals.transfer_pending": "Pendent",
      "approvals.transfer_approved": "Aprovat",
      "approvals.transfer_rejected": "Rebutjat",
      "approvals.transfer_last_day_source": "Últim dia a l’origen",
      "approvals.transfer_first_day_destination": "Primer dia al destí",
      "approvals.transfer_requested_start": "Alta sol·licitada",
      "approvals.transfer_reason_optional": "Motiu / nota (opcional)",
      "approvals.transfer_reason_placeholder": "Afegeix context si cal",
      "approvals.transfer_approve_side": "Aprovar",
      "approvals.transfer_ready": "Llest per finalitzar",
      "approvals.transfer_finalize": "Finalitzar traspàs",
      "approvals.transfer_finalize_help": "Origen i destí estan aprovats. La finalització aplicarà el canvi temporal de plantilla amb les dates acordades.",
      "approvals.transfer_finalize_confirm": "Finalitzar el traspàs amb les dates aprovades per origen i destí? Aquesta acció actualitzarà l’elegibilitat històrica del jugador.",
      "approvals.transfer_date_required": "Selecciona una data vàlida abans d’aprovar.",
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
      approval_center: "Requests",
      "approvals.title": "Request Inbox",
      "approvals.subtitle": "Centralizes access, game closures and transfers, exposing only actions allowed by your role and context.",
      "approvals.refresh": "Refresh",
      "approvals.total": "Total",
      "approvals.pending": "Pending",
      "approvals.resolved": "Resolved",
      "approvals.history": "History",
      "approvals.all": "All",
      "approvals.type_game_lock": "Game closure",
      "approvals.type_team_access": "Team access",
      "approvals.status_pending": "Pending",
      "approvals.status_approved": "Approved",
      "approvals.status_rejected": "Rejected",
      "approvals.status_cancelled": "Cancelled",
      "approvals.view_context": "View context",
      "approvals.approve": "Approve",
      "approvals.reject": "Reject",
      "approvals.loading": "Loading requests...",
      "approvals.partial": "The inbox was only partially loaded.",
      "approvals.empty_pending": "You have no pending requests",
      "approvals.empty_filter": "No requests match this filter",
      "approvals.empty_help": "The inbox refreshes when reopened or when you press Refresh.",
      "approvals.restricted": "Restricted access",
      "approvals.restricted_body": "Your profile cannot access the Request Inbox.",
      "approvals.game_title": "Close game vs {opponent}",
      "approvals.access_subtitle": "Access to {team} as {role}",
      "approvals.approve_lock_confirm": "Approve and close this game? It will remain locked until an Admin/Superadmin reopens it.",
      "approvals.approve_access_confirm": "Approve this access request?",
      "approvals.reject_reason": "Rejection reason (optional):",
      "approvals.action_error": "The action could not be completed.",
      "approvals.type_transfer": "Transfer",
      "approvals.transfer_title": "Transfer · {player}",
      "approvals.transfer_route": "{origin} → {destination}",
      "approvals.transfer_source": "Source",
      "approvals.transfer_destination": "Destination",
      "approvals.transfer_pending": "Pending",
      "approvals.transfer_approved": "Approved",
      "approvals.transfer_rejected": "Rejected",
      "approvals.transfer_last_day_source": "Last day at source",
      "approvals.transfer_first_day_destination": "First day at destination",
      "approvals.transfer_requested_start": "Requested start",
      "approvals.transfer_reason_optional": "Reason / note (optional)",
      "approvals.transfer_reason_placeholder": "Add context if needed",
      "approvals.transfer_approve_side": "Approve",
      "approvals.transfer_ready": "Ready to finalize",
      "approvals.transfer_finalize": "Finalize transfer",
      "approvals.transfer_finalize_help": "Source and destination are approved. Finalization will apply the roster eligibility change using the agreed dates.",
      "approvals.transfer_finalize_confirm": "Finalize the transfer using the dates approved by source and destination? This will update the player’s historical eligibility.",
      "approvals.transfer_date_required": "Select a valid date before approving.",
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
      approval_center: "Demandes",
      "approvals.title": "Boîte de Demandes",
      "approvals.subtitle": "Centralise les accès, clôtures et transferts, et n’affiche que les actions autorisées par votre rôle et votre contexte.",
      "approvals.refresh": "Actualiser",
      "approvals.total": "Total",
      "approvals.pending": "En attente",
      "approvals.resolved": "Résolues",
      "approvals.history": "Historique",
      "approvals.all": "Toutes",
      "approvals.type_game_lock": "Clôture de match",
      "approvals.type_team_access": "Accès à l’équipe",
      "approvals.status_pending": "En attente",
      "approvals.status_approved": "Approuvée",
      "approvals.status_rejected": "Rejetée",
      "approvals.status_cancelled": "Annulée",
      "approvals.view_context": "Voir le contexte",
      "approvals.approve": "Approuver",
      "approvals.reject": "Rejeter",
      "approvals.loading": "Chargement des demandes...",
      "approvals.partial": "La boîte de demandes n’a été chargée que partiellement.",
      "approvals.empty_pending": "Vous n’avez aucune demande en attente",
      "approvals.empty_filter": "Aucune demande pour ce filtre",
      "approvals.empty_help": "La boîte se met à jour à sa réouverture ou en appuyant sur Actualiser.",
      "approvals.restricted": "Accès restreint",
      "approvals.restricted_body": "Votre profil ne peut pas consulter la Boîte de Demandes.",
      "approvals.game_title": "Clôturer le match contre {opponent}",
      "approvals.access_subtitle": "Accès à {team} comme {role}",
      "approvals.approve_lock_confirm": "Approuver et clôturer ce match ? Il restera verrouillé jusqu’à sa réouverture par un Admin/Superadmin.",
      "approvals.approve_access_confirm": "Approuver cette demande d’accès ?",
      "approvals.reject_reason": "Motif du rejet (facultatif) :",
      "approvals.action_error": "L’action n’a pas pu être effectuée.",
      "approvals.type_transfer": "Transfert",
      "approvals.transfer_title": "Transfert · {player}",
      "approvals.transfer_route": "{origin} → {destination}",
      "approvals.transfer_source": "Origine",
      "approvals.transfer_destination": "Destination",
      "approvals.transfer_pending": "En attente",
      "approvals.transfer_approved": "Approuvé",
      "approvals.transfer_rejected": "Rejeté",
      "approvals.transfer_last_day_source": "Dernier jour à l’origine",
      "approvals.transfer_first_day_destination": "Premier jour à destination",
      "approvals.transfer_requested_start": "Début demandé",
      "approvals.transfer_reason_optional": "Motif / note (facultatif)",
      "approvals.transfer_reason_placeholder": "Ajoutez du contexte si nécessaire",
      "approvals.transfer_approve_side": "Approuver",
      "approvals.transfer_ready": "Prêt à finaliser",
      "approvals.transfer_finalize": "Finaliser le transfert",
      "approvals.transfer_finalize_help": "L’origine et la destination ont approuvé. La finalisation appliquera le changement d’éligibilité avec les dates convenues.",
      "approvals.transfer_finalize_confirm": "Finaliser le transfert avec les dates approuvées par l’origine et la destination ? Cette action mettra à jour l’éligibilité historique du joueur.",
      "approvals.transfer_date_required": "Sélectionnez une date valide avant d’approuver.",
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

  // Evita reconsultar el diccionario remoto en cada render/cambio de pantalla.
  // Las traducciones editadas desde administración actualizan la caché local al guardar.
  static remoteCacheTtlMs = 6 * 60 * 60 * 1000;

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
      localStorage.setItem(`iq_dict_sync_${code}`, String(Date.now()));
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

  /**
   * Mantiene el nombre histórico por compatibilidad, pero carga únicamente
   * el idioma activo y usa una caché temporal. Antes descargaba los 4 idiomas
   * completos en cada sincronización.
   */
  static async initAllTranslations(forceRefresh = false) {
    try {
      const lang = this.normalizeLang(this.currentLang || "es");
      let hasCachedDictionary = false;

      // 1. Hidratar únicamente el idioma activo desde LocalStorage.
      if (typeof localStorage !== "undefined") {
        const cached = localStorage.getItem(`iq_dict_${lang}`);
        if (cached) {
          try {
            this.dictionaries[lang] = {
              ...this.dictionaries[lang],
              ...JSON.parse(cached)
            };
            hasCachedDictionary = true;
          } catch {
            // Si la caché estuviera dañada, se recuperará desde Supabase.
          }
        }

        if (!forceRefresh && hasCachedDictionary) {
          const lastSync = Number(localStorage.getItem(`iq_dict_sync_${lang}`) || 0);
          if (lastSync > 0 && (Date.now() - lastSync) < this.remoteCacheTtlMs) {
            return;
          }
        }
      }

      // 2. Sincronizar solo el idioma activo y solo las columnas necesarias.
      if (supabase) {
        let query = supabase
          .from("translations")
          .select("key,language_code,translation,updated_at");

        if (lang === "ca") {
          query = query.in("language_code", ["ca", "cat"]);
        } else {
          query = query.eq("language_code", lang);
        }

        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          data.forEach(item => {
            const itemLang = this.normalizeLang(item.language_code);
            if (!this.dictionaries[itemLang]) this.dictionaries[itemLang] = {};
            this.dictionaries[itemLang][item.key] = item.translation;
          });

          if (typeof localStorage !== "undefined") {
            localStorage.setItem(
              `iq_dict_${lang}`,
              JSON.stringify(this.dictionaries[lang] || {})
            );
            localStorage.setItem(`iq_dict_sync_${lang}`, String(Date.now()));
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