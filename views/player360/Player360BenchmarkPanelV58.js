/**
 * @fileoverview Player360 Benchmark V58 panel.
 * @description Read-only objective benchmarking composed into the stable Player360
 * view. Subjective Passport scores are intentionally excluded.
 */

import { Permission } from "../../security/PermissionService.js";
import { BenchmarkService } from "../../services/player360/BenchmarkService.js";

function esc(v=""){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function fmt(v,d=1){const n=Number(v);return Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:d}):"—";}
function arrow(v,higher=true){const n=Number(v);if(!Number.isFinite(n)||n===0)return "→";return (higher?n>0:n<0)?"↗":"↘";}

export class Player360BenchmarkPanelV58 {
  constructor({client=null,can=()=>false,getContext=()=>({})}={}){
    this.service=new BenchmarkService(client);
    this.can=can;
    this.getContext=getContext;
    this.data=null;
  }

  async load(){
    if(!this.can(Permission.VIEW_BENCHMARKS)){this.data=null;return null;}
    try{
      this.data=await this.service.getPlayerBenchmark(this.getContext());
    }catch(error){
      console.warn("[Benchmark V58]",error?.message||error);
      this.data={error:String(error?.message||error)};
    }
    return this.data;
  }

  html(){
    const d=this.data;
    if(!d)return "";
    if(d.error)return '<section class="b58-panel"><p>No se pudo calcular benchmarking: '+esc(d.error)+'</p></section>'+this.styles();

    const teamRows=(d.teamBenchmark?.metrics||[]).map(m=>{
      const ready=Number.isFinite(Number(m.percentile));
      return '<tr><td>'+esc(m.label)+'</td><td>'+fmt(m.value,1)+'</td><td>'+(ready?("P"+fmt(m.percentile,0)):"—")+'</td><td>'+fmt(m.sampleSize,0)+'</td></tr>';
    }).join("");
    const selfRows=(d.selfBenchmark||[]).map(m=>{
      const change=Number(m.change);
      return '<tr><td>'+esc(m.label)+'</td><td>'+fmt(m.early,1)+'</td><td>'+fmt(m.recent,1)+'</td><td>'+arrow(change,m.higher)+' '+fmt(change,1)+'</td></tr>';
    }).join("");
    const network=(d.network||[]).filter(x=>x.reliability!=="HIDDEN");
    const networkHtml=network.length
      ? '<div class="b58-network">'+network.map(x=>'<span><b>'+esc(x.metric_code)+'</b> · n='+fmt(x.sample_size,0)+' · '+esc(x.reliability)+'</span>').join("")+'</div>'
      : '<div class="b58-network is-empty"><strong>Benchmark IQBasket Network</strong><span>Aún sin cohorte externa suficiente. No se muestran percentiles de red con n&lt;20.</span><small>'+esc(d.cohortKey||"")+'</small></div>';

    return '<section class="b58-panel" aria-label="Benchmarking">'+
      '<header><div><span>IQBASKET · BENCHMARK</span><h2>Comparación contextual del jugador</h2><p>Percentiles objetivos con mínimos de muestra.</p></div><b>'+fmt(d.gamesCount,0)+' partidos</b></header>'+
      '<div class="b58-grid">'+
        '<details open><summary>Contra el equipo</summary><div class="b58-scroll"><table><thead><tr><th>Métrica</th><th>Valor</th><th>Percentil</th><th>n</th></tr></thead><tbody>'+teamRows+'</tbody></table></div></details>'+
        '<details open><summary>Evolución propia</summary><div class="b58-scroll"><table><thead><tr><th>Métrica</th><th>1ª mitad</th><th>2ª mitad</th><th>Cambio</th></tr></thead><tbody>'+selfRows+'</tbody></table></div></details>'+
      '</div>'+networkHtml+
      '<p class="b58-note">Las tasas /40 se normalizan por minutos. eFG%, TS% y 3P% exigen mínimos de intentos. En pérdidas, percentil alto significa mejor control.</p>'+
    '</section>'+this.styles();
  }

  styles(){
    return '<style>'+
      '.b58-panel{display:grid;gap:12px;padding:16px;border:1px solid #cbd5e1;border-radius:15px;background:#fff;color:#0f172a;margin-top:14px}.b58-panel header{display:flex;justify-content:space-between;gap:12px}.b58-panel header span{font-size:10px;font-weight:900;color:#7c3aed;letter-spacing:.06em}.b58-panel h2{font-size:18px;margin:3px 0}.b58-panel header p{font-size:11px;color:#64748b;margin:0}.b58-panel header>b{height:fit-content;background:#ede9fe;color:#5b21b6;border-radius:999px;padding:6px 9px;font-size:11px}.b58-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.b58-grid details{border:1px solid #e2e8f0;border-radius:11px}.b58-grid summary{padding:9px 11px;font-weight:850;cursor:pointer}.b58-scroll{overflow:auto}.b58-grid table{width:100%;border-collapse:collapse;font-size:10px}.b58-grid th,.b58-grid td{padding:7px 9px;border-top:1px solid #f1f5f9;text-align:left;white-space:nowrap}.b58-network{display:flex;gap:8px;flex-wrap:wrap;padding:10px;border-radius:10px;background:#f5f3ff;border:1px solid #ddd6fe;font-size:10px}.b58-network.is-empty{display:grid}.b58-network small{color:#64748b;word-break:break-all}.b58-note{margin:0;font-size:9px;line-height:1.45;color:#64748b}@media(max-width:720px){.b58-grid{grid-template-columns:1fr}.b58-panel header{display:grid}}'+
    '</style>';
  }

  async mount(root){
    if(!root||!this.can(Permission.VIEW_BENCHMARKS))return;
    await this.load();
    root.querySelector(".b58-panel")?.remove();
    const html=this.html();
    if(html)root.insertAdjacentHTML("beforeend",html);
  }
}
export default Player360BenchmarkPanelV58;
