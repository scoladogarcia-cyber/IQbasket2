# IQBasket V77 — Aplicación masiva transaccional de asistencia

La V76 ya exporta, interpreta y previsualiza ficheros de asistencia. V77 añade
el contrato **de escritura futura**, separado del importador offline.

## Archivos
- \`services/exchange/TrainingAttendanceImportServiceV77.js\`: capa de RPC;
  deshabilitada hasta activar una aprobación explícita y la migración.
  Comprueba permiso \`IMPORT_TRAINING_ATTENDANCE\` y \`EDIT_TRAINING\`, confirmación
  humana y versiones antes de pedir la transacción al servidor.
- \`supabase/drafts/training_attendance_import_v77.sql\`: borrador SQL,
  **no desplegado**. Tabla de grants separada (vacía por defecto), auditoría
  privada, un único RPC transaccional para revisar todas las filas, aplicar
  cambios con bloqueo/versiones y rechazar lotes corruptos.
- \`tests/training-attendance-import-v77.mjs\`: condiciones fail-closed
  sin permiso, sin confirmación, versiones cambiadas y retorno completo.

## Pasos antes de activar
1. Copia de seguridad **externa** verificada; ensayo en entorno no productivo,
   incluyendo ejercicios de restauración.
2. Generar migración CLI de Supabase, revisar definiciones y trigger de bloques,
   derechos \`anon\`/\`authenticated\`, errores intermedios y autorizaciones.
3. Configurar grants individuales y expiración corta; incorporar interfaz
   administrativa para conceder/revocar importación por recurso.
4. Aplicar en ventana controlada, tests con una cuenta ADMIN autorizada,
   otra no autorizada, un menor no vinculado y una temporada congelada.
5. Activar el feature flag del cliente solo entonces. Hasta ese momento,
   **no aparecen escrituras masivas ni modificaciones en producción**.

No se permite convertir un cero omitido en cero observado, inventar minutos,
modificar partidos, adjudicar jugadores por nombre, borrar sesiones o aplicar
un lote parcialmente. Los triggers existentes de integridad y frescura
longitudinal siguen ejecutándose.
