# IQBasket Data Architecture v3 – migration plan

Status: **design / draft – not yet executable**

Date: 2026-09-01

## Safety rule

No destructive migration is allowed until the new model has been created, backfilled, validated and the application has run correctly against it.

The migration sequence is:

1. Create new additive structures.
2. Copy/relate existing data.
3. Validate counts and referential integrity.
4. Adapt application code.
5. Compare old/new results.
6. Enable definitive RLS.
7. Keep legacy structures temporarily.
8. Remove legacy only after explicit validation and approval.

The file `supabase/migrations/20260901_rbac_v2.sql` is deprecated and **must not be executed**.

---

## Audited production-like schema facts

### Identity

`auth.users.id` matches `public.user_profiles.id`.

Current observed users:

- scolado@nechigroup.com – SUPERADMIN
- scoladogarcia@gmail.com – ANALISTA
- test@test.com – INVITADO

`profiles` is a legacy/parallel profile table and currently contains the superadmin with a different UUID.

`team_members.user_id` currently contains the legacy `profiles.id`, while `team_join_requests.user_id` has a foreign key to `user_profiles.id`.

Therefore `user_profiles` is the target authenticated profile table.

### Seasons

Current `seasons` has:

- `id`
- `team_id NOT NULL`
- `name`
- `start_date`
- `end_date`
- `coach_name`

This is incompatible with the desired business model because seasons are global and multiple teams participate in the same season.

### Players

Current `players` stores both identity data and roster-context data:

- permanent identity fields: name, birth date, photo, physical attributes
- contextual fields: team_id, jersey, primary_position, secondary_positions, status, joined_at, season_id

All currently audited player `season_id` values were NULL.

The target is to preserve the existing `players.id` so all historical statistics continue to point to the same player.

### Games and stats

`games` links directly to `team_id` and `season_id`.

Important dependent tables use stable keys:

- player_game_stats -> game_id + player_id
- team_game_stats -> game_id
- game_events -> game_id + optional player_id
- game_period_scores -> game_id
- lineup_game_stats -> game_id
- play_by_play_events -> game_id + optional player_id
- reports -> game_id / player_id / team_id / season_id

This allows a non-destructive migration because game/player identities can remain stable.

### Current row counts at audit time

- clubs: 3
- teams: 2
- seasons: 2
- games: 14
- players: 17
- player_game_stats: 144
- team_game_stats: 12
- game_events: 36
- game_period_scores: 56
- translations: 2372
- user_profiles: 3
- profiles: 1
- team_members: 1

Empty but preserved tables included invitations, join_requests, team_join_requests, reports, player_notes, player_goals, lineup_game_stats and play_by_play_events.

### Security

At audit time only `reports` had RLS enabled.

Several existing policies are permissive (`public ALL true`) and must not be reused as the definitive multiuser security model.

RLS v3 must be based on authenticated `user_profiles` plus resource scope.

---

## Target domain model

```
auth.users
   |
user_profiles
   |
   +-------------------------------+
   |                               |
global security role         contextual memberships
                                   |
club ---- team ---- team_season ---- season
                    |
                    +-- roster_memberships ---- players
                    |
                    +-- games
                    |    +-- player_game_stats
                    |    +-- team_game_stats
                    |    +-- game_events
                    |    +-- game_period_scores
                    |
                    +-- team/season staff & access
```

### Global seasons

A season exists once:

- 2025/2026
- 2026/2027
- 2027/2028

Teams opt into or have data for a season through `team_seasons`.

### Team seasons

Proposed fields:

- id UUID PK
- team_id UUID FK teams
- season_id UUID FK global season catalog
- status
- created_at
- optional legacy_season_id for migration traceability

Unique: `(team_id, season_id)`.

### Roster memberships

Keep `players.id` as permanent player identity.

Proposed `roster_memberships`:

- id
- player_id
- team_season_id
- jersey
- primary_position
- secondary_positions
- status
- joined_at
- left_at
- created_at

A player can therefore move between teams/seasons without duplicating identity or losing statistics.

### User roles and access

Global security role and sporting function are different concepts.

Examples:

Global:
- SUPERADMIN
- ADMIN
- USER

Contextual functions:
- COORDINADOR
- ENTRENADOR
- AYUDANTE
- ANALISTA
- PREPARADOR_FISICO
- JUGADOR
- FAMILIA_TUTOR
- VISOR

A user may hold different functions in different team-seasons.

The design must support future ABAC without replacing the permission service.

---

## Analytics architecture

Raw facts remain the source of truth.

Calculation modules must be pure, independent and reusable:

```
domain/analytics/
  shooting/
  efficiency/
  possessions/
  ratings/
  rebounding/
  playmaking/
  defense/
  lineups/
  heatmap/
  aggregations/
```

Views must not implement formulas directly when a domain calculator exists.

### Persisted calculated data

Target aggregate tables:

- player_season_metrics
- team_season_metrics
- lineup_season_metrics

Per-game derived values can continue to use the existing player/team game statistics tables where appropriate.

Each persisted aggregate must include at least:

- calculation_version
- calculated_at
- source revision/hash or source timestamp marker
- team_season_id
- relevant scope identifier (player/lineup/etc.)

Source data is never overwritten merely because an algorithm changes. A new algorithm version can regenerate aggregates.

---

## Migration strategy

The first v3 migration must be additive.

It must not:

- DROP tables
- DROP columns
- rename existing production columns
- delete rows
- rewrite player IDs
- rewrite game IDs
- remove legacy profile rows
- disable access before replacement RLS is tested

Backfill must use INSERT/SELECT or additive UPDATEs only where the target column is new and validation is available.

Before execution:

1. full external backup;
2. record row counts;
3. record FK integrity checks;
4. record key hashes/snapshots;
5. run on a safe environment first;
6. validate application flows;
7. obtain explicit approval before production execution.

---

## Known legacy items to resolve

- `profiles` vs `user_profiles`
- `team_members.user_id` has no FK and currently points to legacy profile ID
- `join_requests` vs `team_join_requests`
- `teams.coach_name` vs `seasons.coach_name`
- old proposed `staff_assignments`
- old proposed `team_access_requests`
- duplicate score/date/event fields in `games`
- duplicate unique indexes on `player_game_stats(game_id, player_id)`
- permissive/disabled RLS model
- `assigned_team_ids` should eventually be superseded by normalized memberships

These are migration concerns, not reasons to delete data now.
