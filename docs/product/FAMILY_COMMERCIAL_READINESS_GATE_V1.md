# IQBasket Family Commercial Readiness Gate V1

## Objetivo

Evitar que IQBasket active accidentalmente checkout o IA familiar antes de que el producto, la operación y la revisión jurídica estén preparados.

Este gate es una defensa de despliegue adicional. **No concede acceso a datos** y no sustituye RBAC/ABAC, relación familiar, autorización de tratamiento, entitlements, verificación de facturación ni controles backend del proveedor de IA.

## Arquitectura

`entorno de despliegue -> family-commercial-readiness.config -> FamilyCommercialReadinessPolicy -> superficies internas`

La configuración es fail-closed: cualquier variable ausente o distinta de un valor afirmativo reconocido (`1`, `true`, `yes`, `on`) se interpreta como `false`.

## Variables de entorno

- `VITE_IQB_FAMILY_COMMERCIAL_PILOT_ENABLED`
- `VITE_IQB_FAMILY_AI_PILOT_ENABLED`
- `VITE_IQB_FAMILY_PRIVACY_TERMS_APPROVED`
- `VITE_IQB_FAMILY_CONSENT_RULES_APPROVED`
- `VITE_IQB_FAMILY_SPECIAL_CATEGORY_REVIEW_APPROVED`
- `VITE_IQB_FAMILY_RIGHTS_RETENTION_PROCESS_APPROVED`
- `VITE_IQB_FAMILY_PROCESSOR_CONTRACTS_APPROVED`
- `VITE_IQB_FAMILY_DPIA_REVIEWED`
- `VITE_IQB_FAMILY_AI_TRANSPARENCY_APPROVED`
- `VITE_IQB_FAMILY_POLICY_VERSIONING_READY`

No se deben guardar secretos en estas variables `VITE_*`; forman parte del bundle cliente y sólo representan estado de readiness no sensible.

## Readiness de checkout

El checkout sólo puede considerarse preparado cuando:

1. el piloto comercial está habilitado explícitamente;
2. privacidad y términos están aprobados;
3. las reglas de edad/consentimiento del mercado objetivo están validadas;
4. la base jurídica y categorías especiales están revisadas por módulo;
5. existe proceso aprobado de conservación, supresión, exportación y ejercicio de derechos;
6. encargados/subencargados y localización de datos están validados;
7. la EIPD/DPIA ha sido revisada cuando proceda;
8. existe versionado y evidencia de aceptación de políticas;
9. el gate de producto `checkoutEnabled` también está abierto.

## Readiness de IA Family

Además de los requisitos anteriores, requiere:

- piloto IA habilitado explícitamente;
- transparencia/finalidad/límites de IA aprobados;
- productos Family AI marcados comercialmente disponibles;
- generación del proveedor habilitada por su gate específico.

La autorización `ai_processing_allowed` del jugador sigue siendo independiente y debe validarse en backend antes de procesar datos. Pagar nunca equivale a autorizar IA.

## Operación

El panel **Producto y monetización** muestra a SUPERADMIN el estado `READY/BLOCKED` de checkout e IA junto con los bloqueos pendientes. La UI es informativa; no permite cambiar estas variables desde el navegador.

## QA permanente

`tests/family-commercial-readiness-contract.mjs` verifica que:

- los valores por defecto fallan cerrados;
- un solo requisito pendiente bloquea checkout;
- readiness comercial no activa IA;
- IA necesita rollout, transparencia, producto y proveedor;
- los bloqueos son explicables mediante códigos estables.

`tests/business-metrics-ui-smoke.mjs` comprueba además el panel en 320x568 y 390x844 sin overflow y con ambos gates bloqueados por defecto.
