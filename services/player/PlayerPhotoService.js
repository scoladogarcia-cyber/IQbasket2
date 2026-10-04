/**
 * @fileoverview Client-side player photo preparation.
 * @description Validates, resizes and compresses images before storing them in players.photo_url.
 * This keeps the existing provider-neutral player schema and avoids multi-megabyte originals.
 */
const DEFAULTS = Object.freeze({
  maxBytes: 6_000_000,
  maxDimension: 720,
  mimeType: "image/jpeg",
  quality: 0.84
});

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se ha podido leer la imagen."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("La imagen seleccionada no es válida."));
    image.src = src;
  });
}

export async function preparePlayerPhoto(file, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  if (!file) throw new Error("Selecciona una imagen.");
  if (!String(file.type || "").startsWith("image/")) throw new Error("El archivo seleccionado no es una imagen.");
  if (Number(file.size || 0) > cfg.maxBytes) throw new Error("La fotografía supera el tamaño máximo de 6 MB.");

  const original = await readDataUrl(file);
  const image = await loadImage(original);
  const largest = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const scale = largest > cfg.maxDimension ? cfg.maxDimension / largest : 1;
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Tu navegador no permite preparar la fotografía.");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL(cfg.mimeType, cfg.quality);
}

export default { preparePlayerPhoto };
