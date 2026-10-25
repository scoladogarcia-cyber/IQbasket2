# V75 · Cierre incremental de seis módulos

## Novedades
- **Pasaporte:** CSV con 69 rúbricas y variaciones ordinales **solo** entre observaciones documentadas en fechas diferentes, misma dificultad D1–D5, protocolo/rúbrica y contexto. Si no hay referencia comparable figura SIN_BASE_EQUIVALENTE; si faltan evidencias, PROVISIONAL o NE. No se prueba causalidad, ni se calculan OVR ni valoraciones de talento.
- **Reporting:** perfiles V74 ampliados con cuatro casillas para incluir/excluir resumen gráfico, conclusiones descriptivas, calidad y glosario. Los datos siguen releyéndose con permisos por partido; no se envían a terceros.
- **Intercambio:** asistencias de entrenamientos del **equipo-temporada activo** a CSV editable, incluyendo sesiones sin asistentes. La revisión posterior verifica todos los IDs de sesión/jugador, estado y minutos, distingue N/D y rechaza omisiones, duplicados y cambios de contexto. **Nunca escribe en Supabase**: para aplicar cambios se utiliza el editor autorizado. Las temporadas ajenas del historial accesible no se exportan por accidente.
- **Idiomas:** al importar paquetes CSV se comprueba que conservan todos los marcadores {player}, {team} y similares presentes en la clave de referencia española; evita roturas de textos interpolados por una traducción.
- **Familia y motivación:** mantienen V74, panel optativo, multilingüe, no diagnóstico y no persistido; las decisiones privadas no alimentan rankings de jugadores, actas ni IA.

## Pendiente de comercialización
- Importación **escribible** por lotes de sesiones/jugadores/equipos necesita API/RPC transaccional, preview con snapshot/revisión y autorizaciones RBAC/ABAC/RLS por recurso. No habilitar simple upsert masivo.
- El cuestionario de motivación es una conversación voluntaria, no una escala psicológica validada. Para almacenar respuestas de menores se requieren evaluación de finalidad, derechos, retención y consentimiento aplicable.
- Diferentes entrenadores deben calibrar conjuntamente las rúbricas del pasaporte antes de anunciar una escala interevaluador validada.
- No hay integración oficial federativa ni generación IA activas en esta entrega.
- Auditar producción y probar con usuarios reales en móviles/tablets antes del piloto pagado.

## Verificación
\`tests/six-modules-v75.mjs\` y workflow \`six-modules-v75.yml\` comprueban identidad y datos ausentes, comparabilidad, permisos frontend, validaciones i18n, regresiones V65/V70–V74 y build. No se aplican migraciones ni se alteran registros.
