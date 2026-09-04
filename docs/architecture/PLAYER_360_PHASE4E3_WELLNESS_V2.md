# Player 360 Phase 4E.3 — Nutrition + Recovery V2

## Objetivo

Evolucionar el MVP manual de Nutrition + Recovery sin convertir IQBasket en una herramienta clínica ni relajar la privacidad existente. La fase añade una señal subjetiva de energía y análisis descriptivo longitudinal 7/28 días sobre los check-ins que el usuario ya puede leer mediante ABAC.

## Decisiones de arquitectura

### 1. Sin duplicar datos ni crear una segunda fuente de verdad

La información personal sigue almacenada exclusivamente en `player360_wellness_entries` + `player360_wellness_observations`. El catálogo sigue en `player360_wellness_metric_catalog`.

La tendencia se calcula en dominio con `WellnessTrendEngine` después de que `WellnessService` haya obtenido las filas mediante los RPC protegidos de Phase 4E.2. No se añaden SELECT directos desde el navegador.

### 2. Seguridad sin atajos

Phase 4E.3 no modifica RBAC, ABAC, RLS ni el override operativo acotado de SUPERADMIN. Si el usuario no puede leer el módulo/jugador/equipo-temporada, tampoco puede ver tendencias derivadas.

No se habilitan `EXPORT`, `AI_PROCESS`, importaciones externas ni texto libre.

### 3. Señal nueva: energía percibida

Se añade `DAILY_ENERGY` como:

- módulo: `recovery`;
- escala estructurada 1–5;
- sensibilidad: `WELLNESS_RESTRICTED`;
- sistema: sí;
- finalidad: apoyo deportivo no clínico.

No representa balance energético, disponibilidad energética clínica ni ingesta calórica.

### 4. Tendencias descriptivas, no causales

`WellnessTrendEngine`:

- ancla las ventanas a la última fecha con datos del contexto seleccionado;
- calcula ventana corta de 7 días y larga de 28 días;
- compara 7 días recientes con los 7 días inmediatamente anteriores;
- calcula medias para NUMBER/SCALE;
- calcula adherencia para BOOLEAN;
- expone `UP`, `DOWN`, `STABLE` o `INSUFFICIENT`;
- nunca califica por sí solo la dirección como buena/mala;
- marca explícitamente `clinical_claim=false` y `causal_claim=false`.

Esta separación es importante porque una subida puede significar cosas distintas según la métrica: por ejemplo, más `READINESS` y más `FATIGUE` no deben interpretarse de la misma forma por una capa genérica.

## Archivos

- `config/player360-wellness.config.js`: contrato V2, métrica `DAILY_ENERGY` y regla de apoyo determinista.
- `domain/player360/WellnessTrendEngine.js`: cálculo puro y testeable de tendencias.
- `views/player360/WellnessSupportPanel.js`: presentación responsive del resumen 7/28 días y mejora de nombres del histórico.
- `tests/player360-phase4e3-wellness-trends.mjs`: contrato, métricas y comportamiento del motor.
- `tests/player360-phase4e3-sql-structure.mjs`: guard de migración aditiva.
- `supabase/ready/20260904_*phase4e3*`: preflight, apply, verify, rollback y post-rollback.
- `supabase/drafts/20260904_rehearse_v4_phase4e3_wellness_v2_rollback.sql`: ensayo transaccional sin persistencia.
- `.github/workflows/player360-phase4e3-wellness-v2.yml`: CI funcional.
- `.github/workflows/player360-phase4e3-controlled-apply.yml`: despliegue DB controlado.

## Impacto de datos

El `apply` esperado añade exactamente **una fila** de catálogo. No cambia entradas ni observaciones existentes. El workflow compara baseline antes y después.

El rollback elimina la métrica si todavía no tiene observaciones. Si ya existe histórico que la referencia, la desactiva en lugar de borrarla para preservar integridad y trazabilidad.

## Fuera de alcance de 4E.3

- peso, IMC, grasa corporal;
- calorías, déficit energético o disponibilidad energética clínica;
- menstruación, medicación, diagnósticos o síntomas clínicos;
- recomendaciones médicas;
- IA externa;
- importación de wearables/apps;
- inferencias causales entre wellness y rendimiento;
- vínculo explícito de un check-in con un entrenamiento/partido concreto.

El vínculo actividad-check-in queda reservado para una fase posterior porque requiere modelar contexto temporal de forma explícita y auditable, no inferirlo únicamente por coincidencia de fecha.
