# Auditoría IQBasket Family / Pasaporte V71 — 25 octubre 2026

## Problema y criterio de producto
La pantalla Family ya cuenta con su propio contrato de datos y con el panel `FamilyPassportBriefPanel`, pero la versión V70 situaba el resumen dentro de un contenedor HTML `details` cerrado por defecto. Una familia no debía abrir "Explorar estadísticas..." para saber la categoría y las horas registradas de su hijo. La corrección hace visible **el único panel existente** fuera de ese contenedor, sin clonar el pasaporte técnico de staff.

## Cambios y responsabilidad de archivos
- `views/family/FamilyWorkspaceView.js`: única ranura HTML accesible junto a la portada familiar, antes de `details.family-deep-dive`.
- `views/family/FamilyWorkspaceV32View.js`: conserva carga asíncrona, protección contra respuestas tardías de otro jugador y error no destructivo; deja de generar el panel duplicado dentro de la sección avanzada.
- `tests/family-passport-v70-browser.mjs`: valida una sola ranura visible en móvil, sin desplegar información avanzada; ejecutado en Chromium y WebKit.
- `tests/family-passport-v70.mjs`: contrato de orden del panel y estructura SQL.
- `supabase/migrations/20261025162000_family_passport_brief_v70.sql`: reconciliación del script histórico con el cuerpo de la función **ya instalado** en Supabase. La primera copia del SQL hacía referencia a `player_evaluation_scores.rubric_version`, columna que no existe; la función productiva extrae versión de protocolo desde `metadata`. No se realizan escrituras de datos.

## Evidencia y conceptos visibles a familias
- Categoría/temporada obtenidas de inscripción deportiva actual.
- **Tiempo registrado**: asistencia marcada en fecha pasada con minutos reales.
- **Tiempo acreditado**: parte del anterior que pertenece a una sesión validada.
- **Pendiente**: registrado menos acreditado. Se preserva; no equivale a inasistencia.
- Competiciones y evolución: solo registros autorizados; no extrapolar causalidad o talento.
- Atributos técnicos: se muestra cobertura de observaciones solo si existe licencia y valoración compartida; una nota con cero evidencia sigue provisional. **La calibración científica entre entrenadores sigue pendiente**.

## Seguridad
El RPC `iq_v70_family_passport_brief(p_player_id uuid)` exige `auth.uid()`, cuenta activa, vinculación a jugador mediante `iq_private.family_can_view_player`, y `PLAYER_PROFILE` antes de generar la respuesta. Los datos de entrenamientos dependen de sus propios permisos comerciales; los atributos exigen `PLAYER_PASSPORT` y únicamente evalúan puntuaciones compartidas, no privadas y no archivadas. Tiene `SECURITY DEFINER`, con `search_path=''`, `EXECUTE` solo para authenticated, y prohibición para anon. El advisor informa una advertencia genérica sobre SECURITY DEFINER accesible a usuarios autenticados; el modelo requiere esa puerta autenticada con autorización por objeto y mínimos privilegios. La prueba final con cuentas reales de padre/madre no suplanta a los tests automatizados.

## Conservación y despliegue
- Se han comprobado 38 entrenamientos, 19 evaluaciones y 147 puntuaciones preexistentes.
- Ninguna sesión ha sido autovalidada, ni se han cambiado minutos o valoraciones.
- No hay migraciones destructivas, creación de vistas expuestas ni nuevas reglas RLS.
- El cambio de UI solo se publicará cuando pasen CI y pruebas de navegador y GitHub Pages confirme el SHA fusionado.
- En caso de regresión, revertir los cambios de UI de este PR. La reconciliación del SQL histórico no altera el código RPC desplegado.

## Pendientes transparentes
1. Prueba manual con al menos una cuenta familiar vinculada y una sin vinculación; comprobar el límite de datos y licencia sin compartir credenciales personales.
2. Validación científica del acuerdo entre entrenadores y descriptores de D1-D5: ni un recuento de observaciones ni el porcentaje de cobertura equivalen a fiabilidad interevaluador.
3. Los entrenamientos pendientes seguirán requiriendo revisión del staff, no promoción automática a validados.
