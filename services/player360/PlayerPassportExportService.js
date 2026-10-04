/**
 * @fileoverview Export helpers for the Player Passport.
 * @description Produces a Word-compatible report and a self-contained PNG player card
 * without sending player data to a third-party rendering service.
 */
function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function filename(value) {
  return String(value || "Jugador").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80) || "Jugador";
}
function download(blob, name) {
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function playerName(player={}) {
  return player.name || [player.first_name,player.last_name].filter(Boolean).join(" ") || "Jugador";
}
function loadImage(src) {
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.crossOrigin="anonymous";
    image.onload=()=>resolve(image);
    image.onerror=reject;
    image.src=src;
  });
}
function xml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
}
function overallPassportScore(summary={}) {
  const values=(summary.attributes||[]).map(a=>Number(a?.latest?.score)).filter(v=>Number.isFinite(v)&&v>=1&&v<=5);
  return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
}
function dimensionPassportScores(summary={}) {
  const map=new Map();
  for(const attribute of summary.attributes||[]) {
    const key=attribute.dimension||"Otros";
    if(!map.has(key))map.set(key,{name:key,total:0,rated:0,sum:0});
    const row=map.get(key); row.total+=1;
    const score=Number(attribute?.latest?.score);
    if(Number.isFinite(score)&&score>=1&&score<=5){row.rated+=1;row.sum+=score;}
  }
  return [...map.values()].map(row=>({...row,score:row.rated?row.sum/row.rated:null}));
}
function crc32(bytes) {
  let crc=0xffffffff;
  for(const b of bytes){
    crc^=b;
    for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}
function le16(n){return [n&255,(n>>>8)&255];}
function le32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
function concatBytes(parts) {
  const length=parts.reduce((n,p)=>n+p.length,0), out=new Uint8Array(length);
  let offset=0; for(const part of parts){out.set(part,offset);offset+=part.length;} return out;
}
function zipStore(files) {
  const encoder=new TextEncoder(), locals=[], centrals=[]; let offset=0;
  for(const file of files) {
    const name=encoder.encode(file.name), data=typeof file.data==="string"?encoder.encode(file.data):file.data;
    const crc=crc32(data), flags=0x0800;
    const local=new Uint8Array([
      ...le32(0x04034b50),...le16(20),...le16(flags),...le16(0),...le16(0),...le16(0),
      ...le32(crc),...le32(data.length),...le32(data.length),...le16(name.length),...le16(0),
      ...name,...data
    ]);
    locals.push(local);
    const central=new Uint8Array([
      ...le32(0x02014b50),...le16(20),...le16(20),...le16(flags),...le16(0),...le16(0),...le16(0),
      ...le32(crc),...le32(data.length),...le32(data.length),...le16(name.length),...le16(0),...le16(0),
      ...le16(0),...le16(0),...le32(0),...le32(offset),...name
    ]);
    centrals.push(central); offset+=local.length;
  }
  const centralData=concatBytes(centrals);
  const end=new Uint8Array([
    ...le32(0x06054b50),...le16(0),...le16(0),...le16(files.length),...le16(files.length),
    ...le32(centralData.length),...le32(offset),...le16(0)
  ]);
  return concatBytes([...locals,centralData,end]);
}
function wRun(text,{bold=false,size=22,color=null}={}) {
  const props=(bold?"<w:b/>":"")+(size?"<w:sz w:val=\""+size+"\"/><w:szCs w:val=\""+size+"\"/>":"")+(color?"<w:color w:val=\""+color+"\"/>":"");
  return "<w:r><w:rPr>"+props+"</w:rPr><w:t xml:space=\"preserve\">"+xml(text)+"</w:t></w:r>";
}
function wParagraph(text,opts={}) {
  const align=opts.align?"<w:jc w:val=\""+opts.align+"\"/>":"";
  const after=opts.after==null?120:opts.after;
  return "<w:p><w:pPr>"+align+"<w:spacing w:after=\""+after+"\"/></w:pPr>"+wRun(text,opts)+"</w:p>";
}
function wCell(text,{bold=false,width=null}={}) {
  return "<w:tc><w:tcPr>"+(width?"<w:tcW w:w=\""+width+"\" w:type=\"dxa\"/>":"")+"</w:tcPr>"+wParagraph(text,{bold,size:18,after:40})+"</w:tc>";
}
function wTable(headers,rows) {
  const borders="<w:tblBorders><w:top w:val=\"single\" w:sz=\"4\" w:color=\"D8DEE9\"/><w:left w:val=\"single\" w:sz=\"4\" w:color=\"D8DEE9\"/><w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"D8DEE9\"/><w:right w:val=\"single\" w:sz=\"4\" w:color=\"D8DEE9\"/><w:insideH w:val=\"single\" w:sz=\"4\" w:color=\"E5E7EB\"/><w:insideV w:val=\"single\" w:sz=\"4\" w:color=\"E5E7EB\"/></w:tblBorders>";
  const head="<w:tr>"+headers.map(h=>wCell(h,{bold:true})).join("")+"</w:tr>";
  const body=rows.map(row=>"<w:tr>"+row.map(value=>wCell(value)).join("")+"</w:tr>").join("");
  return "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/>"+borders+"</w:tblPr>"+head+body+"</w:tbl>";
}
function canvasBlob(canvas) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("No se pudo generar la imagen.")),"image/png"));
}
function roundedRect(ctx,x,y,w,h,r) {
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
}
function drawImageCover(ctx,img,x,y,w,h) {
  const scale=Math.max(w/img.width,h/img.height), sw=w/scale, sh=h/scale;
  const sx=(img.width-sw)/2, sy=(img.height-sh)/2;
  ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
}
function drawTextFit(ctx,text,x,y,maxWidth,startSize,minSize,weight="900") {
  let size=startSize; const value=String(text||"");
  while(size>minSize){ctx.font=weight+" "+size+"px Arial";if(ctx.measureText(value).width<=maxWidth)break;size-=2;}
  ctx.fillText(value,x,y);
}
function baseCardCanvas() {
  const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("No se puede generar la imagen.");
  const grad=ctx.createLinearGradient(0,0,1080,1350);grad.addColorStop(0,"#070914");grad.addColorStop(.58,"#172554");grad.addColorStop(1,"#3b0764");
  ctx.fillStyle=grad;ctx.fillRect(0,0,1080,1350);
  const glow=ctx.createRadialGradient(720,420,20,720,420,520);glow.addColorStop(0,"rgba(124,58,237,.58)");glow.addColorStop(1,"rgba(124,58,237,0)");ctx.fillStyle=glow;ctx.fillRect(0,0,1080,900);
  ctx.strokeStyle="rgba(196,181,253,.68)";ctx.lineWidth=3;ctx.strokeRect(28,28,1024,1294);
  return {canvas,ctx};
}
export function exportPassportWord({player={},team={},summary={},roles=[],asymmetries=[],measurements=[]}={}) {
  const name=playerName(player);
  const strengths=(summary.strengths||[]).slice(0,10);
  const limiters=(summary.limiters||[]).slice(0,10);
  const availableRoles=(roles||[]).filter(r=>r.status==="AVAILABLE").slice(0,8);
  const overall=overallPassportScore(summary);
  const dimensions=dimensionPassportScores(summary);
  const body=[];
  body.push(wParagraph("IQBasket · Pasaporte Digital del Jugador",{bold:true,size:34,color:"4C1D95",after:80}));
  body.push(wParagraph(name,{bold:true,size:30,color:"111827",after:60}));
  body.push(wParagraph("#"+(player.jersey ?? player.number ?? "—")+" · "+(player.primary_position||player.position||"—")+" · "+(team.team_name||"Equipo")+" · "+(team.season_name||team.season_code||"Temporada"),{size:20,color:"64748B"}));
  body.push(wParagraph("Nacimiento: "+(player.birth_date||"—"),{size:18,color:"64748B"}));
  body.push(wParagraph("Resumen",{bold:true,size:28,color:"4C1D95"}));
  body.push(wTable(["Indicador","Valor"],[
    ["Cobertura",(summary.ratedCount||0)+"/"+(summary.totalCount||0)+" ("+Math.round((summary.coverage||0)*100)+"%)"],
    ["Valor global",overall==null?"NE":overall.toFixed(1)+"/5"],
    ["Criterio del valor global","Media simple de los atributos actualmente evaluados"]
  ]));
  body.push(wParagraph("Valores por dimensión",{bold:true,size:28,color:"4C1D95"}));
  body.push(wTable(["Dimensión","Valor","Cobertura"],dimensions.map(d=>[
    d.name,d.score==null?"NE":d.score.toFixed(1)+"/5",d.rated+"/"+d.total
  ])));
  body.push(wParagraph("Roles funcionales",{bold:true,size:28,color:"4C1D95"}));
  body.push(wTable(["Rol","Valor"],availableRoles.length?availableRoles.map(r=>[r.label,Number(r.score).toFixed(1)+"/5"]):[["Datos insuficientes","—"]]));
  body.push(wParagraph("Fortalezas",{bold:true,size:28,color:"4C1D95"}));
  body.push(wTable(["Atributo","Valor"],strengths.length?strengths.map(x=>[x.name,(x.latest?.score??"NE")+"/5"]):[["Aún no identificadas","—"]]));
  body.push(wParagraph("Prioridades de desarrollo",{bold:true,size:28,color:"4C1D95"}));
  body.push(wTable(["Atributo","Valor"],limiters.length?limiters.map(x=>[x.name,(x.latest?.score??"NE")+"/5"]):[["Sin limitantes valorados","—"]]));
  body.push(wParagraph("Atributos",{bold:true,size:28,color:"4C1D95"}));
  const byDimension=new Map();
  for(const attribute of summary.attributes||[]){const key=attribute.dimension||"Otros";if(!byDimension.has(key))byDimension.set(key,[]);byDimension.get(key).push(attribute);}
  for(const [dimension,items] of byDimension.entries()){
    body.push(wParagraph(dimension,{bold:true,size:23,color:"6D28D9"}));
    body.push(wTable(["Atributo","Valor","Contexto","Evidencias","Confianza"],items.map(a=>[
      a.name,String(a.latest?.score??"NE"),a.latest?.context||"—",String(a.latest?.evidence_count??0),a.latest?.confidence||"—"
    ])));
  }
  body.push(wParagraph("Asimetrías D/I",{bold:true,size:28,color:"4C1D95"}));
  body.push(wTable(["Área","Derecha","Izquierda","Diferencia"],(asymmetries||[]).map(a=>[
    a.label,String(a.right??"NE"),String(a.left??"NE"),a.difference==null?"—":String(a.difference)
  ])));
  body.push(wParagraph("Mediciones objetivas",{bold:true,size:28,color:"4C1D95"}));
  body.push(wTable(["Prueba","Valor","Fecha"],(measurements||[]).length?(measurements||[]).map(m=>[
    m.test_code||"—",String(m.value??"")+" "+String(m.unit||""),String(m.measured_at||"").slice(0,10)
  ]):[["Sin mediciones registradas","—","—"]]));
  body.push(wParagraph("Escala observacional 1–5. NE = no evaluado. El valor global mostrado es una media descriptiva de los atributos evaluados, no una ponderación automática.",{size:17,color:"64748B"}));

  const documentXml="<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>"+body.join("")+"<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"900\" w:right=\"900\" w:bottom=\"900\" w:left=\"900\" w:header=\"450\" w:footer=\"450\" w:gutter=\"0\"/></w:sectPr></w:body></w:document>";
  const contentTypes="<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>";
  const rels="<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>";
  const docRels="<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"></Relationships>";
  const zip=zipStore([
    {name:"[Content_Types].xml",data:contentTypes},
    {name:"_rels/.rels",data:rels},
    {name:"word/document.xml",data:documentXml},
    {name:"word/_rels/document.xml.rels",data:docRels}
  ]);
  download(new Blob([zip],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),"IQBasket_Pasaporte_"+filename(name)+".docx");
}
async function renderIdentityCard({player={},team={},summary={},roles=[]}={}) {
  const {canvas,ctx}=baseCardCanvas(), name=playerName(player).toUpperCase(), overall=overallPassportScore(summary);
  ctx.fillStyle="#c4b5fd";ctx.font="800 24px Arial";ctx.fillText("IQBASKET · PLAYER PASSPORT",64,92);
  ctx.fillStyle="#fff";drawTextFit(ctx,name,64,160,950,62,38,"900");
  ctx.fillStyle="#ddd6fe";ctx.font="700 24px Arial";ctx.fillText("#"+(player.jersey??player.number??"—")+" · "+(player.primary_position||player.position||"Jugador")+" · "+(team.team_name||"Equipo"),64,205);

  const photo=player.photo_url||player.avatar_url||player.image_url||"";
  ctx.save();roundedRect(ctx,90,255,900,665,34);ctx.clip();
  let drew=false;
  if(photo){try{const img=await loadImage(photo);drawImageCover(ctx,img,90,255,900,665);drew=true;}catch{}}
  if(!drew){ctx.fillStyle="rgba(139,92,246,.42)";ctx.fillRect(90,255,900,665);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="900 150px Arial";ctx.fillText(name.split(/\s+/).slice(0,2).map(x=>x[0]).join(""),540,640);ctx.textAlign="left";}
  ctx.restore();ctx.strokeStyle="rgba(196,181,253,.72)";ctx.lineWidth=3;roundedRect(ctx,90,255,900,665,34);ctx.stroke();

  ctx.fillStyle="rgba(2,6,23,.84)";roundedRect(ctx,90,955,900,280,28);ctx.fill();
  ctx.fillStyle="#c4b5fd";ctx.font="800 22px Arial";ctx.fillText("VALOR GLOBAL",130,1010);
  ctx.fillStyle="#fff";ctx.font="900 92px Arial";ctx.fillText(overall==null?"NE":overall.toFixed(1)+"/5",130,1115);
  ctx.fillStyle="#cbd5e1";ctx.font="600 20px Arial";ctx.fillText("Media descriptiva de "+(summary.ratedCount||0)+" atributos evaluados · cobertura "+Math.round((summary.coverage||0)*100)+"%",130,1160);
  const firstRole=(roles||[]).find(r=>r.status==="AVAILABLE");
  if(firstRole){ctx.fillStyle="#ddd6fe";ctx.font="700 22px Arial";ctx.fillText("Rol destacado · "+firstRole.label+" "+Number(firstRole.score).toFixed(1)+"/5",130,1205);}
  ctx.fillStyle="#94a3b8";ctx.font="600 17px Arial";ctx.fillText("Escala 1–5 · NE = no evaluado",64,1290);
  return canvas;
}
async function renderValuesCard({player={},team={},summary={}}={}) {
  const {canvas,ctx}=baseCardCanvas(), name=playerName(player).toUpperCase(), dimensions=dimensionPassportScores(summary);
  ctx.fillStyle="#c4b5fd";ctx.font="800 24px Arial";ctx.fillText("IQBASKET · PLAYER PASSPORT",64,92);
  ctx.fillStyle="#fff";drawTextFit(ctx,name,64,160,950,58,36,"900");
  ctx.fillStyle="#ddd6fe";ctx.font="700 24px Arial";ctx.fillText("VALORES DEL PASAPORTE · "+(team.season_name||team.season_code||"Temporada"),64,205);

  ctx.fillStyle="rgba(2,6,23,.82)";roundedRect(ctx,64,245,952,700,28);ctx.fill();
  ctx.fillStyle="#c4b5fd";ctx.font="800 24px Arial";ctx.fillText("VALORES POR DIMENSIÓN",98,300);
  let y=360;
  for(const d of dimensions){
    ctx.fillStyle="#f8fafc";ctx.font="800 25px Arial";ctx.fillText(d.name,98,y);
    ctx.textAlign="right";ctx.fillStyle="#ddd6fe";ctx.font="900 30px Arial";ctx.fillText(d.score==null?"NE":d.score.toFixed(1)+"/5",950,y);ctx.textAlign="left";
    ctx.fillStyle="#94a3b8";ctx.font="600 17px Arial";ctx.fillText("Cobertura "+d.rated+"/"+d.total,98,y+32);
    ctx.fillStyle="rgba(148,163,184,.25)";roundedRect(ctx,98,y+50,852,14,7);ctx.fill();
    if(d.score!=null){ctx.fillStyle="#8b5cf6";roundedRect(ctx,98,y+50,852*(d.score/5),14,7);ctx.fill();}
    y+=125;
  }
  const strengths=(summary.strengths||[]).slice(0,3), limiters=(summary.limiters||[]).slice(0,3);
  ctx.fillStyle="#c4b5fd";ctx.font="800 22px Arial";ctx.fillText("FORTALEZAS",98,1015);
  ctx.fillStyle="#fff";ctx.font="700 21px Arial";strengths.forEach((x,i)=>ctx.fillText("• "+x.name+"  "+x.latest.score+"/5",98,1055+i*40));
  ctx.fillStyle="#c4b5fd";ctx.font="800 22px Arial";ctx.fillText("PRIORIDADES DE DESARROLLO",98,1200);
  ctx.fillStyle="#fff";ctx.font="700 21px Arial";limiters.forEach((x,i)=>ctx.fillText("• "+x.name+"  "+x.latest.score+"/5",98,1240+i*34));
  ctx.fillStyle="#94a3b8";ctx.font="600 17px Arial";ctx.fillText("Perfil longitudinal · escala 1–5 · valores calculados con la valoración más reciente de cada atributo",64,1310);
  return canvas;
}
export async function exportPassportCardPng(payload={}) {
  const name=playerName(payload.player||{});
  const [identity,values]=await Promise.all([renderIdentityCard(payload),renderValuesCard(payload)]);
  const [identityBlob,valuesBlob]=await Promise.all([canvasBlob(identity),canvasBlob(values)]);
  download(identityBlob,"IQBasket_Cromo_"+filename(name)+"_Perfil.png");
  await new Promise(resolve=>setTimeout(resolve,180));
  download(valuesBlob,"IQBasket_Cromo_"+filename(name)+"_Valores.png");
}

export default { exportPassportWord, exportPassportCardPng };
