import assert from "node:assert/strict";
import fs from "node:fs";
import {parseBoxScoreCsv,serializeBoxScoreCsv} from "../services/reports/BoxScoreExchangeV53.js";
import {exportPassportAssessmentCsvV73,previewPassportAssessmentCsvV73,PASSPORT_CSV_HEADERS_V73} from "../services/player360/PassportAssessmentCsvV73.js";

const attributes=Array.from({length:69},(_,i)=>({
  code:"IQ"+(i+1),name:"Habilidad "+(i+1),min_evidence:5,valid_contexts:["P5"]
}));
const catalog={attributes},latest=new Map([["IQ1",{score:3}]]);
const text=exportPassportAssessmentCsvV73(catalog,latest);
const matrix=parseBoxScoreCsv(text);
assert.equal(matrix.length,70);
assert.deepEqual(matrix[0],PASSPORT_CSV_HEADERS_V73);
assert.equal(matrix[1][2],""); // Template never copies a previous 1-5 as new evidence.
assert.equal(matrix[1][7],"3"); // Baseline can be seen without editing.
matrix[1][2]="4";matrix[1][3]="D2";matrix[1][4]="5";matrix[1][5]="HIGH";
const csv=serializeBoxScoreCsv(matrix);
const review=previewPassportAssessmentCsvV73(csv,{catalog,context:"P5"});
assert.equal(review.updated,1);
assert.equal(review.unchanged,68);
assert.deepEqual(review.drafts.get("IQ1"),{
  score:4,difficultyTier:"D2",evidenceCount:5,confidence:"HIGH",notes:"",touched:true
});
assert.throws(()=>previewPassportAssessmentCsvV73(exportPassportAssessmentCsvV73(catalog,latest),{catalog}),/No has introducido/);
matrix[1][2]="0";
assert.throws(()=>previewPassportAssessmentCsvV73(serializeBoxScoreCsv(matrix),{catalog}),/fuera de 1–5/);
matrix[1][2]="4";matrix[1][4]="1";
assert.throws(()=>previewPassportAssessmentCsvV73(serializeBoxScoreCsv(matrix),{catalog}),/observaciones/);
matrix[1][4]="5";matrix[1][0]="FORGED";
assert.throws(()=>previewPassportAssessmentCsvV73(serializeBoxScoreCsv(matrix),{catalog}),/ajeno/);
const view=fs.readFileSync(new URL("../views/player360/passport/PlayerPassportView.js",import.meta.url),"utf8");
assert.match(view,/exportPassportAssessmentCsvV73/);
assert.match(view,/previewPassportAssessmentCsvV73/);
assert.match(view,/id="pp-csv-file"/);
assert.match(view,/self\.editorDraft=new Map\(preview\.drafts\)/);
assert.match(view,/saveGuidedEvaluation/);
console.log("Passport V73 CSV complete catalog, baseline protection and manual review OK.");
