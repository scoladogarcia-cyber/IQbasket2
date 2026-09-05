/**
 * @fileoverview Internal business/product metrics dashboard.
 * @description Aggregate, PII-free decision support for SUPERADMIN only.
 */
import { BusinessMetricsService } from "../../services/analytics/BusinessMetricsService.js";

const esc = (value = "") => String(value)
  .replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;");
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export class BusinessMetricsView {
  constructor(supabaseClient = null) {
    this.service = new BusinessMetricsService(supabaseClient);
    this.days = 30;
    this.container = null;
  }

  async render(containerId = "dashboard-content-area") {
    this.container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!this.container) return;
    this._styles();
    this.container.innerHTML = `<div class="biz-loading">Cargando métricas de producto…</div>`;
    try {
      const metrics = await this.service.getMetrics(this.days);
      this.container.innerHTML = this._content(metrics);
      this._bind();
    } catch (error) {
      this.container.innerHTML = `<section class="biz-shell"><div class="biz-error"><h1>Panel de negocio no disponible</h1><p>${esc(error?.message || error)}</p></div></section>`;
    }
  }

  _content(metrics = {}) {
    const events = metrics.events || {};
    const plans = metrics.family_plans || {};
    const eventRows = Object.entries(events)
      .sort((a,b) => num(b[1]) - num(a[1]))
      .slice(0,12)
      .map(([code,total]) => `<tr><td>${esc(code)}</td><td>${num(total)}</td></tr>`).join("");
    const planRows = Object.entries(plans)
      .map(([code,status]) => `<span class="biz-plan"><b>${esc(code)}</b><i>${esc(status)}</i></span>`).join("");

    return `<section class="biz-shell">
      <header class="biz-hero"><div><p>IQBasket · Growth</p><h1>Producto y monetización</h1>
        <span>Métricas first-party agregadas. Interés no equivale a compra.</span></div>
        <label>Ventana<select data-biz-days>
          <option value="7" ${this.days===7?"selected":""}>7 días</option>
          <option value="30" ${this.days===30?"selected":""}>30 días</option>
          <option value="90" ${this.days===90?"selected":""}>90 días</option>
        </select></label>
      </header>
      <div class="biz-kpis">
        ${this._kpi("Familias activas",num(metrics.unique_users),"usuarios con evento")}
        ${this._kpi("Jugadores",num(metrics.unique_players),"con interacción familiar")}
        ${this._kpi("Ofertas vistas",num(metrics.offer_views),"contextuales")}
        ${this._kpi("Interés",`${num(metrics.interest_rate)}%`,`${num(metrics.interest_clicks)} acciones`)}
      </div>
      <div class="biz-grid">
        <article class="biz-card"><div><p>Planes Family</p><h2>Estado comercial</h2></div>
          <div class="biz-plan-list">${planRows || "Sin planes"}</div>
          <small>Los planes DRAFT no conceden acceso ni pueden consumirse como suscripción efectiva.</small>
        </article>
        <article class="biz-card"><div><p>Funnel</p><h2>Eventos principales</h2></div>
          <div class="biz-table-wrap"><table><thead><tr><th>Evento</th><th>Total</th></tr></thead>
          <tbody>${eventRows || '<tr><td colspan="2">Aún no hay eventos.</td></tr>'}</tbody></table></div>
        </article>
      </div>
      <article class="biz-note"><strong>Lectura correcta:</strong> primero medimos activación y valor. No calcularemos MRR, churn o LTV hasta que exista facturación real y eventos de compra/cancelación verificables.</article>
    </section>`;
  }

  _kpi(label,value,caption) {
    return `<article><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(caption)}</small></article>`;
  }

  _bind() {
    this.container?.querySelector("[data-biz-days]")?.addEventListener("change", async event => {
      this.days = Number(event.target.value) || 30;
      await this.render(this.container);
    });
  }

  _styles() {
    if (document.getElementById("business-metrics-styles")) return;
    const style=document.createElement("style");
    style.id="business-metrics-styles";
    style.textContent=`
      .biz-shell{max-width:1180px;margin:0 auto;padding:8px 0 48px;color:#0f172a}.biz-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;padding:24px;border:1px solid #dbeafe;border-radius:22px;background:linear-gradient(135deg,#eff6ff,#f8fafc)}
      .biz-hero p,.biz-card p{margin:0;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#2563eb}.biz-hero h1{margin:4px 0 6px}.biz-hero span{color:#64748b}.biz-hero label{display:grid;gap:5px;font-size:12px;font-weight:800}.biz-hero select{min-height:42px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:6px 10px}
      .biz-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.biz-kpis article{display:grid;padding:16px;background:#0f172a;color:#fff;border-radius:16px}.biz-kpis span{font-size:11px;color:#cbd5e1;text-transform:uppercase}.biz-kpis strong{font-size:27px}.biz-kpis small{color:#94a3b8}
      .biz-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:14px}.biz-card{padding:20px;border:1px solid #e2e8f0;border-radius:18px;background:#fff}.biz-card h2{margin:4px 0 14px}.biz-card small,.biz-note{color:#64748b;font-size:12px}.biz-plan-list{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 16px}.biz-plan{display:grid;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px}.biz-plan i{font-size:11px;color:#64748b;font-style:normal}
      .biz-table-wrap{overflow:auto}.biz-card table{width:100%;border-collapse:collapse;font-size:12px}.biz-card th,.biz-card td{text-align:left;padding:9px;border-bottom:1px solid #f1f5f9}.biz-card th:last-child,.biz-card td:last-child{text-align:right}.biz-note{margin-top:14px;padding:14px;border-radius:14px;background:#f8fafc}.biz-loading,.biz-error{padding:32px;text-align:center}
      @media(max-width:760px){.biz-hero{display:grid;align-items:start}.biz-kpis{grid-template-columns:1fr 1fr}.biz-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }
}

export default BusinessMetricsView;
