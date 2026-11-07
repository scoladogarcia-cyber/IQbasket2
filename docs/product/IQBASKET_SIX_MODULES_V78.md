# IQBasket V78 — Seguridad de identidad, traducciones e informes verificables

## Propósito
Continuar la integración de Pasaporte, Reporting, Importación/Exportación, Idiomas, Familia y Motivación sin reescribir módulos anteriores ni alterar datos históricos.

## Cambios
1. **Pasaporte**: la nueva plantilla de evaluación CSV contiene versión, UUID del jugador y UUID de equipo-temporada en las 69 filas. Al previsualizar comprueba la identidad, la pertenencia temporal indicada y que las puntuaciones históricas de referencia no han cambiado. El validador V73 sigue exigiendo contexto T/JR/P5/VIDEO, dificultad D1–D5, mínimo de observaciones y confianza; no hay escritura directa. CSV V73 anteriores siguen aceptándose con confirmación adicional explícita, por carecer de identidad.
2. **Reporting**: rango Desde/Hasta para las exportaciones de equipo a PDF, Excel, CSV y manifiesto. Se revalidan permisos por partido y se rechazan fechas incorrectas; los filtros no modifican los datos ni afectan la importación. Manifiesto JSON de auditoría: IDs de partidos, revisión de captura si existe, número de filas, puntuaciones conocidas, coherencia entre suma individual y marcador. No incluye nombres ni notas de jugadores.
3. **Importación y exportación**: se mantienen las plantillas de plantilla V74, entrenamientos V75, preflight V76 y puerta transaccional V77 desactivada. La versión V78 evita que evaluaciones CSV de otro jugador o temporada puedan rellenar inadvertidamente un pasaporte distinto.
4. **Idiomas**: buscador paginado del catálogo administrativo ES/CA/EN/FR, valores de atributo HTML escapados, validación de marcadores tanto en CSV importados como en cambios manuales. No se considera completada la internacionalización de todos los componentes legacy.
5. **Familia**: la nueva validación de importación reduce el riesgo de información atribuida al menor equivocado; los espacios familiares siguen leyendo exclusivamente RPC autorizados.
6. **Motivación**: las tres preguntas voluntarias no diagnósticas siguen siendo temporales; al cerrar el panel se limpian los valores. Sin almacenar resultados en Supabase, IA o analítica.

## Límites importantes
- Un CSV no puede sustituir la comprobación de permisos en el backend. Las escrituras de evaluaciones siguen usando el RPC guiado existente y su RBAC/ABAC/RLS.
- Un control de integridad de referencia en frontend detecta cambios conocidos; no es una transacción y debe recargarse inmediatamente antes de guardar. El backend sigue siendo la autoridad.
- La importación masiva de asistencia V77 **sigue desactivada** hasta disponer de copia externa, rehearsal SQL, autorización por recurso y tests de denegación.
- El manifiesto JSON no verifica por sí solo las cifras originales de la federación ni certifica datos históricos: identifica discrepancias observables.
- La validación científica de rúbricas entre entrenadores, conexión FCBQ y persistencia de motivación requieren pasos propios y no se presentan como finalizados.
- No se modifican tablas ni datos productivos en esta entrega.

## Verificación
\`tests/six-modules-v78.mjs\`, \`six-modules-v78.yml\`, regresiones V73–V77 y compilación. Revisar QA de dispositivos reales, accesibilidad y permisos cruzados antes del piloto comercial.
