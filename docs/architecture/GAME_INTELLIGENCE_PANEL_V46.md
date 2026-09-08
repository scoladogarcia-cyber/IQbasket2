# Game Intelligence Panel V46

## Objetivo

V46 convierte la fundación determinista V45 en una primera funcionalidad visible: **Lectura del partido**, integrada en el detalle del BoxScore y siempre en modo solo lectura.

No activa IA generativa. No crea tablas, RPC, endpoints, escrituras ni permisos. La secuencia sigue siendo:

`BoxScore autorizado -> normalización sin identidad -> Game Intelligence V45 -> panel descriptivo V46`

## Decisión de arquitectura

`GameBoxScoreView.js` ya concentraba mucha lógica de visualización, edición y guardado. Añadir el nuevo panel directamente habría aumentado acoplamiento y riesgo de regresión.

V46 conserva el path público `views/GameBoxScoreView.js`, pero lo convierte en un entry point estable:

- `views/GameBoxScoreBaseView.js`: copia exacta de la implementación BoxScore previa a V46;
- `views/games/GameBoxScoreIntelligenceV46View.js`: extensión que llama al comportamiento original y añade el panel;
- `views/GameBoxScoreView.js`: reexporta la extensión bajo el mismo nombre público `GameBoxScoreView`.

Así no cambian los consumidores existentes (`app.js`, vistas scoped, tests ni rutas), mientras la nueva responsabilidad queda desacoplada.

## Frontera de privacidad

`domain/intelligence/GameIntelligenceInputAdapter.js` acepta las variantes actuales/legacy de campos de BoxScore y produce sólo métricas canónicas. Descarta deliberadamente:

- `player_id` / `playerId`;
- nombre y apellidos;
- IDs de equipo, temporada o partido;
- cualquier otro dato de roster o identidad.

El motor V45 recibe por tanto datos estadísticos anónimos a nivel de agregación.

## Panel read-only

`views/components/GameIntelligencePanelV46.js` presenta cuatro bloques descriptivos y responsive:

1. **Tiro**: 2P, 3P, TL y eFG%.
2. **Cuidado del balón**: asistencias, pérdidas y AST/PER cuando es interpretable.
3. **Rebote**: ofensivo, defensivo y total.
4. **Actividad defensiva**: robos, tapones y faltas cometidas.

Las tasas por debajo de la muestra mínima V45 se muestran como `muestra limitada`; no se convierten en 0% ni se presentan con falsa precisión.

Si los puntos almacenados no coinciden con los puntos derivados de tiros anotados, el panel muestra una advertencia de calidad y mantiene la lectura como limitada. No corrige datos automáticamente.

## Flujo post-guardado

Tras un guardado correcto del BoxScore en el flujo normal de equipo, la aplicación vuelve automáticamente a **Partidos** (`#/games`) para mostrar de nuevo la lista completa con los datos ya persistidos.

La decisión de navegación está aislada en `views/games/BoxScorePostSaveNavigationV46.js` y no duplica ninguna escritura. Se apoya en la confirmación de éxito ya existente en el flujo de guardado:

- si el guardado termina correctamente, se navega a Partidos;
- si falla, el usuario permanece en el BoxScore y el botón Guardar vuelve a habilitarse;
- si el acceso está delegado únicamente a un partido, se vuelve a `#/dashboard` para no ampliar el alcance autorizado del usuario.

## UX y accesibilidad

- `section` con `aria-labelledby`;
- layout `auto-fit/minmax` que se adapta a móvil, tablet y escritorio sin scroll horizontal propio;
- estados descritos también con texto, no sólo mediante color;
- paleta neutral: no se usan verde/rojo para insinuar “bueno/malo”;
- la tabla editable permanece separada y sin alteraciones;
- el panel declara que usa el **BoxScore guardado**, evitando confundir cambios todavía no persistidos con evidencia oficial.

## Seguridad y autorización

V46 hereda el perímetro ya autorizado del BoxScore:

- `GameBoxScoreBaseView` sigue aplicando `EDIT_BOXSCORE` para UX y mantiene GameLock/season freeze;
- RLS, triggers y RPC scoped siguen siendo la autoridad de backend/base de datos;
- la extensión no consulta Supabase ni red por su cuenta;
- no se añade un permiso implícito para “IA”; esta versión sólo transforma localmente datos que la vista ya ha podido leer legítimamente.

## Salvaguardas deportivas y éticas

La UI conserva `DESCRIPTIVE_ONLY` y no debe:

- clasificar jugadoras;
- comparar compañeras como mejores/peores;
- diagnosticar estados físicos o psicológicos;
- convertir correlaciones o BoxScore observacional en causalidad;
- ocultar incertidumbre por muestra insuficiente.

## QA V46

El incremento valida:

- compatibilidad de snake_case/camelCase legacy;
- eliminación de PII antes del motor;
- render accesible del panel;
- supresión visual de tasas con muestra baja;
- aviso de inconsistencia de puntos;
- ausencia de red/RPC/persistencia en adapter, presenter y extensión;
- preservación del contrato de locking/RBAC del BoxScore;
- navegación post-guardado normal y scoped;
- regresión V45;
- smoke browser existente de edición/bloqueo de BoxScore en escritorio y móvil;
- build de producción.

## Siguiente incremento recomendado

V47 puede transformar estos hechos en una **síntesis narrativa determinista y accionable** (qué ocurrió y qué revisar) manteniendo referencias a la evidencia. La IA generativa debería seguir desactivada hasta definir permiso, auditoría, versionado de prompts y revisión humana.
