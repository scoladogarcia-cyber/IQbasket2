/**
 * @fileoverview Informes V53: selección de partidos, intercambio BoxScore y mapas individuales.
 * @description Extiende V50 sin duplicar métricas ni cambiar base de datos.
 * Exportar requiere permiso por partido; importar requiere edición, previsualización
 * explícita, partido abierto y ausencia de eventos del play-by-play.
 */
import ReportsViewV50 from "./ReportsViewV50.js";
import { DataStore } from "../services/DataStore.js";
import { supabase } from "../config/database.config.js";
import { Permission } from "../security/permissions.js";
import { ReportType } from "../security/ReportAccessPolicy.js";
import { ReportExporter } from "../services/ReportExporter.js";
import { loadAuthorizedFinalGameReport } from "../services/games/GameFinalReportReadService.js";
import { refreshGameBoxScore } from "../services/games/GameBoxScoreFreshReadService.js";
import { buildCompleteSeasonReport } from "../services/reports/CompleteSeasonReportService.js";
import { renderSelectedGamesOverview } from "./reports/SelectedGamesOverviewV53.js";
import { buildBoxScoreExchangeRows,serializeBoxScoreCsv,serializeBoxScoreExcel,parseBoxScoreCsv,parseBoxScoreExcel,validateBoxScoreImport,commitBoxScoreImport } from "../services/reports/BoxScoreExchangeV53.js";

const id = value => String(value ?? "");
const button = (label, color="#1e40af") => {
  const node=document.createElement("button");node.type="button";node.textContent=label;
  node.style.cssText=`padding:10px 12px;border-radius:9px;border:0;background:${color};color:white;font-weight:800;min-height:44px;cursor:pointer;white-space:normal`;
  return node;
};
const note = text => {const p=document.createElement("p");p.textContent=text;p.style.cssText="font-size:12px;color:#475569;margin:8px 0";return p;};

export class ReportsViewV53 extends ReportsViewV50 {
  constructor(authController=null) {
    super(authController);
    this._selectionScope="";
    this._selectedReportIds=new Set();
    this._overviewToken=0;
    this._exchangeBusy=false;
    this._playerEvents=[];
    this._playerEventsScope=new Set();
  }

  /** Los eventos no forman parte de la carga inicial del DataStore: lectura RLS fresca. */
  async _loadPlayerSelection(context, selection) {
    const stats=await super._loadPlayerSelection(context,selection);
    if (!supabase?.from) throw new Error("No se puede cargar el mapa de tiro individual.");
    const gameIds=new Set(selection.games.map(game=>id(game.id)));
    const playerIds=new Set(selection.players.map(player=>id(player.id)));
    const events=[];
    const ids=[...gameIds];
    for(let i=0;i<ids.length;i+=35) {
      for(let offset=0;;offset+=1000) {
        const {data,error}=await supabase.from("game_events")
          .select("game_id,player_id,action_type,made,points,coord_x,coord_y")
          .in("game_id",ids.slice(i,i+35)).range(offset,offset+999);
        if(error || !Array.isArray(data)) throw new Error("No se pudieron recuperar los tiros individuales actualizados.");
        for(const event of data) {
          if(!gameIds.has(id(event.game_id))) throw new Error("Evento fuera de la selección autorizada.");
          if(playerIds.has(id(event.player_id))) events.push(event);
        }
        if(data.length<1000) break;
      }
    }
    // Sustituir el estado solamente al completar la consulta y validación.
    this._playerEvents=events;
    this._playerEventsScope=gameIds;
    return stats;
  }

  /** Usado por la ficha legacy: evita consultar una caché de eventos descargada a medias. */
  _getGameShotEvents(gameId=null,playerId=null) {
    const allowed=this._playerEventsScope;
    if(!allowed?.size) return [];
    return this._playerEvents.filter(event=>{
      const gid=id(event.game_id ?? event.gameId),pid=id(event.player_id ?? event.playerId);
      if(!allowed.has(gid) || (gameId && gameId!=="all" && gid!==id(gameId)) || (playerId && playerId!=="all" && pid!==id(playerId))) return false;
      const action=String(event.action_type ?? event.action ?? "").toLowerCase();
      if(!(/^(fg[23]_(made|attempted)|t[23]_(made|attempted))$/.test(action) || /(?:shot|tiro|triple)/.test(action))) return false;
      const x=event.coord_x ?? event.coordX,y=event.coord_y ?? event.coordY;
      return x!==null && x!==undefined && y!==null && y!==undefined
        && Number.isFinite(Number(x)) && Number.isFinite(Number(y))
        && Number(x)>=0 && Number(x)<=100 && Number(y)>=0 && Number(y)<=100;
    });
  }

