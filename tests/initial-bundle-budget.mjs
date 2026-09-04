import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build } from "vite";

const outDir = ".tmp-bundle-budget";
const maxInitialBytes = 520 * 1024;

try {
  await build({
    logLevel: "silent",
    build: {
      outDir,
      emptyOutDir: true,
      manifest: true
    }
  });

  const manifestPath = path.join(outDir, ".vite", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const entry = Object.values(manifest).find(item => item?.isEntry);
  assert.ok(entry?.file, "Vite debe producir un entry chunk identificable.");

  const initialBytes = fs.statSync(path.join(outDir, entry.file)).size;
  const dynamicImports = entry.dynamicImports || [];
  assert.ok(
    initialBytes <= maxInitialBytes,
    `Initial JS supera presupuesto: ${initialBytes} > ${maxInitialBytes} bytes.`
  );
  assert.ok(
    dynamicImports.length >= 10,
    `Se esperaban módulos lazy; Vite sólo detectó ${dynamicImports.length}.`
  );

  console.log(JSON.stringify({
    result: "INITIAL_BUNDLE_BUDGET_OK",
    initialBytes,
    maxInitialBytes,
    dynamicChunks: dynamicImports.length
  }));
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
