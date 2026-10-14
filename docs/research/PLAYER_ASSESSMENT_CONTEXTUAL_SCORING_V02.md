# IQBasket Player Assessment — versión 0.2 (propuesta de decisión)

## Problema: cinco mini ≠ cinco junior
Nunca guardar una nota 1–5 sin su rúbrica, protocolo, condiciones, etapa y versión. El porcentaje de mejora no puede deducirse comparando notas crudas entre etapas.

## Tres ejes independientes
1. **Dominio longitudinal** por atributo: progreso en una escalera de protocolos acumulativos y versionados, con evidencias explícitas. Ejemplo: B1 = control básico en movimiento, B2 = oposición moderada, B3 = oposición activa y cambio de ritmo, B4 = lectura contextual; son identificadores propuestos, no etiquetas FIBA.
2. **Valoración contextual de 1–5** dentro del protocolo seleccionado. Cada punto requiere un descriptor observable y unos criterios de intentos/error/éxito medibles (a fijar y validar).
3. **Contexto**: fecha nacimiento y edad exacta; temporada/categoría según federación y reglamento; nivel competitivo; años practicando; protocolo; condiciones; oposición; instrumento, balón y altura de aro cuando afecten al resultado; evaluador y evidencia.

## Reglas longitudinales
- Mini B1 5/5 y cadete B3 3/5 implica progreso en exigencia pese a menor nota relativa: no convertir en deterioro.
- Una competencia de nivel superior requiere superar protocolos ancla de mayor dificultad, no promocionar automáticamente por edad.
- La etapa preferente para UI se sugiere por edad y nivel, pero el entrenador puede elegir protocolo de nivel inferior/superior con justificación.
- No normalizar históricamente por categoría si falta un benchmark fiable. Datos de percentiles solo tras muestras representativas estratificadas (edad, sexo/categoría cuando proceda, nivel competitivo, maduración según fiabilidad).
- Los resultados físicos de adolescentes deben interpretar edad relativa/maduración sin estigmatizar ni extrapolar talento profesional.

## Mecanismo de homogeneidad
Para cada atributo y versión: propósito, situación, distancias/tiempos/repeticiones, oposición, condiciones, métricas, regla de errores, tabla de nivel 1-5 y ejemplos audiovisuales. Cuando existe resultado numérico objetivo, calcular nivel automáticamente en el servidor; si es observacional, anclajes conductuales y evaluador calibrado.

## Datos mínimos
`skill_id, rubric_version, protocol_id, difficulty_tier, score_1_to_5, observed_result, evidence_source, evaluator_id, evaluated_at, competition_level, age_at_assessment, confidence, notes`. Nunca sustituir histórico al cambiar de club o de categoría.

## Validación requerida
Pilotos por categorías con evaluadores independientes, kappa ponderado/ICC apropiado al resultado, repetición test-retest, sensibilidad al cambio, equidad por edades relativas y contexto. Umbrales 1-5 solo tras validar, evitando falsa precisión.

## Bibliografía de partida
- USA Basketball (2025), *Player Development Curriculum*, enfoque por nivel de dominio, no edad rígida. https://www.usab.com/news/2025/10/usa-basketball-coaching-guidebook-player-development-curriculum
- FIBA/WABC Coaches Manual, capítulos Mini Basket y desarrollo. https://about.fiba.basketball/es/wabc-documents
- Relative Age Effect in basketball, systematic review: https://pmc.ncbi.nlm.nih.gov/articles/PMC7699389/
- Basketball talent identification systematic review: https://pmc.ncbi.nlm.nih.gov/articles/PMC10686286/
