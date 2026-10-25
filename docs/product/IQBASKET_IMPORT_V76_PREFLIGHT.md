# IQBasket · V76: preflight versionado para importar asistencias

La plantilla V75 mantiene su mecanismo seguro de vista previa. V76 añade:
- ámbito único de equipo-temporada activa y conjunto completo de sesiones;
- comparación por identificadores estables y rechazo de duplicados;
- snapshot \`updated_at\` de sesión y participante para detectar cambios simultáneos;
- valores anteriores y propuestos diferenciados, preservando \`null\` frente a \`0\`;
- plan ordenado que especifica permisos \`IMPORT_TRAINING_ATTENDANCE\` y \`EDIT_TRAINING\`;
- ninguna escritura directa en tablas desde el navegador.

## Riesgos pendientes

El plan \`PREVIEW_ONLY\` no debe reutilizarse como token de autorización ni reutilizarse tras una modificación de permisos. Para activar una importación transaccional se necesita un RPC de Supabase que valide en la misma transacción identidad, temporada, actualización de sesión/participantes, políticas, permisos, límites, idempotencia y auditoría. El servidor debe rechazar cambios concurrentes y garantizar rollback ante cualquier error. No implementar \`upsert\` fila a fila desde el navegador.

Antes de SQL productivo: copia externa verificable, ensayo en base no productiva, batería RLS/ABAC con cuentas reales, preflight, migración aditiva, postverificación. No habilitar importación de datos de menores ni motivación persistente antes de pasar gobernanza específica. Revisar issue #155 y seguridad #148.

No se toca ningún registro histórico ni se concede permiso nuevo mediante esta versión.
