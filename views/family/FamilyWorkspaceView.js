/**
 * @fileoverview Family-first workspace for IQBasket.
 * @description Presents one player's longitudinal passport, product access and
 * family-facing Player360 without exposing protected commercial tables.
 */
import { FamilyWorkspaceService } from "../../services/family/FamilyWorkspaceService.js";
import { presentFamilyPlayer360 } from "../../domain/family/FamilyPlayer360Presenter.js";
import { FAMILY_PLAN_PRESENTATION } from "../../config/family.config.js";
import { FAMILY_GROWTH_CONFIG } from "../../config/family-growth.config.js";
import { buildFamilyGrowthState } from "../../domain/family/FamilyGrowthEngine.js";
import { ProductAnalyticsService } from "../../services/analytics/ProductAnalyticsService.js";
import { buildFamilyWeeklyPlan } from "../../domain/family/FamilyDevelopmentPlanEngine.js";
import { buildFamilySupportGuide } from "../../domain/family/FamilySupportGuide.js";
import { FAMILY_AI_PRODUCTS_EXTENDED, FAMILY_AI_POLICY } from "../../config/family-ai-products.config.js";
import { PlayerDataSubmissionService } from "../../services/player360/PlayerDataSubmissionService.js";
import { PlayerSubmissionPanel } from "../player360/PlayerSubmissionPanel.js";
import { Permission } from "../../security/PermissionService.js";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export class FamilyWorkspaceView {
  constructor(supabaseClient = null, authController = null) {
    this.service = new FamilyWorkspaceService(supabaseClient);
    this.auth = authController;
    this.analytics = new ProductAnalyticsService(supabaseClient);
    this.submissionService = new PlayerDataSubmissionService(supabaseClient);
    this.contributionPanel = new PlayerSubmissionPanel({ service: this.submissionService });
    this.playerId = null;
    this.state = { players: [], product: null, passport: null, player360: null, developmentContext: null, developmentCycle: null, weeklyPlan: null, support: null, growth: null, submissionContext: null, contributionsAvailable: false, error: null };
  }

  async render(containerId = "dashboard-content-area", routeParams = {}) {
    const container = typeof containerId === "string"
      ? document.getElementById(containerId)
      : containerId;
    if (!container) return;
    this._ensureStyles();
    container.innerHTML = this._loading();
    try {
      const players = await this.service.listPlayers();
      this.state.players = Array.isArray(players) ? players : [];
      const requested = String(routeParams?.id || "");
      this.playerId = this.state.players.some(row => String(row.player_id) === requested)
        ? requested
        : String(this.state.players[0]?.player_id || "");

      if (!this.playerId) {
        this.state.product = null;
        this.state.passport = null;
        this.state.player360 = null;
        this.state.developmentContext = null;
        this.state.developmentCycle = null;
        this.state.weeklyPlan = null;
        this.state.support = null;
        container.innerHTML = this._emptyWorkspace();
        this._bind(container);
        return;
      }

      await this.service.bootstrapFree(this.playerId);
      const [product, passport, player360, developmentContext, developmentCycle] = await Promise.all([
        this.service.getProductSnapshot(this.playerId),
        this.service.getPassport(this.playerId),
        this.service.getPlayer360Snapshot(this.playerId),
        this.service.getDevelopmentContext(this.playerId),
        this.service.getDevelopmentCycle(this.playerId)
      ]);
      this.state.product = product || {};
      this.state.passport = passport || {};
      this.state.player360 = player360 || {};
      this.state.developmentContext = developmentContext || {};
      this.state.developmentCycle = developmentCycle || {};
      this.state.weeklyPlan = buildFamilyWeeklyPlan(this.state.developmentContext);
      const story = this.state.player360.allowed ? presentFamilyPlayer360(this.state.player360) : null;
      this.state.support = buildFamilySupportGuide({
        story,
        developmentContext: this.state.developmentContext,
        developmentCycle: this.state.developmentCycle,
        weeklyPlan: this.state.weeklyPlan
      });
      this.state.growth = buildFamilyGrowthState({ product, passport, player360, story });
      const selectedScope = this.state.players.find(row => String(row.player_id) === String(this.playerId)) || {};
      const teamSeasonId = selectedScope.team_season_id
        || player360?.team_season_id
        || developmentContext?.team_season_id
        || developmentCycle?.team_season_id
        || null;
      this.state.submissionContext = teamSeasonId ? {
        teamId: selectedScope.team_id || null,
        teamSeasonId,
        playerId: this.playerId,
        playerTeamId: selectedScope.team_id || null,
        actorRelation: "GUARDIAN"
      } : null;
      this.state.contributionsAvailable = Boolean(
        this.state.submissionContext
        && this.auth?.canPreview?.(
          Permission.CREATE_LINKED_PLAYER_SUBMISSION,
          this.state.submissionContext
        )
      );
      if (this.state.contributionsAvailable) {
        await this.contributionPanel.load(this.state.submissionContext);
      }
      this.state.error = null;
      container.innerHTML = this._workspace();
      void this._trackWorkspaceValue();
    } catch (error) {
      console.error("[FamilyWorkspaceView]", error);
      this.state.error = error;
      container.innerHTML = this._error(error);
    }
    this._bind(container);
  }
  _workspace() {
    const passport = this.state.passport || {};
    const player = passport.player || {};
    const product = this.state.product || {};
    const plan = FAMILY_PLAN_PRESENTATION[product.plan_code] || FAMILY_PLAN_PRESENTATION.FAMILY_FREE;
    const totals = passport.career_totals || {};
    const player360 = this.state.player360 || {};
    const growth = this.state.growth || buildFamilyGrowthState({ product, passport, player360 });
    const story = growth.story || (player360.allowed ? presentFamilyPlayer360(player360) : null);
    const weeklyPlan = this.state.weeklyPlan || buildFamilyWeeklyPlan(this.state.developmentContext || {});
    const developmentCycle = this.state.developmentCycle || {};
    const support = this.state.support || buildFamilySupportGuide({
      story, developmentContext: this.state.developmentContext, developmentCycle, weeklyPlan
    });

    return `<section class="family-workspace" aria-labelledby="family-title">
      <header class="family-hero">
        <div><p class="family-eyebrow">IQBasket Family</p>
          <h1 id="family-title">${escapeHtml(player.first_name)} ${escapeHtml(player.last_name)}</h1>
          <p>Entiende su progresión, acompaña su proceso y céntrate en lo que puede ayudarle esta semana.</p>
        </div>
        <div class="family-plan"><span>${escapeHtml(plan?.label || product.plan_code || "Family Free")}</span>
          <small>${product.subject_covered ? "Jugador cubierto" : "Cobertura pendiente"}</small></div>
      </header>
      ${this._playerSwitcher()}
      ${this._supportGuide(support)}
      ${this._familyContributions()}
      <div class="family-value-strip" aria-label="Recorrido de valor">
        <span>1 · Qué está pasando</span><span>2 · Cómo evoluciona</span>
        <span>3 · Qué necesita ahora</span><span>4 · Cómo puedo ayudar</span>
      </div>
      ${this._familyDashboard(growth, weeklyPlan, developmentCycle)}
      ${this._player360(player360, story)}
      ${this._developmentPlan(weeklyPlan, developmentCycle)}
      ${this._summary(totals, passport)}
      ${this._career(passport.career || [])}
      ${this._conversionCard(growth)}
      ${this._aiProductPreview(product)}
      ${this._claimPanel()}
    </section>`;
  }
  _playerSwitcher() {
    const cards = this.state.players.map(row => {
      const label = `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Jugador";
      const context = [row.team_name, row.season_name].filter(Boolean).join(" · ");
      const active = String(row.player_id) === String(this.playerId);
      return `<a href="#/family/${escapeHtml(row.player_id)}"
        class="family-player-chip ${active ? "active" : ""}"
        data-family-player-link="${escapeHtml(row.player_id)}"
        aria-current="${active ? "true" : "false"}">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(context || "Jugador vinculado")}</span>
      </a>`;
    }).join("");
    return `<section class="family-player-scope" aria-label="Mis jugadores">
      <div><p class="family-eyebrow">Tu ámbito familiar</p><h2>Mis jugadores</h2>
        <p>Todo el análisis y las recomendaciones de esta pantalla pertenecen únicamente al jugador seleccionado.</p></div>
      <div class="family-player-chips">${cards}</div>
    </section>`;
  }

  _supportGuide(guide = {}) {
    const observe = (guide.observe || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
    const support = (guide.supportActions || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
    const avoid = (guide.avoid || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
    return `<section class="family-card family-support" data-family-support-guide>
      <div class="family-card-head"><div><p class="family-eyebrow">Cómo puedo ayudar</p><h2>${escapeHtml(guide.focus || "Acompañar su proceso")}</h2></div></div>
      <div class="family-support-grid">
        <article><span>Qué observar</span><ul>${observe}</ul></article>
        <article><span>Cómo ayudar</span><ol>${support}</ol></article>
        <article class="family-support-question"><span>Una buena pregunta</span><p>${escapeHtml(guide.conversationStarter || "¿Cómo te has sentido esta semana?")}</p></article>
        <article><span>Qué evitar</span><ul>${avoid}</ul></article>
      </div>
      <p class="family-disclaimer">${escapeHtml(guide.evidenceNote || "")}</p>
    </section>`;
  }


  _familyContributions() {
    if (!this.state.contributionsAvailable || !this.state.submissionContext) return "";
    return `<section class="family-card family-contributions" data-family-contributions>
      <div class="family-card-head"><div><p class="family-eyebrow">Aportar contexto</p><h2>Información que puede ayudar al staff</h2>
        <p>Las aportaciones quedan vinculadas únicamente al jugador seleccionado y se guardan como provisionales hasta que el staff las valida.</p></div></div>
      <a class="family-wellness-link" href="#/player360/${escapeHtml(this.playerId)}">🥤 Abrir check-ins de nutrición y recuperación</a>
      ${this.contributionPanel.render()}
    </section>`;
  }

  _summary(totals, passport) {
    const recent = Array.isArray(passport.recent_games) ? passport.recent_games : [];
    const seasons = Array.isArray(passport.career) ? passport.career.length : 0;
    return `<section class="family-evidence-summary">
      <div class="family-card-head"><div><p class="family-eyebrow">Evidencia numérica</p><h2>Datos para contextualizar, no para juzgar</h2>
        <p>Las cifras quedan en segundo plano: sirven para apoyar la lectura de progresión de este jugador.</p></div></div>
      <div class="family-kpis">
        ${this._kpi("Temporadas", seasons)}
        ${this._kpi("Partidos", number(totals.games))}
        ${this._kpi("Minutos", number(totals.minutes))}
        ${this._kpi("Últimos registros", recent.length)}
      </div>
    </section>`;
  }

  _kpi(label, value) {
    return `<article class="family-kpi"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`;
  }

  _familyDashboard(growth = {}, weeklyPlan = {}, developmentCycle = {}) {
    const latest = growth.latestGame || null;
    const objective = growth.objective || null;
    const primary = objective?.primaryTarget || null;
    const evolution = growth.story?.evolution?.[0] || growth.body || "Seguimos acumulando evidencia.";
    const cycleAction = (developmentCycle?.current_cycle?.actions || []).find(item => !["COMPLETED","SKIPPED"].includes(item.status))
      || developmentCycle?.current_cycle?.actions?.[0];
    const next = cycleAction?.title
      || (weeklyPlan?.allowed && weeklyPlan?.actions?.[0] ? weeklyPlan.actions[0] : null)
      || growth.story?.next?.[0]
        || (primary?.metric_name ? `Mantener el foco compartido: ${primary.metric_name}.` : "Seguir registrando partidos y sesiones para observar la evolución.");
    const gameText = latest
      ? `${latest.opponent ? `vs ${escapeHtml(latest.opponent)} · ` : ""}${number(latest.points)} pts · ${number(latest.minutes)} min`
      : "Aún no hay un partido reciente registrado.";
    return `<section class="family-card family-dashboard">
      <div class="family-card-head"><div><p class="family-eyebrow">Ahora mismo</p><h2>Lo importante, de un vistazo</h2></div></div>
      <div class="family-dashboard-grid">
        <article><span>Último partido</span><p>${gameText}</p></article>
        <article><span>Evolución</span><p>${escapeHtml(evolution)}</p></article>
        <article><span>Objetivo actual</span><p>${escapeHtml(objective?.title || primary?.metric_name || "Aún no hay un objetivo compartido por el staff.")}</p></article>
        <article><span>Esta semana</span><p>${escapeHtml(next)}</p></article>
      </div>
    </section>`;
  }

  _conversionCard(growth = {}) {
    const conversion = growth.conversion || {};
    if (!conversion.visible) return "";
    const availability = FAMILY_GROWTH_CONFIG.checkoutEnabled
      ? "Continuar"
      : conversion.actionLabel || "Me interesa";
    return `<section class="family-card family-conversion" data-family-offer="${escapeHtml(conversion.placement || "VALUE")}">
      <div><p class="family-eyebrow">Siguiente nivel</p><h2>${escapeHtml(conversion.title)}</h2>
        <p>${escapeHtml(conversion.body)}</p></div>
      <div class="family-conversion-action">
        <button type="button" data-family-interest data-target-plan="${escapeHtml(conversion.targetPlanCode || "FAMILY")}">${escapeHtml(availability)}</button>
        <small data-family-interest-status aria-live="polite">Sin cargos ni contratación en este paso.</small>
      </div>
    </section>`;
  }

  async _trackWorkspaceValue() {
    if (!this.playerId || !this.state.growth) return;
    const base = { playerId: this.playerId, surface: FAMILY_GROWTH_CONFIG.analyticsSurface, evidenceCount: this.state.growth.games };
    await this.analytics.trackOncePerSession({ ...base, eventCode: "FAMILY_WORKSPACE_VIEWED", placement: "DASHBOARD" });
    await this.analytics.trackOncePerSession({ ...base, eventCode: "FAMILY_PASSPORT_VIEWED", placement: "PASSPORT" });
    if (this.state.player360?.allowed) {
      await this.analytics.trackOncePerSession({ ...base, eventCode: "FAMILY_PLAYER360_OPENED", surface: "PLAYER360_FAMILY", placement: "STORY" });
    }
    if (this.state.growth.objective) {
      await this.analytics.trackOncePerSession({ ...base, eventCode: "FAMILY_OBJECTIVE_VIEWED", placement: "CURRENT_OBJECTIVE" });
    }
    if (this.state.weeklyPlan?.allowed) {
      await this.analytics.trackOncePerSession({ ...base, eventCode: "FAMILY_WEEKLY_PLAN_VIEWED", placement: "WEEKLY_PLAN" });
      if ((this.state.developmentContext?.recent_training || []).length) {
        await this.analytics.trackOncePerSession({ ...base, eventCode: "FAMILY_TRAINING_VALUE_VIEWED", placement: "WEEKLY_PLAN" });
      }
      if ((this.state.developmentContext?.recent_external_development || []).length) {
        await this.analytics.trackOncePerSession({ ...base, eventCode: "FAMILY_TECHNIFICATION_VALUE_VIEWED", placement: "WEEKLY_PLAN" });
      }
    }
    const conversion = this.state.growth.conversion || {};
    if (conversion.visible) {
      await this.analytics.trackOncePerSession({ ...base, eventCode: "FAMILY_INSIGHT_OFFER_VIEWED", placement: conversion.placement, targetPlanCode: conversion.targetPlanCode, experimentKey: FAMILY_GROWTH_CONFIG.experimentKey });
    }
  }

  _career(rows) {
    if (!rows.length) return `<article class="family-card"><h2>Trayectoria</h2><p>Aún no hay temporadas registradas.</p></article>`;
    const items = rows.map(row => `<article class="family-career-row">
      <div><strong>${escapeHtml(row.season_name || "Temporada")}</strong>
        <span>${escapeHtml(row.team_name || "Equipo")}${row.club_name ? ` · ${escapeHtml(row.club_name)}` : ""}</span></div>
      <div class="family-career-numbers"><b>${number(row.games)}</b><small>partidos</small><b>${number(row.points)}</b><small>puntos</small></div>
    </article>`).join("");
    return `<details class="family-card family-career-card"><summary><div><p class="family-eyebrow">Pasaporte deportivo</p><strong>Ver trayectoria y cifras históricas</strong></div></summary><div class="family-career-content">${items}</div></details>`;
  }
  _player360(snapshot, story) {
    if (!snapshot?.allowed) {
      return `<section class="family-card family-locked" aria-label="Player 360 bloqueado">
        <div><p class="family-eyebrow">Family</p><h2>Entiende su evolución</h2>
          <p>El pasaporte básico sigue siendo gratuito. Player360 añade tendencias, objetivos y prioridades de desarrollo.</p></div>
        <button type="button" disabled aria-disabled="true">Disponible en Family</button>
      </section>`;
    }

    const evolution = (story?.evolution || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
    const meaning = (story?.meaning || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
    const next = (story?.next || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
    return `<section class="family-card family-story">
      <div class="family-card-head"><div><p class="family-eyebrow">Player360 Familia</p><h2>De los datos al siguiente paso</h2></div></div>
      <div class="family-story-grid">
        <article><span>Qué ha pasado</span><p>${escapeHtml(story?.whatHappened || "")}</p></article>
        <article><span>Cómo evoluciona</span><ul>${evolution}</ul></article>
        <article><span>Qué significa</span><ul>${meaning}</ul></article>
        <article><span>Qué hacemos ahora</span><ul>${next}</ul></article>
      </div>
      <p class="family-disclaimer">Interpretación descriptiva: no atribuye causas ni sustituye al entrenador o a profesionales sanitarios.</p>
    </section>`;
  }

  _developmentPlan(plan = {}, cycleProjection = {}) {
    const cycle = cycleProjection?.current_cycle || null;
    if (cycleProjection?.allowed && cycle) {
      const actions = (cycle.actions || []).map(item => `<li><strong>${escapeHtml(item.title)}</strong> · ${escapeHtml(item.status === "COMPLETED" ? "completada" : item.status === "IN_PROGRESS" ? "en curso" : item.status === "SKIPPED" ? "omitida" : "pendiente")}${item.evidence?.length ? ` · ${item.evidence.length} evidencia(s)` : ""}</li>`).join("");
      return `<section class="family-card family-development" data-family-development-cycle>
        <div class="family-card-head"><div><p class="family-eyebrow">Plan de desarrollo · ciclo real</p><h2>Esta semana: ${escapeHtml(cycle.focus_metric_name)}</h2></div><span>${escapeHtml(cycle.status)}</span></div>
        <div class="family-development-grid"><article><span>Objetivo compartido</span><p>${escapeHtml(cycle.objective_title)}</p></article><article><span>Semana</span><p>${escapeHtml(cycle.week_start)} → ${escapeHtml(cycle.ends_on)}</p></article></div>
        <ol class="family-plan-actions">${actions}</ol>
        <p class="family-disclaimer">El progreso refleja acciones y evidencias registradas por el staff. No implica causalidad ni sustituye criterio profesional.</p>
      </section>`;
    }
    if (!plan?.allowed) {
      return `<section class="family-card family-locked family-development-locked">
        <div><p class="family-eyebrow">Family · Desarrollo</p><h2>Qué hacemos esta semana</h2>
          <p>El plan semanal conecta el objetivo compartido con entrenamientos, tecnificación y competición registrados.</p></div>
        <button type="button" disabled aria-disabled="true">Disponible en Family</button>
      </section>`;
    }
    const actions = (plan.actions || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
    const limitations = (plan.limitations || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
    const focus = plan.primaryFocus || "Pendiente de objetivo compartido";
    return `<section class="family-card family-development" data-family-weekly-plan>
      <div class="family-card-head"><div><p class="family-eyebrow">Plan de desarrollo</p><h2>Esta semana: ${escapeHtml(focus)}</h2></div></div>
      <div class="family-development-grid">
        <article><span>Foco compartido</span><p>${escapeHtml(plan.objectiveTitle || focus)}</p></article>
        <article><span>Evidencia conectada</span><p>${number(plan.evidence?.trainingSessions)} entrenos · ${number(plan.evidence?.technificationSessions)} tecnificaciones · ${number(plan.evidence?.recentGames)} partidos</p></article>
      </div>
      <ol class="family-plan-actions">${actions}</ol>
      ${limitations ? `<details class="family-limitations"><summary>Límites de la evidencia</summary><ul>${limitations}</ul></details>` : ""}
      <p class="family-disclaimer">${escapeHtml(plan.disclaimer || "")}</p>
    </section>`;
  }

  _aiProductPreview(product = {}) {
    const planCode = String(product?.plan_code || "FAMILY_FREE").toUpperCase();
    if (!['FAMILY','FAMILY_PRO'].includes(planCode)) return "";
    const cards = Object.values(FAMILY_AI_PRODUCTS_EXTENDED).map(item => `
      <article><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.description)}</p><span>En preparación</span></article>`).join("");
    return `<section class="family-card family-ai-preview">
      <div class="family-card-head"><div><p class="family-eyebrow">Family Pro · IA</p><h2>Productos inteligentes, todavía no activados</h2></div></div>
      <p>No se contratarán ni consumirán unidades hasta que el piloto valide calidad, coste y privacidad.</p>
      <div class="family-ai-grid">${cards}</div>
      <p class="family-disclaimer">${escapeHtml(FAMILY_AI_POLICY.disclaimer)}</p>
    </section>`;
  }

  _claimPanel() {
    return `<details class="family-card family-link-card"><summary>Vincular otro jugador</summary>
      <p>Introduce el código de invitación recibido del club. El código sólo crea el vínculo autorizado; no compra ningún plan.</p>
      <form data-family-claim-form><label>Código de invitación<input name="claimCode" autocomplete="one-time-code" required></label>
        <button type="submit">Vincular jugador</button><span data-family-claim-status aria-live="polite"></span></form>
    </details>`;
  }
  _emptyWorkspace() {
    return `<section class="family-workspace"><header class="family-hero"><div>
      <p class="family-eyebrow">IQBasket Family</p><h1>Tu jugador, toda su trayectoria</h1>
      <p>Vincula un jugador mediante una invitación verificada del club para empezar.</p>
    </div></header>${this._claimPanel()}</section>`;
  }

  _loading() {
    return `<div class="family-loading" role="status">Preparando el espacio familiar…</div>`;
  }

  _error(error) {
    const code = error?.message || "No se ha podido cargar el espacio familiar.";
    return `<section class="family-workspace"><article class="family-card family-error">
      <h1>No hemos podido abrir tu espacio familiar</h1><p>${escapeHtml(code)}</p>
      <button type="button" data-family-retry>Reintentar</button>
    </article></section>`;
  }

  _bind(container) {
    container.querySelector("[data-family-retry]")?.addEventListener("click", () => this.render(container));
    container.querySelectorAll("[data-family-player-link]").forEach(link => {
      link.addEventListener("click", () => {
        const id = link.dataset.familyPlayerLink;
        if (!id || String(id) === String(this.playerId)) return;
        void this.analytics.trackSafely({ eventCode: "FAMILY_PLAYER_SWITCHED", playerId: id, surface: "FAMILY_WORKSPACE", placement: "PLAYER_SWITCHER" });
      });
    });
    container.querySelector("[data-family-interest]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const targetPlanCode = button.dataset.targetPlan || "FAMILY";
      const status = container.querySelector("[data-family-interest-status]");
      button.disabled = true;
      await this.analytics.trackSafely({
        eventCode: "FAMILY_PLAN_INTEREST_CLICKED", playerId: this.playerId, surface: "FAMILY_WORKSPACE",
        placement: this.state.growth?.conversion?.placement || "VALUE", targetPlanCode,
        experimentKey: FAMILY_GROWTH_CONFIG.experimentKey, evidenceCount: this.state.growth?.games
      });
      if (status) status.textContent = FAMILY_GROWTH_CONFIG.checkoutEnabled
        ? "Preparando contratación…"
        : "Interés registrado. No se ha realizado ningún cargo.";
    });

    if (this.state.contributionsAvailable) {
      void this.contributionPanel.bind(container, {
        onChanged: async () => {
          if (this.state.submissionContext) {
            await this.contributionPanel.load(this.state.submissionContext);
          }
          await this.render(container, { id: this.playerId });
        }
      });
    }

    const form = container.querySelector("[data-family-claim-form]");
    form?.addEventListener("submit", async event => {
      event.preventDefault();
      const status = form.querySelector("[data-family-claim-status]");
      const code = new FormData(form).get("claimCode");
      if (status) status.textContent = "Verificando…";
      void this.analytics.trackSafely({ eventCode: "FAMILY_CLAIM_STARTED", surface: "FAMILY_ONBOARDING", placement: "CLAIM_CODE" });
      try {
        const claimed = await this.service.claimLink(code);
        const claimedPlayerId = claimed?.player_id || claimed?.product?.player_id || null;
        void this.analytics.trackSafely({ eventCode: "FAMILY_CLAIM_SUCCEEDED", playerId: claimedPlayerId, surface: "FAMILY_ONBOARDING", placement: "CLAIM_CODE" });
        if (status) status.textContent = "Jugador vinculado correctamente.";
        await this.render(container);
      } catch (error) {
        void this.analytics.trackSafely({ eventCode: "FAMILY_CLAIM_FAILED", surface: "FAMILY_ONBOARDING", placement: "CLAIM_CODE" });
        if (status) status.textContent = "No se ha podido validar la invitación.";
        console.error("[FamilyWorkspaceView] claim", error);
      }
    });
  }
  _ensureStyles() {
    if (document.getElementById("family-workspace-styles")) return;
    const style = document.createElement("style");
    style.id = "family-workspace-styles";
    style.textContent = `
      .family-workspace{max-width:1180px;margin:0 auto;padding:8px 0 48px;color:#0f172a}
      .family-hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:24px;border-radius:22px;background:linear-gradient(135deg,#f8fafc,#eef2ff);border:1px solid #dbeafe;margin-bottom:16px}
      .family-hero h1{margin:3px 0 8px;font-size:clamp(25px,5vw,38px)}.family-hero p{margin:0;color:#475569;max-width:720px}
      .family-eyebrow{margin:0!important;font-size:11px!important;font-weight:900;color:#2563eb!important;text-transform:uppercase;letter-spacing:.12em}
      .family-plan{display:grid;gap:2px;padding:10px 14px;border-radius:14px;background:#fff;border:1px solid #bfdbfe;white-space:nowrap}.family-plan span{font-weight:900}.family-plan small{color:#64748b}
      .family-player-scope{display:grid;gap:12px;margin:14px 0;padding:18px;border:1px solid #dbeafe;border-radius:18px;background:#f8fbff}.family-player-scope h2{margin:3px 0 5px}.family-player-scope p{margin:0;color:#64748b;font-size:13px}.family-player-chips{display:flex;gap:9px;overflow-x:auto;padding:2px 0}.family-player-chip{display:grid;gap:3px;min-width:180px;padding:11px 13px;border:1px solid #cbd5e1;border-radius:13px;background:#fff;color:#0f172a;text-decoration:none}.family-player-chip span{font-size:11px;color:#64748b}.family-player-chip.active{border-color:#2563eb;box-shadow:0 0 0 2px #dbeafe}.family-link-card input{min-height:44px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 12px;background:#fff}
      .family-support{background:linear-gradient(135deg,#eff6ff,#f0fdf4);border-color:#bfdbfe}.family-support-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.family-support-grid article{padding:15px;border:1px solid #dbeafe;border-radius:14px;background:#fff}.family-support-grid span{font-size:11px;font-weight:900;text-transform:uppercase;color:#2563eb}.family-support-grid ul,.family-support-grid ol{margin:8px 0 0;padding-left:20px}.family-support-grid li{margin:7px 0;color:#334155;font-size:14px}.family-support-question p{font-size:17px;font-weight:800;color:#0f172a}.family-contributions{background:#f8fafc}.family-contributions>.family-card-head p{margin:4px 0;color:#64748b;font-size:13px}.family-wellness-link{display:inline-flex;align-items:center;min-height:44px;margin:4px 0 10px;padding:9px 12px;border:1px solid #bfdbfe;border-radius:11px;background:#eff6ff;color:#1d4ed8;font-weight:850;text-decoration:none}.family-contributions .psub-panel{margin-top:4px}.family-evidence-summary{margin:20px 0}.family-evidence-summary h2{margin:3px 0}.family-evidence-summary p{margin:4px 0;color:#64748b;font-size:13px}.family-career-card summary{cursor:pointer;list-style:none;min-height:44px;display:flex;align-items:center}.family-career-card summary::-webkit-details-marker{display:none}.family-career-content{margin-top:10px}
      .family-value-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.family-value-strip span{padding:10px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;font-size:12px;font-weight:800;text-align:center}
      .family-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.family-kpi{padding:16px;border-radius:16px;background:#0f172a;color:#fff;display:grid}.family-kpi strong{font-size:24px}.family-kpi span{font-size:12px;color:#cbd5e1}
      .family-card{padding:20px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;margin:14px 0}.family-card h2{margin:3px 0 10px}.family-card-head{display:flex;justify-content:space-between;align-items:flex-start}
      .family-career-row{display:flex;justify-content:space-between;gap:12px;padding:13px 0;border-top:1px solid #f1f5f9}.family-career-row span{display:block;color:#64748b;font-size:13px}.family-career-numbers{display:grid;grid-template-columns:auto auto;gap:1px 8px;text-align:right}.family-career-numbers small{color:#64748b}
      .family-story-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.family-story-grid article{padding:15px;border-radius:14px;background:#f8fafc}.family-story-grid span{font-weight:900;font-size:13px}.family-story-grid p,.family-story-grid li{font-size:14px;color:#334155}.family-story-grid ul{margin:8px 0 0;padding-left:18px}.family-disclaimer{font-size:12px;color:#64748b;margin:12px 0 0}
      .family-locked{display:flex;justify-content:space-between;gap:18px;align-items:center;background:#fff7ed}.family-locked button{border:0;border-radius:12px;padding:10px 14px;font-weight:800}.family-link-card summary{font-weight:900;cursor:pointer}.family-link-card form{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:10px;align-items:end}.family-link-card label{display:grid;gap:5px}.family-link-card button,.family-error button{min-height:44px;border:0;border-radius:10px;padding:8px 14px;background:#1d4ed8;color:#fff;font-weight:900}.family-loading{padding:40px;text-align:center;color:#64748b}
      .family-dashboard-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.family-dashboard-grid article{padding:15px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0}.family-dashboard-grid span{font-size:11px;font-weight:900;text-transform:uppercase;color:#64748b}.family-dashboard-grid p{margin:7px 0 0;font-size:14px;color:#1e293b}
      .family-conversion{display:flex;justify-content:space-between;align-items:center;gap:18px;background:linear-gradient(135deg,#eff6ff,#f5f3ff);border-color:#bfdbfe}.family-conversion p{margin:6px 0;color:#334155}.family-conversion-action{display:grid;gap:7px;min-width:190px}.family-conversion-action button{min-height:44px;border:0;border-radius:12px;padding:9px 14px;background:#1d4ed8;color:#fff;font-weight:900;cursor:pointer}.family-conversion-action button:disabled{opacity:.65}.family-conversion-action small{font-size:11px;color:#64748b}
      .family-development{background:linear-gradient(135deg,#f8fafc,#f0fdf4);border-color:#bbf7d0}.family-development-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.family-development-grid article{padding:14px;border:1px solid #dcfce7;border-radius:13px;background:#fff}.family-development-grid span,.family-ai-grid span{font-size:11px;font-weight:900;text-transform:uppercase;color:#64748b}.family-development-grid p{margin:6px 0 0}.family-plan-actions{margin:15px 0 0;padding-left:22px}.family-plan-actions li{margin:7px 0;color:#1e293b}.family-limitations{margin-top:12px}.family-limitations summary{font-weight:800;cursor:pointer}.family-limitations li{font-size:13px;color:#64748b}
      .family-ai-preview{background:#f8fafc}.family-ai-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.family-ai-grid article{padding:14px;border:1px solid #e2e8f0;border-radius:13px;background:#fff}.family-ai-grid strong{display:block}.family-ai-grid p{font-size:13px;color:#475569;margin:6px 0}.family-ai-grid span{color:#7c3aed}
      @media(max-width:700px){.family-hero,.family-locked{display:grid}.family-support-grid{grid-template-columns:1fr}.family-player-chip{min-width:155px}.family-plan{width:max-content}.family-value-strip{grid-template-columns:repeat(2,1fr)}.family-kpis{grid-template-columns:repeat(2,1fr)}.family-story-grid{grid-template-columns:1fr}.family-dashboard-grid{grid-template-columns:1fr 1fr}.family-conversion{display:grid}.family-development-grid,.family-ai-grid{grid-template-columns:1fr}.family-link-card form{grid-template-columns:1fr}.family-career-row{align-items:flex-start}.family-workspace{padding-inline:2px}}
    `;
    document.head.appendChild(style);
  }
}

export default FamilyWorkspaceView;

