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
export function exportPassportWord({player={},team={},summary={},roles=[],asymmetries=[],measurements=[]}={}) {
  const name=playerName(player);
  const strengths=(summary.strengths||[]).slice(0,10);
  const limiters=(summary.limiters||[]).slice(0,10);
  const availableRoles=(roles||[]).filter(r=>r.status==="AVAILABLE").slice(0,8);
  const dimensions=new Map();
  for(const attribute of summary.attributes||[]) {
    const key=attribute.dimension||"Otros";
    if(!dimensions.has(key))dimensions.set(key,[]);
    dimensions.get(key).push(attribute);
  }
  const html=`<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;color:#172033;margin:36px}h1{color:#2e1065}h2{color:#4c1d95;border-bottom:1px solid #ddd;padding-bottom:5px}
  table{width:100%;border-collapse:collapse;margin:10px 0 18px}td,th{border:1px solid #ddd;padding:7px;font-size:10pt;text-align:left}th{background:#f4f0ff}
  .badge{display:inline-block;border:1px solid #c4b5fd;background:#f5f3ff;padding:5px 8px;margin:2px;border-radius:10px}.muted{color:#64748b}
  </style></head><body>
  <h1>IQBasket · Pasaporte Digital del Jugador</h1>
  <p><strong>${safe(name)}</strong> · #${safe(player.jersey ?? player.number ?? "—")} · ${safe(player.primary_position||player.position||"—")}</p>
  <p class="muted">${safe(team.team_name||"Equipo")} · ${safe(team.season_name||team.season_code||"Temporada")} · Nacimiento: ${safe(player.birth_date||"—")}</p>
  <h2>Resumen</h2><p>Cobertura de evaluación: <strong>${safe(summary.ratedCount||0)}/${safe(summary.totalCount||0)}</strong>.</p>
  <p><strong>Roles funcionales:</strong> ${availableRoles.map(r=>`<span class="badge">${safe(r.label)} · ${Number(r.score).toFixed(1)}/5</span>`).join("")||"Datos insuficientes"}</p>
  <p><strong>Fortalezas:</strong> ${strengths.map(x=>`<span class="badge">${safe(x.name)} · ${x.latest.score}/5</span>`).join("")||"Aún no identificadas"}</p>
  <p><strong>Prioridades de desarrollo:</strong> ${limiters.map(x=>`<span class="badge">${safe(x.name)} · ${x.latest.score}/5</span>`).join("")||"Sin limitantes valorados"}</p>
  <h2>Atributos</h2>
  ${[...dimensions.entries()].map(([dimension,items])=>`<h3>${safe(dimension)}</h3><table><thead><tr><th>Atributo</th><th>Valor</th><th>Contexto</th><th>Evidencias</th><th>Confianza</th></tr></thead><tbody>${items.map(a=>`<tr><td>${safe(a.name)}</td><td>${a.latest?.score ?? "NE"}</td><td>${safe(a.latest?.context||"—")}</td><td>${safe(a.latest?.evidence_count??0)}</td><td>${safe(a.latest?.confidence||"—")}</td></tr>`).join("")}</tbody></table>`).join("")}
  <h2>Asimetrías D/I</h2><table><thead><tr><th>Área</th><th>Derecha</th><th>Izquierda</th><th>Diferencia</th></tr></thead><tbody>
  ${(asymmetries||[]).map(a=>`<tr><td>${safe(a.label)}</td><td>${a.right??"NE"}</td><td>${a.left??"NE"}</td><td>${a.difference==null?"—":safe(a.difference)}</td></tr>`).join("")}</tbody></table>
  <h2>Mediciones objetivas</h2><table><thead><tr><th>Prueba</th><th>Valor</th><th>Fecha</th></tr></thead><tbody>
  ${(measurements||[]).map(m=>`<tr><td>${safe(m.test_code)}</td><td>${safe(m.value)} ${safe(m.unit)}</td><td>${safe(String(m.measured_at||"").slice(0,10))}</td></tr>`).join("")}</tbody></table>
  <p class="muted">Escala observacional 1–5. NE significa no evaluado o evidencia insuficiente. IQBasket no calcula un OVR global obligatorio.</p>
  </body></html>`;
  download(new Blob(["\ufeff",html],{type:"application/msword;charset=utf-8"}),`IQBasket_Pasaporte_${filename(name)}.doc`);
}
export async function exportPassportCardPng({player={},team={},summary={},roles=[]}={}) {
  const canvas=document.createElement("canvas");canvas.width=1200;canvas.height=1600;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("No se puede generar la imagen.");
  const grad=ctx.createLinearGradient(0,0,1200,1600);grad.addColorStop(0,"#070914");grad.addColorStop(.55,"#172554");grad.addColorStop(1,"#3b0764");ctx.fillStyle=grad;ctx.fillRect(0,0,1200,1600);
  const glow=ctx.createRadialGradient(650,520,30,650,520,520);glow.addColorStop(0,"rgba(124,58,237,.62)");glow.addColorStop(1,"rgba(124,58,237,0)");ctx.fillStyle=glow;ctx.fillRect(0,0,1200,1100);
  ctx.strokeStyle="rgba(196,181,253,.65)";ctx.lineWidth=4;ctx.strokeRect(34,34,1132,1532);
  ctx.fillStyle="#c4b5fd";ctx.font="800 30px Arial";ctx.fillText("IQBASKET · PLAYER PASSPORT",70,105);
  const name=playerName(player).toUpperCase();ctx.fillStyle="#fff";ctx.font="900 72px Arial";ctx.fillText(name.slice(0,24),70,205);
  ctx.fillStyle="#ddd6fe";ctx.font="700 28px Arial";ctx.fillText(`#${player.jersey ?? player.number ?? "—"} · ${player.primary_position||player.position||"Jugador"} · ${team.team_name||"Equipo"}`,70,260);
  const photo=player.photo_url||player.avatar_url||player.image_url||"";
  let drewPhoto=false;
  if(photo) {try{const img=await loadImage(photo);ctx.save();ctx.beginPath();ctx.arc(600,570,270,0,Math.PI*2);ctx.clip();ctx.drawImage(img,330,300,540,540);ctx.restore();drewPhoto=true;}catch{}}
  if(!drewPhoto){ctx.fillStyle="rgba(139,92,246,.5)";ctx.beginPath();ctx.arc(600,570,270,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="900 150px Arial";ctx.fillText(name.split(/\s+/).slice(0,2).map(x=>x[0]).join(""),600,625);ctx.textAlign="left";}
  ctx.fillStyle="rgba(2,6,23,.78)";ctx.fillRect(70,900,1060,560);
  ctx.fillStyle="#c4b5fd";ctx.font="800 25px Arial";ctx.fillText("COBERTURA",100,960);
  ctx.fillStyle="#fff";ctx.font="900 68px Arial";ctx.fillText(`${summary.ratedCount||0}/${summary.totalCount||0}`,100,1035);
  const available=(roles||[]).filter(r=>r.status==="AVAILABLE").slice(0,3);
  ctx.fillStyle="#c4b5fd";ctx.font="800 25px Arial";ctx.fillText("ROLES FUNCIONALES",100,1110);
  ctx.fillStyle="#fff";ctx.font="700 31px Arial";available.forEach((r,i)=>ctx.fillText(`• ${r.label}  ${Number(r.score).toFixed(1)}/5`,100,1160+i*48));
  ctx.fillStyle="#c4b5fd";ctx.font="800 25px Arial";ctx.fillText("FORTALEZAS",100,1325);
  ctx.fillStyle="#fff";ctx.font="700 27px Arial";(summary.strengths||[]).slice(0,3).forEach((x,i)=>ctx.fillText(`• ${x.name}  ${x.latest.score}/5`,100,1370+i*42));
  ctx.fillStyle="#94a3b8";ctx.font="600 20px Arial";ctx.fillText("Perfil longitudinal · escala 1–5 · NE = no evaluado · sin OVR artificial",100,1510);
  await new Promise(resolve=>canvas.toBlob(blob=>{if(blob)download(blob,`IQBasket_Cromo_${filename(name)}.png`);resolve();},"image/png"));
}
export default { exportPassportWord, exportPassportCardPng };
