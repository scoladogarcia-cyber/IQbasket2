# Privacy Center V1 — diseño funcional y técnico

## Objetivo

Convertir la capa RBAC + ABAC de Player 360 en una experiencia administrable y auditable sin conceder acceso directo a las tablas sensibles.

## Principios

- **RPC-only**: la UI nunca consulta ni modifica directamente las tablas `player360_*` de gobierno.
- **Mínimo privilegio**: la ruta requiere permiso de lectura de privacidad; cada mutación exige además su permiso funcional y la validación contextual del backend.
- **Scope obligatorio**: toda consulta y mutación se limita a un `team_season_id` autorizado.
- **Separación de responsabilidades**: View → Service → RPC → tablas/RLS.
- **Sin bypass de datos sensibles**: administrar autorizaciones no concede automáticamente acceso a datos de Nutrition/Recovery/Neuro.
- **Auditoría**: las mutaciones siguen usando los RPC 4E existentes, que registran eventos de privacidad.

## UX V1

Ruta independiente `#/privacy`, fuera de la navegación principal de cinco botones móviles.

Pestañas:

1. **Resumen**: estado de autorizaciones, grants, solicitudes y relaciones por jugador.
2. **Autorizaciones**: base de tratamiento, módulos, finalidades, vigencia, IA y representante.
3. **Accesos**: grants explícitos a usuarios con módulos/acciones/finalidades y vigencia.
4. **Solicitudes**: solicitudes de acceso sensible y estado de revisión.
5. **Auditoría**: eventos recientes con actor, jugador, acción, decisión y motivo.

## Permisos frontend

- `VIEW_PRIVACY_AUTHORIZATIONS`: abrir el centro y consultar resumen/autorizaciones.
- `CREATE_PRIVACY_AUTHORIZATION`: registrar autorización/relación.
- `REVOKE_PRIVACY_AUTHORIZATION`: revocar autorización/relación.
- `VIEW_SENSITIVE_ACCESS_GRANTS`: consultar grants y solicitudes.
- `GRANT_SENSITIVE_ACCESS`: conceder acceso mediante RPC controlado.
- `REVOKE_SENSITIVE_ACCESS`: revocar grant.
- `VIEW_PRIVACY_AUDIT`: consultar auditoría.

La visibilidad de botones es UX; la seguridad real permanece en RPC/DB.

## Backend V1

Se añaden únicamente RPC de lectura. No se crean nuevas tablas ni se concede `SELECT` directo a `authenticated`.

- `iq_v4f_privacy_center_snapshot(team_season_id, player_id?)`
- `iq_v4f_list_privacy_authorizations(team_season_id, player_id?)`
- `iq_v4f_list_sensitive_access(team_season_id, player_id?)`
- `iq_v4f_list_privacy_audit(team_season_id, player_id?, limit)`

Cada función:

1. exige sesión autenticada;
2. exige `iq_v4e_can_admin_privacy(team_season_id)`;
3. valida que el jugador, si se aporta, pertenezca a la temporada;
4. devuelve sólo los campos necesarios para gestión;
5. usa `SECURITY DEFINER` y `set search_path=''`;
6. se concede sólo a `authenticated`.

## Mutaciones

Se reutilizan los RPC 4E existentes:

- `iq_v4e_record_subject_relationship`
- `iq_v4e_revoke_subject_relationship`
- `iq_v4e_record_processing_authorization`
- `iq_v4e_revoke_processing_authorization`
- `iq_v4e_grant_sensitive_access`
- `iq_v4e_revoke_sensitive_access_grant`

Las solicitudes del staff continúan usando `iq_v4e_request_sensitive_access`; el Centro V1 las visualiza y permite convertirlas en grant sólo mediante el RPC existente y sus reglas.

## Evolución

La V1 queda preparada para ABAC más fino por recurso, licenciamiento SaaS por módulo, retención configurable, exportación auditada y portal de jugador/tutor sin acoplar estas futuras capacidades a la UI administrativa.
