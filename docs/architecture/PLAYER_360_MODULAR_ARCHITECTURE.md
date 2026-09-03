# IQBasket — Player 360 / Development Intelligence

## Estado

Diseño arquitectónico. **No desplegado todavía.**  
No modifica tablas existentes ni activa RLS.

## Objetivo

Añadir una capa longitudinal de desarrollo del jugador sin acoplarla al núcleo actual de partidos, estadísticas y roster.

Principio rector:

> cada nueva fuente de información entra por un módulo independiente y se relaciona con PLAYER + TEAM_SEASON mediante identificadores estables.

Esto permite incorporar posteriormente NeuroMap, wearables, apps de salud, tecnificación externa, nutrición, recuperación u otras fuentes sin rehacer IQBasket.

---

## 1. Módulos funcionales

### A. Training Core

Responsabilidad:
- sesiones de entrenamiento del club;
- bloques dentro de una sesión;
- tipo de trabajo;
- duración;
- intensidad;
- objetivo;
- participación individual.

Entidades previstas:
- TrainingSession
- TrainingBlock
- TrainingParticipant
- TrainingTypeCatalog

Tipos configurables, no hardcodeados:
- físico;
- técnico;
- táctico;
- estratégico;
- cognitivo;
- tiro;
- finalización;
- manejo;
- defensa;
- juego colectivo;
- recuperación;
- otros definidos por club.

### B. External Development

Responsabilidad:
- tecnificación individual externa;
- academias;
- entrenador personal;
- preparador físico externo;
- sesiones complementarias.

Debe registrar procedencia y autoría del dato para evitar atribuir al entrenamiento del club una evolución que pueda proceder de trabajo externo.

### C. Recovery

Preparado desde el inicio aunque el MVP pueda no utilizar todos los campos:
- sueño;
- hidratación;
- fatiga percibida;
- recuperación;
- RPE;
- carga interna;
- disponibilidad.

No almacenar información clínica sensible sin base jurídica, permisos específicos y diseño de privacidad separado.

### D. Nutrition

Módulo independiente y opcional:
- hábitos o indicadores autorizados;
- objetivos;
- adherencia;
- procedencia del dato.

No mezclar nutrición con el perfil deportivo general si el usuario no tiene autorización específica.

### E. Neuro / Cognitive Connectors

Puerto de integración para:
- NeuroMap;
- tests cognitivos;
- EEG;
- futuras apps o sensores.

IQBasket no debe conocer el proveedor. Cada sistema externo implementará un conector al modelo normalizado.

### F. Player Evaluation

Valoración humana histórica:
- entrenador;
- jugador;
- tecnificador;
- otros evaluadores autorizados.

Debe registrar:
- evaluador;
- fecha;
- dimensión;
- escala;
- comentario;
- contexto;
- versión del modelo de evaluación.

La valoración subjetiva nunca debe mezclarse con la puntuación objetiva calculada.

### G. Objective Performance Profile

Araña / perfil calculado exclusivamente con datos observados.

Ejemplos de dimensiones:
- finalización;
- tiro exterior;
- creación;
- control de pérdidas;
- rebote;
- impacto ofensivo;
- impacto defensivo;
- consistencia.

Cada dimensión debe exponer:
- fórmula;
- muestra;
- periodo;
- datos utilizados;
- datos ausentes;
- nivel de confianza.

### H. Data Coverage Engine

Responsabilidad:
- saber qué datos existen;
- detectar qué datos faltan;
- calcular cobertura por dimensión;
- explicar cuánto limita cada ausencia el análisis;
- recomendar qué medir a continuación.

Ejemplo conceptual:

- Competición: 95 %
- Entrenamiento: 80 %
- Cognitivo: 20 %
- Recuperación: 10 %
- Nutrición: 0 %

Un 0 % significa **ausencia de información**, nunca peor rendimiento.

### I. Analytics Engine

Capa determinista.

Calcula:
- tendencias;
- ventanas 7/14/28 días;
- evolución;
- variabilidad;
- percentiles;
- carga;
- correlaciones;
- desfases temporales;
- anomalías;
- calidad de datos.

No debe usar IA para fabricar métricas.

### J. AI Insight Engine

Capa explicativa posterior al Analytics Engine.

Entrada:
- hechos calculados;
- contexto;
- cobertura;
- calidad;
- permisos;
- audiencia.

Salida:
- observaciones;
- oportunidades;
- riesgos;
- hipótesis;
- preguntas abiertas;
- datos que faltan;
- recomendaciones de medición.

Nunca presentar asociación como causalidad demostrada.

Toda conclusión debe poder incluir:
- evidencia utilizada;
- tamaño de muestra;
- confianza;
- limitaciones;
- datos ausentes.

### K. Audience Renderer

Mismo hecho, explicación distinta según audiencia.

Audiencias:
- entrenador;
- dirección deportiva;
- jugador;
- familia/tutor;
- analista.

Ejemplo:

**Entrenador**
- lenguaje técnico;
- métricas;
- hipótesis tácticas;
- alertas.

**Jugador**
- lenguaje accionable;
- objetivos;
- progreso.

