import assert from "node:assert/strict";
import fs from "node:fs";
import {buildFamilyHomeV70,renderFamilyHomeV70} from "../views/family/FamilyHomeV70.js";
import {adaptFederationCsv,isFederationCsv} from "../services/reports/FederationCsvAdapterV70.js";
import {validateBoxScoreImport, BOX_HEADERS} from "../services/reports/BoxScoreExchangeV53.js";

// Read-only Family source is the only input. Missing data must never become zero.
const empty=buildFamilyHomeV70();
assert.equal(empty.minutes,"N/D");
assert.equal(empty.games,"N/D");
assert.equal(empty.seasons,0);
assert.equal(empty.latest,null);
const model=buildFamilyHomeV70({
 playerId:"player-123",
 passport:{player:{first_name:"<Test>","last_name":"Fam & Co"},career_totals:{games:3,minutes:null},
  recent_games:[{date:"2026-10-15",opponent:"Team A",points:0,minutes:null}],
  career:[{season_name:"2026-27",team_name:"Cadetes",games:3}]},
 growth:{objective:{title:"Entrenar pase"},title:"Seguimos aprendiendo"},
 story:{enoughEvidence:false,evolution:["No debe mostrar mejora concluyente"]},
 plan:{allowed:true,actions:["Trabajar pase en movimiento"]},
 cycleProjection:{allowed:true,current_cycle:{actions:[{title:"Practicar pase",status:"IN_PROGRESS"},{title:"Revisar pase",status:"COMPLETED"}]}}
});
assert.equal(model.games,"3");
assert.equal(model.minutes,"N/D");
assert.equal(model.latest.points,"0");
assert.equal(model.latest.minutes,"N/D");
assert.equal(model.next,"Practicar pase");
assert.equal(model.complete,1);
assert.equal(model.evolution,"Seguimos aprendiendo");
assert.equal(model.career.length,1);
const html=renderFamilyHomeV70(model);
assert.match(html, /&lt;Test&gt;/);
assert.match(html, /Fam &amp; Co/);
assert.doesNotMatch(html, /<Test>/);
assert.match(html, /#/);
assert.match(html, /N\/D/);

const names=["Dorsal","Jugador","MIN","PTS","T2C","T2I","T3C","T3I","TLC","TLI","RO","RD","AST","REC","TAP","PER","FP","FR"];
const p1=["4","Jugador A","10:30","5","1","2","1","2","0","0","0","2","1","0","0","0","1","1"];
const p2=["7","Jugador B","12","4","2","3","0","0","0","0","1","1","0","0","0","0","2","1"];
const input=[names,p1,p2];
const players=[{id:"id-a",jersey:4},{id:"id-b",jersey:7}];
const existing=[{player_id:"id-a",starter:true,minutes:10,points:5},{player_id:"id-b",starter:false,minutes:12,points:4}];
const game={id:"game-1",team_season_id:"season-1",team_score:9};
assert.ok(isFederationCsv(input));
const mapped=adaptFederationCsv(input,{game,eligiblePlayers:players,stats:existing});
assert.deepEqual(mapped[0],BOX_HEADERS);
assert.equal(mapped[1][BOX_HEADERS.indexOf("minutes")],"10.5");
assert.equal(mapped[2][BOX_HEADERS.indexOf("player_id")],"id-b");
const preview=validateBoxScoreImport(mapped,{game,stats:existing,eligiblePlayers:players});
assert.equal(preview.points,9);
assert.equal(preview.rows.length,2);
assert.throws(()=>adaptFederationCsv([names,p1],{game,eligiblePlayers:players,stats:existing}),/completa/);
assert.throws(()=>adaptFederationCsv([names,p1,p1],{game,eligiblePlayers:players,stats:existing}),/duplicado/);
assert.throws(()=>adaptFederationCsv([names.filter(s=>s!=="RO"),p1,p2],{game,eligiblePlayers:players,stats:existing}),/columnas|obligatoria/);
assert.throws(()=>adaptFederationCsv([names,[...p1.slice(0,3),"",...p1.slice(4)],p2],{game,eligiblePlayers:players,stats:existing}),/ausente/);
const family=fs.readFileSync(new URL("../views/family/FamilyWorkspaceView.js",import.meta.url),"utf8");
const team=fs.readFileSync(new URL("../views/family/FamilyWorkspaceV30View.js",import.meta.url),"utf8");
const reports=fs.readFileSync(new URL("../views/ReportsViewV53.js",import.meta.url),"utf8");
assert.match(family,/renderFamilyHomeV70\(buildFamilyHomeV70/);
assert.match(family,/class="family-deep-dive"/);
assert.match(team,/family-team-anchor/);
assert.match(reports,/adaptFederationCsv/);
assert.match(reports,/no se modifica el acta ni se pierde el play-by-play/);
console.log("Family P0/P1 V70: dashboard, historical context, safe federation import and live reconciliation OK.");
