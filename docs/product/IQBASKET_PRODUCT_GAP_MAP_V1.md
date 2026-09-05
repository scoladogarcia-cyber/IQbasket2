# IQBasket Product Gap Map V1

## Purpose

This document turns external expert/client feedback into an implementation decision map for IQBasket. It does **not** replace the existing product architecture. It classifies each proposal against the current repository and identifies what should be preserved, improved, deferred or rejected.

Source feedback reviewed:
- Athlete360 PRD / software architecture specification.
- Athlete360 enterprise product/engineering specification.
- Athlete360 business/product/family strategy specification.

The governing product principle remains: **IQBasket should become the longitudinal operating system for player development, not only a match-statistics application.**

## Status legend

- **DONE**: product/architecture exists and should be preserved.
- **PARTIAL**: foundation exists, but the user or operational loop is incomplete.
- **GAP**: meaningful product capability is absent.
- **FUTURE**: strategically useful, but not justified before higher-value gaps are closed.
- **REJECT**: should not be adopted in the proposed form because of product, safety, privacy or architectural concerns.

## Executive decision

External feedback strongly validates four IQBasket value pillars:

1. **Match Experience** — extremely low-friction capture, undo, live lifecycle, safe handoff and offline resilience.
2. **Daily Athlete** — short, privacy-first wellbeing/recovery capture rather than dense forms.
3. **Player Development Loop** — Player360 -> insight -> objective -> weekly action -> training/technification -> measurement.
4. **Family Value** — longitudinal history, understandable evolution, next-step guidance and recurring development value.

IQBasket already has substantial foundations in Player360, Family, training, technification, wellness privacy, game lifecycle, entitlements and AI boundaries. Therefore the correct strategy is **incremental product convergence**, not a rewrite around Flutter/Go/Kafka/Redis/TimescaleDB.

---

# 1. Product gap matrix

| Capability | Current IQBasket status | Decision | Priority |
|---|---|---|---|
| Longitudinal player identity across seasons/teams | DONE | Preserve as core moat | P0 |
| Player360 integrated view | DONE/PARTIAL | Improve interpretation/action loop | P0 |
| Family workspace and passport | DONE/PARTIAL | Continue pilot validation | P0 |
| Goals + development plan | DONE/PARTIAL | Turn into measurable weekly loop | P0 |
| Technification connection | DONE/PARTIAL | Connect actions to evidence and outcomes | P0 |
| Training sessions + attendance/load | DONE | Refine UX and analytics | P1 |
| Nutrition/recovery catalog | DONE | Preserve configurable model | P1 |
| Wellness/recovery express check-in <=30s | PARTIAL | Add athlete-first micro-flow | P1 |
| Fast match capture <=2 interactions for common actions | PARTIAL | Redesign/measure match capture UX | P0 |
| Universal visible Undo | DONE/PARTIAL | Make dominant in live mode | P0 |
| Game single source of truth | DONE | Preserve | P0 |
| Historical game locking | DONE | Preserve | P0 |
| Live scorekeeper exclusive lease | GAP | Add safe live-write lease | P1 |
| Scorekeeper handoff | GAP | Add controlled handoff, QR later if useful | P1 |
| Offline event outbox | GAP | Implement incrementally | P1 |
| Full native offline stack | FUTURE | Only if PWA/browser model proves insufficient | P3 |
| Competition/category rule packs | PARTIAL/GAP | Add configurable rule engine | P2 |
| Staff readiness aggregate | PARTIAL | Add privacy-safe readiness surface | P1 |
| ACWR as injury predictor | REJECT | Do not implement deterministic injury risk claims | - |
| Contextual workload trends | FUTURE/PARTIAL | Use descriptive evidence, not diagnosis | P2 |
| Pedagogical AI | DONE/PARTIAL | Activate only after readiness/privacy gates | P1 |
| AI causal claims between wellness/performance | REJECT | Require uncertainty/non-causality language | - |
| AI post-game summary | PARTIAL | Pilot as outcome, not chatbot | P1 |
| Weekly micro-challenge/action | PARTIAL | Integrate into development loop | P0 |
| Gamification/streaks | FUTURE | Use mastery/consistency, avoid addictive design | P2 |
| Health-triggered commercial marketplace | REJECT | Separate safety from monetisation | - |
| Technical training/content marketplace | FUTURE | Potential clean expansion | P3 |
| Family paid plans | PARTIAL/DRAFT | Validate willingness-to-pay before activation | P0 |
| Global paywall | REJECT for first experiment | Continue closed cohort experiment | - |
| Club free forever | REJECT as fixed doctrine | Use limited Starter + paid B2B ladder experiments | P2 |
| Kafka/Go/Redis/TimescaleDB rewrite | REJECT now | Scale only from measured bottlenecks | - |

