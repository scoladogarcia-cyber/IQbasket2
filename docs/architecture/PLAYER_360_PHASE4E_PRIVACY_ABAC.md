# Player 360 · Phase 4E Privacy, Consent & ABAC Foundation

## Objetivo

Crear el sustrato de autorización necesario antes de habilitar módulos con
sensibilidad `WELLNESS_RESTRICTED` (Recovery, Nutrition y Neuro-Cognitive).

4E **no crea tablas de datos wellness** y no activa esos módulos. Separa:

1. relación del usuario con el jugador;
2. autorización documentada para tratar categorías sensibles;
3. grant concreto de acceso por usuario/acción/finalidad;
4. auditoría de cambios de autorización.

## Estado de despliegue · 2026-09-03

Phase 4E.1 está **instalada en Supabase** mediante Controlled Apply.

Evidencia de validación:

- CI de dominio/RBAC/SQL: PASS;
- preflight read-only: PASS;
- rehearsal rollback-only #1: PASS;
- rehearsal rollback-only #2: PASS;
- baseline antes/después de rehearsal:
  `17|14|144|23|22|1|1|0|0|0`;
- apply controlado: PASS;
- verificador post-apply: PASS;
- smoke instalado: PASS;
- rollback de filas sintéticas del smoke: PASS;
- baseline post-apply:
  `17|14|144|23|22|1|1|0|0|0`;
- filas 4E tras smoke:
  `0|0|0|0|0`;
- rollback de emergencia: no necesario.

La instalación crea únicamente recursos de gobierno y helpers ABAC. No contiene
datos wellness reales ni habilita Nutrition, Recovery o Neuro-Cognitive.

## Principios

- RBAC sigue siendo la primera barrera, pero no basta para datos sensibles.
- SUPERADMIN administra la plataforma, pero no obtiene por ello lectura
  automática de `WELLNESS_RESTRICTED`.
- El acceso sensible se evalúa por recurso y contexto.
- La autorización de tratamiento registra atributos de base jurídica/condición
  especial sin asumir que el consentimiento sea la única base posible.
- IA sobre datos restringidos requiere autorización explícita adicional.
- Exportar datos restringidos requiere grant explícito.
- Investigación queda fuera de la política runtime inicial.
- Los datos objetivos, evaluaciones humanas e inferencias IA siguen siendo
  recursos distintos.

## Recursos 4E

### `player360_subject_relationships`

Relación verificable entre una cuenta y un jugador:

- SELF;
- GUARDIAN.

El campo legacy `user_profiles.linked_player_id` puede actuar como fallback
compatible durante la transición, sin convertirse en la fuente única futura.

### `player360_processing_authorizations`

Define para un jugador/equipo-temporada:

- módulos autorizados;
- finalidades;
- código de base jurídica;
- condición aplicable a categoría especial;
- autorización o no para procesamiento mediante IA;
- representante cuando aplique;
- periodo de validez;
- estado y trazabilidad de revocación.

### `player360_sensitive_access_requests`

Solicitud auditable de un miembro del staff. Solicitar no concede acceso.

### `player360_sensitive_access_grants`

Grant explícito para un usuario concreto:

- jugador;
- equipo-temporada;
- módulos;
- acciones;
- finalidades;
- vigencia;
- estado.

### `player360_privacy_audit_log`

Log mínimo y append-only. Registra cambios de autorización/grants y decisiones
relevantes sin copiar el contenido sensible.

## Decisión ABAC

El helper backend `iq_v4e_can_access_sensitive_resource(...)` debe comprobar:

1. sesión autenticada;
2. módulo, acción y finalidad soportados;
3. jugador perteneciente al contexto equipo-temporada;
4. autorización de tratamiento ACTIVE y vigente;
5. relación SELF/GUARDIAN o contexto staff válido;
6. grant explícito cuando corresponda;
7. opt-in específico si la acción es `AI_PROCESS`;
8. grant explícito si la acción es `EXPORT`.

No existe bypass de lectura por SUPERADMIN.

## Permisos de administración

Frontend mantiene acciones independientes:

- VIEW_PRIVACY_AUTHORIZATIONS;
- CREATE_PRIVACY_AUTHORIZATION;
- REVOKE_PRIVACY_AUTHORIZATION;
- VIEW_SENSITIVE_ACCESS_GRANTS;
- REQUEST_SENSITIVE_ACCESS;
- GRANT_SENSITIVE_ACCESS;
- REVOKE_SENSITIVE_ACCESS;
- VIEW_PRIVACY_AUDIT.

ADMIN puede administrar el sustrato. Entrenador, Analista y Preparador Físico
pueden solicitar acceso, no concedérselo a sí mismos.

## Secuencia de despliegue

La secuencia 4E.1 ya se completó:

1. CI del evaluador puro;
2. preflight read-only contra Supabase;
3. rehearsal transaccional con rollback forzado;
4. repetición del rehearsal tras guard de paridad apply/rehearsal;
5. apply/rollback independientes;
6. Controlled Apply;
7. smoke instalado con datos sintéticos y rollback de filas;
8. baseline 4A–4D confirmado sin cambios.

El preflight original esperaba ausencia de objetos 4E y, por tanto, **no debe
reutilizarse ahora como si 4E no estuviera instalada**.

## No incluido todavía

- tablas de nutrición;
- tablas de recovery/sueño;
- neurodatos;
- interfaces de captura wellness;
- generación IA con datos restringidos;
- investigación/pseudonimización;
- eliminación física de registros sensibles.
