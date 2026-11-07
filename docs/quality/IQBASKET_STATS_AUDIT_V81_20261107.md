# IQBasket2 V81 · Auditoría de integridad y fuentes estadísticas

Fecha: 2026-11-07. Proyecto Supabase: IQBasketV2. **Consultas de solo lectura**; no se han corregido registros en producción.

## 1. Fórmulas que no se deben confundir

**EFF estándar FIBA (manual de estadísticos FIBA 2024, apéndice C.K)**:
`PTS - (FGA - FGM) - (FTA - FTM) + REB + AST - TOV + STL + BLK`.

**PIR / valoración ACB-Euroliga**:
`PTS + REB + AST + STL + BLK + FD - missed_FG - missed_FT - TOV - blocks_received - PF`.

Las ligas pueden configurar fórmulas distintas; **PIR no debe etiquetarse «EFF FIBA»**. Ambos indicadores deben calcularse con las MISMAS estadísticas originales del mismo jugador/partido, indicando la fórmula. La descripción de un tooltip no es una fuente de verdad matemática.

Fuentes:
- FIBA, *Statisticians' Manual 2024*, apéndice C.K: https://assets.fiba.basketball/image/upload/documents-corporate-fiba-statisticians-manual-2024.pdf
- Synergy: distinción EFF FIBA, Index of Success y PIR: https://support.synergysports.com/support/solutions/articles/77000565805-synergy-stats-1-22-0-release-notes-february-12-2023-

## 2. Diccionario técnico de fuentes

| Concepto | Fuente canónica | Regla |
|---|---|---|
| Equipo y temporada activa | `games.team_id/team_season_id` | Filtrar por UUID de equipo/temporada, no por nombre o caché global |
| Jugador de una fila | `player_game_stats.player_id` | Nunca `player_game_stats.id` (ID de la FILA) |
| Identidad única de actuación | `(game_id, player_id)` | Debe existir como máximo una vez |
| Puntos propios y marcador rival | `games.team_score/opponent_score` | Comprobar contra suma de jugadores y parciales |
| Estadística individual de partido | `player_game_stats` | Puntos explícitos 0 se conservan, no sustituyen por tiros |
| Rebotes / tapones / faltas recibidas | `off_reb,def_reb,blocks_made,fouls_drawn` | No mezclar columnas legacy; comparar versiones |
| Parciales de cuartos | `game_period_scores` | Suma por partido con overtime incluido; discrepancias se señalan |
| Jugadas / trazabilidad live | `game_events` | Orden estable por `event_sequence` y revisión temporal |
| Indicadores de posesiones rivales | Observaciones de rival verificadas | Ausencia ⇒ `null`, nunca simular 70 posesiones ni 30 rebotes |
| Valorización almacenada `evaluation` | Snapshot LEGADO | Comparar con PIR derivado, no asumir que usa la fórmula vigente |
| Categoría/plantilla histórica | `roster_memberships` + `games.team_season_id` | No enlazar solo por club o dorsal |

## 3. Auditoría cuantitativa de producción

| Chequeo | Resultado |
|---|---:|
| Registros individuales auditados | 328 |
| Discrepancias `evaluation` vs PIR calculado | **206** |
| Puntos individuales vs desglose de tiros | **0** |
| Identidad `game_id/player_id` duplicada | **0** |
| Referencias a jugadores o partidos no existentes | **0** |
| Filas individuales fuera de la plantilla de su temporada | **0** |
| Partidos cuyos puntos individuales no suman `games.team_score` | **0 de 30** |
| Diferencias reales entre `blocks_made` y `blocks` | **18** |
| Diferencias entre `off_reb` y `rebounds_offensive` | **39** |
| Diferencias entre `def_reb` y `rebounds_defensive` | **34** |
| Diferencias entre `fouls_drawn` y `fouls_received` | **91** |
| Diferencias entre `team_game_stats.opp_points` y `games.opponent_score` | **12 de 24** |
| Diferencias entre alias legacy `our_score/opp_score` y score canónico | **17 de 30** |
| Partidos con desajuste entre suma de parciales y `games.opponent_score` | **1 de 29** |
| Eventos de partido con referencias huérfanas | **0 de 2106** |

Los conteos son fotografías temporales; la discrepancia es una **alerta de conciliación**, no autorización para sustituir valores. Los alias en conflicto tienen valores no nulos diferentes, no simplemente faltantes.

## 4. Cambios seguros V81

- `domain/stats/StatScopeV81.js`: filtra por partidos autorizados, detecta duplicidad y conserva discrepancia PIR en una propiedad separada.
- `domain/stats/BoxScoreCalculator.js`: usa columnas canónicas en vez de alias legacy en conflicto; no confunde PIR con EFF.
- `domain/stats/GameReportMetrics.js`: evita indexar por el ID de la fila como si fuera jugador y preserva puntos observados.
- `services/DataStore.js`: cero válido, PIR único en lectura, snapshot `storedEvaluation` y `valuationMismatch` sin tocar DB.
- `engine/StatsEngine.js`: excluye filas de otros partidos/temporadas y retira ratios fabricados. Sin posesiones rivales no hay DRtg ni Net Rating fiable.
- `views/AdvancedStatsView.js`: filtra al contexto de temporada, deja de inventar ORB%, no mezcla datos de caché global.
- `views/SeasonDashboardView.js`: top jugadores por IDs del contexto, PIR canónico; no inventa 60 tiros, 15 TL, 12 pérdidas ni 70 posesiones.
- `services/StatsSyncService.js`: reemplaza auditoría masiva con escrituras por auditoría de **solo lectura** y recuento de discrepancias. El botón de temporada ya no modifica valoración/PPG almacenadas.

## 5. Conciliación pendiente, por partido (no automatizar a ciegas)

1. Identificar versión de fórmula y origen de cada `evaluation` histórico.
2. En cada alias contradictorio revisar estadísticas de origen, eventos y registro de usuario; determinar columna correcta con evidencia.
3. Para 12 scores de rival cero en `team_game_stats`, cotejar `games.opponent_score`, parciales y eventos, y evaluar actualización transaccional versionada.
4. Conciliar el partido cuyo sumatorio rival por cuartos no alcanza el resultado principal.
5. Comprobar minutos/lineups y consistencia de eventos por periodos antes de calcular +/- y ratings.
6. Tras revisión, crear migración reversible con backup externo, historial de cambios, permisos y tests en Supabase.
7. No modificar columnas `player_game_stats.evaluation`, `players.ppg` ni `team_game_stats` sin confirmación de la reconstrucción histórica.

## 6. Tests de regresión

`node tests/stats-v81-canonical.mjs` + suites de acta final, informes, datos de temporada y CI móvil/desktop.

**Límite:** la revisión es transversal sobre los principales cálculos y datos; todavía puede haber componentes legacy adicionales con cálculos duplicados. La auditoría completa debe ampliarse hasta cubrir todos los renderizadores y exportadores, priorizando los módulos usados por el usuario.
