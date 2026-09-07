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
  liveeditor: async ({ supabase, gameController, authController }) => {
    const { GameAccessView } = await import("../views/games/GameAccessView.js");
    return new GameAccessView(gameController, authController, supabase);
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
    const { ScopedGameBoxScoreView } = await import("../views/games/ScopedGameBoxScoreView.js");
    return new ScopedGameBoxScoreView(supabase, authController);
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
    const { FamilyWorkspaceV32View } = await import("../views/family/FamilyWorkspaceV32View.js");
    return new FamilyWorkspaceV32View(supabase, authController);
  },
  business: async ({ supabase, authController }) => {
    const { BusinessMetricsView } = await import("../views/admin/BusinessMetricsView.js");
    return new BusinessMetricsView(supabase, authController);
  },
  familyadvisor: async ({ supabase, authController }) => {
    const { FamilyAdvisorAccessView } = await import("../views/family/FamilyAdvisorAccessView.js");
    return new FamilyAdvisorAccessView(supabase, authController);
  },
  training: async ({ supabase, authController }) => {
    const { TrainingView } = await import("../views/TrainingView.js");
    return new TrainingView(supabase, authController);
  },
  nutrition: async ({ supabase, authController }) => {
    const { NutritionView } = await import("../views/NutritionView.js");
    const { PlayerNutritionRouterView } = await import("../views/PlayerNutritionRouterView.js");
    const staffView = new NutritionView(supabase, authController);
    return new PlayerNutritionRouterView(supabase, authController, staffView);
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
  },
  settings: async ({ authController }) => {
    const { TranslationsView } = await import("../views/TranslationsView.js");
    return new TranslationsView(authController);
  }
});

const ALIASES = Object.freeze({ equipo: "team", perfil: "profile" });

function hasActiveQuickDelegation(authController, gameId) {
  if (!gameId) return false;
  const user = authController?.getCurrentUser?.() || authController?.currentUser || null;
  const now = Date.now();
  return (user?.gameDelegations || []).some(item => {
    const id = item.gameId || item.game_id;
    const capabilities = Array.isArray(item.capabilities)
      ? item.capabilities.map(value => String(value || "").toUpperCase())
      : [String(item.capability || "").toUpperCase()].filter(Boolean);
    const until = Date.parse(item.validUntil || item.valid_until || "");
    const from = Date.parse(item.validFrom || item.valid_from || "");
    return String(id) === String(gameId)
      && capabilities.includes("RECORD_QUICK_GAME")
      && (!Number.isFinite(from) || from <= now)
      && (!Number.isFinite(until) || until > now);
  });
}

const FACTORY_LOADERS = Object.freeze({
  livehud: async ({ supabase, authController }, { gameId = null } = {}) => {
    const [{ LiveScoreHUDView }, { attachLiveWriterLease }] = await Promise.all([
      import("../views/LiveScoreHUDView.js"),
      import("../features/game-live/LiveWriterLeaseController.js")
    ]);
    const view = new LiveScoreHUDView(authController, gameId);
    return attachLiveWriterLease(view, supabase || authController?.supabase || null, gameId);
  },
  easyentry: async ({ supabase, gameController, authController, i18n }, { gameId = null } = {}) => {
    if (hasActiveQuickDelegation(authController, gameId)) {
      const { DelegatedQuickEntryView } = await import("../views/games/DelegatedQuickEntryView.js");
      return new DelegatedQuickEntryView(supabase, authController, gameId);
    }
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

  _canonicalKey(key) { return ALIASES[key] || key; }

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
