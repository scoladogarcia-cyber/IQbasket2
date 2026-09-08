# Game Intelligence Foundation V45

## Objetivo

V45 crea la primera frontera reutilizable de **inteligencia postpartido** de IQBasket sin introducir una segunda arquitectura de IA ni alterar el scorer live. El motor convierte el BoxScore persistido en hechos deterministas de equipo y en evidencia compatible con `PLAYER360_EVIDENCE_V1`.

La secuencia futura queda preparada como:

`BoxScore -> Game Intelligence -> Player360 Evidence -> interpretación/plan -> revisión humana`

En V45 sólo se implementan los dos primeros saltos. No se activa ningún proveedor de IA, no se añade UI y no se modifica la base de datos.

## Arquitectura

### `config/game-intelligence.config.js`

Centraliza versiones de contrato, mínimos de muestra y salvaguardas. Los mínimos indican **suficiencia de evidencia**, no si un rendimiento es bueno o malo.

No contiene:
- secretos;
- proveedor IA;
- normas por edad;
- benchmarks deportivos;
- umbrales de riesgo.

Los futuros benchmarks deben vivir en perfiles versionados de competición/categoría y entrar como configuración explícita.

### `domain/intelligence/GameIntelligenceEngine.js`

Módulo de dominio puro y determinista. Recibe `player_game_stats`, agrega únicamente a nivel de equipo y devuelve:

- `snapshot`: métricas, calidad de evidencia, limitaciones y salvaguardas;
- `evidenceBundle`: `PLAYER360_EVIDENCE_V1` con claves `competition.game.*`.

No ejecuta red, Supabase, persistencia ni llamadas a proveedor.

## Métricas V45

La fundación calcula hechos descriptivos de un partido:

- puntos;
- intentos y porcentajes de 2P/3P;
- eFG%;
- tiros libres cuando la muestra es suficiente;
- asistencias y pérdidas;
- ratio AST/TO cuando el denominador y la muestra lo permiten;
- rebote ofensivo, defensivo y total;
- robos;
- tapones;
- faltas cometidas.

La suma de puntos se contrasta además con los puntos derivados de 2P/3P/TL como señal de calidad de datos. Una inconsistencia no se “corrige” automáticamente: se marca como limitación para impedir interpretaciones demasiado seguras.

## Reglas de evidencia

1. Los conteos observados pueden emitirse como hechos si existe BoxScore de jugadoras.
2. Una tasa requiere la muestra mínima configurada; si no, se registra `missing_data` con `LOW_SAMPLE`.
3. No se inventa un ratio con denominador cero.
4. Toda evidencia sale con `causal_claim_allowed=false`.
5. La salida no contiene IDs, nombres ni rankings de jugadoras.
6. La evidencia usa exclusivamente el módulo permitido `competition`, por lo que puede atravesar la pasarela Player360 actual sin ampliar permisos.

## Salvaguardas de producto

V45 fija explícitamente:

- `DESCRIPTIVE_ONLY`;
- causalidad desactivada;
- ranking individual desactivado;
- comparación entre compañeras desactivada.

Esto evita que una futura capa de IA convierta estadísticas observacionales en diagnósticos, causalidad o juicios sobre menores.

## Seguridad y permisos

V45 no añade endpoints, tablas, RPC ni políticas. Por tanto:

- no amplía RBAC/RLS;
- no introduce una nueva superficie de escritura;
- no cambia el perímetro de Player360;
- no habilita `generationEnabled` del gateway IA.

Cuando una UI consuma esta fundación deberá conservar `VIEW_BOXSCORE`/alcance del recurso como autoridad y no usar el motor para saltarse RLS.

## QA

El contrato V45 valida:

- agregación determinista;
- cálculo de porcentajes y ratios;
- supresión de tasas con muestra baja;
- compatibilidad con `assertEvidenceAllowedForAi()` y `sanitizeEvidenceForAiProvider()`;
- ausencia de identificadores de jugadora en la evidencia enviada a proveedor;
- detección de BoxScore inconsistente;
- ausencia de red/persistencia en el dominio;
- salvaguardas anti-ranking/anti-causalidad;
- regresión V44 y build de producción mediante workflow dedicado.

## Siguiente incremento recomendado

Tras validar V45, V46 puede añadir una **Lectura del partido** read-only en BoxScore/Game Center usando primero el snapshot determinista. Sólo después conviene decidir qué partes se redactan con IA y bajo qué permiso/revisión humana.
