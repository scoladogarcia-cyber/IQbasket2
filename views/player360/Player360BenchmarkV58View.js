/**
 * @fileoverview Player360 V58 benchmark extension.
 * @description Adds self/team percentiles without changing the stable evaluation,
 * development, wellness or longitudinal modules.
 */

import { Player360View } from "../Player360View.js";
import { Permission } from "../../security/PermissionService.js";
import { BenchmarkService } from "../../services/player360/BenchmarkService.js";

function esc(v=""){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function fmt(v,d=1){const n=Number(v);return Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:d}):"—";}
function arrow(v,higher=true){
  const n=Number(v); if(!Number.isFinite(n)||n===0)return "→";
  const good=higher?n>0:n<0; return good?"↗":"↘";
}

export class Player360BenchmarkV58View extends Player360View {
  constructor(client=null,auth=null){
    super(client,auth);
    this.benchmarkService=new BenchmarkService(this.supabase);
    this.benchmarkData=null;
  }

  async _loadBenchmark(){
    if(!this._can(Permission.VIEW_BENCHMARKS))return null;
    try{
      this.benchmarkData=await this.benchmarkService.getPlayerBenchmark({
        playerId:this.playerId,teamId:this.teamId,teamSeasonId:this.teamSeasonId
      });
    }catch(error){
      console.warn("[Benchmark V58]",error?.message||error);
      this.benchmarkData={error:String(error?.message||error)};
    }
    return this.benchmarkData;
  }

  _panel(){
    const d=this.benchmarkData;
    if(!d||d.error)return d?.error?'<section class="b58-panel"><p>No se pudo calcular benchmarking: '+esc(d.error)+'</p></section>':"";
    const teamRows=(d.teamBenchmark?.metrics||[]).map(m=>{
      const ready=Number.isFinite(Number(m.percentile));
      const pct=ready?("P"+fmt(m.percentile,0)):"—";
      return '<tr><td>'+esc(m.label)+'</td><td>'+fmt(m.value,1)+'</td><td>'+pct+'</td><td>'+fmt(m.sampleSize,0)+'</td></tr>';
    }).join("");
    const selfRows=(d.selfBenchmark||[]).map(m=>{
      const change=Number(m.change);
      return '<tr><td>'+esc(m.label)+'</td><td>'+fmt(m.early,1)+'</td><td>'+fmt(m.recent,1)+'</td><td>'+arrow(change,m.higher)+' '+fmt(change,1)+'</td></tr>';
    }).join("");
    const network=(d.network||[]).filter(x=>x.reliability!=="HIDDEN");
    const networkHtml=network.length
      ? '<div class="b58-network">'+network.map(x=>'<span><b>'+esc(x.metric_code)+'</b> · n='+fmt(x.sample_size,0)+' · '+esc(x.reliability)+'</span>').join("")+'</div>'
      : '<div class="b58-network is-empty"><strong>Benchmark IQBasket Network</strong><span>Aún sin cohorte externa suficiente. El motor queda preparado y no muestra percentiles de red con n&lt;20.</span><small>'+esc(d.cohortKey||"")+'</small></div>';

    return '<section class="b58-panel" aria-label="Benchmarking">'+
      '<header><div><span>IQBASKET · BENCHMARK</span><h2>Comparación contextual del jugador</h2><p>Percentiles de rendimiento objetivo. No se usan puntuaciones subjetivas del Passport.</p></div><b>'+fmt(d.gamesCount,0)+' partidos</b></header>'+
      '<div class="b58-grid">'+
        '<details open><summary>Contra el equipo</summary><div class="b58-scroll"><table><thead><tr><th>Métrica</th><th>Valor</th><th>Percentil</th><th>n</th></tr></thead><tbody>'+teamRows+'</tbody></table></div></details>'+
        '<details open><summary>Evolución propia</summary><div class="b58-scroll"><table><thead><tr><th>Métrica</th><th>1ª mitad</th><th>2ª mitad</th><th>Cambio</th></tr></thead><tbody>'+selfRows+'</tbody></table></div></details>'+
      '</div>'+networkHtml+
      '<p class="b58-note">Las tasas por 40 minutos se normalizan por tiempo jugado. eFG%, TS% y 3P% exigen mínimos de muestra. En pérdidas, un percentil alto significa mejor control (menos pérdidas/40).</p>'+
    '</section>'+
    '<style>'+
      '.b58-panel{display:grid;gap:12px;padding:16px;border:1px solid #cbd5e1;border-radius:15px;background:#fff;color:#0f172a;margin-top:14px}.b58-panel header{display:flex;justify-content:space-between;gap:12px}.b58-panel header span{font-size:10px;font-weight:900;color:#7c3aed;letter-spacing:.06em}.b58-panel h2{font-size:18px;margin:3px 0}.b58-panel header p{font-size:11px;color:#64748b;margin:0}.b58-panel header>b{height:fit-content;background:#ede9fe;color:#5b21b6;border-radius:999px;padding:6px 9px;font-size:11px}.b58-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.b58-grid details{border:1px solid #e2e8f0;border-radius:11px}.b58-grid summary{padding:9px 11px;font-weight:850;cursor:pointer}.b58-scroll{overflow:auto}.b58-grid table{width:100%;border-collapse:collapse;font-size:10px}.b58-grid th,.b58-grid td{padding:7px 9px;border-top:1px solid #f1f5f9;text-align:left;white-space:nowrap}.b58-network{display:flex;gap:8px;flex-wrap:wrap;padding:10px;border-radius:10px;background:#f5f3ff;border:1px solid #ddd6fe;font-size:10px}.b58-network.is-empty{display:grid}.b58-network small{color:#64748b;word-break:break-all}.b58-note{margin:0;font-size:9px;line-height:1.45;color:#64748b}@media(max-width:720px){.b58-grid{grid-template-columns:1fr}.b58-panel header{display:grid}}'+
    '</style>';
  }

  async render(containerId="dashboard-content-area",playerId=null,teamId=null){
    await super.render(containerId,playerId,teamId);
    if(!this.playerId||!this.teamSeasonId||!this._can(Permission.VIEW_BENCHMARKS))return;
    await this._loadBenchmark();
    const container=document.getElementById(containerId);if(!container)return;
    const root=container.querySelector(".p360c-view")||container;
    root.insertAdjacentHTML("beforeend",this._panel());
  }
}
export default Player360BenchmarkV58View;
