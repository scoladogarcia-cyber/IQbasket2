import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildReleaseId, stampBuildRelease } from "../scripts/stamp-build-release.mjs";

const shaA = "a".repeat(40);
const shaB = "b".repeat(40);
const baseRelease = "2026.09.08.29";
assert.notEqual(buildReleaseId(baseRelease, shaA), buildReleaseId(baseRelease, shaB));
assert.throws(() => buildReleaseId(baseRelease, "invalid"), /GITHUB_SHA/);

const root = mkdtempSync(join(tmpdir(), "iqbasket-release-"));
try {
  mkdirSync(join(root, "dist"));
  writeFileSync(join(root, "release.json"), JSON.stringify({ release: baseRelease, label: "existing" }));
  writeFileSync(join(root, "dist", "index.html"), "<script>window.release='__IQBASKET_BUILD_RELEASE__';</script>");
  const actual = stampBuildRelease({ root, commitSha: shaA });
  const published = JSON.parse(readFileSync(join(root, "dist", "release.json"), "utf8"));
  const html = readFileSync(join(root, "dist", "index.html"), "utf8");

  assert.equal(actual, `${baseRelease}-${shaA.slice(0, 12)}`);
  assert.equal(published.release, actual, "El guard debe comparar exactamente la versión del HTML.");
  assert.equal(published.commit, shaA);
  assert.equal(published.source_release, baseRelease);
  assert.equal(published.label, "existing");
  assert.ok(html.includes(actual));
  assert.ok(!html.includes("__IQBASKET_BUILD_RELEASE__"));
  assert.equal(JSON.parse(readFileSync(join(root, "release.json"), "utf8")).release, baseRelease);
  assert.throws(() => stampBuildRelease({ root, commitSha: shaB }), /No se encontró/);
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log("Release freshness contract: OK");
