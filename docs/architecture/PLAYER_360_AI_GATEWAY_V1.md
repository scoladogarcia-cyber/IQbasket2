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
        ├─ minimiza la evidencia por allowlist
        ├─ aplica cuota mensual server-side
        ├─ envía SOLO evidencia deportiva necesaria al proveedor
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

## Minimización de datos antes de abandonar IQBasket

La evidencia persistida puede contener identificadores internos necesarios para trazabilidad dentro de IQBasket. Esos campos **no se transmiten automáticamente al proveedor**.

`sanitizeEvidenceForAiProvider(...)` reconstruye el payload por allowlist y elimina, entre otros:

- `player_id`;
- `team_season_id`;
- `generated_at`;
- `source_id` y otros identificadores de procedencia;
- cualquier campo futuro que no haya sido aprobado expresamente para el contrato externo.

El proveedor recibe únicamente:

- periodo del snapshot;
- versión de evidencia y versión de cálculo;
- hechos deportivos estructurados necesarios;
- ausencias de datos estructuradas;
- limitaciones metodológicas.

No se envía nombre, email, teléfono, foto, perfil de usuario ni tablas completas. El límite del bundle de entrada es 64 KiB antes de la minimización.

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

El resultado se guarda siempre como `DRAFT`; una respuesta del proveedor nunca sustituye métricas, observaciones ni evaluación humana.

## Reglas epistemológicas

El prompt de sistema obliga a:

1. usar solo hechos aportados;
2. no recalcular métricas;
3. no inventar datos ausentes;
4. no convertir correlación/asociación en causalidad;
5. no emitir diagnóstico médico, nutricional o psicológico;
6. expresar limitaciones y trazabilidad de evidencia.

La revisión humana Phase 4D sigue siendo obligatoria antes de tratar la interpretación como aprobada.

## Proveedor, secretos y desacoplamiento

La UI no contiene proveedor, endpoint ni API key. La Edge Function usa configuración de infraestructura:

- `IQB_AI_PROVIDER`;
- `IQB_AI_API_KEY`;
- `IQB_AI_MODEL`;
- `IQB_AI_ENDPOINT` opcional;
- `IQB_AI_ALLOW_CUSTOM_ENDPOINT` para permitir explícitamente un endpoint HTTPS alternativo;
- `IQB_AI_MONTHLY_LIMITS_JSON`;
- `IQB_AI_TIMEOUT_MS` opcional;
- `IQB_AI_MAX_OUTPUT_TOKENS` opcional.

V1 incluye un adaptador `OPENAI`, pero la frontera `callProvider(...)` permite añadir proveedores sin cambiar UI, contratos deportivos ni persistencia.

El endpoint debe ser HTTPS. Por defecto solo se admite el origen oficial de OpenAI; un endpoint alternativo requiere habilitación explícita. Esto evita convertir una variable de entorno mal configurada en una vía accidental de exfiltración.

## Resiliencia y control del proveedor

La llamada a Responses API se ejecuta con:

- `store: false`, para no solicitar almacenamiento recuperable de la respuesta en el proveedor;
- salida JSON Schema estricta;
- `max_output_tokens` limitado y configurable dentro de un rango seguro;
- timeout server-side con `AbortController`;
- tratamiento explícito de respuestas `incomplete`;
- tratamiento explícito de `refusal`;
- rechazo de salida vacía o no JSON antes de persistir.

Los errores de proveedor se traducen a códigos internos y no se registran secretos ni el bundle de evidencia en logs.

## Control de costes y licencias

La cuota se impone en servidor. Si `IQB_AI_MONTHLY_LIMITS_JSON` no está configurado, el gateway deniega todas las generaciones: desplegar código no equivale a habilitar consumo.

Los límites se expresan inicialmente por rol de aplicación y pueden evolucionar a entitlements por licencia/tenant sin modificar el cliente. Los insights sintéticos `SYNTHETIC_DEMO` no consumen cuota real.

V1 usa como contador las generaciones completadas persistidas. **Antes de abrir consumo pagado a múltiples usuarios/tenants**, la capa SaaS deberá evolucionar a un ledger/reserva atómica de intentos y costes para evitar carreras de concurrencia y contabilizar también llamadas al proveedor que fallen antes de persistir un insight.

## Integración UI

`Player360View` crea una única instancia de `Player360AiGatewayService` y la inyecta en `LongitudinalAnalyticsPanel`.

El botón de generación solo puede renderizarse cuando se cumplen simultáneamente:

1. permiso funcional `GENERATE_AI_INSIGHTS`;
2. `PLAYER360_AI_UI_CONFIG.generationEnabled === true`;
3. `Player360AiGatewayService.isEnabled() === true`.

En Gate A ambos interruptores de despliegue permanecen cerrados por defecto, por lo que fusionar el código no puede iniciar una llamada pagada.

## Activación en dos puertas

### Puerta A — código

- contrato compartido;
- Edge Function;
- servicio cliente;
- UI preparada;
- pruebas de seguridad/contrato;
- minimización del payload externo;
- `generationEnabled=false`.

No genera coste ni llama a ningún proveedor.

### Puerta B — infraestructura

Solo después de validar el despliegue de Edge Function:

1. desplegar con Supabase CLI actual y verificar el bundle de dependencias;
2. configurar secretos en Supabase;
3. configurar cuotas server-side;
4. decidir/implantar reserva atómica de consumo antes de apertura multiusuario;
5. ejecutar un smoke con una única generación controlada;
6. confirmar que el proveedor recibe únicamente el payload minimizado;
7. confirmar persistencia DRAFT y revisión humana;
8. activar `generationEnabled=true` en un PR separado y pequeño.

La función comparte el contrato JavaScript con el frontend. El despliegue se realizará mediante el bundler actual de Supabase/`--use-api`, que empaqueta el grafo de dependencias; si en el futuro se abandona ese mecanismo, el contrato server-side deberá moverse a `supabase/functions/_shared` sin duplicar reglas.

Así un merge de frontend nunca puede activar por accidente consumo pagado.
