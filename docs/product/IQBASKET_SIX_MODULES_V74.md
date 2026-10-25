# IQBasket V74 — Passaporte, informes, intercambio, idiomas, familia y motivación

## Alcance integrado
1. **Pasaporte:** exportación CSV independiente de cobertura de los 69 atributos. Diferencia NE, histórico provisional y observaciones documentadas; conserva dificultad D1–D5, sin asignar talento universal. Protegido por EXPORT_PLAYER_PASSPORT.
2. **Reporting:** tres perfiles configurados de PDF, siempre basados en selección de partidos y permisos revisados en cada exportación. "Visual breve", "Seguimiento con evidencia" y "Técnico completo". Reutiliza mapas, gráficos, calidad, glosario y explicaciones existentes.
3. **Intercambio:** CSV exportable de jugadores/plantilla desde un informe autorizado. Importación solo como preview de cambios: IDs exactos, roster completo, tamaño y valores controlados; sin mutar base de datos. CSV federativo añade comprobación de identidad por nombre cuando el roster lo aporta.
4. **Idiomas:** auditoría ES/CA/EN/FR del diccionario estático principal y descarga de CSV con claves que faltan. No confunde fallback automático con traducción disponible. Los strings legacy fuera del diccionario deben migrarse separadamente.
5. **Familia:** interfaz familiar añade un espacio de conversación opcional con el jugador, sin mostrarlo como progreso certificado ni invadir el resumen familiar.
6. **Motivación:** tres preguntas no diagnósticas y voluntarias de disfrute, aprendizaje y expresión; ES/CA/EN/FR. Las respuestas no se guardan, puntúan, transfieren al club o comparten con IA; solo muestran una invitación a conversar y se pierden al abandonar la pantalla.

## Puertas de seguridad y alcance que NO se declara finalizado
- Las plantillas de importación masiva de jugadores, equipos y entrenos necesitarán su propio RPC transaccional, autorización por recurso, validación de referencias y rollback. Una vista previa no equivale a alta/edición masiva.
- No se abre una tabla de motivación de menores ni se reutiliza wellness, para no almacenar perfiles psicológicos sin finalidad, base jurídica, consentimiento pertinente, retención y revisión profesional.
- Los 69 criterios del pasaporte requieren estudio de fiabilidad interevaluador antes de anunciar evaluación científicamente validada.
- El PDF configurable está limitado por perfiles predefinidos; la elección arbitraria de cada gráfico, imagen y variable aún no es un constructor universal.
- Se conserva el límite de los textos legacy no internacionalizados. No se activan IA generativa, checkout, conexión FCBQ ni escrituras directas en Supabase.
- Validación adicional: dispositivos reales, cuentas de familia vinculadas y de staff, permisos en frontend y backend, y regresión de anotación/entrenamientos antes de comercialización.

## Verificación
Workflow \`product-six-modules-v74.yml\`, tests unitarios V74 y baterías de regresión V70–V73 y build. No se alteran datos históricos. Se puede revertir el commit de UI sin tocar el esquema.