---

# 2. Match Experience

## 2.1 What IQBasket already has

The current `EasyStatsEntryView` already provides three capture modes:
- court/visual mode;
- quick tactile mode;
- official boxscore mode.

It also includes a persistent Undo action, game selection, game lifecycle checks, frozen-season enforcement and locked-game read-only behavior. `StatsEngine` already processes event-based statistical behavior including substitutions.

This means IQBasket is not missing a match-capture system. The gap is **interaction discipline and live operational resilience**.

## 2.2 Target product rule

For common live events, the measurable UX target should be:

> `player -> action -> committed`

with no modal or network wait on the critical path.

Optional metadata may require one extra gesture but must never block the base event.

### Acceptance targets

- common event <= 2 meaningful taps;
- Undo = 1 tap and always visible in live mode;
- touch target >= 44px;
- no blocking spinner after a live event;
- active five visible without navigation;
- substitution flow optimized for one out / one in;
- optional shot-location enrichment after the base event, never before it;
- mobile and tablet layouts validated independently.

## 2.3 Live writer lease

Historical game locking and a live writer lock solve different problems.

IQBasket should preserve existing game edit lifecycle and add a separate **live capture lease**:

`game_live_sessions`

Suggested fields:
- `game_id`
- `writer_user_id`
- `lease_token_hash`
- `acquired_at`
- `heartbeat_at`
- `lease_expires_at`
- `released_at`
- `release_reason`

Backend authorization remains authoritative. A stale lease must expire automatically.

### Handoff V1

Do not require Redis or a native QR flow initially.

V1 can support:
1. writer selects "Transfer capture";
2. backend creates short-lived single-use handoff token;
3. second authorized user accepts it;
4. transaction transfers lease;
5. previous writer becomes read-only immediately.

QR can be added as a convenience presentation of the same token later.

---

# 3. Offline-first without a rewrite

## Current state

No repository evidence was found for a complete IndexedDB/service-worker/offline mutation queue covering live game events. This is a real gap because venue connectivity is an operational risk.

## Recommended staged architecture

### Stage 1 — Browser outbox

Add a local event outbox with:
- `client_event_id` UUID;
- `game_id`;
- local monotonic sequence;
- event payload;
- `PENDING | SYNCING | SYNCED | FAILED`;
- retry count;
- local timestamps.

The UI commits to the local event model immediately. Network persistence runs asynchronously.

### Stage 2 — Idempotent batch synchronization

Backend receives batches and guarantees:
- idempotency by `client_event_id`;
- game authorization;
- valid game/live-lease state;
- deterministic reconciliation;
- explicit conflict response.

### Stage 3 — PWA resilience

Add service-worker/offline shell and robust reconnect behavior if validated as necessary.

### Stage 4 — Native/local DB only if evidence demands it

Do not migrate to Flutter/React Native + WatermelonDB merely because an external document proposes it. Native architecture should be justified by browser limitations observed in real pilots.

---

# 4. Game lifecycle model

IQBasket already supports `edit_state`, locking, lock requests and season freezing. Preserve this.

