# IQBasket2 V82 — Tapones recibidos, precisión PIR y protección de datos

## 1. Fórmula y significado

**Tapón realizado (BLK):** el jugador tapona un tiro del rival, suma +1 en PIR.

**Tapón recibido (BLKA):** el rival tapona un tiro de este jugador. Se registra **una sola vez** en `blocks_received`, resta 1 en PIR; **el tiro también cuenta como intento de campo fallado** y se debe anotar como tal. El evento `blocks_received` separado NO incrementa automáticamente FGA, para evitar duplicar un fallo introducido antes.

**PIR (ACB / Euroliga)**:
`PTS + REB + AST + STL + BLK + faltas_recibidas - fallos_TC - fallos_TL - pérdidas - tapones_recibidos - faltas_cometidas`.

**EFF FIBA** no incluye las faltas ni los tapones recibidos como en PIR. No son la misma métrica.

Fuentes: [PIR en investigación EuroLeague](https://journals.sagepub.com/doi/10.1177/22150218251365222), [FIBA Statisticians' Manual 2024](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-statisticians-manual-2024.pdf).

## 2. Módulos modificados

- `GameBoxScoreBaseView.js`: campo editable TAP REC con autocalculado PIR, columna y total de equipo, persistencia explícita de `blocks_received`.
- `EasyStatsEntryView.js`: acta con TAP REC y autocalculado, envío a guardado.
- `GameLiveEditorView.js`: botón TAP REC tras escoger jugador, historial de jugadas, editor clásico, validación previa y distinción frente a «Tapón Riv» sin atribución.
- `DelegatedQuickEntryView.js`: acción TAP REC usando captura con lease y RPC autorizado; preflight antes de registrar.
- `LiveScoreHUDViewV44.js`: corrección de PIR en la proyección del live, conservando los bloques anteriores de `LiveCaptureStatsProjector`.
- `PlayerStatsView.js`: muestra tapones recibidos totales y deja de enseñar estimaciones numéricas fijas de USG%, AST% y TRB%.
- `BlockedShotIntegrityV82.js`: validador puro (enteros, conteos de tiro, correspondencia tapón recibido/fallo) con tolerancia explícita de anomalías históricas sin editar.
- `DataStore.js`: conserva partidas, estadísticas y PBP al guardar parcialmente, mantiene `+/-` y `blocks_received` cuando no se editan, retrocede caché local ante fallo remoto.
- `tests/blocks-received-v82.mjs` y smoke Playwright de BoxScore: regresión fórmula exacta y persistencia, invariantes de PBP y permisos de edición.

## 3. Auditoría histórica sobre producción (solo lectura)

- 328 estadísticas individuales analizadas.
- 66 filas tienen un tapón recibido registrado (66 en total), pero **ningún evento `game_events.blocks_received`**: hay dato estadístico sin jugada atribuida.
- 6 de esas 66 filas tienen más tapones recibidos que tiros fallados. Se mantienen sin modificar hasta revisar el acta o los eventos.
- 206 de 328 valoraciones `evaluation` difieren del PIR recalculado.
- 122 de 328 coinciden exactamente con PIR actual.
- 165 de 328 coinciden con una variante histórica usando columnas legacy y sin descontar tapones recibidos; los conjuntos se solapan.
- **136** no coinciden ni con PIR actual ni con esa variante histórica.
- La auditoría V81 documenta 18 conflictos de tapones realizados, 39 de rebotes ofensivos, 34 defensivos, 91 faltas recibidas, 12 marcadores rivales en `team_game_stats`, 17 alias `our_score/opp_score` y 1 parcial rival distinto.
- Se conserva íntegramente toda la base; no hay SQL de actualización en V82.

## 4. Integridad de datos y límites reales

- Un campo `blocks_received` ya existía en Supabase: **no hace falta ni se aplica migración de base de datos**.
- El sistema solo acepta aumentar los tapones recibidos cuando existe, como mínimo, un tiro fallado de campo sin tapón asociado. No crea ni duplica un evento de fallo automáticamente.
- Los registros históricos contradictorios se admiten sin modificar sus contadores de tapones/fallos, pero NO se pueden agravar; se marca su deuda de conciliación por partido.
- Los campos existentes de otros jugadores y las jugadas no se borran de la caché por guardar una lista parcial o vacía.
- Ante error Supabase, se restablece caché previa y se avisa de que puede existir escritura parcial remota.
- **Limitación preexistente:** `DataStore.saveGameAndStats` utiliza varias solicitudes independientes a Supabase (partido, estadísticas, cuartos, eventos). No proporciona atomicidad remota entre ellas. V82 no declara que sea una transacción. No se migran estos flujos a una RPC sin revisar RLS, captura en directo, autenticación, revisiones y prueba de restauración.
- Tampoco se reconstruyen las 66 jugadas que no existen, ni se sobreescriben los 206 valores históricos de PIR. El histórico debe conciliarse de manera trazable por UUID de partido/jugador.

## 5. QA de regresión y procedimiento de publicación

1. Verificar pruebas V82 de fórmula PIR vs FIBA EFF, tapón+tiro fallado sin contar dos veces.
2. Playwright desktop e iPhone: nuevo input, PIR menos 1, guardado y bloqueo de edición para invitado/partido cerrado/temporada congelada.
3. Verificar CI V81, acta final, capturas V44 y pruebas de dispositivos.
4. Si todo está verde, fusionar **solo frontend y lógica de validación no destructiva**.
5. Conciliación histórica y RPC transaccional de guardado se harán en un cambio separado con backup externo, reporte por UUID y ensayos de RLS.

**No confundir pruebas automatizadas exitosas con garantía de consistencia absoluta de datos históricos que siguen sin evidencia.**
