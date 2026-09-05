# Family / Minor / AI Privacy Readiness

## Objetivo

Este documento fija las invariantes técnicas previas a monetizar IQBasket para familias, especialmente cuando el jugador es menor o se tratan datos sensibles.

## Principios no negociables

1. **Pagar no autoriza datos.** La licencia/entitlement nunca sustituye RBAC, ABAC, relación familiar ni autorización de tratamiento.
2. **La edad informa, no decide la base jurídica.** IQBasket clasifica `MINOR`, `ADULT` o `UNKNOWN`, pero no infiere automáticamente quién debe consentir ni qué base jurídica aplica.
3. **GUARDIAN_CONSENT exige representación verificable.** El backend comprueba una relación `GUARDIAN` activa para el jugador y el representante indicado.
4. **IA requiere opt-in explícito.** `ai_processing_allowed` parte siempre de `false`; autorizar IA no activa Family Pro ni una generación automática.
5. **Revocar vínculo y revocar tratamiento son acciones distintas.** Se controlan mediante `REVOKE_FAMILY_LINK` y `REVOKE_PRIVACY_AUTHORIZATION` respectivamente.
6. **Datos sensibles quedan fuera del pasaporte familiar general.** Nutrition, Recovery, Neuro, RPE, carga interna y notas sensibles siguen su ABAC específico.
7. **Backend como autoridad.** La UI sólo ayuda a comprender y operar; la base de datos valida el perímetro real.

## Estado técnico actual

- Centro de Privacidad responsive con autorización documentada por jugador, módulo y finalidad.
- Relación `GUARDIAN` verificable y revocable de forma independiente.
- Catálogo de autorización alineado con PostgreSQL: `CONSENT`, `GUARDIAN_CONSENT`, `OTHER_DOCUMENTED_BASIS`.
- Aviso de edad y falta de fecha de nacimiento fiable sin inferir consecuencias jurídicas.
- Opt-in de IA desmarcado por defecto y productos Family Pro IA todavía desactivados.

## Gate previo a producción comercial

Antes de activar cobro o IA real deben validarse fuera del código, con asesoramiento jurídico/operativo aplicable al mercado objetivo:

- textos de privacidad y términos para familia/jugador/club;
- edades y mecanismos de consentimiento aplicables por país y tipo de tratamiento;
- base jurídica y condición de categorías especiales para cada módulo;
- conservación, supresión, exportación y respuesta a derechos del interesado;
- contratos de encargado/subencargado y localización de datos;
- DPIA/EIPD cuando proceda por menores, perfilado, salud/rendimiento o IA;
- transparencia sobre finalidad, límites y participación de IA;
- procedimiento de revocación y efecto sobre datos/entitlements históricos;
- trazabilidad de versión de políticas y evidencia aceptada.

## QA mínima permanente

- 320×568, 390×844 y 844×390 sin overflow ni acciones inaccesibles.
- `GUARDIAN_CONSENT` no se guarda sin representante.
- IA nunca aparece preseleccionada.
- Los permisos de relación familiar y autorización permanecen separados.
- Cuenta suspendida/inhabilitada falla cerrada antes de cualquier operación.
