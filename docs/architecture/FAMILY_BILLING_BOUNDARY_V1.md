# IQBasket Family Billing Boundary V1

## Objetivo

Preparar IQBasket para monetización recurrente sin permitir que el navegador, una configuración accidental o una sesión de checkout alteren la verdad comercial del sistema.

Esta fase **no cobra**, **no selecciona proveedor**, **no publica planes de pago** y **no activa suscripciones**. Crea la frontera técnica estable sobre la que se conectará un proveedor de billing cuando los gates técnicos, jurídicos y operativos estén cerrados.

## Principio rector

La verdad comercial vive en backend.

```text
Family UI
   │
   ▼
FamilyBillingGatewayService
   │ Supabase Functions + JWT usuario
   ▼
family-checkout-session (Edge Function)
   ├─ request Origin allowlisted
   ├─ gate servidor
   ├─ readiness comercial servidor
   ├─ autenticación
   ├─ autoridad de billing OWNER/BILLING
   ├─ cuenta FAMILY activa
   ├─ allowlist de planes
   ├─ plan ACTIVE + público
   ├─ return URL allowlisted
   └─ provider adapter [NO IMPLEMENTADO EN V1]
```

El frontend nunca escribe `saas_subscriptions`, `saas_entitlement_overrides` ni ninguna otra tabla comercial.

## Separación de responsabilidades

### `config/family-billing-gateway.config.js`

Gate UX/cliente. `checkoutInvocationEnabled` queda `false` por defecto. No contiene secretos y no concede permiso alguno.

### `services/billing/FamilyBillingGatewayService.js`

Frontera cliente mínima. Normaliza la petición y llama a la Edge Function. No conoce proveedor, precios, claves ni lógica de activación.

### `supabase/functions/family-checkout-session/index.ts`

Frontera de seguridad server-authoritative. Usa el JWT del llamante para autenticar y `service_role` únicamente después de validar identidad, porque las tablas SaaS están correctamente cerradas al rol `authenticated`.

En V1 la función termina siempre antes de llamar a un proveedor: devuelve `BILLING_PROVIDER_NOT_CONFIGURED` o `BILLING_PROVIDER_NOT_IMPLEMENTED`.

## Gates server-only

El servidor no confía en las variables `VITE_*` del navegador. Requiere independientemente:

- `IQB_FAMILY_BILLING_CHECKOUT_ENABLED`
- `IQB_FAMILY_COMMERCIAL_PILOT_ENABLED`
- `IQB_FAMILY_PRIVACY_TERMS_APPROVED`
- `IQB_FAMILY_CONSENT_RULES_APPROVED`
- `IQB_FAMILY_SPECIAL_CATEGORY_REVIEW_APPROVED`
- `IQB_FAMILY_RIGHTS_RETENTION_PROCESS_APPROVED`
- `IQB_FAMILY_PROCESSOR_CONTRACTS_APPROVED`
- `IQB_FAMILY_DPIA_REVIEWED`
- `IQB_FAMILY_POLICY_VERSIONING_READY`

Todos fallan cerrados si no están definidos con valor afirmativo reconocido.

Además requiere:

- `IQB_FAMILY_PAID_PLAN_CODES`: allowlist explícita de códigos de plan;
- `IQB_APP_ALLOWED_REQUEST_ORIGINS`: allowlist exacta de orígenes web que pueden invocar la Edge Function; un `Origin` ausente, inválido o no autorizado se rechaza antes del preflight/POST;
- `IQB_APP_ALLOWED_RETURN_ORIGINS`: allowlist exacta e independiente de orígenes permitidos para retorno del checkout;
- `IQB_BILLING_PROVIDER`: reservado para el futuro adapter; hoy ningún proveedor está implementado.

La respuesta CORS nunca usa `Access-Control-Allow-Origin: *`: refleja únicamente un origen previamente validado y añade `Vary: Origin`.

Las credenciales futuras del proveedor serán exclusivamente secretos de Edge Function, nunca `VITE_*`.

## Autorización de billing

Crear una sesión de checkout requerirá:

1. origen de petición incluido en la allowlist server-only;
2. sesión autenticada válida;
3. cuenta `saas_billing_accounts` tipo `FAMILY` y `ACTIVE`;
4. membresía activa en `saas_billing_account_members`;
5. rol comercial `OWNER` o `BILLING`;
6. plan incluido en la allowlist server-only;
7. plan `FAMILY`, `ACTIVE` y público.

Ser `SUPERADMIN`, entrenador, analista o familiar autorizado a datos deportivos no concede por sí mismo autoridad de facturación sobre una cuenta Family.

## Regla crítica de activación

**Crear o completar un checkout nunca activará directamente una suscripción.**

Cuando se integre un proveedor, la secuencia deberá ser:

```text
checkout session created
       ↓
usuario completa pago fuera de IQBasket
       ↓
webhook firmado del proveedor
       ↓
verificación de firma + idempotencia + estado
       ↓
actualización backend de saas_subscriptions
       ↓
entitlements efectivos
```

Sólo un webhook autenticado/verificado podrá convertir el estado comercial. El retorno del navegador después del pago será informativo y no autoritativo.

## Estado actual de planes

`FAMILY` y `FAMILY_PRO` continúan `DRAFT`. Esta fase no los modifica. `FAMILY_FREE` permanece activo como base de adquisición.

## Idempotencia

El cliente genera un UUID por intento de checkout y lo envía como `idempotency_key`. En V1 se valida el contrato pero no se persiste porque todavía no existe llamada a proveedor. La fase del adapter deberá persistir/reservar la clave de forma atómica antes de cruzar la frontera externa.

## Seguridad adicional

- El origen web de la petición debe figurar en `IQB_APP_ALLOWED_REQUEST_ORIGINS`; no se usa CORS wildcard.
- Return URLs sólo aceptan orígenes de una allowlist server-only distinta, evitando open redirects.
- Un plan publicado accidentalmente no es suficiente: también debe estar en la allowlist del servidor.
- La Edge Function no contiene llamadas externas de billing en V1.
- No hay mutaciones de suscripciones, overrides o entitlements en V1.
- Pagar no equivale a consentimiento ni amplía permisos sobre datos sensibles.

## QA permanente

`tests/family-billing-boundary-contract.mjs` garantiza que:

- el cliente está desactivado por defecto;
- con el gate cerrado ni siquiera invoca backend;
- la petición usa Edge Function e idempotencia;
- existen gates de readiness independientes en servidor;
- se valida allowlist de request Origin, autenticación, rol de billing, plan y return URL;
- no existe CORS wildcard;
- no existe escritura sobre suscripciones/entitlements;
- no existe llamada a proveedor externo;
- el adapter de proveedor sigue explícitamente no implementado.

`.github/workflows/family-billing-boundary.yml` ejecuta además `deno check` sobre el grafo de la Edge Function.

## Siguiente fase cuando proceda

1. elegir proveedor según costes, fiscalidad UE, facturación recurrente, webhooks, Apple/Google si se encapsula como app y portabilidad;
2. implementar adapter aislado `BillingProvider`;
3. añadir ledger de checkout/idempotencia y webhook events;
4. verificar firmas y replay protection;
5. mapear eventos confirmados a `saas_subscriptions`;
6. mantener planes de pago `DRAFT` y gates `false` hasta validación end-to-end en sandbox;
7. sólo después habilitar un piloto cerrado.
