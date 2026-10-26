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
import { buildBoxScoreExchangeRows,serializeBoxScoreCsv,parseBoxScoreCsv,parseBoxScoreExcel,validateBoxScoreImport,commitBoxScoreImport } from "../services/reports/BoxScoreExchangeV53.js";
import { renderStatsQualityInfo } from "../domain/stats/StatQualityV71.js";
import { guideCoachV72, renderGuidedCoachV72 } from "../domain/insights/GuidedSummaryV72.js";
import { renderGameStatisticsGlossary } from "./reports/GameStatisticsGlossary.js";
import { isFederationCsv, adaptFederationCsv } from "../services/reports/FederationCsvAdapterV70.js";
import { createFederationWorksheetV72 } from "../services/reports/FederationWorksheetV72.js";
import { REPORT_PROFILE_V74, resolveReportProfileV74 } from "../services/reports/ReportProfileV74.js";
import { renderPlayerDevelopmentBriefV77 } from "../services/reports/PlayerDevelopmentBriefV77.js";
import { exportRosterCsvV74, previewRosterCsvV74 } from "../services/exchange/RosterExchangeV74.js";
import { buildMatchWorkbookXlsx } from "../services/reports/MatchWorkbookExportV60.js";

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
    this._reportProfileOptionsV75=null;
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
  async _exportSelection(kind,status,gamesOverride=null) {
    if(this._exchangeBusy)return;
    const games=Array.isArray(gamesOverride) ? gamesOverride : this._selectionGames();
    const context=this._reportContext();
    if(!games.length){status.textContent="Selecciona partidos para exportar.";return;}
    const printWindow=(kind==="pdf"||kind==="summary-pdf"||kind==="profile-pdf")?window.open("","_blank","width=1024,height=768"):null;
    if((kind==="pdf"||kind==="summary-pdf"||kind==="profile-pdf")&&!printWindow){status.textContent="Permite ventanas emergentes para guardar el PDF.";return;}
    this._exchangeBusy=true;status.textContent=`Consultando ${games.length} acta(s) autorizadas…`;
    if(printWindow)printWindow.document.body.textContent="Preparando informe completo…";
    try {
      const reports=await this._readSelected(games,true);
      if(kind==="pdf"||kind==="summary-pdf"||kind==="profile-pdf") {
        const teamName=DataStore.getTeamById?.(context.teamId)?.name||"Equipo";
        const seasonName=DataStore.getActiveSeasonDisplayName?.(context.teamId)||"Temporada";
        const quality=reports.map(report=>renderStatsQualityInfo({rows:report.stats,game:report.game})).join("");
        const profile=kind==="profile-pdf"?resolveReportProfileV74(this._reportProfileV74||"DEVELOPMENT",this._reportProfileOptionsV75||{}):null;
        const safeTitle=(teamName+" · "+seasonName).replace(/[&<>"\x27]/g,"");
        const profileHtml=profile?
          '<section class="iq-report-panel"><h1>IQBasket · '+profile.title+" · "+safeTitle+"</h1>"+
          (profile.complete?buildCompleteSeasonReport({reports,teamName,seasonName}):"")+
          (profile.overview?renderSelectedGamesOverview(reports.map(r=>({game:r.game,stats:r.stats})),{title:"Partidos seleccionados"}):"")+
          (profile.interpretation?renderGuidedCoachV72(guideCoachV72(reports)):"")+
          (profile.quality?quality:"")+(profile.glossary?renderGameStatisticsGlossary():"")+"</section>" : null;
        const html=profile?profileHtml:kind==="pdf"
          ? buildCompleteSeasonReport({reports,teamName,seasonName})+quality
          : '<section class="iq-report-panel"><h1>Resumen visual · '+teamName.replace(/[&<>"']/g,"")+' · '+seasonName.replace(/[&<>"']/g,"")+'</h1>'+
            renderSelectedGamesOverview(reports.map(r=>({game:r.game,stats:r.stats})),{title:"Resumen visual · selección de partidos"})+
            renderGuidedCoachV72(guideCoachV72(reports))+quality+renderGameStatisticsGlossary()+'</section>';
        const authorization=this.reportAccessPolicy.authorizeExport(ReportType.SEASON_DOSSIER,context);
        if(!authorization.allowed||!ReportExporter.printReport(kind==="pdf"?"IQBasket_Informe_Completo":kind==="profile-pdf"?"IQBasket_"+profile.key:"IQBasket_Resumen_Visual",html,{authorization,printWindow})) throw new Error("No se pudo preparar el PDF o faltan permisos.");
      } else if(kind==="csv") {
        const rows=buildBoxScoreExchangeRows(reports);
        this._download(serializeBoxScoreCsv(rows),"text/csv;charset=utf-8","IQBasket_BoxScore_Seleccion.csv");
      } else if(kind==="xlsx" || kind==="events-xlsx") {
        const bytes=buildMatchWorkbookXlsx(reports,{eventsOnly:kind==="events-xlsx"});
        const mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const filename=kind==="events-xlsx"
          ? "IQBasket_Jugadas_Seleccion.xlsx"
          : "IQBasket_Acta_BoxScore_Jugadas.xlsx";
        this._download(bytes,mime,filename);
      } else {
        throw new Error("Formato de exportación no compatible.");
      }
      status.textContent=`Preparados ${games.length} partido(s). ${(kind==="pdf"||kind==="summary-pdf"||kind==="profile-pdf")?"Selecciona Guardar como PDF en la impresión.":"Archivo exportado."}`;
    }catch(error){status.textContent=`Exportación cancelada: ${error.message}`;if(printWindow&&!printWindow.closed)printWindow.document.body.textContent=status.textContent;}
    finally{this._exchangeBusy=false;}
  }

  /**
   * Per-player report: never reuse the full-team report.html for a player
   * export. All data is reduced to an authorized player BEFORE HTML creation.
   */
  async _exportPlayerBriefV77({status,playerId,fromDate="",toDate=""}={}) {
    if(this._exchangeBusy)return;
    const selected=this._selectionGames(),context=this._reportContext();
    if(!selected.length){status.textContent="Selecciona partidos.";return;}
    const player=this._authorizedPlayers().find(p=>id(p.id)===id(playerId));
    if(!player){status.textContent="Jugador fuera de la temporada autorizada.";return;}
    const playerScope={...context,playerId:player.id,playerTeamId:player.team_id||player.teamId||context.teamId};
    if(!this.reportAccessPolicy.canExport(ReportType.PLAYER_STATS,playerScope)){
      status.textContent="No tienes permiso de exportación sobre este jugador.";return;
    }
    const printWindow=window.open("","_blank","width=1024,height=768");
    if(!printWindow){status.textContent="Permite ventanas emergentes para guardar el PDF.";return;}
    this._exchangeBusy=true;printWindow.document.body.textContent="Consultando actas individuales…";
    try{
      const reports=await this._readSelected(selected,true);
      if(id(this._reportContext().teamId)!==id(context.teamId) ||
        id(this._reportContext().teamSeasonId)!==id(context.teamSeasonId) ||
        !this.reportAccessPolicy.canExport(ReportType.PLAYER_STATS,playerScope))
        throw new Error("Ha cambiado tu autorización, equipo o temporada.");
      for(const report of reports){
        const scoped={...report.context,playerId:player.id,
          playerTeamId:player.team_id||player.teamId||context.teamId};
        if(!report.policy.canExport(ReportType.PLAYER_STATS,scoped))
          throw new Error("No puedes exportar este jugador para toda la selección.");
      }
      const teamName=DataStore.getTeamById?.(context.teamId)?.name||"Equipo";
      const seasonName=DataStore.getActiveSeasonDisplayName?.(context.teamId)||"Temporada";
      const html=renderPlayerDevelopmentBriefV77({reports,player,fromDate,toDate,teamName,seasonName});
      const authorization=this.reportAccessPolicy.authorizeExport(ReportType.PLAYER_STATS,playerScope);
      if(!authorization.allowed||!ReportExporter.printReport("IQBasket_Seguimiento_Jugador",html,{authorization,printWindow}))
        throw new Error("No se pudo preparar el PDF individual.");
      status.textContent="Informe individual preparado. Selecciona Guardar como PDF.";
    }catch(error){
      status.textContent="Informe individual cancelado: "+String(error.message||error);
      if(!printWindow.closed)printWindow.document.body.textContent=status.textContent;
    }finally{this._exchangeBusy=false;}
  }

  /** Reuse the same fresh, per-game authorized report for the roster read boundary. */
  async _rosterExchangeV74(status,holder,file=null) {
    if(this._exchangeBusy)return;
    const selected=this._selectionGames();
    if(selected.length!==1){status.textContent="Selecciona un solo partido para esta plantilla.";return;}
    this._exchangeBusy=true;
    try{
      const report=(await this._readSelected(selected,true))[0];
      const roster=report.players||[];
      if(!roster.length)throw new Error("Plantilla autorizada no disponible.");
      if(file){
        if(file.size>1_000_000)throw new Error("Archivo demasiado grande.");
        const preview=previewRosterCsvV74(await file.text(),{authorizedPlayers:roster});
        holder.replaceChildren();
        holder.append(note("Vista previa · "+preview.changed+" jugador(es) con diferencias. "+preview.reason));
        const table=document.createElement("table");table.style.cssText="width:100%;border-collapse:collapse;font-size:12px";
        const head=document.createElement("tr");
        ["ID","Nombre","Apellidos","Dorsal","Posición"].forEach(s=>{const th=document.createElement("th");th.textContent=s;head.append(th);});table.append(head);
        for(const row of preview.rows.filter(r=>r.changed)){
          const tr=document.createElement("tr");
          [row.player_id,row.first_name,row.last_name,row.jersey,row.primary_position].forEach(s=>{const td=document.createElement("td");td.textContent=String(s??"");tr.append(td);});table.append(tr);
        }
        holder.append(table);
        status.textContent="Archivo validado y previsualizado. No se han modificado jugadores.";
      }else{
        this._download(exportRosterCsvV74(roster),"text/csv;charset=utf-8","IQBasket_Plantilla_Jugadores.csv");
        status.textContent="CSV de jugadores autorizados exportado.";
      }
    }catch(error){status.textContent="Intercambio de jugadores cancelado: "+error.message;}
    finally{this._exchangeBusy=false;}
  }

  _globalSelectionGames() {
    if(this.reportMode==="game") return this._selectionGames();
    const allowed=this._visibleGames();
    const requested=new Set((this.dossierConfig?.selectedGameIds||[]).map(id));
    return requested.size ? allowed.filter(game=>requested.has(id(game.id))) : allowed;
  }

  async _exportCompleteSeason(button) {
    if (this._exchangeBusy) return;
    const selected=this._globalSelectionGames();
    if(!selected.length){button.disabled=true;button.title="Selecciona al menos un partido.";return;}
    const status={textContent:""};
    const previous=button.textContent;
    button.textContent=`Preparando ${selected.length} partido(s)…`;
    button.disabled=true;
    try {
      await this._exportSelection("pdf",status,selected);
      button.title=status.textContent||"Informe generado con la selección actual.";
    } finally {
      if(button.isConnected){
        button.textContent=previous;
        button.disabled=this._globalSelectionGames().length===0;
      }
    }
  }

  _refreshCompleteSelectionButton(container) {
    const button=container?.querySelector("#btn-export-complete-season");
    if(!button)return;
    const selected=this._globalSelectionGames();
    button.textContent=`📥 Exportar selección actual · ${selected.length} partido(s) (PDF)`;
    button.disabled=!selected.length||this._exchangeBusy;
    button.title=selected.length
      ? "El informe global, comparativas, mapas y acumulados se recalculan únicamente con los partidos seleccionados."
      : "Selecciona uno, varios o todos los partidos.";
  }

  _canImport(game) {
    if(!game)return false;const context={...this._reportContext(),gameId:game.id};
    const season=DataStore.getActiveSeasonContext?.(context.teamId);
    return String(game.edit_state||game.editState||"OPEN").toUpperCase()!=="LOCKED"
      && String(season?.data_status||season?.dataStatus||"ACTIVE").toUpperCase()!=="FROZEN"
      && Boolean(this.auth?.can?.(Permission.EDIT_BOXSCORE,context))
      && Boolean(this.auth?.can?.(Permission.EDIT_GAME,context));
  }

  /**
   * Download one-game template from the same RLS-authorized report used by the
   * normal export. Empty statistics stay blank; user edits never write to DB.
   */
  async _exportFederationTemplate(status) {
    if(this._exchangeBusy)return;
    const selected=this._selectionGames();
    if(selected.length!==1){status.textContent="Selecciona exactamente un partido para generar su plantilla.";return;}
    this._exchangeBusy=true;
    try{
      status.textContent="Preparando plantilla desde el acta autorizada…";
      const report=(await this._readSelected(selected,true))[0];
      const eligible=DataStore.getPlayersEligibleOnDate?.(report.game.team_id,report.game.date)||[];
      const template=createFederationWorksheetV72({game:report.game,eligiblePlayers:eligible,stats:report.stats});
      if(!this.reportAccessPolicy.canExport(ReportType.GAME_STATS,{...this._reportContext(),gameId:report.game.id}))
        throw new Error("Permiso de exportación cambiado.");
      this._download(template.content,"text/csv;charset=utf-8",template.filename);
      status.textContent="Plantilla descargada: "+template.rows+" jugadores. "+
        (template.missingCells?template.missingCells+" campos sin registrar aparecen vacíos (N/D); complétalos antes de importarla.":"Todos los campos de la plantilla tienen valores registrados.")+
        " Puedes editarla en Excel o LibreOffice y guardarla como CSV UTF-8.";
    }catch(error){status.textContent="No se ha generado la plantilla: "+error.message;}
    finally{this._exchangeBusy=false;}
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
      let matrix=/\.csv$/i.test(file.name)?parseBoxScoreCsv(text):/\.xls$/i.test(file.name)?parseBoxScoreExcel(text):null;
      if(!matrix)throw new Error("Formato no compatible: importa CSV o el Excel XML .xls exportado por IQBasket.");
      const [report,events]=await Promise.all([
        this._readSelected([game],true).then(items=>items[0]),
        supabase.from("game_events").select("id").eq("game_id",game.id).limit(1)
      ]);
      if(events.error||!Array.isArray(events.data))throw new Error("No se puede comprobar el play-by-play.");
      const eligible=DataStore.getPlayersEligibleOnDate?.(game.team_id,game.date)||[];
      const federated=isFederationCsv(matrix);
      if(federated)matrix=adaptFederationCsv(matrix,{game:report.game,stats:report.stats,eligiblePlayers:eligible});
      // Never overwrite a live play-by-play from a third-party boxscore.
      // Federated data can still be compared, without mutation.
      if(events.data.length){
        if(!federated)throw new Error("Este partido contiene jugadas: su BoxScore se corrige en el editor de jugadas, no por importación.");
        const current=new Map(report.stats.map(r=>[id(r.player_id??r.playerId),r]));
        const head=matrix[0], col=n=>head.indexOf(n);
        const diffs=matrix.slice(1).map(row=>{
          const pid=row[col("player_id")], old=current.get(pid)||{};
          const pts=Number(row[col("points")]), min=Number(row[col("minutes")]);
          const oldPts=old.points==null?"N/D":old.points,oldMin=old.minutes==null?"N/D":old.minutes;
          return {player:row[col("jugador")],oldPts,pts,oldMin,min,
            changed:String(oldPts)!==String(pts)||String(oldMin)!==String(min)};
        });
        holder.append(note("Comparación oficial · modo solo lectura. Hay jugadas de anotación en vivo: no se modifica el acta ni se pierde el play-by-play."));
        const table=document.createElement("table");table.style.cssText="width:100%;font-size:12px";
        const th=document.createElement("tr");
        ["Jugador","PTS IQBasket","PTS acta","MIN IQBasket","MIN acta"].forEach(label=>{const cell=document.createElement("th");cell.textContent=label;th.append(cell);});table.append(th);
        diffs.filter(d=>d.changed).forEach(d=>{const tr=document.createElement("tr");
          [d.player,d.oldPts,d.pts,d.oldMin,d.min].forEach(val=>{const td=document.createElement("td");td.textContent=String(val);tr.append(td);});table.append(tr);
        });
        if(diffs.some(d=>d.changed))holder.append(table);
        else holder.append(note("Los puntos y minutos importados coinciden con los datos actuales."));
        status.textContent="Comparación completada. Para corregir un partido con jugadas, utiliza el editor de anotación; ningún dato se ha sobrescrito.";
        return;
      }
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
      target.innerHTML=renderSelectedGamesOverview(reports.map(report=>({game:report.game,stats:report.stats})),{title:"Resumen visual · partidos seleccionados"})+renderGuidedCoachV72(guideCoachV72(reports))+reports.map(report=>renderStatsQualityInfo({rows:report.stats,game:report.game})).join("");
    }catch(error){if(token===this._overviewToken)target.textContent=`No se pudo elaborar el resumen: ${error.message}`;}
  }

  /** Selección visible, exportaciones independientes y vista previa de importación. */
  async render(containerId="dashboard-content-area") {
    ++this._overviewToken;
    await super.render(containerId);
    const container=document.getElementById(containerId)||document.getElementById("main-content");
    if(this.reportMode==="game"||this.reportMode==="season_dossier") this._refreshCompleteSelectionButton(container);
    if(this.reportMode!=="game")return;
    const content=container?.querySelector("#report-view-content-area");if(!content)return;
    this._syncSelection();
    this._refreshCompleteSelectionButton(container);
    const panel=document.createElement("section");panel.style.cssText="background:white;border:1px solid #cbd5e1;border-radius:12px;padding:14px;margin:12px 0;display:grid;gap:9px";
    const title=document.createElement("h3");title.textContent="Selección de partidos y datos reutilizables";panel.append(title);
    const status=note("Excel .xlsx exporta Acta, BoxScore y todas las jugadas reales. CSV permite también comparar o importar un acta federativa con columnas completas y dorsales verificados; no sustituye jugadas en vivo. El .xls es solo legacy.");status.setAttribute("role","status");panel.append(status);
    const games=this._visibleGames();
    if(this.selectedGameId==="all") {
      const select=document.createElement("div");select.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:7px";
      games.forEach(game=>{const label=document.createElement("label");label.style.cssText="display:flex;gap:6px;align-items:center;font-size:12px";
        const box=document.createElement("input");box.type="checkbox";box.checked=this._selectedReportIds.has(id(game.id));
        box.addEventListener("change",()=>{if(box.checked)this._selectedReportIds.add(id(game.id));else this._selectedReportIds.delete(id(game.id));this._refreshCompleteSelectionButton(container);void this._refreshOverview(overview);});
        label.append(box,document.createTextNode(`${game.date||"Sin fecha"} · ${game.opponent||"Rival"}`));select.append(label);
      });
      const actions=document.createElement("div");actions.style.cssText="display:flex;gap:8px;flex-wrap:wrap";
      for(const [name,selected] of [["Seleccionar todos",true],["Ninguno",false]]){const btn=button(name,"#475569");btn.addEventListener("click",()=>{this._selectedReportIds=new Set(selected?games.map(g=>id(g.id)):[]);select.querySelectorAll('input').forEach(box=>box.checked=selected);this._refreshCompleteSelectionButton(container);void this._refreshOverview(overview);});actions.append(btn);}
      panel.append(select,actions);
    }
    const toolbar=document.createElement("div");toolbar.style.cssText="display:flex;flex-wrap:wrap;gap:8px";
    const pdf=button("PDF completo · mapas + gráficas + actas","#0f766e");
    const summaryPdf=button("PDF visual breve · resumen","#2563eb");
    const xlsx=button("Excel completo · Acta + BoxScore + Jugadas","#1d4ed8");
    const eventsXlsx=button("Jugadas Excel .xlsx","#4338ca");
    const csv=button("BoxScore CSV","#475569");
    const templateCsv=button("Plantilla editable CSV · 1 partido","#0369a1");
    const profile=document.createElement("select");profile.setAttribute("aria-label","Perfil de informe PDF");profile.style.cssText="min-height:44px;border-radius:9px;padding:8px;border:1px solid #94a3b8";
    Object.values(REPORT_PROFILE_V74).forEach(p=>{const item=document.createElement("option");item.value=p.key;item.textContent=p.title;profile.append(item);});profile.value=this._reportProfileV74||"DEVELOPMENT";
    const sectionOptions=document.createElement("fieldset");
    sectionOptions.setAttribute("aria-label","Secciones del informe");
    sectionOptions.style.cssText="display:flex;flex-wrap:wrap;gap:10px;padding:8px;border:1px solid #cbd5e1;border-radius:10px;align-items:center";
    const profileLegend=document.createElement("legend");profileLegend.textContent="Incluir en el PDF";profileLegend.style.cssText="font-size:12px;font-weight:800;color:#334155";sectionOptions.append(profileLegend);
    const sectionInputs=new Map();
    for(const [key,label] of [["overview","Resumen y gráficos"],["interpretation","Conclusiones"],["quality","Calidad de datos"],["glossary","Glosario"]]){
      const wrapper=document.createElement("label");wrapper.style.cssText="display:inline-flex;gap:6px;align-items:center;font-size:12px;cursor:pointer";
      const input=document.createElement("input");input.type="checkbox";input.dataset.section=key;input.style.minWidth="18px";input.style.minHeight="18px";
      wrapper.append(input,document.createTextNode(label));sectionOptions.append(wrapper);sectionInputs.set(key,input);
    }
    const syncProfile=(reset=false)=>{
      const plan=REPORT_PROFILE_V74[profile.value]||REPORT_PROFILE_V74.DEVELOPMENT;
      const old=(!reset&&this._reportProfileV74===plan.key)?this._reportProfileOptionsV75:null;
      for(const [key,input] of sectionInputs){
        input.disabled=Boolean(plan.complete&&key==="overview");
        input.checked=input.disabled?false:(old?.[key]??plan[key]);
      }
    };
    syncProfile();
    profile.addEventListener("change",()=>{this._reportProfileV74=profile.value;this._reportProfileOptionsV75=null;syncProfile(true);});
    for(const input of sectionInputs.values())input.addEventListener("change",()=>{
      this._reportProfileV74=profile.value;
      this._reportProfileOptionsV75=Object.fromEntries([...sectionInputs].map(([key,box])=>[key,Boolean(box.checked)]));
    });
    const profilePdf=button("PDF configurable","#0f766e");
    const rosterCsv=button("Jugadores CSV","#64748b");
    const rosterPreview=button("Revisar jugadores CSV","#64748b");
    const rosterFile=document.createElement("input");rosterFile.type="file";rosterFile.accept=".csv,text/csv";rosterFile.hidden=true;
    const importButton=button("Importar BoxScore / comparar CSV federativo","#b45309");
    const file=document.createElement("input");file.type="file";file.accept=".csv,.xls,text/csv,application/vnd.ms-excel";file.hidden=true;
    toolbar.append(profile,sectionOptions,profilePdf,summaryPdf,pdf,xlsx,eventsXlsx,csv,templateCsv,importButton,rosterCsv,rosterPreview,file,rosterFile);panel.append(toolbar);
    const playerBrief=document.createElement("div");playerBrief.style.cssText="display:flex;gap:8px;align-items:end;flex-wrap:wrap;padding:9px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff";
    const playerSelect=document.createElement("select");playerSelect.setAttribute("aria-label","Jugador para informe de seguimiento");playerSelect.style.cssText="min-height:44px;padding:8px;border:1px solid #94a3b8;border-radius:9px";
    const first=document.createElement("option");first.value="";first.textContent="Seleccionar jugador";playerSelect.append(first);
    this._authorizedPlayers().forEach(player=>{
      const option=document.createElement("option");option.value=id(player.id);
      option.textContent=[player.first_name,player.last_name].filter(Boolean).join(" ")||player.name||"Jugador";
      playerSelect.append(option);
    });
    const range=(type,label)=>{
      const wrapper=document.createElement("label");wrapper.textContent=label;wrapper.style.cssText="display:grid;gap:3px;font-size:12px";
      const input=document.createElement("input");input.type="date";input.setAttribute("aria-label",label);input.style.cssText="min-height:44px;border:1px solid #94a3b8;border-radius:8px;padding:6px";
      wrapper.append(input);playerBrief.append(wrapper);return input;
    };
    playerBrief.append(playerSelect);
    const fromDate=range("from","Desde"),toDate=range("to","Hasta");
    const playerPdf=button("PDF de seguimiento individual","#1d4ed8");playerBrief.append(playerPdf);
    panel.append(playerBrief);
    playerPdf.addEventListener("click",()=>{void this._exportPlayerBriefV77({
      status,playerId:playerSelect.value,fromDate:fromDate.value,toDate:toDate.value
    });});
    const holder=document.createElement("div");holder.style.cssText="max-width:100%;overflow-x:auto";panel.append(holder);
    for(const [btn,kind] of [[pdf,"pdf"],[summaryPdf,"summary-pdf"],[xlsx,"xlsx"],[eventsXlsx,"events-xlsx"],[csv,"csv"]])btn.addEventListener("click",()=>{void this._exportSelection(kind,status);});
    templateCsv.addEventListener("click",()=>{void this._exportFederationTemplate(status);});
    profilePdf.addEventListener("click",()=>{this._reportProfileV74=profile.value;this._reportProfileOptionsV75=Object.fromEntries([...sectionInputs].map(([key,box])=>[key,Boolean(box.checked)]));void this._exportSelection("profile-pdf",status);});
    rosterCsv.addEventListener("click",()=>{void this._rosterExchangeV74(status,holder);});
    rosterPreview.addEventListener("click",()=>{if(this._selectionGames().length!==1){status.textContent="Selecciona un solo partido.";return;}rosterFile.click();});
    rosterFile.addEventListener("change",()=>{const upload=rosterFile.files?.[0];if(upload)void this._rosterExchangeV74(status,holder,upload);rosterFile.value="";});
    importButton.addEventListener("click",()=>{if(this._selectionGames().length!==1){status.textContent="Selecciona exactamente un partido para importar.";return;}if(!this._canImport(this._selectionGames()[0])){status.textContent="Sin permiso de edición o partido/temporada cerrado.";return;}file.click();});
    file.addEventListener("change",()=>{const selected=file.files?.[0];if(selected)void this._importSelection(selected,holder,status);file.value="";});
    content.prepend(panel);
    if(this.selectedGameId==="all") {
      const overview=document.createElement("div");panel.after(overview);void this._refreshOverview(overview);
    }
  }
}

export default ReportsViewV53;
