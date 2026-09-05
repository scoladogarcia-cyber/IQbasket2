/**
 * @fileoverview Centro de Privacidad y Autorizaciones de Player 360.
 * @description UI administrativa responsive para autorizaciones de tratamiento,
 * relaciones sujeto/tutor, solicitudes, grants y auditoría. La vista no accede
 * directamente a tablas: delega siempre en PrivacyGovernanceService.
 */

import { DataStore } from "../services/DataStore.js";
import { PrivacyGovernanceService } from "../services/player360/PrivacyGovernanceService.js";
import { FamilyWorkspaceService } from "../services/family/FamilyWorkspaceService.js";
import { Permission } from "../security/PermissionService.js";
import {
  PrivacyAgeBand,
  describePrivacyAgeReadiness,
  getActiveGuardians,
  requiresGuardianRepresentative
} from "../domain/privacy/PrivacyReadinessPolicy.js";
import { TranslationStore } from "../services/TranslationStore.js";

const TABS = Object.freeze([
  { key: "overview", label: "Resumen", icon: "🛡️" },
  { key: "authorizations", label: "Autorizaciones", icon: "📋" },
  { key: "access", label: "Accesos", icon: "🔑" },
  { key: "audit", label: "Auditoría", icon: "🧾" }
]);

export class PrivacyCenterView {
  constructor(supabase, authController) {
    this.supabase = supabase || null;
    this.auth = authController || null;
    this.service = new PrivacyGovernanceService(this.supabase);
    this.familyService = new FamilyWorkspaceService(this.supabase);
    this.container = null;
    this.activeTab = "overview";
    this.playerId = null;
    this.loading = false;
    this.state = {
      capabilities: {},
      snapshot: { counts: {}, players: [], relationships: [] },
      authorizations: [],
      requests: [],
      grants: [],
      audit: [],
      error: null
    };
  }

  t(key, fallback = "") {
    return TranslationStore?.t?.(key, fallback) || fallback || key;
  }

  _escape(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _context() {
    return {
      teamId: DataStore.getActiveTeamId?.() || null,
      teamSeasonId: DataStore.getActiveTeamSeasonId?.() || null,
      playerId: this.playerId || null
    };
  }

  _can(permission) {
    const fn = this.auth?.canPreview || this.auth?.can;
    return typeof fn === "function" ? Boolean(fn.call(this.auth, permission, this._context())) : false;
  }

  _formatDate(value, includeTime = false) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return this._escape(value);
    return new Intl.DateTimeFormat("es-ES", includeTime
      ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" }
    ).format(date);
  }

  _personName(person = {}, fallback = "Usuario") {
    const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
    return name || person.email || fallback;
  }

