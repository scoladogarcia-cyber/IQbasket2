/** @fileoverview Hoja final de ayuda y significado de todas las columnas del acta. */
const ENTRIES = [
  ["TIT / MIN / PTS", "Titular; minutos jugados; puntos anotados según tiros convertidos."],
  ["T2 C/I / T2%", "Tiros de dos puntos convertidos/intentos; porcentaje = convertidos ÷ intentos × 100."],
  ["T3 C/I / T3%", "Triples convertidos/intentos; porcentaje = convertidos ÷ intentos × 100."],
  ["TL C/I / TL%", "Tiros libres convertidos/intentos; porcentaje = convertidos ÷ intentos × 100."],
  ["TC C/I / TC%", "Tiros de campo de 2 y 3 puntos juntos. No incluye tiros libres."],
  ["RO / RD / REB", "Rebotes ofensivos, defensivos y totales (RO + RD)."],
  ["AST / ROB / TAP", "Asistencias, robos de balón y tapones realizados."],
  ["PER / FC / FR", "Pérdidas de balón, faltas cometidas y faltas recibidas."],
  ["TAP REC / +/−", "Tapones recibidos y diferencia de puntos mientras el jugador está en pista, solo si esta última se registró."],
  ["VAL", "Valoración tradicional: PTS + REB + AST + ROB + TAP + FR − tiros fallados − TL fallados − PER − TAP recibidos − FC. Según campos capturados."],
  ["eFG%", "Porcentaje efectivo de tiro de campo: (T2C + 1,5 × T3C) ÷ (T2I + T3I) × 100. Premia el valor adicional del triple."],
  ["TS%", "Porcentaje verdadero de tiro: PTS ÷ [2 × (TC intentados + 0,44 × TL intentados)] × 100. Se indica estimación cuando corresponde."],
  ["AST/PER", "Relación asistencias/pérdidas. Si no hay pérdidas, N/D: no se sustituye por 0."],
  ["USG% estim.", "Porcentaje estimado de acciones finalizadas: (TCI + 0,44 × TLI + PER) del jugador, ajustado a sus minutos y a las acciones/minutos del equipo. Sin minutos o denominador: N/D."],
  ["Posesiones estimadas", "TC intentados + 0,44 × TL intentados − RO + PER. Aproximación, no posesiones observadas."],
  ["ORtg estimado", "Puntos por 100 posesiones propias estimadas. DRtg y Net Rating requieren datos suficientes del rival."],
  ["Game Score / ORtg / DRtg jugador", "Indicadores individuales almacenados si se calcularon. No se rellenan automáticamente con valores supuestos."],
  ["ARO / MEDIA / ESQ3 C/I", "Aciertos/intentos en el aro, media distancia y esquinas de triple, cuando la tecnificación registró estas zonas."],
  ["TC asist. / AST pot. / AST sec.", "Tiros de campo asistidos, posibles asistencias y asistencias secundarias registradas."],
  ["ENTR / TOQ Z", "Entradas a canasta y contactos con balón en la zona/pintura, si fueron registrados."],
  ["DESV / C. REC / REB DIS / BLO REB", "Desvíos, faltas en ataque provocadas, rebotes disputados y bloqueos de rebote (box-outs)."],
  ["Comparativa con rival", "Agregados guardados cuando existen; en su ausencia, eventos rivales registrados. El número de canastas conocido no equivale a intentos completos ni autoriza un porcentaje."],
  ["Mapa de puntos recibidos", "Ubicación real de canastas de campo de 2 y 3 del rival. Los tiros libres no tienen coordenadas. Sin todos los fallos, no existe acierto por zona fiable."],
  ["N/D y control de calidad", "N/D = no disponible/no calculable, distinto de cero. Diferencias con el marcador y cobertura espacial se advierten; los datos históricos nunca se inventan ni modifican."],
];
const esc = x => String(x ?? "").replace(/[&<>"']/g, k => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[k]);

/** Deja una hoja final independiente tanto en vista web como en impresión. */
export function renderGameStatisticsGlossary() {
  return `<section class="iq-report-panel iq-report-glossary" aria-label="Hoja final de ayuda estadística"><h2>Guía de lectura · glosario de estadísticas</h2>
  <p>Consulta rápida para entrenadores, analistas, familias y usuarios autorizados. C = convertidos, I = intentados; % expresa la proporción en porcentaje.</p>
  <div class="iq-glossary-grid">${ENTRIES.map(([term,meaning])=>`<details class="iq-glossary-entry"><summary style="cursor:pointer;min-height:32px"><strong>${esc(term)}</strong></summary><span>${esc(meaning)}</span></details>`).join("")}</div>
  <p><strong>Preguntas frecuentes:</strong> ¿Un 0 es igual que N/D? No. ¿Qué significa 0/0 tiros? Que el porcentaje es N/D, no 0 %. ¿Se comparan porcentajes sin intentos suficientes? No deben compararse sin contextualizar la muestra.</p><p><small>IQBasket · Glosario del informe de partido. Las comparaciones son descriptivas: contexto, estilo de captura y cobertura afectan su interpretación.</small></p></section>`;
}
