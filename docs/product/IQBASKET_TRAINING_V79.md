# IQBasket V79 — Histórico de entrenamientos unificado

## Alcance entregado
- El historial usa una ficha común para equipo, tecnificación, personal y cognitivo. No elimina ni reinterpreta datos antiguos.
- Filtros combinables: fecha inicial/final, tipo, jugador participante y estado.
- Orden descendente y páginas de 20 sesiones. Al abrir una ficha se conservan los filtros; el listado vuelve a mostrar los resultados.
- Selección de sesiones pendientes, ocurridas y editables **en la página actual**, con validación agrupada.
- La validación envía cada sesión al RPC existente `iq_v65_set_training_validation`. El RPC autoriza equipo-temporada y comprueba fecha, duración, participantes y minutos; las sesiones erróneas permanecen pendientes.
- **No es transaccional como lote**: las primeras pueden guardarse aunque una posterior falle. Se muestra recuento de éxitos/errores.
- No se cambia el contenido de ninguna sesión automáticamente ni se ejecuta SQL contra producción.

## Pendientes antes de cerrar la petición íntegra
- Verificación real de permisos y regresión móvil en entorno autenticado, incluyendo temporadas antiguas.
- Migración de categorías históricas `session_kind_review=PENDING`: requiere clasificación respaldada por evidencia; no adjudicar una categoría sin información.
- Validación global de registros antiguos: ejecutar únicamente tras inventario por temporada, copia externa, revisión de asistencia y autorización efectiva. Las sesiones que no cumplen el RPC no deben validarse por defecto.
- Evaluar posteriormente un RPC batch atómico/auditable si se necesita todo-o-nada a gran escala.
