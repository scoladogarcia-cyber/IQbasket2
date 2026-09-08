# V39 · Validación de campo

La automatización evita regresiones conocidas, pero la aceptación definitiva del scorer requiere un partido real.

## Anotador

- El alta de un partido nuevo requiere sólo los datos mínimos y exactamente cinco titulares.
- Tras pulsar `Crear e iniciar partido`, el usuario entra en el scorer con un `gameId` persistido y estado `LIVE`.
- Un partido existente `SCHEDULED/READY` nunca muestra el error de lease como única salida: ofrece una acción clara para iniciar si el usuario tiene permiso.
- Marcador, quinteto y paleta de acciones deben poder consultarse simultáneamente en móvil durante la captura normal.
- Una jugada frecuente debe registrarse en uno o dos toques.
- `Deshacer` debe permitir corregir el último error sin abandonar el flujo.
- Los microcortes de red no deben eliminar el borrador local de captura.

## Seguidor

- El acceso `Marcador / Acta` es siempre read-only.
- El marcador debe reflejar los cambios live con un retraso percibido objetivo inferior a 3 s en condiciones normales.
- El acta acumula el historial completo visible del partido, no sólo las últimas jugadas.
- El play-by-play ordena primero la acción más reciente y muestra periodo, reloj, acción y jugador/rival.
- Un usuario sin `VIEW_BOXSCORE` no debe obtener la vista mediante URL directa.

## Métricas del piloto

Registrar durante un partido completo:

1. jugadas omitidas;
2. toques medios por jugada;
3. número de correcciones/deshacer;
4. tiempo de captura percibido;
5. scroll necesario durante acciones normales;
6. incidencias de conectividad;
7. retraso percibido del Game Center;
8. comprensión del marcador/acta por parte de familiares.
