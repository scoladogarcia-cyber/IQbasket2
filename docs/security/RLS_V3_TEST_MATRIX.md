# IQBasket v3 – RLS security matrix

Status: draft. Do not deploy until the v3 schema/backfill exists and these cases
have been exercised against a rehearsal transaction.

## Principles

1. Authorization is enforced in the database, not only by hidden UI controls.
2. SUPERADMIN is the unique master account.
3. Global security role and contextual sporting function are separate.
4. Player/game/statistical data requires team-season scope.
5. Catalog metadata (clubs, teams, global seasons) may be discoverable to an
   authenticated user so they can request access, but sporting data is not.
6. Security-sensitive writes to user profiles and memberships are RPC/Edge-only.
7. Legacy permissive policies must be removed before enabling final RLS.

## Expected behavior

| Actor / context | Catalog | Team-season sporting data | Games/stats | Roster write | Game write | Delete game | Private player notes | User/access admin |
|---|---|---|---|---|---|---|---|---|
| SUPERADMIN | All | All | All | Yes | Yes | Yes | Yes | All |
| ADMIN / managed scope | Read | Managed scope | Managed scope | Yes | Yes | Yes | Yes | Managed scope |
| COORDINADOR / managed scope | Read | Managed scope | Managed scope | Yes | Yes | Yes | Yes | Managed scope |
| ENTRENADOR | Read | Assigned scope | Assigned scope | Yes | Yes | No | Yes | No |
| AYUDANTE | Read | Assigned scope | Assigned scope | No | Yes | No | No by default | No |
| ANALISTA | Read | Assigned scope | Assigned scope | No | Yes | No | Yes | No |
| PREPARADOR_FISICO | Read | Assigned scope | Read | No | No | No | Yes | No |
| JUGADOR | Read | Assigned scope | Read | No | No | No | Own/link rules only | No |
| FAMILIA_TUTOR | Read | Assigned/link scope | Read | No | No | No | No | No |
| VISOR | Read | Assigned scope | Read | No | No | No | No | No |
| INVITADO | Catalog only | No | No | No | No | No | No | Own access request only |

## Mandatory test cases before COMMIT

- Master account can read every team-season and remains the only SUPERADMIN.
- A user with no memberships cannot read players, games, stats or events.
- A user assigned to Team A cannot read Team B sporting data.
- A coach can edit a game in their assigned team-season but cannot delete it.
- An analyst can record/update game data but cannot manage the roster.
- A physical trainer cannot edit games.
- A player cannot read another team's data.
- A family/tutor can only reach explicitly linked player data and allowed team context.
- An admin can manage only their authorized club/team-season scope.
- A pending access request does not grant access.
- Approving access creates membership and request status atomically.
- Rejecting access never creates membership.
- Anonymous users cannot write any operational table.
- Anonymous users may read translations only.
- Legacy public ALL policies are gone.
- Existing source-table row counts and fingerprints remain unchanged after the
  additive migration.
