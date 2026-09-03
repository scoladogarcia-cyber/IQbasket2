# Player 360 · Phase 4E.2 Nutrition + Recovery

## Objetivo

Habilitar los primeros módulos `WELLNESS_RESTRICTED` sobre el sustrato ABAC
4E.1 ya instalado, sin convertir IQBasket en una aplicación clínica y sin
mezclar hábitos/bienestar con estadísticas deportivas objetivas.

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
8. **IA sensible desactivada en esta fase** aunque 4E.1 ya soporte el atributo
   de autorización.
9. **No causalidad**: los datos wellness podrán correlacionarse más adelante,
   pero nunca etiquetarse automáticamente como causa de rendimiento.

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
- fecha/hora;
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

1. catálogo y validadores puros;
2. tests de minimización/tipos;
3. diseño SQL + RLS usando 4E.1;
4. preflight;
5. rehearsal rollback-only;
6. controlled apply;
7. servicio mediante RPC;
8. UI responsive;
9. browser smoke desktop/móvil;
10. integración en Player 360 longitudinal sin IA sensible.
