# V53 · Informes visuales y BoxScore reutilizable

## Alcance

- En **Informes → Partido** se pueden seleccionar uno o varios partidos autorizados y obtener un resumen infográfico basado exclusivamente en sus marcadores y actas guardadas. El documento completo sitúa este resumen antes del BoxScore, comparativas y mapas. En el dossier de temporada también aparece un resumen agregado de los partidos exportados. Los textos son observaciones descriptivas, sin afirmar causas; N/D no equivale a cero.
- En **Informes → Jugador**, los eventos espaciales se consultan de nuevo por `game_id` de la selección autorizada, se reducen a sus `player_id` y se representan al reutilizar la ficha para pantalla y PDF. Sin coordenadas válidas aparece un aviso explícito.
- Exportación BoxScore: CSV UTF-8 RFC4180 y Excel XML Spreadsheet 2003 `.xls` generado por IQBasket, sin dependencia de proveedores. Incluye identificadores de partido, equipo-temporada y jugador, minutos, puntos y desglose de tiro y acciones. Un archivo puede contener varios partidos.

## Importación controlada

- Se acepta `.csv` o `.xls` **solo Excel XML 2003 exportado por IQBasket**. Excel binario legado y `.xlsx` externos se convierten antes a CSV UTF-8. Excel puede advertir de compatibilidad por usar el formato XML 2003 con extensión `.xls`.
- Se importa **un partido a la vez** y únicamente una plantilla completa que corresponda exactamente a los jugadores ya presentes en su acta. Se comprueban identidad y temporada, elegibilidad, enteros no negativos, aciertos <= intentos, puntos derivados, suma de puntos = marcador, ausencia de duplicados y permisos de `EDIT_BOXSCORE` y `EDIT_GAME`.
- El partido y temporada deben estar abiertos y el partido no puede contener eventos play-by-play: los partidos de captura en vivo se modifican desde la edición de jugadas para evitar desincronización. Vista previa explícita y segunda confirmación, comprobación de versión de acta antes del guardado y `upsert` de las filas en una única petición bajo RLS/triggers. No modifica resultados, parciales, eventos, plantilla ni el histórico `players.ppg`.
- La comprobación de versión es optimista; RLS y triggers del backend siguen siendo la autoridad para carreras de escritura o bloqueos de última hora. Para un bloqueo transaccional más fuerte entre la última lectura y el guardado haría falta una RPC versionada en una evolución posterior.

## Módulos

`SelectedGamesOverviewV53.js` resume y dibuja KPIs y SVG autocontenidos. `BoxScoreExchangeV53.js` serializa, parsea y valida; `ReportsViewV53.js` conecta lectura autorizada, selección, mapa y descargas/importación. Las vistas V50 y el renderer V49 siguen proporcionando el acta y mapas detallados. `selected-reports-v53.mjs` y su workflow documentan regresiones.

No se requieren migraciones ni se escribe en la base de datos durante el despliegue.