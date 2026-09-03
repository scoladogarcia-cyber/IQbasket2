# Player 360 · Phase 4E.2 Nutrition + Recovery

## Objetivo

Habilitar los primeros módulos de apoyo Nutrition + Recovery sobre el sustrato
ABAC 4E.1 ya instalado, sin convertir IQBasket en una aplicación clínica y sin
mezclar hábitos/bienestar con estadísticas deportivas objetivas.

Aunque el catálogo inicial evita datos clínicos, corporales invasivos y texto
libre, estos check-ins se protegen técnicamente como `WELLNESS_RESTRICTED` por
prudencia y para mantener una frontera segura de cara a futuras integraciones.

## Criterios de producto

1. **Minimización de datos**: solo se captura lo necesario para seguimiento
   deportivo.
2. **Estructurado antes que texto libre**: los check-ins se basan en métricas
   configurables; no se almacena texto sensible por defecto.
3. **Sin métricas corporales invasivas por defecto**: peso, grasa corporal,
   calorías, diagnósticos, medicación o síntomas clínicos quedan fuera del
   catálogo inicial.
4. **ABAC obligatorio**: ninguna tabla wellness se podrá leer o escribir solo
   por rol.
5. **Autogestión del jugador**: SELF puede registrar/leer su información para
   `PLAYER_SELF_SERVICE` si existe autorización de tratamiento.
6. **Tutor**: GUARDIAN usa `FAMILY_SUPPORT` y relación verificada.
7. **Staff**: necesita rol compatible + grant explícito + finalidad
   `SPORT_PERFORMANCE` u `OPERATIONS`.
8. **Visibilidad demo/read-only**: `INVITADO` puede descubrir Nutrition/Recovery y
   abrir su shell de producto, pero RBAC no le concede edición y el backend ABAC
   sigue siendo obligatorio para leer cualquier fila wellness personal. Sin una
   autorización contextual válida, la UI muestra únicamente el estado bloqueado
   y no ejecuta consultas de entradas.
9. **IA sensible desactivada en esta fase** aunque 4E.1 ya soporte el atributo
   de autorización.
10. **No causalidad**: los datos wellness podrán correlacionarse más adelante,
   pero nunca etiquetarse automáticamente como causa de rendimiento.

## Estado de despliegue · 2026-09-03

Phase 4E.2 está **instalada en Supabase** y la UI está implementada en la rama
`feature/player360-nutrition-recovery-v1`.

Validación:

- catálogo/validadores/recomendaciones deterministas: PASS;
- SQL structure/minimización: PASS;
- preflight read-only: PASS;
- rehearsal rollback-only: PASS;
- baseline antes/después del rehearsal: `17|23|22|1|1|0|0|0`;
- primer Controlled Apply: schema aplicado, verificador falló por un error
  `boolean = integer`; rollback de emergencia automático: PASS;
- baseline tras rollback: `17|23|22|1|1|0|0|0`;
- segundo Controlled Apply tras corregir solo el verificador: PASS;
- post-apply verifier: PASS;
- installed smoke + rollback de filas sintéticas: PASS;
- baseline post-apply: `17|23|22|1|1|0|0|0`;
- filas instaladas tras smoke: catálogo `9`, entries `0`, observaciones `0`;
- browser smoke desktop 1440×900: PASS;
- browser smoke iPhone 390×844: PASS;
- overflow horizontal: 0;
- importaciones externas: 0;
- llamadas IA: 0;
- Cancelar creación: 0 escrituras;
- Cancelar edición: 0 escrituras adicionales.

La importación de apps/wearables queda para una fase posterior y deberá entrar
como una fuente nueva explícita; el origen manual actual no puede suplantarla.

## Recomendaciones

El valor inmediato del módulo es ayudar a decidir el siguiente paso, no acumular
datos. `WellnessRecommendationEngine` genera apoyos deterministas y explicables
a partir del último check-in.

Las reglas:

- están centralizadas en configuración;
- no son diagnósticos;
- no hacen afirmaciones causales;
- no llaman a un modelo IA;
- no modifican el dato original;
- pueden evolucionar a personalización longitudinal cuando exista evidencia
  suficiente y una frontera de acceso específica.

## Arquitectura

### Catálogo configurable

`player360_wellness_metric_catalog`

Define:

- módulo: `nutrition` / `recovery`;
- código estable;
- nombre y descripción;
- tipo de valor;
- unidad;
- límites/elecciones;
- sensibilidad;
- orden;
- activo/inactivo;
- origen global o específico de equipo-temporada.

La UI renderizará formularios desde este catálogo.

### Check-in

`player360_wellness_entries`

Contenedor auditable:

- jugador;
- equipo-temporada;
- módulo;
- fecha del check-in;
- finalidad;
- fuente;
- usuario que lo registra;
- estado.

No incluye texto libre sensible en 4E.2.

### Observaciones

`player360_wellness_observations`

Valores estructurados asociados al check-in:

- metric_code;
- numeric_value / boolean_value / choice_value;
- unidad;
- calidad;
- procedencia.

Cada fila debe poder transformarse a `PLAYER360_OBSERVATION_V1` para que la
analítica longitudinal no conozca la forma de las tablas wellness.

## Catálogo inicial propuesto

### Recovery

- `SLEEP_DURATION_HOURS` · número;
- `SLEEP_QUALITY` · escala 1–5;
- `FATIGUE` · escala 1–5;
- `MUSCLE_SORENESS` · escala 1–5;
- `READINESS` · escala 1–5.

### Nutrition

- `HYDRATION_ADHERENCE` · escala 1–5;
- `MEAL_REGULARITY` · escala 1–5;
- `PRE_TRAINING_FUELING` · booleano;
- `POST_TRAINING_RECOVERY` · booleano.

Estas métricas son defaults de producto, no columnas ni lógica de UI. Un club
podrá ampliar/desactivar el catálogo sin modificar código.

## Métricas deliberadamente excluidas del default

- peso;
- IMC;
- porcentaje de grasa;
- calorías;
- déficit/superávit energético;
- menstruación;
- medicación;
- diagnóstico;
- síntomas clínicos.

Podrían requerir una fase y política específica, pero no forman parte de este
MVP.

## Permisos

4E.2 activará permisos base de Nutrition/Recovery solo para roles compatibles.
El permiso base **no concede acceso**: siempre se combina con
`iq_v4e_can_access_sensitive_resource(...)`.

No se habilitará acceso para VISOR o INVITADO.

## Secuencia

Los pasos 1–9 están completados. El paso 10 se pospone deliberadamente: no se
incorporarán observaciones wellness al snapshot longitudinal genérico mientras
su lectura no sea ABAC-aware. Hacerlo ahora podría convertir datos protegidos en
evidencia visible mediante permisos de analítica 4D.

Siguiente evolución segura:

1. gestión de autorizaciones/grants desde la app;
2. uso manual real de Nutrition/Recovery;
3. tendencias wellness dentro de una vista protegida;
4. integración con apps externas mediante adaptadores de fuente;
5. solo después, estudiar analítica combinada sin romper la separación de
   sensibilidad.
