export const en = {
  // --- 1. ESTRUCTURA SEMÁNTICA ANIDADA ---
  common: {
    loading: "Loading...",
    saving: "Saving...",
    saved: "Successfully saved",
    processing: "Processing...",
    searching: "Searching...",
    noData: "No data available",
    noResults: "No results found",
    notAvailable: "N/A",
    yes: "Yes",
    no: "No",
    all: "All",
    none: "None",
    actions: {
      save: "Save",
      saveChanges: "Save Changes",
      cancel: "Cancel",
      close: "Close",
      back: "Back",
      next: "Next",
      edit: "Edit",
      delete: "Delete",
      confirm: "Confirm",
      view: "View",
      export: "Export",
      search: "Search"
    }
  },
  navigation: {
    home: "Home",
    dashboard: "Dashboard",
    team: "Team",
    players: "Players",
    games: "Games",
    gameStats: "Game Stats",
    advancedStats: "Advanced Stats",
    lineups: "Lineups",
    comparator: "Comparator",
    reports: "Reports",
    aiAssistant: "IQ Assistant",
    profile: "Profile",
    settings: "Settings",
    logout: "Log Out",
    more: "More"
  },
  dashboard: {
    title: "Season Summary",
    games: {
      played: "Games Played",
      total: "Total Games",
      wins: "Wins",
      losses: "Losses",
      winPercentage: "Win %"
    },
    points: {
      for: "Points For",
      against: "Points Against",
      perGame: "Points Per Game",
      allowedPerGame: "Points Allowed Per Game",
      difference: "Point Differential"
    },
    rating: {
      offensive: "Offensive Rating",
      defensive: "Defensive Rating",
      net: "Net Rating"
    },
    sections: {
      summary: "Overview",
      performance: "Team Performance",
      recentGames: "Recent Games",
      highlights: "Featured Players"
    },
    tabs: {
      attack: "Offense",
      defense: "Defense",
      pace: "Pace",
      shooting: "Shooting"
    }
  },
  stats: {
    gamesPlayed: "Games Played",
    wins: "Wins",
    losses: "Losses",
    ppg: "Points Per Game",
    oppg: "Points Allowed",
    offRating: "Offensive Rating",
    defRating: "Defensive Rating",
    netRating: "Net Rating",
    pace: "Pace",
    efg: "eFG% (Effective FG%)",
    ts: "TS% (True Shooting%)",
    tovPct: "TOV% (Turnover %)",
    orbPct: "ORB% (Offensive Rebound %)",
    drbPct: "DRB% (Defensive Rebound %)",
    ftr: "FTR (Free Throw Rate)",
    val: "Efficiency / VAL",
    help: {
      netRating: "Point differential produced and allowed per 100 possessions.",
      efg: "Shooting percentage giving 50% extra weight to 3-point field goals.",
      ts: "Measures overall shooting efficiency taking into account 2PT, 3PT, and FT.",
      pace: "Estimated number of possessions played per 40 minutes."
    }
  },
  games: {
    date: "Date",
    time: "Time",
    opponent: "Opponent",
    location: "Location",
    home: "Home",
    away: "Away",
    score: "Score",
    actions: {
      start: "Record Game",
      continue: "Continue Game",
      viewStats: "View Stats"
    }
  },
  ai: {
    title: "IQ Analytics Assistant",
    subtitle: "Ask questions about performance in natural language",
    input: {
      placeholder: "Ask a question about team performance..."
    },
    send: "Send",
    status: {
      ready: "Ready",
      thinking: "Analyzing data...",
      error: "Error processing request"
    }
  },

  // --- 2. CLAVES PLANAS SINCRO CON SUPABASE (DICCIONARIO BBDD ENGLISH) ---
  actions: "Actions",
  active_players: "Active Players",
  active_role: "Active Role",
  active_team: "Active Team",
  add_player: "Add Player",
  advanced_stats: "Advanced Stats",
  against: "Against",
  all_positions: "All Positions",
  ask_ai: "Ask your Data",
  assists: "Assists",
  blocks: "Blocks",
  boxscore: "Box Score Register",
  comparator: "Comparator",
  completed: "Final",
  dashboard: "Dashboard",
  edit: "Edit",
  fouls: "Fouls",
  games: "Games",
  height: "Height",
  in_favor: "For",
  jersey: "Jersey",
  language: "Language",
  lineups: "Lineups",
  local: "Home",
  logout: "Log Out",
  market: "Transfer Market",
  no_players_loaded: "No players loaded in the roster.",
  opponent: "Opponent",
  pending: "Pending",
  players: "Players",
  points: "Points",
  position: "Position",
  ppg_tooltip: "Average points per game scored by the player.",
  profile: "My Profile",
  read_only: "Read-Only Mode",
  rebounds: "Rebounds",
  record: "Record",
  reports: "Reports",
  roster: "Roster",
  save_changes: "Save Changes",
  score: "Score",
  search_player: "Search player...",
  season: "Season",
  seasons: "Seasons",
  settings: "Settings",
  stats: "Statistics",
  status: "Status",
  steals: "Steals",
  team: "Team",
  team_info: "Team Information",
  turnovers: "Turnovers",
  users_roles: "Users & Roles",
  view_boxscore: "Analysis",
  visitor: "Away"
};