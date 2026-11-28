# IQBasquet · Backlog de lanzamiento

Fecha: 28 de noviembre de 2026. Alcance: cuatro ediciones sobre el mismo sistema de datos y permisos. Las tareas se cierran con evidencias de prueba en un entorno aislado. Este documento no aplica cambios a datos ni a producción.

## Prioridad 0 · Flujos y conservación de datos

| ID | Tarea y dependencias | Criterio de aceptación |
|---|---|---|
| P0-01 | Inventariar los flujos vigentes desde móvil y escritorio: alta y edición de partido, anotación, cierre, reapertura, corrección, alta y edición de jugador, importación, herencia y traspaso. Registrar las rutas, repositorios, RPC y tablas que toca cada flujo. | Guardar una línea base con resultados, IDs, número de jugadas y huellas por partido. Cubrir datos legacy y nuevos con casos reproducibles. |
| P0-02 | Inventariar copias y restaurar base de datos y archivos privados en un entorno aislado. Depende de P0-01. | Comparar la restauración con la línea base, comprobar objetos y permisos, y registrar el tiempo de recuperación y la pérdida máxima observada. |
| P0-03 | Asegurar alta y edición transaccionales e idempotentes de partidos y jugadores. Revisar las rutas manuales, delegadas y de importación. Depende de P0-01. | Doble toque, respuesta perdida tras una escritura, reintento, dos altas concurrentes y validación fallida a mitad del flujo. Un reintento devuelve el mismo recurso y una operación fallida no deja altas parciales. Dos personas homónimas siguen siendo distintas. |
| P0-04 | Completar la captura con un escritor por partido, cola persistente, recuperación y traspaso controlado del turno. Partir del arreglo local de errores de almacenamiento. Depende de P0-01. | Probar dos dispositivos, dos pestañas, modo avión, recarga, sesión caducada, cuota agotada y conflicto de revisión. Las jugadas confirmadas sobreviven a la recuperación. El cierre rechaza pendientes o conflictos. |
| P0-05 | Completar la matriz de acceso por club, equipo, temporada, pertenencia, vínculo familiar y acción. Aplicar a RPC, RLS, archivos, exportaciones e IA. Depende de P0-01. | Verificar cada autorización y denegación con cuentas de prueba. Revocar permisos durante una sesión activa y comprobar el resultado en datos, informes y enlaces a archivos. |
| P0-06 | Validar identidad permanente y pertenencias con fechas. Reutilizar el modelo de equipo-temporada y los tramos de plantilla existentes. Depende de P0-03 y P0-05. | Heredar plantilla, cambiar de categoría, trasladar o reincorporar a un jugador. Cada actuación conserva su contexto original. El club anterior conserva el histórico autorizado y pierde acceso al progreso privado posterior. |
| P0-07 | Completar el alta, vínculo familiar revocable, registro de versiones de condiciones y avisos, consentimientos por finalidad cuando procedan, y política de conservación. Depende de P0-05. | Ejecutar el flujo de adulto y menor, revocación familiar, ejercicio de derechos y revisión de privacidad del club, archivos y proveedor de IA. |
| P0-08 | Aplicar límites de imagen configurables, miniaturas privadas y carga paginada de histórico. Depende de P0-02 y P0-05. | Medir tamaño de subida, descarga y carga inicial en móvil. Verificar permisos sobre originales y miniaturas y recuperar ambos desde copia cuando corresponda. |

## Prioridad 0 · Motor de cálculo e integridad

| ID | Tarea y dependencias | Criterio de aceptación |
|---|---|---|
| EST-01 | Actualizar en modo lectura la auditoría V81. Inventariar cada métrica y consumidor en captura, acta, dashboards, informes, pasaporte, exportaciones, SQL e IA. | Cada métrica tiene identificador, fuente, fórmula, unidad, versión, denominador, ámbito, redondeo y política para ceros, ausencias y datos legacy. Las diferencias quedan registradas por partido y campo. |
| EST-02 | Consolidar fórmulas dentro de los módulos existentes del motor. Usar `domain/stats/BoxScoreCalculator.js` para métricas básicas y de valoración, los módulos avanzados para sus fórmulas y `engine/StatsEngine.js` para coordinar el cálculo. Identificar fórmulas duplicadas en SQL y acordar una fuente de verdad por indicador. Depende de EST-01. | Cada indicador tiene una única implementación normativa. Rendimiento y cobertura determinan qué agregados se materializan, siempre derivados del cálculo canónico. Los adaptadores normalizan campos; las vistas, Excel, PDF e IA consumen resultados calculados. |
| EST-03 | Validar atribución y reconciliación. Comparar marcador, parciales, acta y jugadas. Distinguir captura completa, parcial y manual. Depende de EST-01 y P0-01. | Casos con prórroga, puntos propios/rivales, DNP, tapones cometidos/recibidos, minutos, alineaciones, revisiones, alias contradictorios y cero explícito. Los conflictos se muestran con origen y propuesta de revisión. |
| EST-04 | Validar paridad entre interfaces y agregación. Depende de EST-02 y EST-03. | La misma actuación produce los mismos datos en acta, ficha, informe individual del partido, informe de temporada, exportación e IA. Probar FIBA EFF y PIR por separado, porcentajes desde la suma de aciertos e intentos, y ratings sin datos suficientes. Los informes por partido quedan acotados al UUID correcto. |
| EST-05 | Auditar claves, relaciones e índices reales. Depende de P0-01 y EST-01. | Verificar unicidad de actuación por `game_id, player_id`, claves de parciales y jugadas, ámbito de equipo-temporada e identificación de periodos de plantilla. Revisar índices de filtros, joins y políticas RLS con planes de ejecución en pruebas. Medir lectura y coste de escritura antes y después. |
| EST-06 | Preparar conciliación selectiva y reversible, con aprobación por lote. Depende de P0-02, EST-03, EST-04 y EST-05. | Primero generar diferencias en seco. Cada corrección tiene evidencia de origen, valores anteriores y posteriores y control por partido. Comparar recuentos y huellas y aplicar a producción solo el lote validado. |

