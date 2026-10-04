# IQBasket V58 — Offline Live, Training Intelligence and Benchmarking

## Objective

V58 closes three product gaps without replacing the stable V44 live scorer, V54/V55 training editor or Player360 shell:

1. protect live capture through connectivity loss and safe reconnect;
2. turn training records into usable descriptive intelligence;
3. introduce objective self/team benchmarking and a privacy-safe network benchmark contract.

## 1. Offline Live

### Client boundary

- `LiveScoreHUDViewV58` extends the stable `LiveScoreHUDViewV44`.
- `LiveOfflineStore` persists drafts and an ordered outbox in IndexedDB with localStorage fallback.
- every queued operation has a UUID, base capture revision, complete game snapshot, status and retry metadata.
- reconnect attempts are automatic.
- reopening the scorer restores compatible pending data.
- game finalization is blocked while local operations remain pending or a conflict exists.

### Server boundary

`iq_v58_save_game_capture` adds:

- idempotency by `(game_id, client_operation_id)`;
- optimistic `capture_revision`;
- advisory/row locking;
- existing V28 lease validation and capture persistence;
- fail-closed stale revision conflict.

A device never overwrites a newer remote writer silently.

### Offline app shell

`iqbasket-sw.js` is deliberately network-first:

- navigation and app assets prefer the newest network version;
- cache is only an offline fallback;
- `release.json` is never served from the service-worker cache;
- Supabase/external requests are not intercepted.

This preserves the existing release-freshness protection on iOS.

### Remaining production validation

A full commercial “100%” claim requires field validation on real iOS and Android:

- full match in airplane mode;
- tab/process termination and reopen;
- reconnect;
- handoff/conflicting writer;
- battery/data observations;
- zero lost/duplicated actions.

## 2. Training Intelligence

The stable training CRUD remains `TrainingCompleteEditV54View`. V58 composes a separate analytics panel.

### Current analytics

- sessions and session hours;
- attendance;
- participant minutes;
- RPE;
- accumulated internal load;
- weekly trends;
- V55 focus distribution;
- player exposure to each focus;
- classification coverage;
- explicit list/classifier for unclassified historical sessions.

Historical focus codes are never inferred and persisted automatically. A coach must confirm them.

### Focus semantics

A session tagged `SHOOT_FINISH` for 80 minutes does **not** mean that 80 minutes were exclusively shooting. V58 stores and displays:

> player minutes in a session containing the focus.

Future advanced training allocation can add explicit per-focus minutes without changing this contract.

### Training → performance

Player360 now emits `training.FOCUS_<CODE>_MINUTES` observations and tests descriptive associations against:

- evaluation;
- points;
- eFG%;
- TS%;
- assists;
- turnovers.

Lags: 0, 1, 2 and 4 weeks.

The longitudinal calculator keeps minimum sample/coverage requirements and explicitly states that associations do not demonstrate causality.

## 3. Benchmarking

V58 deliberately starts with objective competition metrics:

- points / 40;
- rebounds / 40;
- assists / 40;
- steals / 40;
- turnover control / 40;
- eFG%;
- TS%;
- 3P%.

### Team benchmark

A percentile is shown only when at least five eligible players meet the metric's sample rules. Shooting metrics also require attempt minimums.

For metrics where lower is better, such as turnovers, the displayed percentile is performance-oriented.

### Self benchmark

The player's eligible season sample is split into earlier and recent halves and displays change without claiming statistical significance.

### Network benchmark

Network data is aggregate-only in `iq_v58_private.benchmark_network_snapshots`.

Reliability policy:

- n < 20: hidden;
- 20–49: provisional;
- 50–99: reasonable;
- >=100: robust.

The public RPC returns only aggregate quantiles after sports-access authorization. It never exposes cohort members.

The current production database does not yet have enough external network cohorts to claim national/regional percentiles. V58 therefore shows no network percentile until a valid aggregate snapshot exists.

## 4. Security

V58 follows the existing IQBasket split:

- RBAC controls functional permission;
- team-season/player scope controls sports access;
- Supabase RPC/RLS remains authoritative;
- private tables are not exposed through the Data API;
- Training focus mutation revalidates `iq_v4_can_manage_training`;
- Network benchmark revalidates `iq_v4_can_view_longitudinal_analytics`;
- all V58 public RPCs explicitly deny `anon`.

## 5. Commercial boundaries

New entitlement codes:

- `TRAINING_ANALYTICS`
- `BENCHMARKING`

Mappings prepared:

- Internal Full: both;
- Club: both;
- Academy: both;
- Family Pro: Benchmarking.

V58 does **not** activate draft plans and does not introduce a new paywall in the UI. The entitlement catalog is ready for the future checkout/subscription activation.

## 6. Main files

### Live
- `services/games/LiveOfflineStore.js`
- `services/games/LiveCaptureSyncService.js`
- `services/games/GameCaptureDelegationService.js`
- `views/LiveScoreHUDViewV58.js`
- `views/LiveScoreHUDViewV38.js`
- `features/offline/OfflineAppShellBootstrap.js`
- `public/iqbasket-sw.js`

### Training
- `domain/player360/TrainingIntelligenceAnalytics.js`
- `views/training/TrainingIntelligencePanelV58.js`
- `services/player360/TrainingIntelligenceService.js`
- `services/player360/Player360ObservationAssembler.js`
- `config/player360-analytics.config.js`

### Benchmark
- `domain/stats/BenchmarkEngine.js`
- `services/player360/BenchmarkService.js`
- `views/player360/Player360BenchmarkPanelV58.js`
- `views/Player360View.js`

### Database / SaaS
- `20261004211500_live_offline_training_benchmark_v58.sql`
- `20261004213000_v58_benchmark_authorization_hotfix.sql`
- `20261004214500_v58_commercial_entitlements.sql`

## 7. Definition of done for V58

V58 is code-complete only when:

- V58 contract workflow passes;
- V38/V44 live regressions pass;
- V54/V55 training regressions pass;
- Player360/report regressions pass;
- production build passes;
- Supabase migrations and security verification pass.

Field validation remains a separate production-readiness gate for claiming offline capture as fully proven in live competition.
