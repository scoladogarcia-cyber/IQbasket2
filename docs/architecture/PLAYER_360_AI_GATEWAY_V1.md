# IQBasket — Player 360 AI Gateway V1

## Objetivo

Activar interpretación generativa real sobre evidencia longitudinal ya calculada sin exponer secretos, sin permitir llamadas directas desde el navegador y sin convertir la salida de un modelo en dato objetivo.

## Arquitectura

```text
LongitudinalAnalyticsPanel
        │
        ▼
Player360AiGatewayService
        │  Supabase Functions + JWT del usuario
        ▼
player360-ai-insight (Edge Function)
        │
        ├─ verifica sesión
        ├─ lee snapshot con RLS del llamante
        ├─ revalida iq_v4_can_generate_ai_insights(team_season)
        ├─ bloquea módulos restringidos
        ├─ aplica cuota mensual server-side
        ├─ envía SOLO evidence_bundle al proveedor
        ├─ valida salida estructurada
        └─ persiste DRAFT mediante iq_v4_save_ai_insight
                │
                ▼
         player_ai_insights
                │
                ▼
        revisión humana existente
```

La Edge Function nunca usa `service_role` para leer el snapshot ni para persistir el insight. El service role se limita a la comprobación server-side de perfil/consumo; el recurso deportivo se obtiene y escribe siempre en contexto del JWT del usuario.

## Alcance V1

La primera activación admite exclusivamente audiencia `STAFF` y evidencia no restringida procedente de:

- competición;
- entrenamiento;
- tecnificación/desarrollo externo;
- evaluación deportiva.

Quedan expresamente fuera:

- Nutrition;
- Recovery;
- Neuro-Cognitive;
- cualquier payload que incorpore módulos desconocidos.

La exclusión también inspecciona `missing_data`: que una métrica sensible carezca de muestra no permite introducirla silenciosamente en el gateway genérico.

## Privacidad y ABAC

Phase 4E define `AI_PROCESS` para recursos restringidos. V1 no utiliza datos restringidos, por lo que no crea ningún bypass especial ni concede acceso sensible a SUPERADMIN.

Cuando Nutrition/Recovery/Neuro se incorporen a IA se hará en una fase independiente que deberá validar, antes de cada llamada, autorización de tratamiento + grant explícito `AI_PROCESS` + finalidad permitida mediante `iq_v4e_can_access_sensitive_resource(...)`.

## Evidencia mínima enviada al proveedor

No se envía nombre, email, teléfono, foto ni perfil de usuario. El proveedor recibe:

- periodo del snapshot;
- `PLAYER360_EVIDENCE_V1` ya determinista;
- hechos, ausencias y limitaciones del contrato.

La IA no recibe tablas completas ni acceso a Supabase. El límite inicial del bundle es 64 KiB.

## Contrato de salida

`PLAYER360_AI_INSIGHT_V1` exige JSON estructurado:

- `summary`;
- `interpretation`;
- `priorities[]`;
- `recommendations[]`;
- `action_plan[]`;
- `evidence_refs[]`;
- `limitations[]`.

El servidor elimina campos no reconocidos y normaliza longitudes antes de persistir. Además adjunta `_generation` de confianza con versión de gateway, request id del proveedor, tokens cuando estén disponibles, latencia y fingerprint de la evidencia.

## Reglas epistemológicas

El prompt de sistema obliga a:

1. usar solo hechos aportados;
2. no recalcular métricas;
3. no inventar datos ausentes;
4. no convertir correlación/asociación en causalidad;
5. no emitir diagnóstico médico, nutricional o psicológico;
6. expresar limitaciones y trazabilidad de evidencia.

El insight se guarda siempre como `DRAFT`. La revisión humana Phase 4D sigue siendo obligatoria antes de tratarlo como interpretación aprobada.

## Proveedor y secretos

La UI no contiene proveedor, endpoint ni API key. La Edge Function usa configuración de infraestructura:

- `IQB_AI_PROVIDER`;
- `IQB_AI_API_KEY`;
- `IQB_AI_MODEL`;
- `IQB_AI_ENDPOINT` opcional;
- `IQB_AI_MONTHLY_LIMITS_JSON`.

V1 incluye un adaptador `OPENAI`, pero la frontera `callProvider(...)` permite añadir proveedores sin cambiar UI, contratos deportivos ni persistencia.

## Control de costes y licencias

La cuota se impone en servidor. Si `IQB_AI_MONTHLY_LIMITS_JSON` no está configurado, el gateway deniega todas las generaciones: despliegue no equivale a consumo.

Los límites se expresan por rol de aplicación y pueden evolucionar a entitlements por licencia/tenant sin modificar el cliente. Los insights sintéticos `SYNTHETIC_DEMO` no consumen cuota real.

Una fase SaaS posterior añadirá ledger de intentos/coste monetario por tenant; V1 registra uso técnico dentro del insight exitoso y utiliza la persistencia existente como contador de generaciones completadas.

## Activación en dos puertas

### Puerta A — código

- contrato compartido;
- Edge Function;
- servicio cliente;
- UI preparada;
- pruebas de seguridad/contrato;
- `generationEnabled=false`.

No genera coste ni llama a ningún proveedor.

### Puerta B — infraestructura

Solo después de validar el despliegue de Edge Function:

1. configurar secretos en Supabase;
2. configurar cuotas server-side;
3. smoke con una única generación controlada;
4. confirmar persistencia DRAFT y revisión;
5. activar `generationEnabled=true` en un PR separado o commit final controlado.

Así un merge de frontend nunca puede activar por accidente consumo pagado.
