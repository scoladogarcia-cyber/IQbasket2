# Egress audit – IQBasket – 2026-09-01

## Context

Supabase Free reported **10.07 GB of egress** in the previous billing cycle while the database size was only about **0.056 GB**.

The second Supabase project in the organization was inactive, so IQBasket is the relevant source of traffic.

## Root causes found in code

The main issue was not database size but the read pattern:

1. `DataStore.init()` downloaded complete tables and filtered in the browser:
   - clubs
   - teams
   - players
   - games
   - seasons
   - player_game_stats
   - game_period_scores
   - game_events

2. `TranslationStore.initAllTranslations()` downloaded the entire translations table for all languages.

3. Team/season changes forced full reloads.

4. `games.events` is a JSONB payload that can become large and duplicated information already stored in `game_events`.

5. Some statistics audit/import services were reading global tables instead of scoping by team/game.

## Phase 0 changes already applied

- Players, games and legacy seasons are now queried by active team.
- Player stats and period scores are fetched only for visible game IDs.
- `game_events` is no longer preloaded at bootstrap.
- Heatmap and game editor lazy-load events only when required.
- `games.events` is excluded from bootstrap queries.
- Translation runtime loads only the active language.
- Translation cache has a TTL to avoid repeated remote sync.
- Admin translation reads are filtered server-side by language.
- User profile queries request only required columns.
- Statistics audit is scoped to the selected team/game set where possible.
- Statistics import/audit writes have been aligned with the **real audited Supabase columns**, avoiding writes to non-existent fields.

## Remaining optimization work

- Replace the remaining broad `select("*")` calls where payload size matters.
- Server-side pagination/search for the global player market.
- Introduce query repositories so views do not talk directly to Supabase.
- Add explicit cache invalidation and data revision metadata.
- Add database indexes for future v3 scope:
  - team_seasons
  - roster_memberships
  - user/team/season memberships
  - analytics aggregates
- Add monitoring/telemetry for request count and payload size.

## Performance rule

The browser must never download global data simply to filter it locally.

Preferred pattern:

```
Authenticated user
  -> authorized resource scope
  -> active team + season
  -> server-side filtered query
  -> compact result
  -> local cache
  -> view
```

Granular data such as events, play-by-play, heatmaps and lineups must be lazy-loaded.

## Storage vs egress

Persisting calculated metrics is desirable. Numeric aggregates are cheap to store compared with repeatedly transferring raw events and recalculating them on every screen.

Source data remains authoritative. Calculated data must be reproducible and versioned.
