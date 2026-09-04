# Player 360 Phase 4G — FREE_ONLY AI Gateway

## Objetivo

Activar interpretación mediante LLM real sin introducir costes variables de API, sin exponer claves en el navegador y sin permitir que un modelo escriba resultados aprobados directamente.

## Decisión de producto

El MVP opera en modo `FREE_ONLY`.

- Único tipo de proveedor admitido: `LOCAL_OPENAI_COMPATIBLE`.
- El modelo debe ejecutarse en infraestructura controlada/autogestionada y exponer una API compatible con OpenAI mediante HTTPS.
- No se habilitan OpenAI, Anthropic, Gemini, proveedores comerciales ni endpoints que puedan generar facturación por tokens.
- Si el backend detecta un `cost class` distinto de `FREE`, la generación se bloquea.
- Si no existe un LLM gratuito configurado, Player 360 sigue funcionando con analítica determinista y la IA permanece no disponible.

Esto permite usar, por ejemplo, un servidor local basado en Ollama o llama.cpp sin acoplar IQBasket a un modelo concreto.

## Flujo

`UI -> AiInsightGatewayService -> Supabase Edge Function -> LLM local/autogestionado -> RPC service_role -> DRAFT -> revisión humana`

La UI nunca conoce `AI_BASE_URL`, `AI_API_KEY` ni detalles de infraestructura.

## Seguridad

### Autenticación y RBAC

La Edge Function valida la sesión real y vuelve a comprobar `iq_v4_can_generate_ai_insights(team_season_id)` antes de preparar cualquier petición.

### ABAC sensible

La evidencia persistida se inspecciona en backend. Si aparecen métricas de `nutrition`, `recovery` o `neuro_cognitive`, cada módulo exige `AI_PROCESS` con la finalidad solicitada mediante `iq_v4e_can_access_sensitive_resource(...)`.

El cliente no puede ocultar que un snapshot contiene evidencia sensible.

### Cierre del bypass Phase 4D

Phase 4D permitía ejecutar `iq_v4_save_ai_insight(...)` desde un usuario autenticado porque aún no existía proveedor real. Phase 4G revoca ese `EXECUTE` al rol `authenticated`.

Los resultados LLM solo pueden persistirse mediante `iq_v4g_complete_ai_gateway_request(...)`, ejecutable por `service_role` desde la Edge Function.

### Revisión humana

Todo resultado se guarda en `player_ai_insights` con estado `DRAFT`. La aprobación/rechazo existente se conserva sin cambios.

## Minimización de datos

El prompt no recibe nombre, email ni identificadores del jugador/equipo. Solo recibe:

- periodo del snapshot;
- hechos deterministas;
- datos ausentes;
- limitaciones metodológicas;
- versiones de evidencia/cálculo.

La Edge Function limita además el volumen de hechos y el tamaño total del payload.

## Reglas de salida

El LLM no calcula métricas. Solo puede redactar a partir de evidencia ya calculada.

Se rechazan respuestas que:

- no sean JSON válido;
- añadan campos fuera del contrato;
- sean excesivamente grandes;
- incluyan afirmaciones causales explícitas;
- incluyan lenguaje diagnóstico o clínico.

## Trazabilidad y deduplicación

Cada solicitud registra:

- snapshot;
- usuario solicitante;
- audiencia/idioma/finalidad;
- proveedor y modelo;
- versión de prompt;
- fingerprint de evidencia;
- `request_key` idempotente;
- tokens cuando el servidor local los informa;
- estado y errores;
- coste estimado, obligado por constraint a `0`.

Una misma combinación de evidencia/modelo/prompt no vuelve a consumir inferencia si ya existe un resultado completado.

## Cuotas

`ai_gateway_role_limits` centraliza la cuota mensual por rol. Su objetivo inicial es controlar abuso y capacidad de cómputo, no monetizar consumo.

Los valores iniciales mantienen los límites existentes de IQBasket y pueden evolucionar más adelante hacia planes SaaS sin modificar el gateway.

## Variables de entorno de la Edge Function

- `AI_GATEWAY_ENABLED=true|false`
- `AI_FREE_ONLY=true` obligatorio para este MVP
- `AI_COST_CLASS=FREE`
- `AI_PROVIDER=LOCAL_OPENAI_COMPATIBLE`
- `AI_BASE_URL=https://.../v1`
- `AI_MODEL=<modelo local>`
- `AI_API_KEY=<opcional, si el endpoint privado la requiere>`
- `AI_TIMEOUT_MS=<opcional>`
- `AI_MAX_OUTPUT_TOKENS=<opcional>`

## Fuera de alcance de Phase 4G

- proveedores de pago;
- fallback automático a APIs comerciales;
- facturación por token;
- procesamiento de neurodatos sin autorización explícita;
- decisiones automáticas sobre jugadores;
- publicación automática de insights sin revisión humana;
- entrenamiento/fine-tuning con datos de IQBasket.
