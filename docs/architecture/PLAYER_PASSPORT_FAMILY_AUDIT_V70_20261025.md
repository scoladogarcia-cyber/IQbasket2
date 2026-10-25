# Auditoría e integración del Pasaporte Familiar — V70

Fecha de revisión: 25-10-2026. Alcance: IQBasket2 producción, Supabase IqBasketV2, UI de familia y pasaporte avanzado.

## Decisión de arquitectura

**El jugador es el propietario lógico del historial deportivo**, identificado por `players.id`. Las relaciones con clubes/temporadas dan contexto, no propiedad. **La familia es el destinatario principal de la lectura sencilla**, pero no obtiene permisos deportivos para editar ni ve notas privadas de otros clubes.

Se conserva el pasaporte técnico V68 y su editor de 69 atributos. Se integra un resumen de solo lectura en el espacio familiar V32, que ya comprueba vínculos autorizados y licencias. No se crea una segunda fuente de datos ni se rompe el editor de entrenamientos o el registro en vivo.

## Hallazgos auditados

| Id | Riesgo / observación | Evidencia | Resolución |
|---|---|---|---|
| A1 | El pasaporte técnico V68 exige `iq_v4_can_view_player360_team_season`: una familia vinculada, pero sin rol técnico, puede quedar fuera | Definición de `iq_v4_can_access_player_passport` y de `iq_v7_unchecked_v4_can_view_player360_team_season` | **No abrir** el RPC deportivo a todas las familias. Reutilizar el espacio familiar con `iq_private.family_can_view_player` y entitlements individuales |
| A2 | El histórico familiar anterior suma minutos PRES/ PARTIAL independientemente del estado PLANNED/ COMPLETED; puede parecer que todo está validado | `iq_v33_family_player_passport`: `training_minutes` no filtra el estado del entrenamiento | Nuevo resumen devuelve **registrados / acreditados / pendientes** y excluye fechas futuras de las horas asistidas |
| A3 | 147 puntuaciones históricas sin `evidence_count` ni `difficulty_tier`; un 5 de mini no es 5 de junior | Recuento de `player_evaluation_scores` en SQL | Mantener valoraciones sin reescribir; exponer solo **observaciones documentadas**, nunca como certificación científica |
| A4 | Catálogo deportivo del jugador depende de federación y temporada; no existe bono por subir de categoría | Config V68 y `teams.category` | Mostrar categoría almacenada como **contexto**, no utilizarla para añadir puntos a un OVR |
| A5 | La interfaz familiar ya contiene tendencias y soporte parental; duplicar el pasaporte técnico añadiría complejidad | `FamilyWorkspaceV32View` y `FamilyWorkspaceService` | Una tarjeta compacta: nombre contextual, 3 contadores de entreno, partidos y fiabilidad condicional |
| A6 | Permisos por jugador y por ámbito sensible deben mantenerse independientes | `iq_v33_family_player_passport`, `family_can_view_player`, `PLAYER_PROFILE` / `GAME_HISTORY` / `PLAYER_PASSPORT` | RPC V70 deniega antes de leer, separa autorizaciones y nunca retorna información de compañeros |
| A7 | Un histórico incompleto puede verse como cero | Presencia de `NULL` en APIs y datos archivados | El presenter muestra **No disponible** cuando no hay permiso o dato, sin inferir una cifra |
| A8 | IA y predicción en menores tienen alto riesgo de inferencias infundadas | Plan V68 | No activar predicciones ni entrenamiento de modelos; conservar referencias temporales y reglas de consentimiento para fase futura |

### Punto de partida verificado en producción

- `training_sessions`: **38**.
- `training_participants`: **350**.
- `player_evaluations`: **19**.
- `player_evaluation_scores`: **147**.
- Histórico de puntuaciones sin conteo de evidencias: **147**; sin dificultad documentada: **147**.
- Sesiones: 25 COMPLETED y 13 PLANNED (en el instante del análisis).
- `iq_v70_family_passport_brief` instalada como función nueva, sin cambio de filas existentes.
- RPC: EXECUTE para autenticados, **no** para anónimos. Se comprobó que una llamada sin identidad válida recibe rechazo SQLSTATE 42501.
- Advisory de Supabase: WARN conocido sobre **SECURITY DEFINER ejecutable por authenticated**. Su uso es deliberado para un *único jugador vinculado*, con comprobaciones de identidad y entitlements dentro de la función. Revisar periódicamente: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Flujo propuesto para familias