  _playerName(row = {}) {
    const player = row.player || row;
    const name = [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
    const jersey = player.jersey !== null && player.jersey !== undefined ? `#${player.jersey} · ` : "";
    return `${jersey}${name || "Jugador"}`;
  }

  _playerRecord(playerId) {
    return DataStore.getPlayerById?.(playerId) || null;
  }

  _ageReadinessMarkup(playerId) {
    const player = this._playerRecord(playerId) || {};
    const birthDate = player.birth_date || player.birthDate || null;
    const readiness = describePrivacyAgeReadiness(birthDate);
    const cls = readiness.band === PrivacyAgeBand.MINOR ? "minor"
      : readiness.band === PrivacyAgeBand.ADULT ? "adult" : "unknown";
    return `<div class="privacy-age-readiness ${cls}" data-privacy-age-readiness data-age-band="${readiness.band}">
      <strong>${this._escape(readiness.label)}</strong>
      <span>${this._escape(readiness.guidance)}</span>
    </div>`;
  }

  _guardianRows(playerId) {
    return getActiveGuardians(this.state.snapshot.relationships || [], playerId);
  }

  _guardianOptionsMarkup(playerId) {
    const guardians = this._guardianRows(playerId);
    return `<option value="">Selecciona un tutor verificado</option>${guardians.map(row =>
      `<option value="${this._escape(row.user_id)}">${this._escape(this._personName(row.user, "Tutor"))}</option>`
    ).join("")}`;
  }

  async render(containerId = "dashboard-content-area") {
    const container = typeof containerId === "string"
      ? document.getElementById(containerId)
      : containerId;
    if (!container) return;
    this.container = container;

    if (!this._can(Permission.VIEW_PRIVACY_AUTHORIZATIONS)) {
      container.innerHTML = this._renderRestricted();
      return;
    }

    const teamSeasonId = DataStore.getActiveTeamSeasonId?.();
    if (!teamSeasonId) {
      container.innerHTML = this._renderMessage(
        "Selecciona una temporada",
        "El Centro de Privacidad necesita un equipo y una temporada activos para aplicar el alcance contextual."
      );
      return;
    }

    await this._load();
  }

  async _load() {
    if (this.loading || !this.container) return;
    this.loading = true;
    this.container.innerHTML = this._renderLoading();

    const teamSeasonId = DataStore.getActiveTeamSeasonId?.();
    try {
      const capabilities = await this.service.getCapabilities(teamSeasonId);
      if (!capabilities?.can_admin_privacy) {
        this.state = { ...this.state, capabilities, error: null };
        this.container.innerHTML = this._renderRestricted(
          "Tu contexto actual no permite administrar privacidad para esta temporada."
        );
        return;
      }

      const [snapshot, authorizations, sensitiveAccess, audit] = await Promise.all([
        this.service.getSnapshot({ teamSeasonId, playerId: this.playerId }),
        this.service.listAuthorizations({ teamSeasonId, playerId: this.playerId }),
        this.service.listSensitiveAccess({ teamSeasonId, playerId: this.playerId }),
        this._can(Permission.VIEW_PRIVACY_AUDIT)
          ? this.service.listAudit({ teamSeasonId, playerId: this.playerId, limit: 100 })
          : Promise.resolve([])
      ]);

      this.state = {
        capabilities,
        snapshot,
        authorizations,
        requests: sensitiveAccess.requests,
        grants: sensitiveAccess.grants,
        audit,
        error: null
      };
      this._paint();
    } catch (error) {
      console.error("[PrivacyCenterView]", error);
      this.state.error = error;
      this.container.innerHTML = this._renderError(error);
    } finally {
      this.loading = false;
    }
  }

  _paint() {
    if (!this.container) return;
    this.container.innerHTML = `
      ${this._styles()}
      <section class="privacy-center" aria-labelledby="privacy-center-title">
        ${this._renderHeader()}
        ${this._renderToolbar()}
        ${this._renderTabs()}
        <div class="privacy-panel" id="privacy-tab-panel">
          ${this._renderActiveTab()}
        </div>
      </section>
      <div id="privacy-modal-root"></div>
    `;
    this._bindEvents();
  }

  _renderHeader() {
    return `
      <header class="privacy-hero">
        <div>
          <span class="privacy-eyebrow">PLAYER 360 · GOBIERNO DEL DATO</span>
          <h1 id="privacy-center-title">🛡️ Centro de Privacidad</h1>
          <p>Gestiona autorizaciones, accesos sensibles y trazabilidad sin abrir acceso directo a los datos personales.</p>
        </div>
        <div class="privacy-secure-badge" title="Las tablas sensibles permanecen protegidas por RLS y RPC">
          <span>🔐</span>
          <strong>RBAC + ABAC</strong>
          <small>Backend enforced</small>
        </div>
      </header>
    `;
  }

  _renderToolbar() {
    const players = this.state.snapshot.players || [];
    return `
      <div class="privacy-toolbar">
        <label class="privacy-filter">
          <span>Jugador</span>
          <select id="privacy-player-filter">
            <option value="">Toda la plantilla</option>
            ${players.map(player => `
              <option value="${this._escape(player.player_id)}" ${String(this.playerId || "") === String(player.player_id) ? "selected" : ""}>
                ${this._escape(this._playerName(player))}
              </option>
            `).join("")}
          </select>
        </label>
        <button class="privacy-btn privacy-btn-secondary" id="privacy-refresh" type="button">↻ Actualizar</button>
        ${this._can(Permission.CREATE_PRIVACY_AUTHORIZATION)
          ? `<button class="privacy-btn privacy-btn-primary" id="privacy-new-authorization" type="button">+ Nueva autorización</button>`
          : ""}
      </div>
    `;
  }

  _renderTabs() {
    return `
      <div class="privacy-tabs" role="tablist" aria-label="Secciones de privacidad">
        ${TABS.map(tab => {
          if (tab.key === "access" && !this._can(Permission.VIEW_SENSITIVE_ACCESS_GRANTS)) return "";
          if (tab.key === "audit" && !this._can(Permission.VIEW_PRIVACY_AUDIT)) return "";
          return `
            <button type="button" role="tab" class="privacy-tab ${this.activeTab === tab.key ? "active" : ""}"
                    data-privacy-tab="${tab.key}" aria-selected="${this.activeTab === tab.key}">
              <span>${tab.icon}</span>${tab.label}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  _renderActiveTab() {
    if (this.activeTab === "authorizations") return this._renderAuthorizations();
    if (this.activeTab === "access") return this._renderAccess();
    if (this.activeTab === "audit") return this._renderAudit();
    return this._renderOverview();
  }

  _renderOverview() {
    const counts = this.state.snapshot.counts || {};
    const players = this.state.snapshot.players || [];
    const relationships = this.state.snapshot.relationships || [];
    return `
      <div class="privacy-kpis">
        ${this._kpi("Autorizaciones activas", counts.authorizations || 0, "📋")}
        ${this._kpi("Accesos activos", counts.active_grants || 0, "🔑")}
        ${this._kpi("Solicitudes pendientes", counts.pending_requests || 0, "⏳", Number(counts.pending_requests || 0) > 0)}
        ${this._kpi("Relaciones sujeto/tutor", counts.relationships || 0, "👥")}
      </div>

      <div class="privacy-section-head">
        <div><h2>Estado por jugador</h2><p>Vista operativa del alcance de privacidad de la plantilla.</p></div>
      </div>
      ${players.length ? `
        <div class="privacy-table-wrap">
          <table class="privacy-table">
            <thead><tr><th>Jugador</th><th>Autorizaciones</th><th>Accesos</th><th>Solicitudes</th><th></th></tr></thead>
            <tbody>
              ${players.map(player => `
                <tr>
                  <td><strong>${this._escape(this._playerName(player))}</strong></td>
                  <td>${Number(player.active_authorizations || 0)}</td>
                  <td>${Number(player.active_grants || 0)}</td>
                  <td>${Number(player.pending_requests || 0)}</td>
                  <td><button class="privacy-link-btn" type="button" data-player-focus="${this._escape(player.player_id)}">Gestionar →</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : this._empty("No hay jugadores en el alcance actual.")}

      <div class="privacy-section-head privacy-section-gap">
        <div><h2>Relaciones jugador / tutor</h2><p>Relaciones verificadas que pueden sustentar autoservicio o representación.</p></div>
        ${this._can(Permission.INVITE_FAMILY_LINK) ? `<button class="privacy-btn privacy-btn-primary" type="button" data-open-family-invite>+ Invitar familia</button>` : ""}
      </div>
      ${relationships.length ? `
        <div class="privacy-card-list">
          ${relationships.map(row => `
            <article class="privacy-row-card">
              <div>
                <strong>${this._escape(this._personName(row.user))}</strong>
                <span>${this._escape(row.relationship_type)} · ${this._escape(row.status)}</span>
              </div>
              <div class="privacy-row-meta">
                <span>Hasta ${this._formatDate(row.valid_until)}</span>
                ${row.verification_source ? `<small>${this._escape(row.verification_source)}</small>` : ""}
              </div>
              ${this._can(Permission.REVOKE_FAMILY_LINK) && row.status === "ACTIVE"
                ? `<button class="privacy-danger-link" type="button" data-revoke-relationship="${this._escape(row.id)}">Revocar</button>`
                : ""}
            </article>
          `).join("")}
        </div>
      ` : this._empty("No hay relaciones explícitas registradas para este alcance.")}
    `;
  }

  _renderAuthorizations() {
    const rows = this.state.authorizations || [];
    return `
      <div class="privacy-section-head">
        <div><h2>Autorizaciones de tratamiento</h2><p>Base documentada para procesar módulos y finalidades concretas.</p></div>
        ${this._can(Permission.CREATE_PRIVACY_AUTHORIZATION)
          ? `<button class="privacy-btn privacy-btn-primary" type="button" data-open-authorization>+ Nueva</button>` : ""}
      </div>
      ${rows.length ? `<div class="privacy-card-list">
        ${rows.map(row => `
          <article class="privacy-data-card">
            <div class="privacy-data-card-head">
              <div><strong>${this._escape(this._playerName(row))}</strong><span>${this._escape(row.authorization_type || "AUTORIZACIÓN")}</span></div>
              ${this._status(row.status)}
            </div>
            <div class="privacy-chip-row">
              ${(row.modules || []).map(value => `<span class="privacy-chip">${this._escape(value)}</span>`).join("")}
              ${(row.purposes || []).map(value => `<span class="privacy-chip privacy-chip-blue">${this._escape(value)}</span>`).join("")}
              ${row.ai_processing_allowed ? `<span class="privacy-chip privacy-chip-purple">IA autorizada</span>` : ""}
            </div>
            <dl class="privacy-details">
              <div><dt>Base legal</dt><dd>${this._escape(row.legal_basis_code || "—")}</dd></div>
              <div><dt>Condición especial</dt><dd>${this._escape(row.special_category_condition_code || "—")}</dd></div>
              <div><dt>Vigencia</dt><dd>${this._formatDate(row.valid_until)}</dd></div>
              <div><dt>Evidencia</dt><dd>${this._escape(row.evidence_reference || "—")}</dd></div>
            </dl>
            ${this._can(Permission.REVOKE_PRIVACY_AUTHORIZATION) && row.status === "ACTIVE"
              ? `<div class="privacy-card-actions"><button class="privacy-btn privacy-btn-danger" type="button" data-revoke-authorization="${this._escape(row.id)}">Revocar autorización</button></div>`
              : ""}
          </article>
        `).join("")}
      </div>` : this._empty("No hay autorizaciones registradas para el filtro actual.")}
    `;
  }

  _renderAccess() {
    if (!this._can(Permission.VIEW_SENSITIVE_ACCESS_GRANTS)) return this._empty("No tienes permiso para consultar accesos sensibles.");
    const pending = (this.state.requests || []).filter(row => row.status === "PENDING");
    const requests = this.state.requests || [];
    const grants = this.state.grants || [];
    return `
      <div class="privacy-section-head">
        <div><h2>Solicitudes pendientes</h2><p>Solicitar acceso nunca lo concede automáticamente.</p></div>
        <span class="privacy-count-badge">${pending.length} pendientes</span>
      </div>
      ${pending.length ? `<div class="privacy-card-list">
        ${pending.map(row => `
          <article class="privacy-request-card">
            <div>
              <strong>${this._escape(this._personName(row.requester))}</strong>
              <span>solicita acceso a ${this._escape(this._playerName(row))}</span>
              <p>${this._escape(row.justification || "Sin justificación")}</p>
            </div>
            <div class="privacy-chip-row">
              ${(row.modules || []).map(value => `<span class="privacy-chip">${this._escape(value)}</span>`).join("")}
              ${(row.actions || []).map(value => `<span class="privacy-chip privacy-chip-blue">${this._escape(value)}</span>`).join("")}
              ${(row.purposes || []).map(value => `<span class="privacy-chip privacy-chip-purple">${this._escape(value)}</span>`).join("")}
            </div>
            ${this._can(Permission.GRANT_SENSITIVE_ACCESS) || this._can(Permission.REVIEW_SENSITIVE_ACCESS_REQUESTS)
              ? `<div class="privacy-card-actions">
                  ${this._can(Permission.GRANT_SENSITIVE_ACCESS) ? `<button class="privacy-btn privacy-btn-primary" type="button" data-grant-request="${this._escape(row.id)}">Revisar y conceder</button>` : ""}
                  ${this._can(Permission.REVIEW_SENSITIVE_ACCESS_REQUESTS) ? `<button class="privacy-btn privacy-btn-danger" type="button" data-reject-request="${this._escape(row.id)}">Rechazar</button>` : ""}
                </div>`
              : ""}
          </article>
        `).join("")}
      </div>` : this._empty("No hay solicitudes pendientes.")}

      <div class="privacy-section-head privacy-section-gap"><div><h2>Accesos concedidos</h2><p>Grants explícitos, con alcance y caducidad propios.</p></div></div>
      ${grants.length ? `<div class="privacy-card-list">
        ${grants.map(row => `
          <article class="privacy-data-card">
            <div class="privacy-data-card-head">
              <div><strong>${this._escape(this._personName(row.user))}</strong><span>${this._escape(this._playerName(row))}</span></div>
              ${this._status(row.status)}
            </div>
            <div class="privacy-chip-row">
              ${(row.modules || []).map(value => `<span class="privacy-chip">${this._escape(value)}</span>`).join("")}
              ${(row.actions || []).map(value => `<span class="privacy-chip privacy-chip-blue">${this._escape(value)}</span>`).join("")}
              ${(row.purposes || []).map(value => `<span class="privacy-chip privacy-chip-purple">${this._escape(value)}</span>`).join("")}
            </div>
            <p class="privacy-reason">${this._escape(row.grant_reason || "Sin nota")}</p>
            <div class="privacy-validity">Válido hasta: <strong>${this._formatDate(row.valid_until)}</strong></div>
            ${this._can(Permission.REVOKE_SENSITIVE_ACCESS) && row.status === "ACTIVE"
              ? `<div class="privacy-card-actions"><button class="privacy-btn privacy-btn-danger" type="button" data-revoke-grant="${this._escape(row.id)}">Revocar acceso</button></div>`
              : ""}
          </article>
        `).join("")}
      </div>` : this._empty("No hay grants en el filtro actual.")}

      <details class="privacy-history"><summary>Historial de solicitudes (${requests.length})</summary>
        <div class="privacy-history-list">${requests.map(row => `<div><strong>${this._escape(this._personName(row.requester))}</strong><span>${this._escape(row.status)} · ${this._formatDate(row.created_at, true)}</span></div>`).join("")}</div>
      </details>
    `;
  }

  _renderAudit() {
    if (!this._can(Permission.VIEW_PRIVACY_AUDIT)) return this._empty("No tienes permiso para consultar la auditoría.");
    const rows = this.state.audit || [];
    return `
      <div class="privacy-section-head"><div><h2>Auditoría</h2><p>Trazabilidad reciente de decisiones y mutaciones de privacidad.</p></div><span class="privacy-count-badge">Últimos ${rows.length}</span></div>
      ${rows.length ? `<div class="privacy-audit-list">
        ${rows.map(row => `
          <article class="privacy-audit-row">
            <div class="privacy-audit-icon">${row.decision === "DENY" ? "⛔" : "✓"}</div>
            <div><strong>${this._escape(row.event_type || "Evento")}</strong><span>${this._escape(this._personName(row.actor, "Sistema"))} · ${this._formatDate(row.occurred_at, true)}</span><small>${this._escape([row.module, row.action, row.purpose, row.reason_code].filter(Boolean).join(" · "))}</small></div>
            ${this._status(row.decision || "LOG")}
          </article>
        `).join("")}
      </div>` : this._empty("No hay eventos de auditoría para el filtro actual.")}
    `;
  }

  _kpi(label, value, icon, alert = false) {
    return `<article class="privacy-kpi ${alert ? "alert" : ""}"><span>${icon}</span><div><strong>${Number(value || 0)}</strong><small>${this._escape(label)}</small></div></article>`;
  }

  _status(status = "") {
    const normalized = String(status || "").toUpperCase();
    const cls = normalized === "ACTIVE" || normalized === "ALLOW" || normalized === "APPROVED" ? "ok"
      : normalized === "PENDING" ? "pending"
      : normalized === "REVOKED" || normalized === "DENY" || normalized === "REJECTED" ? "danger" : "neutral";
    return `<span class="privacy-status ${cls}">${this._escape(normalized || "—")}</span>`;
  }

  _empty(message) {
    return `<div class="privacy-empty"><span>○</span><p>${this._escape(message)}</p></div>`;
  }

  _renderLoading() {
    return `<div class="privacy-loading"><div class="privacy-spinner"></div><strong>Cargando gobierno de privacidad…</strong><span>Aplicando alcance de equipo y temporada.</span>${this._styles()}</div>`;
  }

  _renderRestricted(detail = "Tu perfil no dispone de permisos para administrar autorizaciones y accesos sensibles.") {
    return `${this._styles()}<div class="privacy-message privacy-message-danger"><h2>🔒 Acceso restringido</h2><p>${this._escape(detail)}</p></div>`;
  }

  _renderMessage(title, body) {
    return `${this._styles()}<div class="privacy-message"><h2>${this._escape(title)}</h2><p>${this._escape(body)}</p></div>`;
  }

  _renderError(error) {
    const message = error?.message || "No se pudo cargar el Centro de Privacidad.";
    return `${this._styles()}<div class="privacy-message privacy-message-danger"><h2>⚠️ No se pudo cargar</h2><p>${this._escape(message)}</p><button type="button" class="privacy-btn privacy-btn-secondary" onclick="window.location.reload()">Reintentar</button></div>`;
  }

  _bindEvents() {
    if (!this.container) return;
    this.container.querySelectorAll("[data-privacy-tab]").forEach(button => {
      button.addEventListener("click", () => {
        this.activeTab = button.dataset.privacyTab;
        this._paint();
      });
    });

    this.container.querySelector("#privacy-player-filter")?.addEventListener("change", async event => {
      this.playerId = event.target.value || null;
      await this._load();
    });
    this.container.querySelector("#privacy-refresh")?.addEventListener("click", () => this._load());
    this.container.querySelector("[data-open-family-invite]")?.addEventListener("click", () => this._openFamilyInviteModal());
    this.container.querySelector("#privacy-new-authorization")?.addEventListener("click", () => this._openAuthorizationModal());
    this.container.querySelectorAll("[data-open-authorization]").forEach(button => button.addEventListener("click", () => this._openAuthorizationModal()));
    this.container.querySelectorAll("[data-player-focus]").forEach(button => button.addEventListener("click", async () => {
      this.playerId = button.dataset.playerFocus || null;
      this.activeTab = "authorizations";
      await this._load();
    }));

    this.container.querySelectorAll("[data-revoke-authorization]").forEach(button => button.addEventListener("click", () => this._revokeAuthorization(button.dataset.revokeAuthorization)));
    this.container.querySelectorAll("[data-revoke-grant]").forEach(button => button.addEventListener("click", () => this._revokeGrant(button.dataset.revokeGrant)));
    this.container.querySelectorAll("[data-revoke-relationship]").forEach(button => button.addEventListener("click", () => this._revokeRelationship(button.dataset.revokeRelationship)));
    this.container.querySelectorAll("[data-grant-request]").forEach(button => button.addEventListener("click", () => this._openGrantModal(button.dataset.grantRequest)));
    this.container.querySelectorAll("[data-reject-request]").forEach(button => button.addEventListener("click", () => this._rejectRequest(button.dataset.rejectRequest)));
  }

  _openFamilyInviteModal() {
    if (!this._can(Permission.INVITE_FAMILY_LINK)) return;
    const root = document.getElementById("privacy-modal-root");
    const players = this.state.snapshot.players || [];
    const defaultPlayer = this.playerId || players[0]?.player_id || "";
    if (!root || !defaultPlayer) return;
    root.innerHTML = `
      <div class="privacy-modal-overlay"><div class="privacy-modal" role="dialog" aria-modal="true" aria-labelledby="family-invite-title">
        <div class="privacy-modal-head"><div><h2 id="family-invite-title">Invitar a un familiar</h2><p>El vínculo se activa sólo cuando la persona reclama el código con el mismo email.</p></div><button type="button" data-modal-close aria-label="Cerrar">×</button></div>
        <form data-family-invite-form>
          <label>Jugador<select name="playerId" required>${players.map(row => `<option value="${this._escape(row.player_id)}" ${row.player_id === defaultPlayer ? "selected" : ""}>${this._escape(this._playerName(row))}</option>`).join("")}</select></label>
          <label>Email del padre/madre/tutor<input name="email" type="email" autocomplete="email" required></label>
          <label>Caducidad<select name="expiresHours"><option value="72">3 días</option><option value="168" selected>7 días</option><option value="336">14 días</option></select></label>
          <div data-family-invite-result aria-live="polite"></div>
          <div class="privacy-modal-actions"><button type="button" class="privacy-btn privacy-btn-secondary" data-modal-close>Cancelar</button><button type="submit" class="privacy-btn privacy-btn-primary">Crear invitación</button></div>
        </form>
      </div></div>`;
    this._bindModalClose(root);
    root.querySelector("[data-family-invite-form]")?.addEventListener("submit", event => this._submitFamilyInvite(event));
  }

  async _submitFamilyInvite(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const teamSeasonId = this._context().teamSeasonId;
    const resultBox = form.querySelector("[data-family-invite-result]");
    try {
      this._setFormBusy(form, true);
      const result = await this.familyService.createInvitation({ teamSeasonId, playerId: data.get("playerId"), email: data.get("email"), expiresHours: data.get("expiresHours") });
      const code = String(result?.claim_code || "");
      resultBox.innerHTML = `<div class="privacy-data-card"><strong>Invitación creada</strong><p>Comparte este código sólo con ${this._escape(result?.invite_email || data.get("email"))}.</p><code data-family-code>${this._escape(code)}</code><button type="button" class="privacy-btn privacy-btn-secondary" data-copy-family-code>Copiar código</button></div>`;
      resultBox.querySelector("[data-copy-family-code]")?.addEventListener("click", async () => { await navigator.clipboard?.writeText(code); });
    } catch (error) {
      resultBox.textContent = "No se ha podido crear la invitación.";
      console.error("[PrivacyCenterView] family invite", error);
    } finally { this._setFormBusy(form, false); }
  }

  _openAuthorizationModal() {
    if (!this._can(Permission.CREATE_PRIVACY_AUTHORIZATION)) return;
    const players = this.state.snapshot.players || [];
    const defaultPlayer = this.playerId || players[0]?.player_id || "";
    const root = document.getElementById("privacy-modal-root");
    if (!root || !defaultPlayer) return;
    root.innerHTML = `
      <div class="privacy-modal-overlay" role="presentation">
        <form class="privacy-modal" id="privacy-authorization-form" role="dialog" aria-modal="true" aria-labelledby="privacy-auth-modal-title" aria-describedby="privacy-auth-modal-desc">
          <div class="privacy-modal-head"><div><span>NUEVA AUTORIZACIÓN</span><h2 id="privacy-auth-modal-title">Autorizar tratamiento</h2><p id="privacy-auth-modal-desc">Documenta alcance, base, representación y uso de IA de forma explícita.</p></div><button type="button" data-close-privacy-modal aria-label="Cerrar">×</button></div>
          <label>Jugador<select name="playerId" required>${players.map(player => `<option value="${this._escape(player.player_id)}" ${String(defaultPlayer) === String(player.player_id) ? "selected" : ""}>${this._escape(this._playerName(player))}</option>`).join("")}</select></label>
          <div data-privacy-age-readiness-host>${this._ageReadinessMarkup(defaultPlayer)}</div>
          <fieldset><legend>Módulos</legend><label class="privacy-check"><input type="checkbox" name="modules" value="nutrition" checked> Nutrición</label><label class="privacy-check"><input type="checkbox" name="modules" value="recovery" checked> Recuperación</label><label class="privacy-check"><input type="checkbox" name="modules" value="neuro_cognitive"> Neuro-cognitivo</label></fieldset>
          <fieldset><legend>Finalidades</legend><label class="privacy-check"><input type="checkbox" name="purposes" value="SPORT_PERFORMANCE" checked> Rendimiento deportivo</label><label class="privacy-check"><input type="checkbox" name="purposes" value="OPERATIONS"> Operaciones</label><label class="privacy-check"><input type="checkbox" name="purposes" value="PLAYER_SELF_SERVICE"> Autoservicio jugador</label><label class="privacy-check"><input type="checkbox" name="purposes" value="FAMILY_SUPPORT"> Apoyo familiar</label></fieldset>
          <div class="privacy-form-grid"><label>Tipo de autorización<select name="authorizationType" required><option value="">Selecciona una opción</option><option value="CONSENT">Consentimiento documentado</option><option value="GUARDIAN_CONSENT">Consentimiento de padre/madre/tutor</option><option value="OTHER_DOCUMENTED_BASIS">Otra base documentada</option></select></label><label>Válida hasta<input type="date" name="validUntil"></label></div>
          <label data-guardian-representative hidden>Representante verificado<select name="representativeUserId">${this._guardianOptionsMarkup(defaultPlayer)}</select></label>
          <div class="privacy-form-note privacy-guardian-note" data-guardian-warning hidden>Para GUARDIAN_CONSENT debe existir un vínculo GUARDIAN activo y seleccionarse ese representante. Si no aparece, verifica primero la relación familiar.</div>
          <label>Base legal documentada (código interno)<input name="legalBasisCode" required placeholder="Ej. código de la política aprobada"></label>
          <label>Condición de categoría especial (código interno)<input name="specialCategoryConditionCode" required placeholder="Referencia interna validada por el club"></label>
          <label>Referencia de evidencia<input name="evidenceReference" placeholder="Documento, consentimiento o expediente"></label>
          <label class="privacy-check privacy-ai-check"><input type="checkbox" name="aiProcessingAllowed"> Autorizar tratamiento por IA dentro de este alcance</label>
          <div class="privacy-form-note">La autorización de IA es explícita y no activa por sí sola Family Pro, generación automática ni acceso a módulos no seleccionados.</div>
          <div class="privacy-form-note">IQBasket registra la decisión y su evidencia; no determina automáticamente la base jurídica aplicable por edad, rol o relación familiar.</div>
          <div class="privacy-modal-actions"><button type="button" class="privacy-btn privacy-btn-secondary" data-close-privacy-modal>Cancelar</button><button type="submit" class="privacy-btn privacy-btn-primary">Guardar autorización</button></div>
        </form>
      </div>
    `;
    this._bindModalClose(root);
    this._bindAuthorizationReadiness(root);
    root.querySelector("#privacy-authorization-form")?.addEventListener("submit", event => this._submitAuthorization(event));
  }

  _bindAuthorizationReadiness(root) {
    const form = root.querySelector("#privacy-authorization-form");
    if (!form) return;
    const playerSelect = form.querySelector('[name="playerId"]');
    const typeSelect = form.querySelector('[name="authorizationType"]');
    const representativeBlock = form.querySelector("[data-guardian-representative]");
    const representativeSelect = form.querySelector('[name="representativeUserId"]');
    const warning = form.querySelector("[data-guardian-warning]");
    const ageHost = form.querySelector("[data-privacy-age-readiness-host]");

    const refresh = () => {
      const playerId = playerSelect?.value || "";
      const guardians = this._guardianRows(playerId);
      if (ageHost) ageHost.innerHTML = this._ageReadinessMarkup(playerId);
      if (representativeSelect) representativeSelect.innerHTML = this._guardianOptionsMarkup(playerId);
      const guardianRequired = requiresGuardianRepresentative(typeSelect?.value);
      if (representativeBlock) representativeBlock.hidden = !guardianRequired;
      if (representativeSelect) representativeSelect.required = guardianRequired;
      if (warning) warning.hidden = !(guardianRequired && guardians.length === 0);
    };
    playerSelect?.addEventListener("change", refresh);
    typeSelect?.addEventListener("change", refresh);
    refresh();
  }

  async _submitAuthorization(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const teamSeasonId = DataStore.getActiveTeamSeasonId?.();
    try {
      this._setFormBusy(form, true);
      const authorizationType = String(data.get("authorizationType") || "").toUpperCase();
      const representativeUserId = data.get("representativeUserId") || null;
      if (requiresGuardianRepresentative(authorizationType) && !representativeUserId) {
        throw new Error("Selecciona un padre/madre/tutor con relación GUARDIAN activa.");
      }
      await this.service.recordAuthorization({
        teamSeasonId,
        playerId: data.get("playerId"),
        modules: data.getAll("modules"),
        purposes: data.getAll("purposes"),
        authorizationType,
        legalBasisCode: data.get("legalBasisCode"),
        specialCategoryConditionCode: data.get("specialCategoryConditionCode"),
        aiProcessingAllowed: data.get("aiProcessingAllowed") === "on",
        representativeUserId,
        validUntil: data.get("validUntil") ? `${data.get("validUntil")}T23:59:59Z` : null,
        evidenceReference: data.get("evidenceReference") || null
      });
      document.getElementById("privacy-modal-root").innerHTML = "";
      await this._load();
    } catch (error) {
      alert(`No se pudo crear la autorización: ${error.message || error}`);
      this._setFormBusy(form, false);
    }
  }

  _openGrantModal(requestId) {
    const request = (this.state.requests || []).find(row => String(row.id) === String(requestId));
    if (!request || !this._can(Permission.GRANT_SENSITIVE_ACCESS)) return;
    const root = document.getElementById("privacy-modal-root");
    if (!root) return;
    root.innerHTML = `
      <div class="privacy-modal-overlay" role="presentation">
        <form class="privacy-modal" id="privacy-grant-form" aria-labelledby="privacy-grant-modal-title">
          <div class="privacy-modal-head"><div><span>REVISIÓN DE SOLICITUD</span><h2 id="privacy-grant-modal-title">Conceder acceso sensible</h2></div><button type="button" data-close-privacy-modal aria-label="Cerrar">×</button></div>
          <div class="privacy-request-summary"><strong>${this._escape(this._personName(request.requester))}</strong><span>${this._escape(this._playerName(request))}</span><p>${this._escape(request.justification || "Sin justificación")}</p></div>
          <div class="privacy-chip-row">${(request.modules || []).map(v => `<span class="privacy-chip">${this._escape(v)}</span>`).join("")}${(request.actions || []).map(v => `<span class="privacy-chip privacy-chip-blue">${this._escape(v)}</span>`).join("")}${(request.purposes || []).map(v => `<span class="privacy-chip privacy-chip-purple">${this._escape(v)}</span>`).join("")}</div>
          <label>Válido hasta<input type="date" name="validUntil" required></label>
          <label>Motivo de concesión<textarea name="reason" rows="3" required placeholder="Justificación administrativa y alcance"></textarea></label>
          <div class="privacy-form-note">El grant conservará exactamente los módulos, acciones y finalidades solicitados. El backend vuelve a comprobar usuario, jugador y temporada.</div>
          <div class="privacy-modal-actions"><button type="button" class="privacy-btn privacy-btn-secondary" data-close-privacy-modal>Cancelar</button><button type="submit" class="privacy-btn privacy-btn-primary">Conceder acceso</button></div>
        </form>
      </div>
    `;
    this._bindModalClose(root);
    root.querySelector("#privacy-grant-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      try {
        this._setFormBusy(form, true);
        await this.service.grantSensitiveAccess({
          teamSeasonId: DataStore.getActiveTeamSeasonId?.(),
          userId: request.requested_by,
          playerId: request.player_id,
          modules: request.modules,
          actions: request.actions,
          purposes: request.purposes,
          validUntil: `${data.get("validUntil")}T23:59:59Z`,
          reason: data.get("reason"),
          requestId: request.id
        });
        root.innerHTML = "";
        await this._load();
      } catch (error) {
        alert(`No se pudo conceder el acceso: ${error.message || error}`);
        this._setFormBusy(form, false);
      }
    });
  }

  _bindModalClose(root) {
    root.querySelectorAll("[data-close-privacy-modal], [data-modal-close]").forEach(button => button.addEventListener("click", () => { root.innerHTML = ""; }));
    root.querySelector(".privacy-modal-overlay")?.addEventListener("click", event => {
      if (event.target.classList.contains("privacy-modal-overlay")) root.innerHTML = "";
    });
  }

  _setFormBusy(form, busy) {
    form.querySelectorAll("button,input,select,textarea").forEach(element => { element.disabled = Boolean(busy); });
  }

  /** Rechaza una solicitud sin conceder acceso y conserva trazabilidad. */
  async _rejectRequest(id) {
    if (!this._can(Permission.REVIEW_SENSITIVE_ACCESS_REQUESTS)) return;
    const reason = window.prompt("Motivo del rechazo de la solicitud:");
    if (!reason?.trim()) return;
    if (!window.confirm("¿Rechazar esta solicitud de acceso? La decisión quedará auditada.")) return;
    try {
      await this.service.rejectSensitiveAccessRequest({ requestId: id, reason });
      await this._load();
    } catch (error) {
      alert(`No se pudo rechazar la solicitud: ${error.message || error}`);
    }
  }

  async _revokeAuthorization(id) {
    if (!this._can(Permission.REVOKE_PRIVACY_AUTHORIZATION)) return;
    const reason = window.prompt("Motivo de revocación de la autorización:");
    if (!reason?.trim()) return;
    if (!window.confirm("¿Revocar esta autorización? El cambio será inmediato y quedará auditado.")) return;
    try { await this.service.revokeAuthorization({ authorizationId: id, reason }); await this._load(); }
    catch (error) { alert(`No se pudo revocar: ${error.message || error}`); }
  }

  async _revokeGrant(id) {
    if (!this._can(Permission.REVOKE_SENSITIVE_ACCESS)) return;
    const reason = window.prompt("Motivo de revocación del acceso:");
    if (!reason?.trim()) return;
    if (!window.confirm("¿Revocar este acceso sensible?")) return;
    try { await this.service.revokeSensitiveGrant({ grantId: id, reason }); await this._load(); }
    catch (error) { alert(`No se pudo revocar: ${error.message || error}`); }
  }

  async _revokeRelationship(id) {
    if (!this._can(Permission.REVOKE_FAMILY_LINK)) return;
    const reason = window.prompt("Motivo de revocación de la relación:");
    if (!reason?.trim()) return;
    if (!window.confirm("¿Revocar esta relación jugador/tutor?")) return;
    try { await this.service.revokeRelationship({ teamSeasonId: DataStore.getActiveTeamSeasonId?.(), relationshipId: id, reason }); await this._load(); }
    catch (error) { alert(`No se pudo revocar: ${error.message || error}`); }
  }

  _styles() {
    return `<style>
      .privacy-center{max-width:1200px;margin:0 auto;padding:4px 0 88px;color:#0f172a}.privacy-center *{box-sizing:border-box}.privacy-hero{display:flex;justify-content:space-between;gap:20px;padding:24px;border-radius:18px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;margin-bottom:16px}.privacy-hero h1{color:#fff!important;margin:3px 0 8px;font-size:clamp(24px,4vw,34px)}.privacy-hero p,.privacy-hero span,.privacy-hero small{color:#dbeafe!important}.privacy-eyebrow{font-size:11px!important;font-weight:900;letter-spacing:.08em}.privacy-secure-badge{min-width:145px;align-self:center;text-align:center;border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:13px;background:rgba(255,255,255,.08)}.privacy-secure-badge>span{display:block;font-size:24px!important}.privacy-secure-badge strong,.privacy-secure-badge small{display:block}.privacy-secure-badge small{font-size:10px!important;margin-top:3px}.privacy-toolbar{display:flex;align-items:end;gap:10px;flex-wrap:wrap;padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:12px}.privacy-filter{display:grid;gap:5px;min-width:min(100%,260px);flex:1}.privacy-filter>span{font-size:11px!important;font-weight:800;color:#475569!important}.privacy-filter select{min-height:44px}.privacy-btn{min-height:44px;border-radius:10px;padding:9px 14px;font-weight:800;font-size:13px}.privacy-btn-primary{background:#1d4ed8;color:#fff}.privacy-btn-secondary{background:#fff;color:#334155;border:1px solid #cbd5e1}.privacy-btn-danger{background:#fff1f2;color:#be123c;border:1px solid #fecdd3}.privacy-tabs{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}.privacy-tab{min-height:44px;white-space:nowrap;padding:9px 14px;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:10px;font-weight:800}.privacy-tab span{color:inherit!important;font-size:inherit!important}.privacy-tab.active{background:#1e40af;color:#fff;border-color:#1e40af}.privacy-panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px}.privacy-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.privacy-kpi{display:flex;gap:11px;align-items:center;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.privacy-kpi.alert{border-color:#fed7aa;background:#fff7ed}.privacy-kpi>span{font-size:23px!important}.privacy-kpi strong{display:block;font-size:22px}.privacy-kpi small{display:block;color:#64748b!important}.privacy-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0 10px}.privacy-section-head h2{font-size:18px;margin:0 0 3px}.privacy-section-head p{margin:0;color:#64748b}.privacy-section-gap{margin-top:28px}.privacy-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:12px}.privacy-table{min-width:620px}.privacy-table th,.privacy-table td{padding:12px;border-bottom:1px solid #e2e8f0;font-size:13px}.privacy-table th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;background:#f8fafc}.privacy-table tr:last-child td{border-bottom:0}.privacy-link-btn,.privacy-danger-link{min-height:36px;padding:4px 8px;color:#1d4ed8;font-weight:800}.privacy-danger-link{color:#be123c}.privacy-card-list{display:grid;gap:10px}.privacy-row-card,.privacy-data-card,.privacy-request-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fff}.privacy-row-card{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:12px}.privacy-row-card strong,.privacy-row-card span{display:block}.privacy-row-card span,.privacy-row-meta small{color:#64748b!important}.privacy-row-meta{text-align:right}.privacy-data-card-head{display:flex;justify-content:space-between;gap:10px}.privacy-data-card-head strong,.privacy-data-card-head span{display:block}.privacy-data-card-head span{color:#64748b!important;margin-top:2px}.privacy-chip-row{display:flex;gap:6px;flex-wrap:wrap;margin:11px 0}.privacy-chip{display:inline-flex!important;border-radius:999px;padding:4px 8px;background:#ecfdf5;color:#047857!important;font-size:10px!important;font-weight:900}.privacy-chip-blue{background:#eff6ff;color:#1d4ed8!important}.privacy-chip-purple{background:#f5f3ff;color:#6d28d9!important}.privacy-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.privacy-details div{padding:9px;background:#f8fafc;border-radius:9px}.privacy-details dt{font-size:10px;color:#64748b;text-transform:uppercase;font-weight:800}.privacy-details dd{margin:3px 0 0;font-size:12px;overflow-wrap:anywhere}.privacy-card-actions{display:flex;justify-content:flex-end;margin-top:12px}.privacy-status{display:inline-flex!important;align-items:center;padding:4px 8px;border-radius:999px;font-size:10px!important;font-weight:900}.privacy-status.ok{background:#dcfce7;color:#166534!important}.privacy-status.pending{background:#fef3c7;color:#92400e!important}.privacy-status.danger{background:#fee2e2;color:#991b1b!important}.privacy-status.neutral{background:#f1f5f9;color:#475569!important}.privacy-request-card p,.privacy-reason{margin:7px 0;color:#475569}.privacy-validity{font-size:12px;color:#64748b}.privacy-count-badge{display:inline-flex!important;padding:5px 9px;border-radius:999px;background:#f1f5f9;color:#475569!important;font-size:11px!important;font-weight:800}.privacy-history{margin-top:18px;border-top:1px solid #e2e8f0;padding-top:12px}.privacy-history summary{cursor:pointer;font-weight:800;color:#475569}.privacy-history-list{display:grid;gap:7px;margin-top:10px}.privacy-history-list>div{display:flex;justify-content:space-between;gap:10px;padding:8px;background:#f8fafc;border-radius:8px}.privacy-history-list span{color:#64748b!important}.privacy-audit-list{display:grid;gap:7px}.privacy-audit-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid #e2e8f0;border-radius:10px}.privacy-audit-icon{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:#f8fafc}.privacy-audit-row strong,.privacy-audit-row span,.privacy-audit-row small{display:block}.privacy-audit-row span,.privacy-audit-row small{color:#64748b!important}.privacy-empty{text-align:center;padding:28px;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b}.privacy-empty>span{font-size:28px!important;color:#94a3b8!important}.privacy-message,.privacy-loading{max-width:800px;margin:20px auto;padding:24px;border:1px solid #e2e8f0;background:#fff;border-radius:16px;text-align:center}.privacy-message-danger{border-color:#fecaca;background:#fff7f7}.privacy-loading{display:grid;place-items:center;gap:7px}.privacy-loading>span{color:#64748b!important}.privacy-spinner{width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:privacy-spin .8s linear infinite}@keyframes privacy-spin{to{transform:rotate(360deg)}}.privacy-modal-overlay{position:fixed;inset:0;z-index:2000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}.privacy-modal{width:min(680px,100%);max-height:calc(100svh - 32px);overflow-y:auto;background:#fff;border-radius:16px;padding:18px;display:grid;gap:12px}.privacy-modal label{display:grid;gap:5px;font-weight:700;color:#334155}.privacy-modal input,.privacy-modal select,.privacy-modal textarea{min-height:44px}.privacy-modal fieldset{border:1px solid #e2e8f0;border-radius:10px;padding:10px;display:flex;gap:10px;flex-wrap:wrap}.privacy-modal legend{padding:0 5px;font-size:12px;font-weight:900}.privacy-modal .privacy-check{display:flex;align-items:center;gap:6px;font-weight:600}.privacy-check input{min-height:auto;width:auto}.privacy-ai-check{padding:10px;border-radius:9px;background:#f8fafc}.privacy-modal-head{display:flex;justify-content:space-between;align-items:start;gap:10px}.privacy-modal-head span{font-size:10px!important;color:#64748b!important;font-weight:900;letter-spacing:.06em}.privacy-modal-head h2{margin:2px 0 0;font-size:20px}.privacy-modal-head button{font-size:24px;min-width:44px;min-height:44px}.privacy-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.privacy-form-note{padding:10px;border-radius:9px;background:#eff6ff;color:#1e40af;font-size:12px}.privacy-age-readiness{display:grid;gap:4px;padding:10px;border-radius:10px;border:1px solid #cbd5e1;background:#f8fafc}.privacy-age-readiness strong{font-size:12px}.privacy-age-readiness span{font-size:11px!important;color:#475569!important}.privacy-age-readiness.minor{border-color:#fed7aa;background:#fff7ed}.privacy-age-readiness.unknown{border-color:#fde68a;background:#fffbeb}.privacy-guardian-note{background:#fff7ed;color:#9a3412}.privacy-modal{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.privacy-modal-actions{display:flex;justify-content:flex-end;gap:8px;position:sticky;bottom:-18px;background:#fff;padding:10px 0 0}.privacy-request-summary{padding:12px;background:#f8fafc;border-radius:10px}.privacy-request-summary strong,.privacy-request-summary span{display:block}.privacy-request-summary span{color:#64748b!important}.privacy-request-summary p{margin:6px 0 0}
      @media(max-width:767px){.privacy-hero{padding:18px;display:block}.privacy-secure-badge{margin-top:14px;width:100%}.privacy-toolbar>*{width:100%}.privacy-panel{padding:12px}.privacy-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.privacy-row-card{grid-template-columns:1fr}.privacy-row-meta{text-align:left}.privacy-details{grid-template-columns:1fr}.privacy-data-card-head{align-items:start}.privacy-form-grid{grid-template-columns:1fr}.privacy-modal-overlay{align-items:flex-end;padding:0}.privacy-modal{max-height:calc(100svh - 12px);border-radius:16px 16px 0 0;padding-bottom:calc(20px + env(safe-area-inset-bottom,0px))}}
    </style>`;
  }
}

export default PrivacyCenterView;
