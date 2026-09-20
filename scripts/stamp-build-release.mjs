/**
 * @fileoverview Produce metadatos de despliegue únicos para cada commit.
 * El HTML y release.json deben identificar exactamente el mismo bundle.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PLACEHOLDER = "__IQBASKET_BUILD_RELEASE__";

/** Construye una versión diferente en cada commit sin editar release.json a mano. */
export function buildReleaseId(sourceRelease, commitSha) {
  const release = String(sourceRelease || "").trim();
  const sha = String(commitSha || "").trim();
  if (!release || !/^[a-f0-9]{40}$/i.test(sha)) {
    throw new Error("Se requiere release.json válido y GITHUB_SHA de 40 caracteres.");
  }
  return `${release}-${sha.slice(0, 12).toLowerCase()}`;
}

/** Estampa la misma versión en el HTML y los metadatos del artefacto publicado. */
export function stampBuildRelease({ root = process.cwd(), commitSha = process.env.GITHUB_SHA } = {}) {
  const source = JSON.parse(readFileSync(join(root, "release.json"), "utf8"));
  const htmlPath = join(root, "dist", "index.html");
  const metadataPath = join(root, "dist", "release.json");
  const html = readFileSync(htmlPath, "utf8");
  if (!html.includes(PLACEHOLDER)) {
    throw new Error(`No se encontró ${PLACEHOLDER} en dist/index.html.`);
  }
  const release = buildReleaseId(source.release, commitSha);
  const metadata = {
    ...source,
    release,
    source_release: source.release,
    commit: String(commitSha).toLowerCase()
  };
  writeFileSync(htmlPath, html.replaceAll(PLACEHOLDER, release));
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return release;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Stamped IQBasket build release ${stampBuildRelease()}`);
}
