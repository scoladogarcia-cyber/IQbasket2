export const es = {
  // --- 1. ESTRUCTURA SEMÁNTICA ANIDADA ---
  common: {
    loading: "Cargando...",
    saving: "Guardando...",
    saved: "Guardado correctamente",
    processing: "Procesando...",
    searching: "Buscando...",
    noData: "Sin datos disponibles",
    noResults: "No se encontraron resultados",
    notAvailable: "N/D",
    yes: "Sí",
    no: "No",
    all: "Todos",
    none: "Ninguno",
    actions: {
      save: "Guardar",
      saveChanges: "Guardar Cambios",
      cancel: "Cancelar",
      close: "Cerrar",
      back: "Volver",
      next: "Siguiente",
      edit: "Editar",
      delete: "Eliminar",
      confirm: "Confirmar",
      view: "Ver",
      export: "Exportar",
      search: "Buscar"
    }
  },
  navigation: {
    home: "Inicio",
    dashboard: "Dashboard",
    team: "Equipo",
    players: "Jugadores",
    games: "Partidos",
    gameStats: "Estadísticas de Partido",
    advancedStats: "Análisis Avanzado",
    lineups: "Quintetos",
    comparator: "Comparador",
    reports: "Informes",
    aiAssistant: "Asistente IQ",
    profile: "Perfil",
    settings: "Configuración",
    logout: "Cerrar Sesión",
    more: "Más"
  },
  dashboard: {
    title: "Resumen de Temporada",
    games: {
      played: "Partidos Jugados",
      total: "Total Partidos",
      wins: "Victorias",
      losses: "Derrotas",
      winPercentage: "% Victorias"
    },
    points: {
      for: "Puntos a Favor",
      against: "Puntos en Contra",
      perGame: "Puntuación Media",
      allowedPerGame: "Puntos Recibidos Media",
      difference: "Diferencia Total"
    },
    rating: {
      offensive: "Offensive Rating",
      defensive: "Defensive Rating",
      net: "Net Rating"
    },
    sections: {
      summary: "Resumen General",
      performance: "Rendimiento del Equipo",
      recentGames: "Últimos Partidos",
      highlights: "Jugadores Destacados"
    },
    tabs: {
      attack: "Ataque",
      defense: "Defensa",
      pace: "Ritmo",
      shooting: "Tiro"
    }
  },
  stats: {
    gamesPlayed: "Partidos Jugados",
    wins: "Victorias",
    losses: "Derrotas",
    ppg: "Puntos Por Partido",
    oppg: "Puntos Permitidos",
    offRating: "Offensive Rating",
    defRating: "Defensive Rating",
    netRating: "Net Rating",
    pace: "Ritmo (Pace)",
    efg: "eFG% (Tiro Efectivo)",
    ts: "TS% (True Shooting)",
    tovPct: "TOV% (% Pérdidas)",
    orbPct: "ORB% (% Rebote Ofensivo)",
    drbPct: "DRB% (% Rebote Defensivo)",
    ftr: "FTR (Tiros Libres por Tiro de Campo)",
    val: "Valoración / EFF",
    help: {
      netRating: "Diferencia de puntos producida y recibida por cada 100 posesiones.",
      efg: "Porcentaje de tiro que otorga un 50% más de valor a los triples anotados.",
      ts: "Mide la eficiencia global de tiro considerando dobles, triples y tiros libres.",
      pace: "Número estimado de posesiones jugadas por cada 40 minutos."
    }
  },
  games: {
    date: "Fecha",
    time: "Hora",
    opponent: "Rival",
    location: "Sede",
    home: "Local",
    away: "Visitante",
    score: "Resultado",
    actions: {
      start: "Registrar Partido",
      continue: "Continuar Partido",
      viewStats: "Ver Estadísticas"
    }
  },
  ai: {
    title: "Asistente Analítico IQ",
    subtitle: "Consulta información deportiva en lenguaje natural",
    input: {
      placeholder: "Haz una pregunta sobre el rendimiento del equipo..."
    },
    send: "Enviar",
    status: {
      ready: "Listo",
      thinking: "Analizando datos...",
      error: "Error al procesar la consulta"
    }
  },

  // --- 2. CLAVES PLANAS SINCRO CON SUPABASE (DICCIONARIO BBDD) ---
  actions: "Acciones",
  active_players: "Jugadores Activos",
  active_role: "Rol Activo",
  active_team: "Equipo Activo",
  add_player: "Añadir Jugador",
  advanced_stats: "Estadística avanzada",
  against: "En contra",
  all_positions: "Todas las Posiciones",
  ask_ai: "Pregúntale a tus datos",
  assists: "Asistencias",
  blocks: "Tapones",
  boxscore: "Registro estadístico",
  comparator: "Comparador",
  completed: "Finalizado",
  dashboard: "Dashboard",
  edit: "Editar",
  fouls: "Faltas",
  games: "Partidos",
  height: "Altura",
  in_favor: "A favor",
  jersey: "Dorsal",
  language: "Idioma",
  lineups: "Quintetos",
  local: "Local",
  logout: "Cerrar sesión",
  market: "Mercado de Fichajes",
  no_players_loaded: "No hay jugadores cargados en la plantilla.",
  opponent: "Rival",
  pending: "Pendiente",
  players: "Jugadores",
  points: "Puntos",
  position: "Posición",
  ppg_tooltip: "Puntos Por Partido promedio anotados por el jugador.",
  profile: "Mi Perfil",
  read_only: "Modo Solo Lectura",
  rebounds: "Rebotes",
  record: "Balance",
  reports: "Informes",
  roster: "Plantilla",
  save_changes: "Guardar Cambios",
  score: "Resultado",
  search_player: "Buscar jugador...",
  season: "Temporada",
  seasons: "Temporadas",
  settings: "Configuración",
  stats: "Estadísticas",
  status: "Estado",
  steals: "Robos",
  team: "Equipo",
  team_info: "Información del Equipo",
  turnovers: "Pérdidas",
  users_roles: "Usuarios y Roles",
  view_boxscore: "Análisis",
  visitor: "Visitante"
};