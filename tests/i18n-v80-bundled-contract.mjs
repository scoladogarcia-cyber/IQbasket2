import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {TranslationStore} from "../services/TranslationStore.js";
import {I18n} from "../services/I18nService.js";
import {i18n} from "../core-modules/i18n/I18nEngine.js";
import {BUNDLED_LANGUAGE_CATALOG_V80,flattenLanguageDictionaryV80,normalizeBundledLocaleV80,interpolateLanguageV80} from "../services/i18n/BundledLanguageCatalogV80.js";
import {languagePlaceholdersV75} from "../services/i18n/LanguagePackExchangeV71.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
assert.equal(normalizeBundledLocaleV80("cat"),"ca");
assert.equal(normalizeBundledLocaleV80("en-GB"),"en");
assert.deepEqual({...flattenLanguageDictionaryV80({a:{b:"ok"},flat:"fine"})},{"a.b":"ok",flat:"fine"});
assert.equal(interpolateLanguageV80("Hi {player} / {{team}}",{player:"Ada",team:"Girls"}),"Hi Ada / Girls");
for(const code of ["es","ca","en","fr"]){
  const dict=BUNDLED_LANGUAGE_CATALOG_V80[code];
  assert.ok(Object.keys(dict).length>350,code+" translations missing");
  assert.ok(dict["training.history.validate"]);
  assert.deepEqual(languagePlaceholdersV75(dict["training.history.validate"]),["count"]);
  await TranslationStore.setLanguage(code);
  assert.equal(TranslationStore.currentLang,code);
  assert.equal(I18n.getLocale(),code);
  assert.equal(i18n.getLanguage(),code);
  assert.notEqual(TranslationStore.t("training.history.title"),"training.history.title");
  assert.equal(TranslationStore.t("training.history.validate",{count:7}).includes("7"),true);
}
await TranslationStore.setLanguage("en");
assert.equal(TranslationStore.t("training.history.from"),"From");
await TranslationStore.setLanguage("fr");
assert.equal(TranslationStore.t("training.history.from"),"Du");
assert.ok(TranslationStore.t("approvals.title"));
for(const path of ["services/TranslationStore.js","services/I18nService.js","views/TranslationsView.js","views/LanguageSettingsView.js"]){
  assert.doesNotMatch(read(path),/\.from\(["']translations["']\)/,path+" still queries the retired table");
}
assert.match(read("views/LanguageSettingsView.js"),/IQBasket_cambios_/);
assert.match(read("views/TrainingView.js"),/training\.validation\.result/);
console.log("PASS V80 bundled locales, one fallback, no remote translation calls.");