  _visibleGames() {return this._exportableGames(this._reportContext());}
  _selectionGames() {
    const allowed=this._visibleGames();
    return this.selectedGameId!=="all" ? allowed.filter(game=>id(game.id)===id(this.selectedGameId))
      : allowed.filter(game=>this._selectedReportIds.has(id(game.id)));
  }
  _syncSelection() {
    const scope=this._reportContext();const key=`${id(scope.teamId)}:${id(scope.teamSeasonId)}`;
    const all=this._visibleGames();
    if(this._selectionScope!==key) {this._selectionScope=key;this._selectedReportIds=new Set(all.map(game=>id(game.id)));}
    else {const allowed=new Set(all.map(game=>id(game.id)));this._selectedReportIds=new Set([...this._selectedReportIds].filter(gid=>allowed.has(gid)));}
  }

  /** Revalida el permiso de exportación por recurso después de cada lectura. */
  async _readSelected(games,requireExport=true) {
    if(!games.length) throw new Error("Selecciona al menos un partido.");
    const context=this._reportContext();const result=[];
    for(const selected of games) {
      const scope={...context,gameId:selected.id};
      if(!this.reportAccessPolicy.canView(ReportType.GAME_STATS,scope) || (requireExport&&!this.reportAccessPolicy.canExport(ReportType.GAME_STATS,scope))) throw new Error("Partido fuera del alcance autorizado.");
      const report=await loadAuthorizedFinalGameReport({supabase,dataStore:DataStore,auth:this.auth,gameId:selected.id});
      if(id(report.game.id)!==id(selected.id) || id(report.game.team_id)!==id(context.teamId)
        || id(report.game.team_season_id)!==id(context.teamSeasonId)
        || !report.policy.canView(ReportType.GAME_STATS,report.context)
        || (requireExport&&!report.policy.canExport(ReportType.GAME_STATS,report.context))) throw new Error("Ha cambiado el partido o el permiso durante la lectura.");
      result.push(report);
    }
    if(id(context.teamId)!==id(this._reportContext().teamId)||id(context.teamSeasonId)!==id(this._reportContext().teamSeasonId)) throw new Error("Has cambiado de equipo/temporada. Operación cancelada.");
    return result;
  }

