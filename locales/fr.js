export const fr = {
  // --- 1. ESTRUCTURA SEMÁNTICA ANIDADA ---
  common: {
    loading: "Chargement...",
    saving: "Enregistrement...",
    saved: "Enregistré avec succès",
    processing: "Traitement...",
    searching: "Recherche...",
    noData: "Aucune donnée disponible",
    noResults: "Aucun résultat trouvé",
    notAvailable: "N/D",
    yes: "Oui",
    no: "Non",
    all: "Tous",
    none: "Aucun",
    actions: {
      save: "Enregistrer",
      saveChanges: "Enregistrer les modifications",
      cancel: "Annuler",
      close: "Fermer",
      back: "Retour",
      next: "Suivant",
      edit: "Modifier",
      delete: "Supprimer",
      confirm: "Confirmer",
      view: "Voir",
      export: "Exporter",
      search: "Rechercher"
    }
  },
  navigation: {
    home: "Accueil",
    dashboard: "Tableau de Bord",
    team: "Équipe",
    players: "Joueurs",
    games: "Matchs",
    gameStats: "Statistiques du Match",
    advancedStats: "Analyse Avancée",
    lineups: "Cinq Majeur / Alignements",
    comparator: "Comparateur",
    reports: "Rapports",
    aiAssistant: "Assistant IQ",
    profile: "Profil",
    settings: "Paramètres",
    logout: "Déconnexion",
    more: "Plus"
  },
  dashboard: {
    title: "Résumé de la Saison",
    games: {
      played: "Matchs Joués",
      total: "Total Matchs",
      wins: "Victoires",
      losses: "Défaites",
      winPercentage: "% Victoires"
    },
    points: {
      for: "Points Pour",
      against: "Points Contre",
      perGame: "Points Par Match",
      allowedPerGame: "Points Encassés Par Match",
      difference: "Différentiel de Points"
    },
    rating: {
      offensive: "Offensive Rating",
      defensive: "Defensive Rating",
      net: "Net Rating"
    },
    sections: {
      summary: "Vue d'ensemble",
      performance: "Performance de l'Équipe",
      recentGames: "Derniers Matchs",
      highlights: "Joueurs Vedettes"
    },
    tabs: {
      attack: "Attaque",
      defense: "Défense",
      pace: "Rythme",
      shooting: "Tirs"
    }
  },
  stats: {
    gamesPlayed: "Matchs Joués",
    wins: "Victoires",
    losses: "Défaites",
    ppg: "Points Par Match",
    oppg: "Points Encassés",
    offRating: "Offensive Rating",
    defRating: "Defensive Rating",
    netRating: "Net Rating",
    pace: "Rythme (Pace)",
    efg: "eFG% (Tir Effectif)",
    ts: "TS% (True Shooting)",
    tovPct: "TOV% (% Balles Perdues)",
    orbPct: "ORB% (% Rebonds Offensifs)",
    drbPct: "DRB% (% Rebonds Défensifs)",
    ftr: "FTR (Lancers Francs par Tir)",
    val: "Évaluation / VAL",
    help: {
      netRating: "Différence de points produits et encassés pour 100 possessions.",
      efg: "Pourcentage de tir accordant 50% de valeur supplémentaire aux paniers à 3 points.",
      ts: "Mesure l'efficacité globale au tir en prenant en compte les 2pts, 3pts et lancers francs.",
      pace: "Nombre estimé de possessions jouées toutes les 40 minutes."
    }
  },
  games: {
    date: "Date",
    time: "Heure",
    opponent: "Adversaire",
    location: "Lieu",
    home: "Domicile",
    away: "Extérieur",
    score: "Score",
    actions: {
      start: "Enregistrer Match",
      continue: "Continuer Match",
      viewStats: "Voir Statistiques"
    }
  },
  ai: {
    title: "Assistant Analytique IQ",
    subtitle: "Posez des questions sur le rendement en langage naturel",
    input: {
      placeholder: "Posez une question sur le rendement de l'équipe..."
    },
    send: "Envoyer",
    status: {
      ready: "Prêt",
      thinking: "Analyse des données...",
      error: "Erreur lors du traitement"
    }
  },

  // --- 2. CLAVES PLANAS SINCRO CON SUPABASE (DICCIONARIO BBDD FRANÇAIS) ---
  actions: "Actions",
  active_players: "Joueurs Actifs",
  active_role: "Rôle Actif",
  active_team: "Équipe Active",
  add_player: "Ajouter un Joueur",
  advanced_stats: "Statistiques Avancées",
  against: "Contre",
  all_positions: "Toutes les Positions",
  ask_ai: "Posez une question",
  assists: "Passes Décisives",
  blocks: "Contres",
  boxscore: "Registre Statistique",
  comparator: "Comparateur",
  completed: "Terminé",
  dashboard: "Tableau de Bord",
  edit: "Modifier",
  fouls: "Fautes",
  games: "Matchs",
  height: "Taille",
  in_favor: "Pour",
  jersey: "Maillot",
  language: "Langue",
  lineups: "Cinq Majeur",
  local: "Domicile",
  logout: "Déconnexion",
  market: "Marché des Transferts",
  no_players_loaded: "Aucun joueur chargé dans l'effectif.",
  opponent: "Adversaire",
  pending: "En attente",
  players: "Joueurs",
  points: "Points",
  position: "Poste",
  ppg_tooltip: "Moyenne de points par match marqués par le joueur.",
  profile: "Mon Profil",
  read_only: "Mode Lecture Seule",
  rebounds: "Rebonds",
  record: "Bilan",
  reports: "Rapports",
  roster: "Effectif",
  save_changes: "Enregistrer les modifications",
  score: "Score",
  search_player: "Rechercher un joueur...",
  season: "Saison",
  seasons: "Saisons",
  settings: "Paramètres",
  stats: "Statistiques",
  status: "Statut",
  steals: "Interceptions",
  team: "Équipe",
  team_info: "Informations sur l'équipe",
  turnovers: "Balles Perdues",
  users_roles: "Utilisateurs et Rôles",
  view_boxscore: "Analyse",
  visitor: "Extérieur"
};