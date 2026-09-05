# IQBasket Family Pilot Cohort V1

## Objetivo

Validar si las familias perciben valor recurrente en la capa de interpretación y desarrollo de IQBasket antes de activar cobros o seleccionar un proveedor de billing.

El piloto no es un plan comercial. Mantiene `FAMILY_FREE` como suscripción efectiva y añade temporalmente capacidades premium únicamente al jugador incluido en la cohorte.

## Hipótesis

La hipótesis a validar es que una familia vuelve a IQBasket y encuentra valor cuando puede pasar de:

`qué ocurrió -> cómo evoluciona -> qué significa -> qué trabajar después`

El experimento se centra por tanto en Player 360, tendencias, objetivos, desarrollo y tecnificación. No intenta validar todavía IA, nutrición, wellness ni pricing.

## Duración

Duración por defecto: **28 días**.

Ventanas permitidas: 7, 14, 28, 42 o 56 días.

Cuatro semanas permiten observar varios ciclos partido-entrenamiento, repetición de consulta y evolución de objetivos sin convertir la prueba en un premium gratuito indefinido.

## Bundle temporal

Incluye:

- `ADVANCED_ANALYTICS`
- `PLAYER360`
- `PLAYER_GOALS`
- `DEVELOPMENT_PLAN`
- `TECHNIFICATION`
- `FAMILY_INSIGHTS`
- `REPORT_EXPORT`
- `EXPORT_MONTHLY_UNITS = 20`

No incluye:

- `AI_INSIGHTS`
- `AI_WEEKLY_PLAN`
- `WELLNESS`
- `NUTRITION_RECOVERY`
- ningún acceso que no estuviera ya autorizado por la relación deportiva/familiar.

## Elegibilidad

Una familia sólo puede entrar si existe previamente una relación tutor-jugador válida y activa. El piloto nunca crea esa relación.

El alta reutiliza `family_bootstrap_free_account`, por lo que la cuenta debe quedar sobre `FAMILY_FREE`, con el jugador cubierto como sujeto comercial. Si la cuenta tiene una situación incompatible, un override operativo activo o un grant ajeno que contaminaría el experimento, el backend falla cerrado.

## Arquitectura

```text
relación GUARDIAN existente
        ↓
FAMILY_FREE efectivo
        ↓
SUPERADMIN -> ENROLL_FAMILY_PILOT
        ↓
iq_v11_family_pilot_enroll
        ↓
saas_family_pilot_enrollments
        ↓
saas_entitlement_grants (scope PLAYER)
        ↓
resolver de entitlements
        ↓
ACCOUNT_OVERRIDE > SCOPED_GRANT > PLAN
```

`saas_entitlement_grants` es una primitiva SaaS reutilizable para promociones, pilotos o licencias patrocinadas. Un grant sigue necesitando:

1. una suscripción efectiva;
2. cobertura comercial del sujeto;
3. acceso deportivo/familiar válido;
4. beneficiary scope compatible.

Por ello, un grant nunca concede acceso a datos por sí solo.

## Permisos

La aplicación separa tres acciones:

- `VIEW_FAMILY_PILOT`
- `ENROLL_FAMILY_PILOT`
- `REVOKE_FAMILY_PILOT`

En V1 sólo `SUPERADMIN` posee estos permisos. El backend mantiene además una frontera independiente `VIEW / ENROLL / REVOKE` y vuelve a validar `iq_v3_is_global_superadmin()` en cada RPC.

## Caducidad y revocación

Los grants llevan `valid_until`. Al llegar la fecha dejan de ser efectivos sin cron ni tarea externa y la familia vuelve automáticamente a las capacidades de `FAMILY_FREE`.

La revocación manual marca tanto la inscripción como sus grants como `REVOKED`.

Si la relación familiar se revoca durante el piloto, el resolver de entitlements seguirá denegando acceso al jugador aunque el grant todavía no haya caducado.

## UI de operación

El panel **Producto y monetización** muestra a SUPERADMIN:

- número de pilotos activos, expirados y revocados;
- candidatos que ya tienen relación familiar válida;
- selector de duración;
- alta controlada con confirmación;
- historial reciente y revocación explícita.

El panel recuerda que no existe cobro y que IA/Wellness/Nutrición están fuera del experimento.

## Métricas de decisión

Durante este piloto no se optimiza precio. Las señales principales son:

- familias activadas y elegibles;
- frecuencia semanal de retorno;
- consultas a Player 360 y desarrollo;
- revisitas a objetivos/plan;
- exportaciones solicitadas;
- uso alrededor de partidos y entrenamientos;
- permanencia de uso durante las semanas 2–4;
- incidencias de soporte o privacidad;
- interés explícito en continuar cuando el acceso temporal finaliza.

El pricing sólo debe probarse después de comprobar que existe repetición de valor.

## Rollout

Orden de despliegue de base de datos:

1. `20260905_apply_saas_scoped_entitlement_grants_v1.sql`
2. `20260905_apply_family_pilot_cohort_v1.sql`

Después se despliega la aplicación. No se crea ninguna inscripción automáticamente; la cohorte empieza en cero y cada alta requiere una acción explícita autorizada.

## Rollback

`20260905_rollback_family_pilot_cohort_v1.sql` elimina únicamente la cohorte y los grants `FAMILY_PILOT`. No elimina la infraestructura genérica `saas_entitlement_grants`, no modifica `FAMILY_FREE` y no activa/desactiva planes de pago.

## Siguiente gate

Tras obtener suficiente señal de valor:

1. revisar cohortes y feedback;
2. decidir si la propuesta Family merece prueba de precio;
3. cerrar readiness jurídico/comercial pendiente;
4. elegir proveedor de billing;
5. probar sandbox + webhooks firmados;
6. sólo entonces abrir un piloto de pago limitado.
