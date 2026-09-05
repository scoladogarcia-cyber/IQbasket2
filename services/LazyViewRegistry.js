/**
 * @fileoverview Registro lazy de vistas secundarias de IQBasket.
 * @description Separa la carga del shell inicial de los módulos deportivos y
 * administrativos que sólo son necesarios después de navegar a una ruta.
 */

const SINGLETON_LOADERS = Object.freeze({
  team: async ({ supabase, authController }) => {
    const { TeamStatsView } = await import("../views/TeamStatsView.js");
    return new TeamStatsView(supabase, authController);
  },
  liveeditor: async ({ gameController, authController }) => {
    const { GameLiveEditorView } = await import("../views/GameLiveEditorView.js");
    return new GameLiveEditorView(gameController, authController);
  },
  heatmap: async ({ supabase, authController }) => {
    const { HeatmapAnalysisView } = await import("../views/HeatmapAnalysisView.js");
    return new HeatmapAnalysisView(supabase, authController);
  },
  advanced: async ({ gameController }) => {
    const { AdvancedStatsView } = await import("../views/AdvancedStatsView.js");
    return new AdvancedStatsView(gameController);
  },
  boxscore: async ({ supabase, authController }) => {
    const { GameBoxScoreView } = await import("../views/GameBoxScoreView.js");
    return new GameBoxScoreView(supabase, authController);
  },
  player: async ({ supabase, authController }) => {
    const { PlayerStatsView } = await import("../views/PlayerStatsView.js");
    return new PlayerStatsView(supabase, authController);
  },
  lineups: async ({ authController }) => {
    const { LineupsView } = await import("../views/LineupsView.js");
    return new LineupsView(authController);
  },
  comparator: async ({ authController }) => {
    const { ComparatorView } = await import("../views/ComparatorView.js");
    return new ComparatorView(authController);
  },
  reports: async ({ authController }) => {
    const { ReportsView } = await import("../views/ReportsView.js");
    return new ReportsView(authController);
  },
  familyworkspace: async ({ supabase, authController }) => {
    const { FamilyWorkspaceView } = await import("../views/family/FamilyWorkspaceView.js");
    return new FamilyWorkspaceView(supabase, authController);
  },
  business: async ({ supabase }) => {
    const { BusinessMetricsView } = await import("../views/admin/BusinessMetricsView.js");
    return new BusinessMetricsView(supabase);
  },
  familyadvisor: async ({ authController }) => {
    const { FamilyAdvisorView } = await import("../views/FamilyAdvisorView.js");
    return new FamilyAdvisorView(authController);
  },
  training: async ({ supabase, authController }) => {
    const { TrainingView } = await import("../views/TrainingView.js");
    return new TrainingView(supabase, authController);
  },
  nutrition: async ({ supabase, authController }) => {
    const { NutritionView } = await import("../views/NutritionView.js");
    return new NutritionView(supabase, authController);
  },
  player360: async ({ supabase, authController }) => {
    const { Player360View } = await import("../views/Player360View.js");
    return new Player360View(supabase, authController);
  },
  privacy: async ({ supabase, authController }) => {
    const { PrivacyCenterView } = await import("../views/PrivacyCenterView.js");
    return new PrivacyCenterView(supabase, authController);
  },
  ask: async ({ authController }) => {
    const { AskAIView } = await import("../views/AskAIView.js");
    return new AskAIView(authController);
  },
  profile: async ({ authController }) => {
    const { ProfileView } = await import("../views/ProfileView.js");
    return new ProfileView(authController);
  }
});

const ALIASES = Object.freeze({
  equipo: "team",
  perfil: "profile"
});

const FACTORY_LOADERS = Object.freeze({
  livehud: async ({ authController }, { gameId = null } = {}) => {
    const { LiveScoreHUDView } = await import("../views/LiveScoreHUDView.js");
    return new LiveScoreHUDView(authController, gameId);
  },
  easyentry: async ({ gameController, authController, i18n }, { gameId = null } = {}) => {
    const { EasyStatsEntryView } = await import("../views/EasyStatsEntryView.js");
    return new EasyStatsEntryView(gameController, authController, i18n, gameId);
  }
});
export class LazyViewRegistry {
  constructor(dependencies, target = {}) {
    this.dependencies = Object.freeze({ ...dependencies });
    this.target = target;
    this.pending = new Map();
  }

  _canonicalKey(key) {
    return ALIASES[key] || key;
  }

  async get(key) {
    const canonical = this._canonicalKey(key);
    if (this.target[canonical]) return this.target[canonical];
    if (this.pending.has(canonical)) return this.pending.get(canonical);

    const loader = SINGLETON_LOADERS[canonical];
    if (!loader) throw new Error(`UNKNOWN_LAZY_VIEW:${canonical}`);

    const promise = loader(this.dependencies)
      .then(view => {
        this.target[canonical] = view;
        for (const [alias, resolved] of Object.entries(ALIASES)) {
          if (resolved === canonical) this.target[alias] = view;
        }
        return view;
      })
      .finally(() => this.pending.delete(canonical));

    this.pending.set(canonical, promise);
    return promise;
  }

  async create(key, params = {}) {
    const loader = FACTORY_LOADERS[key];
    if (!loader) throw new Error(`UNKNOWN_LAZY_VIEW_FACTORY:${key}`);
    return loader(this.dependencies, params);
  }
}

export default LazyViewRegistry;
