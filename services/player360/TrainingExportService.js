import { TRAINING_FOCUS_LABELS } from "../../config/trainingEditV54.config.js";
import { buildTrainingFocusAnalytics } from "../../domain/player360/TrainingFocusAnalytics.js";

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
function safeName(value="") {
  return String(value || "entrenamiento").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80) || "entrenamiento";
}
function x(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
}
function focusCodes(session={}) {
  const raw=session?.metadata?.training_focus_codes;
  return Array.isArray(raw) ? raw.map(v=>String(v).toUpperCase()) : [];
}
function focusText(session={}) {
  const codes=focusCodes(session);
  return codes.length ? codes.map(code=>TRAINING_FOCUS_LABELS[code]||code).join(" · ") : "Sin clasificación V55";
}
function sessionMinutes(session={}) {
  const n=Number(session.duration_minutes);
  return Number.isFinite(n)&&n>0?n:0;
}
function playerName(player={}) {
  return player.name || [player.first_name||player.firstName,player.last_name||player.lastName].filter(Boolean).join(" ") || "Jugador";
}
function crc32(bytes) {
  let crc=0xffffffff;
  for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
const le16=n=>[n&255,(n>>>8)&255];
const le32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
function concat(parts){const len=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
function zip(files){
  const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;
  for(const file of files){
    const name=enc.encode(file.name),data=typeof file.data==="string"?enc.encode(file.data):file.data,crc=crc32(data),flags=0x0800;
    const local=new Uint8Array([...le32(0x04034b50),...le16(20),...le16(flags),...le16(0),...le16(0),...le16(0),...le32(crc),...le32(data.length),...le32(data.length),...le16(name.length),...le16(0),...name,...data]);
    locals.push(local);
    centrals.push(new Uint8Array([...le32(0x02014b50),...le16(20),...le16(20),...le16(flags),...le16(0),...le16(0),...le16(0),...le32(crc),...le32(data.length),...le32(data.length),...le16(name.length),...le16(0),...le16(0),...le16(0),...le16(0),...le32(0),...le32(offset),...name]));
    offset+=local.length;
  }
  const cd=concat(centrals),end=new Uint8Array([...le32(0x06054b50),...le16(0),...le16(0),...le16(files.length),...le16(files.length),...le32(cd.length),...le32(offset),...le16(0)]);
  return concat([...locals,cd,end]);
}
function p(text,{bold=false,size=20,color=null}={}) {
  const props=(bold?"<w:b/>":"")+("<w:sz w:val=\""+size+"\"/><w:szCs w:val=\""+size+"\"/>")+(color?"<w:color w:val=\""+color+"\"/>":"");
  return "<w:p><w:pPr><w:spacing w:after=\"120\"/></w:pPr><w:r><w:rPr>"+props+"</w:rPr><w:t xml:space=\"preserve\">"+x(text)+"</w:t></w:r></w:p>";
}
function cell(text,bold=false){return "<w:tc><w:tcPr/><w:p><w:r><w:rPr>"+(bold?"<w:b/>":"")+"<w:sz w:val=\"18\"/></w:rPr><w:t>"+x(text)+"</w:t></w:r></w:p></w:tc>";}
function table(headers,rows){
  const borders="<w:tblBorders><w:top w:val=\"single\" w:sz=\"4\" w:color=\"D8DEE9\"/><w:left w:val=\"single\" w:sz=\"4\" w:color=\"D8DEE9\"/><w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"D8DEE9\"/><w:right w:val=\"single\" w:sz=\"4\" w:color=\"D8DEE9\"/><w:insideH w:val=\"single\" w:sz=\"4\" w:color=\"E5E7EB\"/><w:insideV w:val=\"single\" w:sz=\"4\" w:color=\"E5E7EB\"/></w:tblBorders>";
  return "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/>"+borders+"</w:tblPr><w:tr>"+headers.map(h=>cell(h,true)).join("")+"</w:tr>"+rows.map(r=>"<w:tr>"+r.map(v=>cell(String(v??""))).join("")+"</w:tr>").join("")+"</w:tbl>";
}
function makeDocx(body,filename){
  const doc="<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>"+body+"<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"900\" w:right=\"800\" w:bottom=\"900\" w:left=\"800\"/></w:sectPr></w:body></w:document>";
  const ct="<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>";
  const rels="<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>";
  const docRels="<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"></Relationships>";
  download(new Blob([zip([{name:"[Content_Types].xml",data:ct},{name:"_rels/.rels",data:rels},{name:"word/document.xml",data:doc},{name:"word/_rels/document.xml.rels",data:docRels}])],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),filename);
}
export function exportTrainingSessionDocx({session={},teamName="Equipo",seasonName="Temporada",directory=new Map()}={}){
  const participants=session.participants||[],present=participants.filter(r=>["PRESENT","PARTIAL"].includes(String(r.attendance_status||"").toUpperCase()));
  let body=p("IQBasket · Informe de entrenamiento",{bold:true,size:32,color:"1E3A8A"})+p(session.title||"Entrenamiento",{bold:true,size:28})+
    p(teamName+" · "+seasonName+" · "+(session.session_date||""))+
    table(["Dato","Valor"],[["Duración",sessionMinutes(session)+" min"],["Focos",focusText(session)],["Intensidad",session.intensity??"—"],["Asistencia",present.length+"/"+participants.length],["Notas",session.notes||"—"]]);
  if((session.blocks||[]).length) body+=p("Bloques",{bold:true,size:25,color:"1E3A8A"})+table(["Bloque","Tipo","Min","Objetivo"],session.blocks.map(b=>[b.title,b.activity_code||"—",b.duration_minutes??"—",b.objective||"—"]));
  body+=p("Participación",{bold:true,size:25,color:"1E3A8A"})+table(["Jugador","Estado","Min","RPE","Nota"],participants.map(r=>[playerName(directory.get(String(r.player_id))||{}),r.attendance_status||"—",r.participated_minutes??"—",r.rpe??"—",r.notes||"—"]));
  makeDocx(body,"IQBasket_Entrenamiento_"+safeName(session.session_date+"_"+(session.title||""))+".docx");
}
export function exportTrainingSeasonDocx({sessions=[],teamName="Equipo",seasonName="Temporada",directory=new Map()}={}){
  const analytics=buildTrainingFocusAnalytics(sessions);
  let body=p("IQBasket · Informe de entrenamientos",{bold:true,size:32,color:"1E3A8A"})+p(teamName+" · "+seasonName,{bold:true,size:26})+
    table(["Indicador","Valor"],[["Sesiones",analytics.totals.sessions],["Minutos de sesión",analytics.totals.sessionMinutes],["Horas de sesión",(analytics.totals.sessionMinutes/60).toFixed(1)]]);
  body+=p("Distribución de focos",{bold:true,size:25,color:"1E3A8A"})+
    p("Los minutos indican duración de sesiones que incluyeron el foco; no son minutos exclusivos dedicados a ese contenido.",{size:17,color:"64748B"})+
    table(["Foco","Sesiones","Minutos de sesión con foco"],analytics.focuses.map(f=>[TRAINING_FOCUS_LABELS[f.code]||f.code,f.sessions,f.focusSessionMinutes]));
  body+=p("Histórico",{bold:true,size:25,color:"1E3A8A"})+
    table(["Fecha","Entrenamiento","Duración","Focos","Asistencia","Notas"],sessions.map(s=>{
      const ps=s.participants||[],present=ps.filter(r=>["PRESENT","PARTIAL"].includes(String(r.attendance_status||"").toUpperCase())).length;
      return [s.session_date,s.title||"Entrenamiento",sessionMinutes(s)+" min",focusText(s),present+"/"+ps.length,s.notes||""];
    }));
  body+=p("Exposición por jugador",{bold:true,size:25,color:"1E3A8A"})+
    p("Exposición = minutos participados en sesiones que contenían cada foco. Es una medida descriptiva y no prueba causalidad con mejoras posteriores.",{size:17,color:"64748B"});
  for(const player of analytics.players){
    const name=playerName(directory.get(String(player.playerId))||{});
    body+=p(name+" · "+player.participatedMinutes+" min",{bold:true,size:21})+
      table(["Foco","Sesiones","Minutos de exposición"],player.focuses.map(f=>[TRAINING_FOCUS_LABELS[f.code]||f.code,f.sessions,f.playerExposureMinutes]));
  }
  makeDocx(body,"IQBasket_Entrenamientos_"+safeName(teamName+"_"+seasonName)+".docx");
}
function csvCell(value){const s=String(value??"");return '"'+s.replaceAll('"','""')+'"';}
export function exportTrainingSeasonCsv({sessions=[],teamName="Equipo",seasonName="Temporada"}={}){
  const header=["equipo","temporada","fecha","titulo","duracion_min","focos","intensidad","presentes_parciales","participantes","notas"];
  const rows=sessions.map(s=>{
    const ps=s.participants||[],present=ps.filter(r=>["PRESENT","PARTIAL"].includes(String(r.attendance_status||"").toUpperCase())).length;
    return [teamName,seasonName,s.session_date,s.title||"",sessionMinutes(s),focusCodes(s).join("|"),s.intensity??"",present,ps.length,s.notes||""];
  });
  const csv="\ufeff"+[header,...rows].map(row=>row.map(csvCell).join(";")).join("\r\n");
  download(new Blob([csv],{type:"text/csv;charset=utf-8"}),"IQBasket_Entrenamientos_"+safeName(teamName+"_"+seasonName)+".csv");
}
export default { exportTrainingSessionDocx, exportTrainingSeasonDocx, exportTrainingSeasonCsv };
