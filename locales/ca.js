export const ca = {
  // --- 1. ESTRUCTURA SEMÁNTICA ANIDADA ---
  common: {
    loading: "Carregant...",
    saving: "Desant...",
    saved: "Desat correctament",
    processing: "Processant...",
    searching: "Cercant...",
    noData: "Sense dades disponibles",
    noResults: "No s'han trobat resultats",
    notAvailable: "N/D",
    yes: "Sí",
    no: "No",
    all: "Tots",
    none: "Cap",
    actions: {
      save: "Desar",
      saveChanges: "Desar Canvis",
      cancel: "Cancel·lar",
      close: "Tancar",
      back: "Tornar",
      next: "Següent",
      edit: "Editar",
      delete: "Eliminar",
      confirm: "Confirmar",
      view: "Veure",
      export: "Exportar",
      search: "Cercar"
    }
  },
  navigation: {
    home: "Inici",
    dashboard: "Tauler Principal",
    team: "Equip",
    players: "Jugadors",
    games: "Partits",
    gameStats: "Estadístiques de Partit",
    advancedStats: "Anàlisi Avançada",
    lineups: "Quintets",
    comparator: "Comparador",
    reports: "Informes",
    aiAssistant: "Assistent IQ",
    profile: "Perfil",
    settings: "Configuració",
    logout: "Tancar Sessió",
    more: "Més"
  },
  dashboard: {
    title: "Resum de Temporada",
    games: {
      played: "Partits Jugats",
      total: "Total Partits",
      wins: "Victòries",
      losses: "Derrotes",
      winPercentage: "% Victòries"
    },
    points: {
      for: "Punts a Favor",
      against: "Punts en Contra",
      perGame: "Puntuació Mitjana",
      allowedPerGame: "Punts Rebuts Mitjana",
      difference: "Diferència Total"
    },
    rating: {
      offensive: "Offensive Rating",
      defensive: "Defensive Rating",
      net: "Net Rating"
    },
    sections: {
      summary: "Resum General",
      performance: "Rendiment de l'Equip",
      recentGames: "Últims Partits",
      highlights: "Jugadors Destacats"
    },
    tabs: {
      attack: "Atac",
      defense: "Defensa",
      pace: "Ritme",
      shooting: "Llançament"
    }
  },
  stats: {
    gamesPlayed: "Partits Jugats",
    wins: "Victòries",
    losses: "Derrotes",
    ppg: "Punts Per Partit",
    oppg: "Punts Permesos",
    offRating: "Offensive Rating",
    defRating: "Defensive Rating",
    netRating: "Net Rating",
    pace: "Ritme (Pace)",
    efg: "eFG% (Tir Efectiu)",
    ts: "TS% (True Shooting)",
    tovPct: "TOV% (% Pèrdues)",
    orbPct: "ORB% (% Rebot Ofensiu)",
    drbPct: "DRB% (% Rebot Defensiu)",
    ftr: "FTR (Tirs Lliures per Tir de Camp)",
    val: "Valoració / EFF",
    help: {
      netRating: "Diferència de punts produïda i rebuda per cada 100 possessions.",
      efg: "Percentatge de tir que atorga un 50% més de valor als triples anotats.",
      ts: "Mesura l'eficiència global de tir considerant dobles, triples i tirs lliures.",
      pace: "Nombre estimat de possessions jugades per cada 40 minuts."
    }
  },
  games: {
    date: "Data",
    time: "Hora",
    opponent: "Rival",
    location: "Seu",
    home: "Local",
    away: "Visitant",
    score: "Resultat",
    actions: {
      start: "Registrar Partit",
      continue: "Continuar Partit",
      viewStats: "Veure Estadístiques"
    }
  },
  ai: {
    title: "Assistent Analític IQ",
    subtitle: "Consulta informació esportiva en llenguatge natural",
    input: {
      placeholder: "Fes una pregunta sobre el rendiment de l'equip..."
    },
    send: "Enviar",
    status: {
      ready: "A punt",
      thinking: "Analitzant dades...",
      error: "Error en processar la consulta"
    }
  },

  // --- 2. CLAVES PLANAS SINCRO CON SUPABASE (DICCIONARIO BBDD CATALÀ) ---
  actions: "Accions",
  active_players: "Jugadors Actius",
  active_role: "Rol Actiu",
  active_team: "Equip Actiu",
  add_player: "Afegir Jugador",
  advanced_stats: "Estadística Avançada",
  against: "En contra",
  all_positions: "Totes les Posicions",
  ask_ai: "Pregunta a les dades",
  assists: "Assistències",
  blocks: "Dops",
  boxscore: "Registre Estadístic",
  comparator: "Comparador",
  completed: "Finalitzat",
  dashboard: "Tauler Principal",
  edit: "Editar",
  fouls: "Faltes",
  games: "Partits",
  height: "Alçada",
  in_favor: "A favor",
  jersey: "Dorsal",
  language: "Idioma",
  lineups: "Quintets",
  local: "Local",
  logout: "Tancar sessió",
  market: "Mercat de Fitxatges",
  no_players_loaded: "No hi ha jugadors carregats a la plantilla.",
  opponent: "Rival",
  pending: "Pendent",
  players: "Jugadors",
  points: "Punts",
  position: "Posició",
  ppg_tooltip: "Punts per partit mitjans anotats pel jugador.",
  profile: "El meu Perfil",
  read_only: "Mode Només Lectura",
  rebounds: "Rebots",
  record: "Balanç",
  reports: "Informes",
  roster: "Plantilla",
  save_changes: "Desar Canvis",
  score: "Resultat",
  search_player: "Cercar jugador...",
  season: "Temporada",
  seasons: "Temporades",
  settings: "Configuració",
  stats: "Estadístiques",
  status: "Estat",
  steals: "Recuperacions",
  team: "Equip",
  team_info: "Informació de l'Equip",
  turnovers: "Pèrdues",
  users_roles: "Usuaris i Rols",
  view_boxscore: "Anàlisi",
  visitor: "Visitant"
};