The next architectural improvement is to explicitly separate:

## Sporting state

Suggested minimum:
- `PLANNED`
- `READY`
- `LIVE`
- `FINISHED`

Optional future states can include period breaks/overtime if they create real workflow value.

## Administrative edit state

- `OPEN`
- `LOCK_REQUESTED`
- `LOCKED`

This separation allows:
- `FINISHED + OPEN`: corrections still allowed;
- `FINISHED + LOCK_REQUESTED`: awaiting authorized approval;
- `FINISHED + LOCKED`: historical immutable record.

Do not over-model every clock condition as a database state unless backend rules require it.

---

# 5. Daily Athlete / Wellness Express

## Current strength

IQBasket already has a configurable Player360 Wellness model covering recovery and nutrition, with:
- metric catalog;
- configurable value types;
- no mandatory free-text values;
- non-clinical recommendation rules;
- explicit restricted metric handling;
- AI processing disabled by default;
- ABAC privacy boundary.

This is more extensible than hard-coded `daily_wellness_logs` columns.

## Product gap

The athlete-facing capture experience should be radically simpler than the professional/team wellness surface.

Create a **Check-in Express** presentation layer over the existing catalog rather than a second data model.

Suggested V1 cards:
1. sleep/rest;
2. perceived fatigue/energy;
3. general discomfort/readiness;
4. optional contextual stress/load;
5. hydration/recovery routine.

### UX requirements

- target completion <=30 seconds;
- no mandatory keyboard;
- large touch controls;
- visible progress;
- one-tap "nothing to report" where appropriate;
- configurable card/metric mapping by organization/product configuration;
- accessibility labels and non-color-only status semantics.

---

# 6. Readiness without medical overclaiming

A staff-facing aggregated readiness surface is useful, but it must not expose restricted wellness details automatically.

Suggested public states:
- `READY`
- `REVIEW_BEFORE_SESSION`
- `INSUFFICIENT_INFORMATION`

A stronger `REST_RECOMMENDED` state should only be introduced after a separately validated rule and governance process.

The staff surface should communicate **operational readiness**, not diagnoses or injury probabilities.

---

# 7. ACWR and injury-risk claims

Do **not** implement the external specification as written where fixed ACWR thresholds become deterministic injury-risk labels or claims such as a specific multiple of injury risk.

IQBasket may later expose workload context such as:
- recent training load;
- longer-window load;
- significant recent increase/decrease;
- evidence coverage;

but wording must remain descriptive and uncertainty-aware.

The current non-clinical recommendation philosophy should be preserved.

---

# 8. Player Development Loop — highest-value differentiation

The repository already contains the essential foundations:
- longitudinal Player360;
- explicit player goals;
- development-plan entitlement;
- training sessions;
- external development/technification;
- family development context;
- deterministic weekly plan;
- Family workspace.

The current `FamilyDevelopmentPlanEngine` is intentionally conservative: it connects an explicit objective to recent training, technification and games without causal inference or load prescription. This is the correct base.

## Target loop

`OBSERVE -> UNDERSTAND -> ACT -> MEASURE -> REVIEW`

### Observe

Use objective-linked game/training/technification evidence.

### Understand

Describe longitudinal trend and evidence sufficiency.

### Act

Create 1 primary weekly focus plus 1-3 small actions.

### Measure

Bind each focus to measurable evidence that can be revisited after future games/sessions.

### Review

Close the weekly cycle explicitly:
- continue;
- adapt;
- achieved;
- pause;
- redefine with staff.

## Gap to close

The weekly plan today is primarily a deterministic presenter. The next version should support **action lifecycle**, not only generated/displayed text.

Suggested future domain objects:

`development_cycles`
- player
- objective
- start/end
- state
- evidence snapshot

`development_actions`
- cycle
- focus
- action type
- completion state
- linked training/technification evidence

This creates a measurable recurring product rather than a one-off report.

