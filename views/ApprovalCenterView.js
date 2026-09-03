/**
 * @fileoverview Bandeja central de solicitudes y aprobaciones.
 * @description UI responsive que consume ApprovalCenterService y mantiene
 * las escrituras en los servicios de dominio existentes.
 */

import { DataStore } from "../services/DataStore.js";
import { ApprovalCenterService, RequestType } from "../services/ApprovalCenterService.js";
import { Permission } from "../security/PermissionService.js";

export class ApprovalCenterView {
  constructor(supabase, authController) {
    this.supabase = supabase || null;
    this.auth = authController || null;
    this.service = new ApprovalCenterService(this.supabase, this.auth, DataStore);
    this.state = {
      items: [],
      errors: [],
      pendingCount: 0,
      resolvedCount: 0
    };
    this.filter = "PENDING";
    this.container = null;
    this.isLoading = false;
  }

  _escape(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _statusMeta(status = "") {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "PENDING") {
      return { label: "Pendiente", icon: "⏳", bg: "#fef3c7", fg: "#92400e", border: "#fde68a" };
    }
    if (normalized === "APPROVED") {
      return { label: "Aprobada", icon: "✓", bg: "#dcfce7", fg: "#166534", border: "#86efac" };
    }
    if (normalized === "REJECTED") {
      return { label: "Rechazada", icon: "×", bg: "#fee2e2", fg: "#991b1b", border: "#fca5a5" };
    }
    if (normalized === "CANCELLED") {
      return { label: "Cancelada", icon: "—", bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1" };
    }
    return { label: normalized || "Estado", icon: "•", bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1" };
  }

  _typeMeta(type) {
    if (type === RequestType.GAME_LOCK) {
      return { label: "Cierre de partido", icon: "🔒", bg: "#fff7ed", fg: "#9a3412" };
    }
    return { label: "Acceso a equipo", icon: "👥", bg: "#eff6ff", fg: "#1d4ed8" };
  }

  _formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  _visibleItems() {
    if (this.filter === "ALL") return this.state.items || [];
    if (this.filter === "RESOLVED") {
      return (this.state.items || []).filter(item => item.status !== "PENDING");
    }
    return (this.state.items || []).filter(item => item.status === "PENDING");
  }

  async render(containerId = "dashboard-content-area") {
    const container = typeof containerId === "string"
      ? document.getElementById(containerId)
      : containerId;
    if (!container) return;

    this.container = container;

    if (!this.auth?.canPreview?.(Permission.VIEW_APPROVAL_CENTER)) {
      container.innerHTML = `
        <div style="padding:24px;background:#ffffff;border:1px solid #fecaca;border-radius:12px;color:#991b1b;">
          <h2 style="margin:0 0 8px;font-size:18px;">🔒 Acceso restringido</h2>
          <p style="margin:0;">Tu perfil no puede consultar la Bandeja de Solicitudes.</p>
        </div>
      `;
      return;
    }

    await this._loadAndRender();
  }

  async _loadAndRender() {
    if (!this.container || this.isLoading) return;
    this.isLoading = true;
    this.container.innerHTML = `
      <div style="max-width:1180px;margin:0 auto;padding:4px 0 80px;">
        <div style="padding:28px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;text-align:center;color:#475569;">
          <div style="font-size:28px;margin-bottom:8px;">⏳</div>
          <strong>Cargando solicitudes...</strong>
        </div>
      </div>
    `;

    try {
      this.state = await this.service.load();
    } catch (error) {
      console.error("[ApprovalCenterView] Error cargando bandeja:", error);
      this.state = {
        items: [],
        errors: [{ source: "CENTER", message: error?.message || String(error) }],
        pendingCount: 0,
        resolvedCount: 0
      };
    } finally {
      this.isLoading = false;
    }

    this._renderState();
  }

  _renderState() {
    if (!this.container) return;
    const visibleItems = this._visibleItems();
    const total = (this.state.items || []).length;
    const pending = Number(this.state.pendingCount || 0);
    const resolved = Number(this.state.resolvedCount || 0);

    const warningMarkup = (this.state.errors || []).length > 0
      ? `
        <div style="margin-bottom:14px;padding:12px 14px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:12px;">
          ⚠️ La bandeja se ha cargado parcialmente. ${this._escape((this.state.errors || []).map(error => error.message).join(" · "))}
        </div>
      `
      : "";

    const cardsMarkup = visibleItems.length > 0
      ? visibleItems.map(item => this._renderItem(item)).join("")
      : this._renderEmptyState();

    this.container.innerHTML = `
      <section style="max-width:1180px;margin:0 auto;padding:4px 0 90px;font-family:system-ui,-apple-system,sans-serif;">
        <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <h1 style="margin:0;color:#0f172a;font-size:24px;font-weight:900;">📥 Bandeja de Solicitudes</h1>
              ${pending > 0 ? `<span style="padding:4px 9px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:900;">${pending} pendiente${pending === 1 ? "" : "s"}</span>` : ""}
            </div>
            <p style="margin:6px 0 0;color:#64748b;font-size:13px;line-height:1.45;max-width:720px;">
              Unifica solicitudes de acceso y cierres de partido. Las acciones disponibles dependen siempre de tus permisos reales y del equipo/temporada seleccionados.
            </p>
          </div>
          <button type="button" id="btn-refresh-approval-center"
                  style="min-height:44px;padding:9px 14px;border-radius:9px;border:1px solid #cbd5e1;background:#ffffff;color:#0f172a;font-weight:800;cursor:pointer;">
            ↻ Actualizar
          </button>
        </header>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px;">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:13px;">
            <div style="font-size:11px;color:#64748b;font-weight:800;text-transform:uppercase;">Total visible</div>
            <div style="font-size:24px;color:#0f172a;font-weight:900;margin-top:3px;">${total}</div>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:13px;">
            <div style="font-size:11px;color:#92400e;font-weight:800;text-transform:uppercase;">Pendientes</div>
            <div style="font-size:24px;color:#78350f;font-weight:900;margin-top:3px;">${pending}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:13px;">
            <div style="font-size:11px;color:#64748b;font-weight:800;text-transform:uppercase;">Resueltas</div>
            <div style="font-size:24px;color:#334155;font-weight:900;margin-top:3px;">${resolved}</div>
          </div>
        </div>

        ${warningMarkup}

        <div role="tablist" aria-label="Filtrar solicitudes" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
          ${this._renderFilterButton("PENDING", `Pendientes (${pending})`)}
          ${this._renderFilterButton("RESOLVED", `Historial (${resolved})`)}
          ${this._renderFilterButton("ALL", `Todas (${total})`)}
        </div>

        <div id="approval-center-list" style="display:grid;gap:10px;">
          ${cardsMarkup}
        </div>
      </section>
    `;

    this._bindEvents();
  }

  _renderFilterButton(filter, label) {
    const active = this.filter === filter;
    return `
      <button type="button" class="approval-filter" data-filter="${filter}"
              role="tab" aria-selected="${active}"
              style="min-height:44px;padding:8px 14px;border-radius:999px;border:1px solid ${active ? "#1e3a8a" : "#cbd5e1"};background:${active ? "#1e3a8a" : "#ffffff"};color:${active ? "#ffffff" : "#334155"};font-weight:800;cursor:pointer;">
        ${label}
      </button>
    `;
  }

  _renderItem(item) {
    const status = this._statusMeta(item.status);
    const type = this._typeMeta(item.type);
    const created = this._formatDate(item.createdAt);
    const detail = item.detail ? this._escape(item.detail) : "";
    const actions = item.status === "PENDING" && (item.canApprove || item.canReject);

    const targetLink = item.type === RequestType.GAME_LOCK
      ? `#/games`
      : `#/settings`;

    return `
      <article class="approval-card" data-request-id="${this._escape(item.id)}"
               style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:15px;box-shadow:0 1px 3px rgba(15,23,42,.04);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div style="min-width:0;flex:1 1 280px;">
            <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:7px;">
              <span style="padding:3px 8px;border-radius:999px;background:${type.bg};color:${type.fg};font-size:11px;font-weight:900;">${type.icon} ${type.label}</span>
              <span style="padding:3px 8px;border-radius:999px;background:${status.bg};color:${status.fg};border:1px solid ${status.border};font-size:11px;font-weight:900;">${status.icon} ${status.label}</span>
            </div>
            <h2 style="margin:0;color:#0f172a;font-size:15px;font-weight:900;overflow-wrap:anywhere;">${this._escape(item.title)}</h2>
            <div style="margin-top:4px;color:#475569;font-size:12px;line-height:1.45;overflow-wrap:anywhere;">${this._escape(item.subtitle || "")}</div>
            ${detail ? `<div style="margin-top:7px;padding:8px 10px;border-radius:8px;background:#f8fafc;color:#334155;font-size:12px;line-height:1.45;overflow-wrap:anywhere;">${detail}</div>` : ""}
            ${created ? `<div style="margin-top:7px;color:#94a3b8;font-size:11px;">${created}</div>` : ""}
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
            <a href="${targetLink}" style="min-height:44px;display:inline-flex;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;text-decoration:none;font-size:12px;font-weight:800;">Ver contexto</a>
            ${actions && item.canApprove ? `<button type="button" class="btn-approval-approve" data-request-id="${this._escape(item.id)}" style="min-height:44px;padding:8px 12px;border:0;border-radius:8px;background:#166534;color:#ffffff;font-size:12px;font-weight:900;cursor:pointer;">✓ Aprobar</button>` : ""}
            ${actions && item.canReject ? `<button type="button" class="btn-approval-reject" data-request-id="${this._escape(item.id)}" style="min-height:44px;padding:8px 12px;border:1px solid #fca5a5;border-radius:8px;background:#fff1f2;color:#be123c;font-size:12px;font-weight:900;cursor:pointer;">Rechazar</button>` : ""}
          </div>
        </div>
      </article>
    `;
  }

  _renderEmptyState() {
    const isPending = this.filter === "PENDING";
    return `
      <div style="padding:34px 20px;text-align:center;background:#ffffff;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;">
        <div style="font-size:28px;margin-bottom:8px;">${isPending ? "✅" : "📭"}</div>
        <strong style="display:block;color:#334155;margin-bottom:4px;">${isPending ? "No tienes solicitudes pendientes" : "No hay solicitudes en este filtro"}</strong>
        <span style="font-size:12px;">La bandeja se actualizará al entrar de nuevo o al pulsar Actualizar.</span>
      </div>
    `;
  }

  _findItem(id) {
    return (this.state.items || []).find(item => String(item.id) === String(id)) || null;
  }

  _bindEvents() {
    this.container?.querySelector("#btn-refresh-approval-center")?.addEventListener("click", () => {
      this._loadAndRender();
    });

    this.container?.querySelectorAll(".approval-filter").forEach(button => {
      button.addEventListener("click", () => {
        this.filter = button.dataset.filter || "PENDING";
        this._renderState();
      });
    });

    this.container?.querySelectorAll(".btn-approval-approve").forEach(button => {
      button.addEventListener("click", async event => {
        const item = this._findItem(event.currentTarget.dataset.requestId);
        if (!item) return;
        const confirmation = item.type === RequestType.GAME_LOCK
          ? "¿Aprobar y cerrar este partido? Quedará bloqueado hasta que un Admin/Superadmin lo reabra."
          : "¿Aprobar esta solicitud de acceso?";
        if (!confirm(confirmation)) return;

        await this._runAction(event.currentTarget, async () => {
          await this.service.approve(item);
          if (item.type === RequestType.GAME_LOCK) {
            await DataStore.init(DataStore.getActiveTeamId?.() || null, true);
          }
        });
      });
    });

    this.container?.querySelectorAll(".btn-approval-reject").forEach(button => {
      button.addEventListener("click", async event => {
        const item = this._findItem(event.currentTarget.dataset.requestId);
        if (!item) return;
        const note = item.type === RequestType.GAME_LOCK
          ? prompt("Motivo del rechazo (opcional):", "")
          : null;
        if (item.type === RequestType.GAME_LOCK && note === null) return;

        await this._runAction(event.currentTarget, () => this.service.reject(item, note));
      });
    });
  }

  async _runAction(button, action) {
    try {
      button.disabled = true;
      button.style.opacity = "0.65";
      await action();
      await this._loadAndRender();
    } catch (error) {
      console.error("[ApprovalCenterView] Error resolviendo solicitud:", error);
      alert(`❌ No se pudo completar la acción: ${error?.message || error}`);
      button.disabled = false;
      button.style.opacity = "1";
    }
  }
}

export default ApprovalCenterView;