  _download(content,mime,filename) {
    const blob=new Blob([content],{type:mime});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  async _exportSelection(kind,status) {
    if(this._exchangeBusy)return;
    const games=this._selectionGames(),context=this._reportContext();
    if(!games.length){status.textContent="Selecciona partidos para exportar.";return;}
    const printWindow=kind==="pdf"?window.open("","_blank","width=1024,height=768"):null;
    if(kind==="pdf"&&!printWindow){status.textContent="Permite ventanas emergentes para guardar el PDF.";return;}
    this._exchangeBusy=true;status.textContent=`Consultando ${games.length} acta(s) autorizadas…`;
    if(printWindow)printWindow.document.body.textContent="Preparando informe completo…";
    try {
      const reports=await this._readSelected(games,true);
      if(kind==="pdf") {
        const html=buildCompleteSeasonReport({reports,teamName:DataStore.getTeamById?.(context.teamId)?.name||"Equipo",seasonName:DataStore.getActiveSeasonDisplayName?.(context.teamId)||"Temporada"});
        const authorization=this.reportAccessPolicy.authorizeExport(ReportType.SEASON_DOSSIER,context);
        if(!authorization.allowed||!ReportExporter.printReport("IQBasket_Seleccion_Partidos",html,{authorization,printWindow})) throw new Error("No se pudo preparar el PDF o faltan permisos.");
      } else {
        const rows=buildBoxScoreExchangeRows(reports);
        if(kind==="csv")this._download(serializeBoxScoreCsv(rows),"text/csv;charset=utf-8","IQBasket_BoxScore_Seleccion.csv");
        else this._download(serializeBoxScoreExcel(rows),"application/vnd.ms-excel;charset=utf-8","IQBasket_BoxScore_Seleccion.xls");
      }
      status.textContent=`Preparados ${games.length} partido(s). ${kind==="pdf"?"Selecciona Guardar como PDF en la impresión.":"Archivo exportado."}`;
    }catch(error){status.textContent=`Exportación cancelada: ${error.message}`;if(printWindow&&!printWindow.closed)printWindow.document.body.textContent=status.textContent;}
    finally{this._exchangeBusy=false;}
  }

  _canImport(game) {
    if(!game)return false;const context={...this._reportContext(),gameId:game.id};
    const season=DataStore.getActiveSeasonContext?.(context.teamId);
    return String(game.edit_state||game.editState||"OPEN").toUpperCase()!=="LOCKED"
      && String(season?.data_status||season?.dataStatus||"ACTIVE").toUpperCase()!=="FROZEN"
      && Boolean(this.auth?.can?.(Permission.EDIT_BOXSCORE,context))
      && Boolean(this.auth?.can?.(Permission.EDIT_GAME,context));
  }

  async _importSelection(file,holder,status) {
    holder.replaceChildren();const games=this._selectionGames();
    if(games.length!==1){status.textContent="Selecciona exactamente un partido para importar.";return;}
    const game=games[0];
    if(!this._canImport(game)){status.textContent="Partido/temporada bloqueados o sin permisos de importación.";return;}
    if(!file || file.size>4_000_000){status.textContent="Archivo vacío o demasiado grande (máximo 4 MB).";return;}
    try{
      status.textContent="Leyendo y comprobando archivo…";
      const text=await file.text();
      const matrix=/\.csv$/i.test(file.name)?parseBoxScoreCsv(text):/\.xls$/i.test(file.name)?parseBoxScoreExcel(text):null;
      if(!matrix)throw new Error("Formato no compatible: importa CSV o el Excel XML .xls exportado por IQBasket.");
      const [report,events]=await Promise.all([
        this._readSelected([game],true).then(items=>items[0]),
        supabase.from("game_events").select("id").eq("game_id",game.id).limit(1)
      ]);
      if(events.error||!Array.isArray(events.data))throw new Error("No se puede comprobar el play-by-play.");
      if(events.data.length)throw new Error("Este partido contiene jugadas: su BoxScore se corrige en el editor de jugadas, no por importación.");
      const eligible=DataStore.getPlayersEligibleOnDate?.(game.team_id,game.date)||[];
      const preview=validateBoxScoreImport(matrix,{game:report.game,stats:report.stats,eligiblePlayers:eligible});
      holder.append(note(`Vista previa · ${preview.rows.length} jugadores · ${preview.differences} filas con cambios · ${preview.points} puntos. Solo se modificarían estadísticas individuales del partido, nunca jugadas, parciales ni marcador.`));
      const table=document.createElement("table");table.style.cssText="width:100%;font-size:12px;border-collapse:collapse";
      const head=document.createElement("tr");["Jugador (ID)","MIN","PTS","T2","T3","TL"].forEach(text=>{const th=document.createElement("th");th.textContent=text;head.append(th);});table.append(head);
      preview.rows.forEach(row=>{const tr=document.createElement("tr");[row.player_id,row.minutes,row.points,`${row.fg2_made}/${row.fg2_attempted}`,`${row.fg3_made}/${row.fg3_attempted}`,`${row.ft_made}/${row.ft_attempted}`].forEach(text=>{const td=document.createElement("td");td.textContent=String(text);td.style.borderBottom="1px solid #cbd5e1";tr.append(td);});table.append(tr);});
      const scroll=document.createElement("div");scroll.style.overflowX="auto";scroll.append(table);holder.append(scroll);
      const confirm=button("Confirmar importación de este partido","#b45309");confirm.disabled=!preview.differences;
      const cancel=button("Cancelar","#475569");holder.append(confirm,cancel);
      cancel.addEventListener("click",()=>{holder.replaceChildren();status.textContent="Importación cancelada sin cambios.";});
      confirm.addEventListener("click",async()=>{
        confirm.disabled=true;cancel.disabled=true;
        try{
          const current=DataStore.getActiveSeasonContext?.(game.team_id);
          if(!this._canImport(game)||id(this._reportContext().teamSeasonId)!==preview.teamSeasonId)throw new Error("Permiso, partido o temporada cambiados.");
          const saved=await commitBoxScoreImport({preview,client:supabase,auth:this.auth,game:report.game,eligiblePlayers:eligible,seasonStatus:current?.data_status||current?.dataStatus});
          await refreshGameBoxScore({supabase,dataStore:DataStore,gameId:game.id});
          status.textContent=`Importadas ${saved.count} filas del partido. Acta actualizada; mapas y jugadas intactos.`;holder.replaceChildren();
        }catch(error){status.textContent=`Importación cancelada: ${error.message}`;confirm.disabled=false;cancel.disabled=false;}
      });
      status.textContent="Archivo validado. Revisa las filas antes de confirmar.";
    }catch(error){status.textContent=`No se ha importado nada: ${error.message}`;holder.replaceChildren();}
  }

  async _refreshOverview(target) {
    const token=++this._overviewToken;const games=this._selectionGames();
    if(!games.length){target.textContent="Selecciona partidos para ver su resumen visual.";return;}
    target.textContent="Preparando resumen de la selección con actas guardadas…";
    try{
      const reports=await this._readSelected(games,false);
      if(token!==this._overviewToken || this.reportMode!=="game"||this.selectedGameId!=="all")return;
      target.innerHTML=renderSelectedGamesOverview(reports.map(report=>({game:report.game,stats:report.stats})),{title:"Resumen visual · partidos seleccionados"});
    }catch(error){if(token===this._overviewToken)target.textContent=`No se pudo elaborar el resumen: ${error.message}`;}
  }

  /** Selección visible, exportaciones independientes y vista previa de importación. */
  async render(containerId="dashboard-content-area") {
    ++this._overviewToken;
    await super.render(containerId);
    if(this.reportMode!=="game")return;
    const container=document.getElementById(containerId)||document.getElementById("main-content");
    const content=container?.querySelector("#report-view-content-area");if(!content)return;
    this._syncSelection();
    const panel=document.createElement("section");panel.style.cssText="background:white;border:1px solid #cbd5e1;border-radius:12px;padding:14px;margin:12px 0;display:grid;gap:9px";
    const title=document.createElement("h3");title.textContent="Selección de partidos y datos reutilizables";panel.append(title);
    const status=note("CSV y Excel XML 2003 (.xls) exportan las filas reales. Para importar: un partido editable, sin jugadas, con vista previa.");status.setAttribute("role","status");panel.append(status);
    const games=this._visibleGames();
    if(this.selectedGameId==="all") {
      const select=document.createElement("div");select.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:7px";
      games.forEach(game=>{const label=document.createElement("label");label.style.cssText="display:flex;gap:6px;align-items:center;font-size:12px";
        const box=document.createElement("input");box.type="checkbox";box.checked=this._selectedReportIds.has(id(game.id));
        box.addEventListener("change",()=>{if(box.checked)this._selectedReportIds.add(id(game.id));else this._selectedReportIds.delete(id(game.id));void this._refreshOverview(overview);});
        label.append(box,document.createTextNode(`${game.date||"Sin fecha"} · ${game.opponent||"Rival"}`));select.append(label);
      });
      const actions=document.createElement("div");actions.style.cssText="display:flex;gap:8px;flex-wrap:wrap";
      for(const [name,selected] of [["Seleccionar todos",true],["Ninguno",false]]){const btn=button(name,"#475569");btn.addEventListener("click",()=>{this._selectedReportIds=new Set(selected?games.map(g=>id(g.id)):[]);select.querySelectorAll('input').forEach(box=>box.checked=selected);void this._refreshOverview(overview);});actions.append(btn);}
      panel.append(select,actions);
    }
    const toolbar=document.createElement("div");toolbar.style.cssText="display:flex;flex-wrap:wrap;gap:8px";
    const pdf=button("PDF · partidos seleccionados","#0f766e"),csv=button("Exportar BoxScore CSV"),xls=button("Exportar BoxScore Excel .xls"),importButton=button("Importar BoxScore CSV / Excel","#b45309");
    const file=document.createElement("input");file.type="file";file.accept=".csv,.xls,text/csv,application/vnd.ms-excel";file.hidden=true;
    toolbar.append(pdf,csv,xls,importButton,file);panel.append(toolbar);
    const holder=document.createElement("div");holder.style.cssText="max-width:100%;overflow-x:auto";panel.append(holder);
    for(const [btn,kind] of [[pdf,"pdf"],[csv,"csv"],[xls,"xls"]])btn.addEventListener("click",()=>{void this._exportSelection(kind,status);});
    importButton.addEventListener("click",()=>{if(this._selectionGames().length!==1){status.textContent="Selecciona exactamente un partido para importar.";return;}if(!this._canImport(this._selectionGames()[0])){status.textContent="Sin permiso de edición o partido/temporada cerrado.";return;}file.click();});
    file.addEventListener("change",()=>{const selected=file.files?.[0];if(selected)void this._importSelection(selected,holder,status);file.value="";});
    content.prepend(panel);
    if(this.selectedGameId==="all") {
      const overview=document.createElement("div");panel.after(overview);void this._refreshOverview(overview);
    }
  }
}

export default ReportsViewV53;
