# IQBasket2 · Auditoría global de idiomas y CSS responsive (V89)

**Fecha:** 12 de noviembre de 2026  
**Idiomas oficiales:** ES, CA, EN, FR  
**Rama:** `audit/i18n-css-coverage-v89-20261112` · [PR #175](https://github.com/scoladogarcia-cyber/IQbasket2/pull/175)

## Alcance y criterio

Los CSS **no almacenan ni traducen palabras**. La traducción debe provenir de catálogos JavaScript por clave semántica, mediante `TranslationStore` / `I18n` o catálogos locales lazy. Los CSS compartidos deben poder mostrar etiquetas de longitudes distintas sin desbordamientos, ocultar acciones o romper la accesibilidad.

Se han inspeccionado el servicio i18n, el orquestador del selector, 12 CSS compartidos, vistas y módulos de interfaz, la estructura de los diccionarios y la navegación móvil/desktop. El analizador es **de solo lectura** y no se conecta a producción ni modifica datos.

## Resultado medido en CI

Ejecución: `node scripts/audit-i18n-v89.mjs --strict-core`.

| Indicador | Resultado | Interpretación |
|---|---:|---|
| Ficheros analizados | 123 (110 JS, 12 CSS, 1 HTML) | Vista estática del frontend; no incluye plantillas SQL externas |
| Claves de catálogo ES/CA/EN/FR | 818 por idioma | Paridad estructural correcta |
| Claves ausentes frente a ES | 0 | No confirma que las cadenas se utilicen en las vistas |
| Discrepancias de interpolación | 0 | Formato `{placeholder}` coherente |
| Candidatas sin clave global | 142 | Revisar: incluyen claves de subcatálogos/no globales y algunas realmente inexistentes |
| Candidatas de texto literal en HTML | 703 | Búsqueda heurística, no errores confirmados uno a uno |
| Candidatas de atributos literales | 85 | Especialmente `placeholder`, `title`, `aria-label` |
| Candidatas idénticas a ES | 1 | La coincidencia restante («Eliminar jugador») es natural en ambos idiomas; se corrigieron las demás en CA |
| Hojas CSS especiales por idioma | 0 | Correcto: estilos compartidos, no CSS de traducción |
| Riesgos `nowrap` en selectores relevantes de CSS externos | 0 | Se corrigió también la definición CSS **interna** de `LayoutView` |

**Dictamen:** los **catálogos estructurales** están al día, pero **la cobertura real de traducción de todos los módulos NO está completa**. Un `fallback` a castellano puede ocultar un error aun cuando los cuatro catálogos tengan el mismo número de claves. No usar “100 % traducido” como criterio de publicación todavía.

## Correcciones entregadas en V89

1. `views/LayoutView.js`: evita que reglas CSS internas vuelvan a imponer `white-space:nowrap` a las etiquetas de navegación; admite dos líneas, asegura `min-width:0` en selectores flex y añade nombres accesibles para equipo/temporada/idioma.
2. `styles/layout.css`: unifica la regla compartida de etiquetas móviles, `overflow-wrap:anywhere` y `hyphens:auto` para idiomas con textos más largos.
3. `components/AppLayout.js`: garantiza el mismo comportamiento en la interfaz heredada, sin romper sus rutas ni navegación.
4. `scripts/audit-i18n-v89.mjs`: genera el inventario global y comprueba paridad de catálogos de funcionalidades migradas.
5. `tests/global-ui-shell-qa.mjs`: añade iPhone de 320 px en ES/CA/EN/FR a los escenarios anteriores y exige ausencia de recortes/overflow horizontal, contraste y superficies táctiles.
6. `tests/i18n-v89-style-contract.mjs`: impide reintroducir el CSS de etiquetas en una sola línea.
7. `.github/workflows/i18n-v80.yml`: incorpora la auditoría y el contrato CSS al CI.

No se han alterado Supabase, RLS, equipos, partidas, entrenamientos, eventos, valoraciones estadísticas, usuarios ni textos escritos por usuarios.

## Priorización de las pantallas que siguen pendientes

| Prioridad | Módulos con candidatos a revisar | Enfoque |
|---|---|---|
| P0 | Partidos en vivo, anotación rápida y boxscore; Entrenamientos; autenticación | Textos de acciones, validaciones, errores, tooltip, accesibilidad, control de bloqueos y permisos |
| P0 | Pasaporte del jugador y PlayerStats | Formularios, resultados y evidencias sin transformar los datos introducidos |
| P1 | Familia / bienestar / privacidad | Estados, ayudas, consentimiento y mensajes de acceso |
| P1 | Reporting, mapa de calor, comparaciones y exportaciones | Textos de informes, métricas, leyendas y exportaciones por idioma |
| P2 | Gestión de temporadas, administración, traducciones heredadas, negocio | Operaciones y formularios administrativos |

Entre los ficheros con mayor número de candidatos se encuentran `views/player360/passport/PlayerPassportView.js`, `views/TranslationsView.js`, `views/TrainingView.js`, `views/family/FamilyWorkspaceView.js` y `views/PrivacyCenterView.js`. El inventario no debe convertirse en traducción automática masiva porque mezclaría elementos de interfaz con contenidos históricos del usuario.

## Criterios de cierre de la internacionalización total

- Todas las cadenas **de interfaz** por vista (etiquetas, botones, estados, formularios, `placeholder`, `title`, ARIA, errores, validaciones y ayuda) requieren clave semántica en los cuatro idiomas.
- Las opciones de idioma deben reconstruir la pantalla en el idioma seleccionado, **sin cerrar sesión ni perder datos sin guardar**.
- Pruebas funcionales reales en iPhone Safari / Chromium móvil / desktop y varios perfiles con permisos; evaluar textos de longitud mayor y pantallas estrechas.
- El servidor, la base de datos y las políticas RBAC/ABAC permanecen independientes del idioma mostrado.
- No traducir nombres propios, notas clínicas/deportivas, notas del entrenador, historiales ni categorías personalizadas, salvo vocabularios canónicos controlados.
- Evitar fallback silencioso del español en las vistas migradas; continuar hasta eliminar todos los candidatos **confirmados**.

La continuación funcional está inventariada en [GitHub issue #174](https://github.com/scoladogarcia-cyber/IQbasket2/issues/174).
