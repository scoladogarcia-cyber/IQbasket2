/**
 * @fileoverview CSS and language-selector contract for the shared responsive shell.
 * @description Protects readable translated labels and accessible language control
 * in both the primary LayoutView and the legacy AppLayout.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const layout=read("views/LayoutView.js");
const legacy=read("components/AppLayout.js");
const css=read("styles/layout.css");
const i18n=read("services/I18nService.js");
const lcss=layout.match(/\.mobile-label\s*\{([^}]+)\}/)?.[1]||"";
const main=css.match(/\.mobile-bottom-bar\s+\.mobile-nav-item\s+\.mobile-label\s*\{([^}]+)\}/)?.[1]||"";
const legacyMobile=legacy.match(/\.mobile-bottom-bar\s+\.mobile-nav-item\s+\.mobile-label\s*\{([^}]+)\}/)?.[1]||"";
for(const [name,style] of [["LayoutView",lcss],["layout.css",main],["AppLayout",legacyMobile]]){
  assert.match(style,/white-space\s*:\s*normal\s*;/,name+" must wrap translations");
  assert.match(style,/overflow-wrap\s*:\s*anywhere\s*;/,name+" must wrap long words");
  assert.match(style,/line-height\s*:\s*1\.[12]/,name+" two-line layout");
  assert.doesNotMatch(style,/white-space\s*:\s*nowrap/,name+" must not clip translations on one line");
}
assert.match(layout,/\.mobile-selectors-row\s*\{[^}]*min-width\s*:\s*0\s*;/);
assert.match(layout,/\.mobile-select\s*\{[^}]*min-width\s*:\s*0\s*;/);
assert.match(i18n,/document\.documentElement\.lang\s*=\s*target/);
console.log("PASS V89 locale-safe mobile navigation CSS and language metadata");
