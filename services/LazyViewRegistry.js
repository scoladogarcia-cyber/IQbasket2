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
    const { ScopedGameBoxScoreLiveV39View } = await import("../views/games/ScopedGameBoxScoreLiveV39View.js");
    return new ScopedGameBoxScoreLiveV39View(supabase, authController);
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
const QUICK_CAPTURE_ROUTES = new Set(["easy-entry", "easy", "entrada-facil", "live-entry"]);

function currentHashRoute() {
  if (typeof window === "undefined") return "";
  return String(window.location?.hash || "")
    .replace(/^#\//, "")
    .split("/")[0]
    .toLowerCase();
}

function showLazyRouteLoading(canonical) {
  if (canonical !== "liveeditor" || typeof document === "undefined") return;
  const container = document.getElementById("dashboard-content-area");
  if (!container) return;
  container.innerHTML = `
    <div role="status" aria-live="polite" style="min-height:220px;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 18px;color:#475569;box-shadow:0 4px 16px rgba(15,23,42,.04);">
        <span aria-hidden="true" style="width:22px;height:22px;border:3px solid #e2e8f0;border-top-color:#f97316;border-radius:50%;animation:iq-lazy-spin .8s linear infinite"></span>
        <strong style="font-size:13px">Cargando partidos…</strong>
      </div>
      <style>@keyframes iq-lazy-spin{to{transform:rotate(360deg)}}</style>
    </div>`;
}

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
  livehud: async (dependencies, { gameId = null } = {}) => {
    if (QUICK_CAPTURE_ROUTES.has(currentHashRoute())) {
      return FACTORY_LOADERS.easyentry(dependencies, { gameId });
    }

    const { supabase, authController } = dependencies;
    const [
      { LiveScoreHUDViewV44 },
      { attachLiveWriterLeaseV43 },
      { attachLiveCaptureStartGate },
      { GameCaptureDelegationService },
      { GamePlayStateService }
    ] = await Promise.all([
      import("../views/LiveScoreHUDViewV44.js"),
      import("../features/game-live/LiveWriterLeaseV43Controller.js"),
      import("../features/game-live/LiveCaptureStartController.js"),
      import("./games/GameCaptureDelegationService.js"),
      import("./games/GamePlayStateService.js")
    ]);

    const runtimeClient = supabase || authController?.supabase || null;
    const view = new LiveScoreHUDViewV44(authController, gameId);
    view.captureService = new GameCaptureDelegationService(runtimeClient);
    view.playStateService = new GamePlayStateService(runtimeClient);

    // Composition order matters: sporting lifecycle first, then the V43
    // recoverable single-writer boundary. V44 changes sporting projection/UX,
    // not the backend authorization or concurrency policy.
    const gated = attachLiveCaptureStartGate(view, runtimeClient, authController, gameId);
    return attachLiveWriterLeaseV43(gated, runtimeClient, gameId);
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
    showLazyRouteLoading(canonical);
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