**Familia**
- explicación sencilla;
- sin notas privadas;
- sin información clínica o interna no autorizada.

---

## 2. Modelo conceptual

```
PLAYER
  |
  +-- ROSTER_MEMBERSHIP -------- TEAM_SEASON
  |
  +-- TRAINING_PARTICIPATION
  |       |
  |       +-- TRAINING_SESSION
  |               |
  |               +-- TRAINING_BLOCK
  |
  +-- EXTERNAL_TRAINING
  |
  +-- RECOVERY_OBSERVATIONS
  |
  +-- NUTRITION_OBSERVATIONS
  |
  +-- PLAYER_EVALUATIONS
  |
  +-- EXTERNAL_MEASUREMENTS
  |       |
  |       +-- source = NeuroMap / wearable / app / sensor
  |
  +-- GAME_STATS
  |
  +-- PLAYER_ANALYTICS
          |
          +-- DATA_COVERAGE
          +-- OBJECTIVE_PROFILE
          +-- AI_INSIGHTS
```

---

## 3. Contrato común de datos

Toda observación futura debería poder responder:

- player_id
- team_season_id cuando aplique
- occurred_at
- source_type
- source_id
- metric_code
- value
- unit
- quality
- confidence
- provenance
- captured_by
- created_at
- metadata

Esto permite integrar fuentes heterogéneas sin crear dependencias entre módulos.

---

## 4. Provenance y calidad

Cada dato debe declarar procedencia:

- GAME_SYSTEM
- CLUB_COACH
- PLAYER_SELF_REPORT
- FAMILY_REPORT
- EXTERNAL_COACH
- NEUROMAP
- WEARABLE
- HEALTH_APP
- SENSOR
- IMPORT
- OTHER

Y calidad/confianza separadas.

Ejemplo:
- dato objetivo de partido: alta procedencia;
- sueño autoinformado: válido, pero autoinformado;
- estimación IA: nunca se almacena como medición objetiva.

---

## 5. Seguridad

RBAC actual debe evolucionar a ABAC por recurso y contexto.

Permisos futuros independientes:
- VIEW_TRAINING
- CREATE_TRAINING
- EDIT_TRAINING
- VIEW_PLAYER_DEVELOPMENT
- VIEW_PRIVATE_EVALUATIONS
- CREATE_PLAYER_EVALUATION
- VIEW_RECOVERY
- EDIT_RECOVERY
- VIEW_NUTRITION
- EDIT_NUTRITION
- VIEW_NEURO_DATA
- VIEW_AI_INSIGHTS
- GENERATE_AI_INSIGHTS
- EXPORT_PLAYER_360

Restricciones adicionales:
- menor de edad;
- relación tutor-jugador;
- equipo-temporada;
- autor;
- categoría de dato;
- sensibilidad.

La UI nunca sustituye la validación backend/RLS.

---

## 6. UX prevista

### Entrenador
Nueva área:
- Entrenamientos
- Crear sesión
- Asistencia
- Bloques
- Carga
- Evaluación

### Jugador
Nueva área:
- Mi desarrollo
- Entrenamientos realizados
- Evolución
- Objetivos
- recuperación autorizada
- recomendaciones

### Player 360
Pestañas:
1. Resumen
2. Competición
3. Entrenamiento
4. Tecnificación externa
5. Evolución
6. Evaluación humana
7. Perfil objetivo
8. Recuperación
9. Nutrición
10. Cognitivo / Neuro
11. Cobertura de datos
12. Insights

Las pestañas sin datos deben mostrar:
- dato todavía no disponible;
- utilidad de incorporarlo;
- prioridad recomendada;
- cómo obtenerlo.

---

## 7. Principio de análisis explicable

Cada pantalla de datos podrá incorporar un panel:

### Qué sabemos
Hechos calculados directamente.

### Qué parece estar ocurriendo
Hipótesis con nivel de confianza.

### Oportunidades
Aspectos con margen de mejora.

### Riesgos
Patrones que merecen observación.

### Qué falta
Datos ausentes que limitan el análisis.

### Qué convendría medir
Prioridad y motivo.

La IA redacta; el motor analítico calcula.

---

## 8. Estrategia de implementación

### Etapa 0
Estabilizar v3 actual y RLS.

### Etapa 1
Training Core + External Development.

### Etapa 2
Player Evaluation + Objective Performance Profile.

### Etapa 3
Data Coverage Engine.

### Etapa 4
Analytics longitudinal entrenamiento ↔ competición.

### Etapa 5
AI Insight Engine + Audience Renderer.

### Etapa 6
Recovery + Nutrition.

### Etapa 7
Connectors: NeuroMap, wearables y otras apps.

---

## 9. Regla de no impacto

Ninguno de estos módulos debe:
- modificar el significado de `players`;
- modificar el significado de `games`;
- introducir datos de entrenamiento dentro de tablas de partidos;
- depender de un proveedor externo concreto;
- exigir que todos los usuarios tengan todos los módulos activos.

Cada módulo se puede activar, evolucionar o sustituir de forma independiente.
