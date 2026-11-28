# IQBasquet · Paquetes por perfil V1

## Decisión de producto
Cuatro líneas de comunicación y captación: Equipos, Entrenadores, Jugadores y Familias. No son roles, ni cuatro bases de datos, ni cuatro aplicaciones. La identidad del jugador es longitudinal; un cambio de club no elimina su historial.

El catálogo se centraliza en `config/commercial-package-catalog.config.js` y se muestra como información interna en Producto y monetización. Las referencias a planes existentes no equivalen a disponibilidad efectiva. El servidor continúa siendo la fuente de verdad de suscripciones y entitlements. No se crean licencias ni se alteran planes o permisos con este cambio.

| Línea | Oferta | Referencia existente | Decisión |
|---|---|---|---|
| Equipos | Esencial / Pro / Club y academia | TEAM_STARTER / TEAM_PRO / CLUB / ACADEMY | B2B por equipo o entidad, borrador |
| Entrenadores | Entrenador Pro | TEAM_PRO / CLUB / ACADEMY | Acceso por licencia de entidad y autorización deportiva; no incluye todo por defecto |
| Entrenadores | Independiente | Ninguna | Requiere modelar comprador y alcance personal antes de habilitarlo |
| Jugadores | Jugador Plus | FAMILY | Pago por desarrollo y pasaporte, normalmente por tutor |
| Jugadores | Inteligencia y acompañamiento | FAMILY_PRO | IA bloqueada hasta piloto, coste y autorizaciones |
| Familias | Acceso incluido | FAMILY_FREE | Mantener plan básico existente |
| Familias | Acompañamiento ampliado | FAMILY / FAMILY_PRO | Misma suscripción, no duplicar cobro con Jugador Plus |

## Módulos y ampliaciones
- Analítica de partido, gestión de entrenamiento, pasaporte, tecnificación y reporting: reutilizar módulos existentes.
- Scouting Pro, biblioteca de vídeos/cursos/guías, productos de tecnificación: líneas de ampliación, sin representar funciones o licencias inexistentes como vendibles.
- IA: unidades por resultado, límites de coste y privacidad; no desbloquear salud ni datos de menores por el mero pago.
- La licencia personal de entrenador requiere revisar el modelo de cuenta y sujeto; no simular un equipo ficticio ni conceder permisos globales.
- Clubes no financian automáticamente acceso premium familiar. Definir beneficiarios explícitos y verificar relaciones deportivas.
- El acceso gratuito existente no se revoca. Los precios, ciclos de pago, proveedor y promociones se fijarán en el catálogo de facturación, no en el código de autorización.

## Activación
Mantener checkout y flags de IA cerrados. Verificar catálogo real, capacidades efectivas por contexto, consentimiento, controles backend, cuotas, soporte, pruebas y piloto antes de publicar planes. La activación comercial y suscripción recurrente quedan fuera de este cambio, sin alterar datos de producción.