1. El usuario entra al espacio Familia y selecciona **solo un jugador verificado**.
2. La pantalla antigua se mantiene; aparece al comienzo **Pasaporte en un vistazo**.
3. Muestra la categoría real, horas de asistencia anotadas, horas confirmadas y tiempo pendiente de validación. Las cifras son *minutos del jugador*, no la suma de todas las personas del equipo.
4. Si el plan permite estadísticas básicas, muestra partidos y minutos registrados sin deducir talento ni comparaciones entre niños.
5. Solo si el plan incluye PLAYER_PASSPORT, muestra la cantidad de atributos valorados y cuántos tienen observaciones mínimas registradas. Las notas antiguas siguen provisionales.
6. El entrenador mantiene en su propia vista la edición, evaluación D1–D5 y validación de entrenamientos. La familia **no** puede cambiar asistencia, notas ni estado del entrenamiento.
7. Si la consulta falla, el resto del espacio familiar sigue funcionando y se indica que la verificación no está disponible.

## Implementación

- `supabase/migrations/20261025162000_family_passport_brief_v70.sql`: consulta aditiva, RO, autenticación, vínculo y entitlement obligatorios; no altera filas.
- `services/family/FamilyWorkspaceService.js`: método `getPassportBrief(playerId)`.
- `domain/family/FamilyPassportBriefPresenter.js`: formato de horas y estados sin inventar datos; funciones puras.
- `views/family/FamilyPassportBriefPanel.js`: tarjeta compacta responsive con vocabulario familiar y accesibilidad.
- `views/family/FamilyWorkspaceV32View.js`: incorpora el resumen sin bloquear la pantalla existente y evita resultados de cargas anteriores al cambiar de jugador.
- `tests/family-passport-v70.mjs`: contratos de unidades, límites de acceso y presentación.
- `tests/family-passport-v70-browser.mjs`: recorrido móvil real con datos controlados en Chromium/WebKit.
- `.github/workflows/family-passport-v70-browser.yml`: pruebas automáticas de interfaz para cualquier cambio.
- `.github/workflows/ci.yml`: exige el test unitario/contrato.

## Límites expresos y siguientes mejoras

- No equivale a haber homologado científicamente las rúbricas; un contador de observaciones declarado por el entrenador no es una medición independiente.
- No se suman puntos por cumplir años, subir de mini a infantil/cadete o cambiar de club.
- No se cambia el acceso al pasaporte avanzado deportivo: sigue protegido y comercializable por licencia.
- La UI familiar usa la API consolidada de partidos que ya filtra partidos finalizados. Calidad y completitud del acta se auditan en el módulo de partidos, no se recalculan en el pasaporte.
- Se ha optado por no incluir nutrición, sueño, datos clínicos o medidas privadas en el resumen sin permiso específico.
- No se han modificado las 147 puntuaciones históricas, los 38 entrenamientos ni sus asistencias.

## Puertas de integración y verificación

1. Tests CI, family multiplayer/privacy, mobile Chromium+WebKit y QA global verdes.
2. Migración V70 aplicada y función verificada en Supabase; comprobar los recuentos inalterados.
3. Verificar `anon_exec=false`, guardas de usuario, relación y entitlement.
4. Fusionar PR solo con todo verde y ejecutar publicación de GitHub Pages del *commit de main*.
5. Probar posteriormente con **una cuenta real FAMILIA_TUTOR vinculada**, especialmente si tiene PLAYER_PROFILE pero no GAME_HISTORY/PLAYER_PASSPORT.
6. Rollback: revertir el merge frontend de V70. La función aditiva puede mantenerse sin clientes; su eliminación requiere un cambio controlado de esquema. No hay migración de datos que revertir.

## Criterio de aceptación humano

Una familia debería poder responder en diez segundos a cuatro preguntas: «¿Qué categoría juega?», «¿Cuánto ha entrenado realmente?», «¿Cuánto está pendiente de confirmar?» y «¿Hasta qué punto están documentadas sus valoraciones?». El sistema debe explicar con claridad cuando no tiene la respuesta.
