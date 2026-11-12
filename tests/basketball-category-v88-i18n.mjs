import assert from "node:assert/strict";
import {formatBasketballCategoryLabelV88 as label} from "../services/i18n/BasketballCategoryDisplayV88.js";
assert.equal(label("Cadete Masculino","es"),"Cadete Masculino");
assert.equal(label("Cadete Masculino","ca"),"Cadet · masculí");
assert.equal(label("Cadete Masculino","en"),"Cadet · boys");
assert.equal(label("Cadete Masculino","fr"),"Cadet · garçons");
assert.equal(label("Preinfantil Femenino","ca"),"Preinfantil · femení");
assert.equal(label("Mini Mixto","en"),"Mini · mixed");
assert.equal(label("Senior","en"),"Senior");
for(const locale of ["ca","en","fr"]){
  assert.equal(label("Cadete Masculino B1",locale),"Cadete Masculino B1");
  assert.equal(label("Categoría personalizada",locale),"Categoría personalizada");
  assert.equal(label("Nombre de equipo",locale),"Nombre de equipo");
}
console.log("PASS V88: category labels ES/CA/EN/FR are display-only, preserve custom entries");
