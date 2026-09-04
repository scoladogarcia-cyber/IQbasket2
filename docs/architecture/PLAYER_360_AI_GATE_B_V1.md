# Player 360 AI Gate B V1

## Objetivo

Gate B introduce control de consumo y trazabilidad comercial antes de permitir cualquier llamada pagada. No activa la IA: el cliente mantiene `generationEnabled=false` y la Edge Function exige además `IQB_AI_GENERATION_ENABLED=true`, ausente por defecto.

## Frontera de seguridad

La evidencia longitudinal continúa leyéndose con el JWT del usuario y RLS. `service_role` se usa únicamente para el ledger de consumo y nunca para leer el bundle de evidencia ni para guardar el insight deportivo. La persistencia del insight sigue pasando por `iq_v4_save_ai_insight`, que revalida permisos en base de datos.

## Ledger atómico

`public.ai_usage_ledger` registra una operación `PLAYER360_AI_INSIGHT` con usuario, club, team-season, snapshot, periodo mensual, idempotencia, estado, proveedor, modelo, tokens, latencia y resultado. `anon` y `authenticated` no tienen acceso directo a la tabla ni a sus RPC de metering.

Estados:

- `RESERVED`: cuota reservada antes de cruzar el límite de coste externo.
- `IN_PROGRESS`: proveedor iniciado; la unidad ya se considera consumida.
- `SUCCEEDED`: insight guardado y consumo conciliado.
- `FAILED`: conserva consumo 1 si el proveedor llegó a iniciarse y 0 si falló antes.
- `EXPIRED`: reserva abandonada antes del proveedor y liberada.

La reserva usa `pg_advisory_xact_lock` por usuario, operación y mes. Esto serializa decisiones concurrentes y evita superar la cuota por carreras entre dispositivos o dobles clics.
## Idempotencia y reintentos

Cada solicitud transporta un `idempotency_key` UUID. Una clave ya reservada no crea otra llamada; una clave completada reproduce el insight existente; una clave fallida no vuelve a consumir de forma silenciosa. Una nueva acción explícita del usuario obtiene una nueva clave.

Las reservas `RESERVED` obsoletas expiran y liberan cuota. Los `IN_PROGRESS` obsoletos se cierran como fallos consumidos para no infra-contabilizar una llamada que pudo llegar al proveedor.

## Secuencia de generación

1. Feature flag server-side.
2. Autenticación y lectura RLS del snapshot.
3. Permiso `iq_v4_can_generate_ai_insights`.
4. Sanitización y allowlist de evidencia.
5. Validación de configuración del proveedor, antes de reservar cuota.
6. Reserva atómica `iq_ai_reserve_usage`.
7. Segunda comprobación de permiso.
8. `iq_ai_mark_provider_started`; desde aquí se consume una unidad.
9. Llamada al proveedor.
10. Persistencia DRAFT mediante RPC del usuario.
11. `iq_ai_complete_usage` con tokens, latencia e identificador del proveedor.
12. Si falla antes del proveedor, se libera la reserva; si falla después, queda trazado como consumido.

Si el insight se guarda pero falla la conciliación final, no se marca el ledger como fallido: queda `IN_PROGRESS` y consumido para una reconciliación segura posterior.

## Evolución SaaS

La cuota V1 sigue resolviéndose desde configuración server-side por rol, pero el ledger almacena `club_id` para migrar después a planes, entitlements y facturación por licencia/tenant sin cambiar la API cliente. El ledger es una base de metering, no todavía un subsistema de billing.

## Gates pendientes para consumo real

El despliegue del esquema puede hacerse con la generación cerrada. La llamada real al proveedor requiere, en una fase separada, desplegar la Edge Function, configurar secretos server-side, definir cuotas comerciales, ejecutar una única generación de smoke y solo entonces abrir ambos flags de generación. Nutrition, Recovery y Neuro-Cognitive siguen fuera del gateway general y requieren autorización ABAC `AI_PROCESS` específica.