**Cobertura mínima del cálculo.** Puntos, parciales, minutos, tiros y porcentajes, rebotes, asistencias, robos, pérdidas, faltas, tapones realizados y recibidos, FIBA EFF, PIR, más/menos, posesiones y ratings. Mantener separados datos registrados, métricas derivadas y estimaciones. En un histórico incompleto, mostrar qué falta. Un jugador que no participó queda identificado como tal. Un cero registrado se conserva.

**Claves e índices.** La identidad de la fila del boxscore y la del jugador representan entidades distintas. La posición en una lista, el nombre y el dorsal no definen identidad. Estudiar índices compuestos para partido, jugador, temporada y orden de eventos según las consultas reales. Detectar y conciliar duplicados antes de imponer restricciones. Usar datos de prueba representativos y evitar bloquear escrituras de partidos en directo durante cambios de esquema.

## Prioridad 1 · Rediseño de lanzamiento

| ID | Tarea | Criterio de aceptación |
|---|---|---|
| UX-01 | Portadas y navegación de Equipos, Entrenadores, Jugadores y Familias. | El delegado crea o abre el partido, el entrenador registra una observación, el jugador encuentra su tarea y la familia accede al partido de su hijo y al resumen colectivo. |
| UX-02 | Biblioteca de vídeos, guías, cursos y productos vinculados a objetivos, con búsqueda y recursos externos. | Encontrar recursos por audiencia y objetivo. Identificar qué contenido es externo, gratuito, de pago o patrocinado. |
| IA-01 | Asistente contextual para las cuatro ediciones. Depende de P0-05, P0-07 y EST-04. | Familias y jugadores interpretan y consultan, entrenadores analizan patrones con evidencia y equipos generan borradores. Las respuestas citan el partido, periodo o evaluación. La IA respeta acceso y visibilidad en cada consulta. |
| REL-01 | Ensayo completo del lanzamiento y despliegue progresivo. Depende de los P0, EST y las capacidades que se activen. | Crear jugador y partido, anotar, recuperar, cerrar, analizar y exportar desde las rutas vigentes. Repetir con temporada heredada. Aprobar evidencias y restauración antes de activar a más usuarios. |

## Condiciones para integrar cada entrega

1. Ejecutar las comprobaciones de altas, edición, captura, histórico, permisos y estadísticas afectadas antes de integrar. Al cambiar rutas o navegación, probar también los enlaces vigentes.
2. Introducir cambios de datos por etapas compatibles: ampliar esquema, validar lectura/escritura, conciliar con ejecución en seco y activar el nuevo flujo. Proteger los IDs y las jugadas existentes.
3. Si cambia un recuento o resultado que la tarea no pretendía modificar, detener la promoción y revisar su origen.
4. Revertir primero la aplicación, manteniendo compatibilidad de esquema y conservando escrituras posteriores. Si se requiere recuperar datos, restaurar en un entorno aislado y conciliar por identificador antes de sustituir o reinsertar registros.
5. Registrar responsable, evidencia, versión y resultado por tarea. Una prueba de contrato local no sustituye un ensayo en móvil con backend ni una restauración de copias.

## Referencias del repositorio

- `docs/quality/IQBASKET_STATS_AUDIT_V81_20261107.md`: línea base histórica de fuentes y discrepancias.
- `docs/migration/BACKUP_AND_REHEARSAL_RUNBOOK.md`: procedimiento previo de ensayo y huellas.
- `domain/repositories/GameRepository.js` y `domain/repositories/PlayerRepository.js`: puntos de persistencia a trazar desde las pantallas y los importadores.
- `tests/stats-v81-canonical.mjs`, `tests/player-report-match-scope.mjs`, `tests/live-offline-storage-failure.mjs`, `tests/live-lease-sync-race-v69.mjs`, `tests/season-legacy-roster-eligibility-regression.mjs` y `tests/v1-hotpath-index-contract.mjs`: punto de partida de las pruebas.

## Primera ejecución · 28 de noviembre de 2026

- P0-01 y EST-01 iniciadas. Consulta directa en Supabase, de solo lectura: 33 partidos, 30 jugadores, 3.181 jugadas y 358 actuaciones. Cero pares partido-jugador duplicados y cero jugadas sin partido. Son recuentos puntuales, pendientes de completar con huellas y recorridos de alta y edición con backend.
- EST-02 iniciada. El informe clásico delega el PIR al cálculo canónico en el acta, el acumulado y la ficha individual. La etiqueta identifica el indicador como PIR.
- EST-05 iniciada. El esquema desplegado tiene índices únicos para actuación y parcial, y orden por secuencia para jugadas con secuencia informada. Hay dos índices únicos sobre `player_game_stats (game_id, player_id)`. Antes de proponer retirar uno, comprobar restricciones dependientes y medir planes de ejecución y coste de escritura.
