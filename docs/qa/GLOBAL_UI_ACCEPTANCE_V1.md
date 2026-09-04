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

Se verifica visibilidad frente a mutación conforme a RBAC, manteniendo backend/RLS como autoridad final.

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

## Criterio de salida

V1 se considera cerrada cuando:

- Global UI Shell QA = PASS;
- Role Acceptance UI = PASS;
- Core User Flows = PASS;
- Player 360 browser smokes = PASS;
- Operations browser smokes = PASS;
- no se detectan regresiones visuales o de permisos en desktop/tablet/iPhone.
