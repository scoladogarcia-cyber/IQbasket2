# IQBasket V70–V72 · P0/P1 Family, entrenadores e IA

## Integración sobre arquitectura existente

Se reutilizan Player Passport V68 (69 atributos contextuales y rúbricas), Player360, Family, entrenamiento V65, anotación offline V69 y RBAC/ABAC/RLS. No se crea una segunda identidad de jugador ni se reescriben actas.

| Bloque | Implementación en rama |
|---|---|
| Inicio familiar | FamilyHomeV70.js: portada sencilla, objetivos, historial, contenido avanzado bajo desplegable |
| Pasaporte | V68 existente + FAQ, controles de evidencia, categorías y visualización N/D |
| Idiomas | Paquetes locales versionados es/ca/en/fr, CSV masivo y traducciones en base de datos como excepciones |
| Reporting | Selección de partidos y jugadores, PDF breve/completo, gráficos y mapas existentes, glosario y control de calidad |
| Importación/exportación | CSV de acta editable y validación; modalidad de comparación no destructiva con PBP |
| Fórmulas | BoxScoreCalculator central, StatQualityV71, distinción cero observado / no disponible |
| Interpretación | GuidedSummaryV72 para entrenador y familia: determinista y sin envío a IA externa |

## Limitaciones que impiden declarar cobertura completa

- **Open Data FCBQ**: no existe contrato técnico/API autenticada aportado; el adaptador acepta un CSV explícito, pero no se puede afirmar que lee cualquier acta federativa. Se necesitan especificación, licencia, credenciales y ejemplos oficiales anonimizados.
- **Motivación**: no copiar instrumentos psicométricos de terceros. El check-in de disfrute y motivación necesita propósito, contrato de datos sensible, derechos/consentimientos adecuados, catálogo propio y evaluación de sesgos. No equiparar autoinforme con diagnóstico o predicción de abandono.
- **IA generativa**: Player360AiGatewayService existe, pero su generación está desactivada y permite sólo destinatario STAFF. Los resúmenes V72 no son IA generativa. No habilitar chat, inferencias psicológicas ni cesión de datos de menores desde frontend.
- **Minutos**: la columna player_game_stats.minutes es INTEGER NOT NULL DEFAULT 0, por lo que parte del histórico no distingue minutos desconocidos de cero registrado. Una reparación exige una migración verificada del modelo de procedencia, no sobreescritura masiva.
- **Caches**: ya existen player_game_stats, player_season_metrics, team_season_metrics y analytics_runs con marcas calculated_at/source_revision. Reutilizarlos y actualizar resultados sólo cuando cambien eventos fuente o formula_version; no duplicar tablas.
- **Porcentajes**: sin denominador o sin cobertura deben mostrarse N/D. Un cero observado se preserva. Las fórmulas usan el catálogo común y versiones explícitas.
- **Importación**: sólo modifica un partido abierto sin eventos PBP y con permiso de edición; con PBP es comparación de sólo lectura. El servidor confirma RLS.

## Arquitectura de productos de IA para Family y Staff

1. **Famílias**: explicación de evolución, preguntas para conversar y acciones semanales derivadas del objetivo autorizado. No rankings emocionales ni valoración global del menor.
2. **Entrenadores**: borrador de crónica, revisión de actas, tendencias contextualizadas, planes de entrenamiento vinculados al objetivo con evidencias verificables.
3. **Jugadores**: un reto pequeño observable y revisión con entrenador. Sin prescripciones de carga o salud.
4. **Frente de seguridad**: lectura vía RPC y RLS; paquete mínimo de evidencias con jugador/contexto, source_revision, muestra, cobertura y límites; eliminación de identificadores antes del proveedor cuando se pueda; backend valida rol, licencia, propósito, permisos AI_PROCESS, cuota y modelo.
5. **Salida**: borrador explicable con referencias a datos, incertidumbre y revisión humana. Prohibido inferir lesiones, diagnóstico, causalidad no probada o profesionalización futura.
6. **Monetización**: Family Free útil; Family Premium centrado en continuidad, progreso explicado y orientación revisable, no en revender acceso a datos propios. Validar disposición a pagar antes de activar checkout.

## Puertas de verificación

Ejecutar npm ci, npm run build, suites family-p0-p1-v70, product-p1-v71, product-p1-v72, live v69, passport v68, reports V50/V53/V60 y QA móvil/WebKit. Comprobar con cuentas reales de Familia y Entrenador, un jugador vinculado y otro no vinculado; validar RLS/ABAC.

No aplicar SQL por su nombre sin preflight read-only, rehearsal no productivo, copia de seguridad externa, apply controlado y post-verify. Hasta cumplir las puertas, esta integración sigue en rama de trabajo y no se considera un despliegue completo.