---

# 9. Family Value and monetisation

## Existing product thesis is confirmed

The current documented IQBasket ladder is stronger than the external fixed-price proposal:

`What happened -> How is the player evolving -> What does it mean -> What next`

Family Free provides useful history/statistics, while Family is designed around longitudinal interpretation and development planning. Family Pro is intended for recurring intelligence/action, with sensitive wellness separately governed.

This should remain the commercial thesis.

## Pilot rule

Do not activate a global paywall or paid plans before the closed Family value cohort validates:
- repeated weekly use;
- perceived usefulness;
- conversion intent;
- retention;
- support/privacy burden;
- willingness to pay for understanding/action rather than raw statistics.

Pricing remains an experiment, never a product constant.

---

# 10. AI product policy

## Preserve current architecture

IQBasket already separates:
- deterministic analytics;
- AI gateway;
- provider boundary;
- product entitlements;
- sensitive-data authorization;
- commercial readiness.

Family AI products remain disabled by default. This is correct.

## Product contract

AI should be sold as **outcomes**, not as a generic chat capability:
- evolution report;
- post-game interpretation;
- priorities;
- weekly plan.

## Required guardrails

AI must:
- never rank a minor's worth;
- never compare teammates destructively;
- not diagnose;
- not prescribe medication or restrictive diet;
- distinguish observation from interpretation;
- state evidence limitations;
- avoid claiming that sleep/stress/nutrition caused a match outcome without valid evidence;
- use restricted wellness evidence only with explicit processing authorization.

Preferred phrasing:

> "These observations occurred in the same period; the available data does not establish that one caused the other."

---

# 11. Micro-challenges and weekly actions

External feedback correctly identifies the value of ending interpretation with something actionable. IQBasket should implement this through the existing development-plan domain rather than free-form AI advice.

A micro-action must be:
- tied to an explicit development objective;
- small enough to complete during the week;
- observable/measurable;
- suitable for age/context;
- revisited after completion;
- optionally reviewed by staff.

This is a **P0 product opportunity** because it joins Family value, training, technification and Player360 into one recurring loop.

---

# 12. Gamification policy

Use gamification to reinforce mastery and consistency, not compulsive engagement.

Allowed patterns:
- progress milestones;
- objective completion;
- consistency acknowledgement;
- personal-best development markers;
- season memories/achievements.

Avoid:
- variable reward loops designed to maximize compulsive checking;
- shame for broken streaks;
- fear-based upgrade prompts;
- teammate comparison leaderboards for minors unless a specific safe context is designed.

---

# 13. Marketplace policy

## Health-triggered marketplace — reject

Do not create a flow where IQBasket detects a health concern and financially benefits from recommending a specific provider/product. Safety recommendations and commercial optimization must remain separate.

A neutral voluntary directory can be considered later with clear governance.

## Technical development marketplace — future opportunity

A cleaner future expansion is:
- objective detected/selected;
- relevant technical program available;
- user voluntarily chooses content/coaching.

Possible future product families:
- IQBasket Training;
- IQBasket Academy;
- IQBasket Experts.

Not required for current product-market validation.

---

# 14. Competition Rule Packs

External feedback correctly highlights that youth basketball rules vary by age, federation and competition.

Do not hard-code rules by age.

Future architecture:

`competition_rule_sets`
- code/version
- federation/region
- period count/duration
- overtime rules
- foul/bonus rules
- player participation constraints
- shot/clock capabilities
- roster rules

Examples:
- `FIBA`
- `FEB`
- `FCBQ_MINIBASKET`
- `CUSTOM`

Rules should be versioned and attach to competitions/seasons, allowing international licensing without rewriting the core.

---

# 15. Infrastructure strategy

Do not introduce Kafka, Go microservices, Redis, TimescaleDB, Kubernetes or multiple specialist services before measured production load justifies them.

