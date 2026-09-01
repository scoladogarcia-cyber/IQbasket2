# IQBasket pre-v3 integrity baseline

Date: 2026-09-01

This file records the integrity fingerprints captured manually from the real
Supabase database immediately before the v3 migration work.

These values are the reference baseline. After any committed migration, the
same read-only fingerprint query must be executed again and the source tables
must match unless a change was explicitly planned and approved.

## Source-table fingerprints

| Table | Rows | Fingerprint |
|---|---:|---|
| game_events | 36 | `0608decbdc4e76c8df7ee6bc71f023b9` |
| game_period_scores | 56 | `a51983041a4b3c3f2cfd15897d2c1d96` |
| games | 14 | `0509f2466e3384725ba1f2a9c5d6b812` |
| player_game_stats | 144 | `5d88744477ebc27d9a1c6efd5d7b6836` |
| players | 17 | `7106619dc7cecf03381105c7f59f0b10` |
| team_game_stats | 12 | `614e1af2c8e68f58bb9f4b1a33ab2690` |
| translations | 2372 | `1fe8697b9f274be2045991c714ae675e` |
| user_profiles | 3 | `aabe1d3bc41b38e6a83c5f8a39961f65` |

## Relationship validation captured with the same baseline

- games: 14
- players: 17
- player_game_stats: 144
- team_game_stats: 12
- game_events: 36
- game_period_scores: 56
- valid_player_stat_links: 144
- valid_event_links: 36

## Rollback rehearsal validation

After the full v3 rehearsal completed with ROLLBACK:

- season_catalog: absent
- team_seasons: absent
- roster_memberships: absent
- games RLS: false (restored)
- players RLS: false (restored)
- games: 14
- players: 17
- player_game_stats: 144
- game_events: 36

Conclusion: the rehearsal transaction was fully rolled back and the observed
source data remained intact.

## Gate

Do not replace any v3 draft ROLLBACK with COMMIT until:

1. an external backup exists;
2. the backup is verified/readable;
3. the production migration has an explicit rollback plan;
4. these baseline fingerprints are saved outside Supabase as well;
5. explicit approval is given.
