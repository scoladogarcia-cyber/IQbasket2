# IQBasket V80 · Arquitectura de idiomas versionados

## Decisión
La UI tiene cuatro idiomas oficiales ES/CA/EN/FR. El texto de la interfaz es código de producto y se publica mediante catálogo versionado, no mediante consultas a Supabase. CSS se limita a estilo y distribución.

## Hallazgos del proyecto (2026-11-07)
- Tres capas previas: `TranslationStore`, `I18nService`, `I18nEngine`; existen claves planas y anidadas.
- Anteriormente dos alias para catalán `ca` y `cat` en Supabase.
- La tabla `public.translations` contiene 2.372 filas en 5 códigos, tamaño total aproximado 432 KB. No hay evidencia de gran impacto de almacenamiento.
- Muchos archivos de interfaz mantienen textos en español no vinculados a claves. V80 NO declara que se hayan traducido todos.

## Cambios V80
- `services/i18n/BundledLanguageCatalogV80.js`: fuente común, normalizador de locale y claves anidadas/planas, interpolación de parámetros.
- `locales/es|ca|en|fr.js`: catálogos históricos oficiales; `trainingHistoryV80.js`, `trainingDetailV80.js` y `languageAdminV80.js` amplían la cobertura por módulo.
- `TranslationStore` e `I18nService`: eliminan lectura remota y uso de caché de traducciones de usuarios; conservan el idioma elegido en el dispositivo. La carga inicial funciona offline.
- `TranslationsView`: catálogo local para el administrador sin consulta SQL.
- `LanguageSettingsView`: previsualización y exportación CSV de cambios para su revisión e inclusión en GitHub. Las ediciones NO se publican instantáneamente ni se guardan en Supabase.
- `TrainingView`: traducción del historial V79 y la ficha de sesión en cuatro idiomas. Lógica de asistencia y validación intacta.
- `scripts/audit-i18n-v80.mjs`: inventario no destructivo de claves potencialmente ausentes y textos fijos. La detección es orientativa; hay contenido y nombres de jugadores que nunca deben transformarse automáticamente.

## Garantías
- No hay alteraciones de datos históricos ni de jugadores.
- No se elimina ni se cambia el esquema de `public.translations` en este PR.
- No hay traducción automática de datos introducidos por usuarios, nombres, observaciones ni texto histórico.
- Fallback idioma actual → español → texto por defecto → clave.
- `cat` se normaliza a `ca`; permisos y autenticación se mantienen.
- El idioma de la interfaz es distinto de los datos de dominio y nunca debe derivarse de CSS.
- Importación CSV con validación de parámetros y aprobación humana antes del commit.

## Procedimiento de retirada de `public.translations` (cambio independiente)
1. Verificar V80 publicada y funcionamiento completo de navegación en ES/CA/EN/FR, incluyendo dispositivos móviles y usuarios de distintos roles.
2. Auditar todos los consumidores (front, funciones SQL, cron, scripts, clientes anteriores y conectores). La revisión de código V80 elimina los consumidores conocidos en frontend; el inventario debe repetirse en producción.
3. Exportar los registros a copia **externa verificada** (JSON/CSV y su hash), preservando también las 387 traducciones heredadas `cat`; cotejar 2.372 filas, integridad y posibilidad de restauración.
4. Confirmar que las traducciones relevantes no incluidas en los catálogos versionados se han incorporado y revisado en los cuatro idiomas.
5. En una migración separada, con revisión de DBA, retirar grants y después `DROP TABLE public.translations RESTRICT`. No usar CASCADE; si hay dependencias, detener y corregir antes.
6. Verificar aplicación, RLS y ausencia de 404 en telemetría; conservar el backup conforme a política.

### Alcance pendiente de internacionalización
La migración integral de las pantallas restantes (partidos, live, estadísticas, reportes, familias, pasaporte, administración legacy) debe hacerse por módulos con regresiones de idioma. La V80 arregla arquitectura y dos áreas funcionales, NO el 100 % de strings.

## Verificación CI
`node tests/i18n-v80-bundled-contract.mjs`, `node scripts/audit-i18n-v80.mjs`, V78/V75/V79, build, QA móvil y navegador.