Current architecture should continue to prefer:
- Supabase/PostgreSQL;
- Edge Functions where trusted backend processing is required;
- modular domain/services;
- RLS/RBAC/ABAC;
- explicit indexes and performance monitoring;
- provider-neutral boundaries.

Scale bottlenecks should be solved from observability evidence, not speculative architecture diagrams.

---

# 16. Recommended execution order

## Phase 0 — Finish current production safety work

Before new product work:
1. fix the reserved SQL alias in the scoped entitlement migration;
2. run CI and merge the fix;
3. apply scoped grant / Family pilot migrations in safe order;
4. run Supabase security/performance verification;
5. keep the pilot cohort empty until an explicit verified guardian relationship and participant decision exists.

## Phase 1 — Player Development Loop V2

Highest product-value/lowest architectural-risk next investment:
- weekly development cycle state;
- micro-actions linked to objectives;
- evidence linkage to training/technification/games;
- review/complete/continue workflow;
- Family presentation of progress.

Why first: it directly tests the existing Family monetisation thesis using capabilities already built.

## Phase 2 — Match Capture UX V2

- measurable <=2 interaction target for common events;
- dominant Undo;
- optimized active-five/substitution UX;
- mobile/tablet QA;
- telemetry for interactions/event and correction rate.

Why second: it improves data capture quality and B2B adoption, which feeds every longitudinal product.

## Phase 3 — Live capture lease + handoff

- single active writer lease;
- heartbeat/expiry;
- secure transfer token;
- read-only takeover behavior;
- audit.

Why third: resolves multi-user live integrity before offline mutation complexity is added.

## Phase 4 — Offline Event Outbox V1

- local durable event queue;
- idempotent event IDs;
- batch synchronization;
- conflict handling;
- offline/reconnect UX;
- automated tests for network loss.

## Phase 5 — Check-in Express + Readiness V1

- athlete micro-flow over current wellness catalog;
- privacy-safe aggregate staff readiness;
- no diagnosis or deterministic injury score.

## Phase 6 — Family AI controlled pilot

Only after:
- commercial readiness gate passes;
- provider boundary is enabled deliberately;
- explicit data-processing authorization is present where required;
- deterministic Family product already demonstrates recurring value.

## Phase 7 — Rule Packs / B2B packaging

After core workflows are validated:
- competition rule packs;
- Team/Club packaging;
- onboarding/import improvements;
- multi-team governance.

## Phase 8 — Marketplace/content ecosystem

Only after recurring SaaS value and retention are demonstrated.

---

# 17. Product KPIs to add to the validation model

## Match capture

- median interactions per common event;
- correction/Undo rate;
- abandoned live sessions;
- sync failure rate;
- capture completeness;
- time to complete substitution.

## Player development

- players with active objective;
- weekly plans viewed;
- weekly actions started/completed;
- objective review rate;
- percentage of actions linked to real session/game evidence;
- repeat weekly engagement.

## Family

- verified household activation;
- 7/30/90-day family return rate;
- Player360 revisit rate;
- weekly plan revisit/completion;
- conversion interest by value moment;
- Family pilot retention;
- privacy/support incidents.

## Daily Athlete

- median check-in completion time;
- completion rate;
- missing-data rate;
- self vs guardian entry mix;
- staff readiness view usage without restricted-data leakage.

---

# 18. Final product stance

IQBasket should not become a collection of sports-tech features. Its defensible product is the **connected development loop**:

`CAPTURE -> HISTORY -> INTERPRETATION -> OBJECTIVE -> ACTION -> TRAINING -> MEASUREMENT -> FAMILY VALUE`

The external feedback is most useful where it improves capture friction, offline resilience, handoff and athlete check-in UX. It is less suitable where it proposes premature infrastructure, deterministic medical risk, aggressive engagement mechanics or health-linked monetisation.

The next engineering decisions should therefore prioritize **measurable recurring player-development value and trustworthy data capture** before adding infrastructure or marketplace breadth.
