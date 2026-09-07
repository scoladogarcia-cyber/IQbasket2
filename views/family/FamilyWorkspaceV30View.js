/**
 * @fileoverview V30 Family workspace extension with team context and comparison.
 * @description Linked players are always identified; other identities are already
 * masked by the V30 backend according to Family privacy preferences.
 */
import { FamilyWorkspaceView } from "./FamilyWorkspaceView.js";
import { FamilyTeamSnapshotService } from "../../services/family/FamilyTeamSnapshotService.js";

const esc = (value = "") => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export class FamilyWorkspaceV30View extends FamilyWorkspaceView {
  constructor(supabaseClient = null, authController = null) {
    super(supabaseClient, authController);
    this.teamService = new FamilyTeamSnapshotService(supabaseClient);
    this.teamSnapshot = null;
  }

  async render(containerId = "dashboard-content-area", routeParams = {}) {
    await super.render(containerId, routeParams);
    const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!container || !this.playerId) return;

    const selected = (this.state?.players || []).find(row => String(row.player_id) === String(this.playerId)) || {};
    try {
      this.teamSnapshot = await this.teamService.getSnapshot({
        playerId: this.playerId,
        teamSeasonId: selected.team_season_id || null
      });
      const target = container.querySelector(".family-player-scope") || container.querySelector(".family-hero");
      if (target && this.teamSnapshot) target.insertAdjacentHTML("afterend", this._teamSection(this.teamSnapshot));
    } catch (error) {
      console.warn("[FamilyWorkspaceV30] Team snapshot no disponible:", error?.message || error);
    }
  }

  _playerIdentity(player = {}) {
    if (player.linked) {
      const name = `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Mi jugador";
      return `${player.jersey !== null && player.jersey !== undefined ? `#${player.jersey} · ` : ""}${name}`;
    }
    const name = `${player.first_name || ""} ${player.last_name || ""}`.trim();
    const jersey = player.jersey !== null && player.jersey !== undefined ? `#${player.jersey}` : "";
    const position = player.primary_position || "Posición";
    if (!name && !jersey) return position;
    return [jersey, name, position].filter(Boolean).join(" · ");
  }

  _teamSection(snapshot = {}) {
    const team = snapshot.team || {};
    const m = snapshot.team_metrics || {};
    const privacy = snapshot.privacy || {};
    const players = Array.isArray(snapshot.players) ? snapshot.players : [];
    const rows = players.map(player => `<tr class="${player.linked ? "family-team-linked" : ""}">
      <td><strong>${esc(this._playerIdentity(player))}</strong>${player.linked ? `<small>Tu jugador</small>` : ""}</td>
      <td>${n(player.games)}</td><td>${n(player.mpg).toFixed(1)}</td><td>${n(player.ppg).toFixed(1)}</td>
      <td>${n(player.rpg).toFixed(1)}</td><td>${n(player.apg).toFixed(1)}</td><td>${n(player.eval_pg).toFixed(1)}</td>
      <td>${n(player.plus_minus)}</td>
    </tr>`).join("");

    const identityText = privacy.show_other_player_names && privacy.show_other_player_jerseys
      ? "Puedes ver nombres y dorsales del resto de la plantilla."
      : !privacy.show_other_player_names && !privacy.show_other_player_jerseys
        ? "La identidad del resto está protegida: se muestra sólo su posición; sus métricas siguen disponibles para comparar."
        : "Se respetan por separado tus preferencias de nombres y dorsales; la posición siempre permanece visible.";

    return `<section class="family-team-v30" aria-labelledby="family-team-v30-title">
      <style>
        .family-team-v30{background:#fff;border:1px solid #dbe3ee;border-radius:18px;padding:20px;margin:18px 0;box-shadow:0 5px 20px rgba(15,23,42,.04);color:#0f172a}.family-team-v30 h2{margin:3px 0 5px;font-size:20px}.family-team-v30 p{margin:0;color:#64748b;line-height:1.5}.family-team-eyebrow{font-size:11px!important;font-weight:900;color:#1d4ed8!important;letter-spacing:.12em}.family-team-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin:15px 0}.family-team-kpi{border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:11px}.family-team-kpi strong{display:block;font-size:20px}.family-team-kpi span{font-size:10px;color:#64748b;font-weight:800}.family-team-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:12px}.family-team-v30 table{width:100%;border-collapse:collapse;min-width:720px}.family-team-v30 th,.family-team-v30 td{padding:10px 9px;border-bottom:1px solid #eef2f7;text-align:center;font-size:12px}.family-team-v30 th:first-child,.family-team-v30 td:first-child{text-align:left;min-width:190px}.family-team-v30 th{background:#f8fafc;color:#475569;font-size:10px;text-transform:uppercase}.family-team-v30 td small{display:block;color:#2563eb;font-size:9px;margin-top:2px}.family-team-linked{background:#eff6ff}.family-team-privacy{font-size:11px!important;margin-top:10px!important}
        @media(max-width:760px){.family-team-v30{padding:15px;border-radius:14px}.family-team-kpis{grid-template-columns:repeat(3,1fr)}}
      </style>
      <p class="family-team-eyebrow">CONTEXTO DE EQUIPO</p><h2 id="family-team-v30-title">${esc(team.team_name || "Equipo")} · ${esc(team.season_name || "")}</h2>
      <p>Resultados globales del equipo y comparación deportiva de la plantilla. Los datos personales sensibles de otros jugadores no se incluyen.</p>
      <div class="family-team-kpis">
        ${this._kpiTeam("PJ", n(m.games))}${this._kpiTeam("Victorias", n(m.wins))}${this._kpiTeam("Derrotas", n(m.losses))}
        ${this._kpiTeam("PF/P", n(m.points_for_avg).toFixed(1))}${this._kpiTeam("PC/P", n(m.points_against_avg).toFixed(1))}${this._kpiTeam("Asist.", n(m.assists))}
      </div>
      <div class="family-team-table-wrap"><table><thead><tr><th>Jugador / posición</th><th>PJ</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>VAL</th><th>+/-</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="8">Aún no hay estadísticas comparables.</td></tr>`}</tbody></table></div>
      <p class="family-team-privacy">🔐 ${esc(identityText)}</p>
    </section>`;
  }

  _kpiTeam(label, value) {
    return `<article class="family-team-kpi"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`;
  }
}

export default FamilyWorkspaceV30View;
