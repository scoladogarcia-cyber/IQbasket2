# IQBasket · Global UI Acceptance V1

## Objetivo

Establecer un gate reproducible de calidad visual y experiencia de uso antes de seguir ampliando módulos funcionales.

Esta fase no modifica esquema ni datos de Supabase. Todas las pruebas de navegador trabajan con fixtures en memoria y stubs de red.

## Alcance V1

### Shell global

Se valida el contenedor común de la aplicación en:

- desktop 1440×900;
- tablet portrait 820×1180;
- iPhone 390×844;
- iPhone compacto 375×667.

Invariantes:

- sin overflow horizontal global;
- cabecera y navegación inferior dentro del viewport;
- sidebar oculto en móvil y visible en desktop;
- targets táctiles >= 44 px;
- contraste mínimo WCAG AA para textos principales del shell;
- tipografía de labels encapsulada en el componente, sin heredar accidentalmente el tamaño/color global de `span`;
- labels de navegación inferior en hasta dos líneas, sin elipsis tipo `Mapa de ...`;
- drawer `Más` completamente accesible, dentro del viewport y con scroll vertical;
- selectores de equipo, temporada e idioma dentro del viewport.

### Roles

El gate reutiliza las pruebas existentes de aceptación para:

- SUPERADMIN;
- ADMIN;
- ENTRENADOR;
- INVITADO.

La ampliación móvil añade cobertura explícita para:

- JUGADOR;
- FAMILIA_TUTOR.

Se verifica visibilidad frente a mutación conforme a RBAC, manteniendo backend/RLS/ABAC como autoridad final.

### Navegadores móviles

La aceptación específica de JUGADOR y FAMILIA_TUTOR se ejecuta en:

- Chromium;
- WebKit (regresión equivalente al motor Safari/iPhone).

Se comprueban navegación inferior, rutas propias/vinculadas, targets táctiles, drawer `Más`, scroll y geometría de las familias de modales utilizadas por los módulos lazy.

### Idiomas

El shell se prueba en:

- ES;
- CA;
- EN;
- FR.

La prueba fuerza además una traducción realista larga de `heatmap_analysis` para reproducir y prevenir el truncado observado en iPhone.

### Flujos funcionales reutilizados

El gate global ejecuta también las smokes existentes de:

- roster y configuración;
- traspasos;
- cierre de temporada;
- entrenamiento y tecnificación;
- Player 360 evaluación;
- Player 360 evolución/IA;
- Nutrition/Recovery;
- BoxScore;
- matriz read-only de INVITADO.

## Estrategia

1. Detectar defectos de shell y estilos transversales.
2. Corregir únicamente la capa responsable, sin cambios de negocio.
3. Ejecutar la regresión completa de UI.
4. Corregir superficies concretas que fallen.
5. Fusionar a `main` únicamente con todos los gates verdes.

## Primer hallazgo estructural

`styles/global.css` aplica reglas tipográficas a todos los `span`. Esto puede sobrescribir la escala visual definida por componentes compactos. No se cambia la regla global en esta fase por el riesgo de alterar toda la aplicación; se encapsula explícitamente el shell en `styles/layout.css` y se añade una regresión permanente.

## Hallazgo WebKit 2026-09-07

El nuevo gate WebKit reprodujo un fallo que Chromium no detectaba: el drawer `Más` quedaba formalmente abierto pero su panel conservaba parcialmente la transformación de entrada, dejando la mayor parte de las opciones fuera del viewport de 390×844.

La corrección mantiene el overlay como única fuente de verdad de visibilidad (`display`, clases `open/is-visible` y `aria-hidden`) y elimina en móvil la segunda capa de visibilidad basada en `translateY` del panel. Se conserva el scroll vertical, safe-area y el límite por `100svh`.

El mismo escenario pasa después de la corrección en Chromium y WebKit para JUGADOR y FAMILIA_TUTOR.

## Verificación ABAC real de Nutrition/Recovery

Además de los browser smokes con fixtures se ha verificado el backend productivo mediante transacciones con `ROLLBACK`, sin modificar datos reales:

- SUPERADMIN: lectura/creación/edición/archivo de Nutrition y acceso a Recovery correctos; no se relajan las protecciones especiales de exportación o neurocognición.
- JUGADOR: `PLAYER_SELF_SERVICE` permite leer, crear, editar y archivar Nutrition/Recovery para su jugador vinculado cuando existe autorización de tratamiento.
- FAMILIA_TUTOR: la relación GUARDIAN está activa y verificada, pero la autorización de tratamiento actual del jugador incluye `SPORT_PERFORMANCE` y `PLAYER_SELF_SERVICE`, no `FAMILY_SUPPORT`; por ello Nutrition/Recovery sensible permanece denegado por ABAC. Es el comportamiento seguro esperado con la autorización actual y no debe solventarse ampliando permisos frontend.

## Criterio de salida

V1 se considera cerrada cuando:

- Global UI Shell QA = PASS;
- Role Acceptance UI = PASS;
- Mobile Role + WebKit QA = PASS en Chromium y WebKit;
- Core User Flows = PASS;
- Player 360 browser smokes = PASS;
- Operations browser smokes = PASS;
- no se detectan regresiones visuales o de permisos en desktop/tablet/iPhone.

## Revalidación 2026-09-07

Se relanza el gate completo desde `qa/global-ui-acceptance-v1` apuntando al `main` posterior a V30 (Family links, modos de captura y comparación). La regresión base resultó verde y la ampliación WebKit permitió detectar y corregir el problema de drawer descrito arriba. Este documento se actualiza al final de la corrección para disparar una última regresión completa sobre el estado que se propone fusionar a `main`.
