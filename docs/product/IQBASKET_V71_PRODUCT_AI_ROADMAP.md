# IQBasket Product V71 — P0/P1 expansion and governed AI

## Product principle
Player-owned career identity, club-controlled confidential observations, easily understood family story. One core for teams, coaches and families; avoid a second data model. This document records changes in `feature/family-p0-p1-integration-20261025` and identifies remaining dependencies accurately.

## Shipped to V71 branch (pending release)
- `views/family/FamilyHomeV70.js`: read-only family snapshot and accessible mobile intro. Do not confuse missing with zero; advanced panels remain available on demand.
- `views/family/FamilyWorkspaceView.js`: reuses verified Family RPCs and existing V68 premium passport, objectives, activity and development cycles.
- `views/family/FamilyWorkspaceV30View.js`: team context remains in the advanced section.
- `services/reports/FederationCsvAdapterV70.js`: strict, editable CSV with unique jersey mapping and complete player rows; no guesses, no FCBQ API or claimed endorsement. Source data provenance should be retained in a future connector. Existing V53 import only writes under existing locked-game, event and permission checks.
- `views/ReportsViewV53.js`: official CSV vs live stats is read-only. Detailed PDF, compact visual PDF, Excel match + PBP and customizable game selection share the same authorized records. Reports include read-only data-quality findings.
- `views/ReportsViewV50.js`: brief/complete per-player PDF using existing approved data; complete version includes graphs and available shot maps.
- `services/i18n/LanguagePackExchangeV71.js`: CSV import/export around bundled `es,ca,en,fr` dictionaries; Supabase `translations` retained as optional overrides for backwards compatibility and existing tenant edits. **CSS is for design; translations use locale JS dictionaries or CSV, not CSS.**
- `views/LanguageSettingsView.js`: repair missing event binding and provide bulk CSV controls, preview, paging, atomic RLS-protected upsert (no delete fallback).
- `domain/stats/StatQualityV71.js`: read-only independent inspection, reuses the existing BoxScoreCalculator. Distinguishes a recorded 0 from unknown and undefined denominator; no silent historical backfill.
- `views/player360/passport/PlayerPassportView.js`: retains 69 rubrics, D1–D5, scope controls and adds plain-language FAQ.
- `views/reports/GameStatisticsGlossary.js`: click/tap-accessible definitions and N/D FAQ.
- Tests: `tests/family-p0-p1-v70.mjs`, `tests/product-p1-v71.mjs`; gate plus existing CI.

## Outstanding to meet the full P0/P1 scope — not represented as delivered
1. Real accounts and match-device acceptance testing of live/period score, player minutes, offline reconnect, undo and finalization. V69 regression exists; passing unit tests alone is not field acceptance.
2. Licensed FCBQ API contract, legal data-reuse right, stable schemas, identity mapping and token issued by federation. Data synchronization must be server-side, scoped, idempotent and auditable. Without official approval, CSV upload remains manual only.
3. True batch-import features for squads, teams, training and passport evidence: agree identity/version/permissions and use staging tables plus transactional RPC, never direct partial writes or silent upserts. Different data domains require separate templates and validators.
4. Motivational check-in: create an explicitly permitted, voluntary non-diagnostic self-report experience, with retention and privacy policy. The existing nutrition/recovery scale **must not** be relabelled as validated motivation. Do not copy Switch On Sports psychometrics.
5. Persistence and invalidation of advanced analytics snapshots: `player_game_stats` and `player_season_metrics` already persist values. Audit the write/update dependency graph and align versioned formulas; do not create a second cache until freshness and permissions are assured.
6. Human-in-the-loop coach review of goals/challenges with evaluation evidence, no automatic child ranking or comparative talent OVR.
7. 4-language rollout beyond new catalog-managed messages: remaining legacy hardcoded strings require a staged UI-by-UI migration and screenshots.

## Metric rules — explicit separation
- `0` means a recorded zero event (e.g., 0 successful shots in 5 attempts).
- `null` / `N/D` means unknown, not recorded or undefined (e.g., 0 attempts -> percentage undefined).
- `NE` means a Passport skill has **not** been evaluated.
- `DNP` means did not play. Not identical to N/D minutes. Never use hidden false zeros as a reason to claim progress.
- Canonical fundamentals: PTS = 2×2PM + 3×3PM + FTM; eFG% = (FGM + 0.5×3PM)/FGA; TS% = PTS/[2×(FGA + 0.44×FTA)]. Percentages require valid positive denominators.
- Ratio 0/0 is N/D, not zero. 0/x with x>0 is 0%.
- Team totals must equal displayed team score when complete, except when opponent/official corrections are separately marked.
- Raw observations, derived metrics, calculation version, last-input revision and calculation time should be stored with provenance. Official imported figures can differ from private live capture and must never silently replace its PBP.
- Do not advertise formula labels as "official" for estimates such as 0.44×FTA, USG, possession estimates or ORtg. Version by game rule set, federation and category.

## How AI can help — family / coach / organization

### Family products
**Family Evolution Brief**: 4 short paragraphs built from authorized verified trends: what happened, what changed, what it means (with uncertainty), how to help this week. Each statement cites a stored metric, match, evaluation or objective. Never rank a child, speculate on future professional career or reveal another child's data.

**Post-game Explanation**: interpret recorded minutes, score, efficiency and context. Missing periods/minutes must be flagged before any generated output. A game alone does not prove skill acquisition.

**Personalised Weekly Development**: only on an explicit staff-approved objective; propose 1 simple action and an observable measure, not medical training loads or pressure to maximise playing time.

### Coach products
**Coaching co-pilot**: extract structured game/PBP patterns and training focus coverage, locate discrepancies and generate game-plan suggestions tagged as suggestions; coach approves changes. Video-derived events only if consented and verified.

**Season Review & Scouting Notes**: create a first-draft evidence-based PDF with group and individual authorized scope, role suitability and rubric coverage. Comparative claims always account for league, minutes, age bands, category and sample size; no generic player worth score.

**Data Quality Agent**: identify conflicting game totals, 0 vs N/D, missed practice validations, duplicate player IDs and low-confidence passport scores deterministically before invoking any LLM.

### Club/administration
Import mapping suggestions for varied authorized federation/CSV templates, privacy-safe aggregate club reports and a searchable knowledge base of **public rules, rubrics and FAQ**.

### Model-provider boundary
Current `Player360AiGatewayService` is server-directed, but generation is deliberately disabled. `AskAIView` still contains a legacy direct browser Groq path and client-side quota: **do not send youth player records through that path**. Provider calls must be mediated by Edge Functions with server-side permissions, idempotency, scoped entitlements, per-tenant budgets and audit. Do not put model API secrets in localStorage or web bundles. Separate a curated deterministic fact packet from narrative generation; schema-validate output and require human approval for high-impact coach decisions.

### Data / quality gates
1. `family_product_access`, RBAC/ABAC, real relationship, tenant scope and purpose authorization.
2. Snapshot has adequate dated evidence and passed `StatQualityV71` validation; no unauthorized wellness fields.
3. Bundle contains only permitted structured facts, not free-form private coach notes by default.
4. Model outputs link to evidence IDs; reject unverifiable numbers, causal wellness/performance claims, diagnosis or medical advice.
5. Draft preview and human review (staff for development plans), with clear "AI-assisted" disclosure.
6. Versioned evaluation/prompt/model + drift monitoring and per-role cost ceilings.
7. Never use image/voice emotion inference in educational settings; do not infer mental health or manipulate minors. AI Act Article 5 specifically restricts emotion recognition in education/workplace, subject to defined exceptions. Check exact deployment context and GDPR legal basis.
8. Family AI paid pilot only after empirical tests for usefulness, retention, factuality, privacy and cost — don't turn on a global paywall yet.

### Rollout recommendation
P0: deterministic quality and readable family reports (no model).
P1: opt-in staff copilot on competition/training factual summaries; human review.
P2: Family AI outcomes with separate permission + contract + value/cost validated.
P3: video-assisted scouting only after stringent technical, rights and bias reviews.

## References / verification
- FCBQ Open Data service: https://www.sciosports.org/bp/lacta-digital-en-el-basquet-catala
- European AI Act, prohibited practices: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-5
- European Commission AI transparency: https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations
- Existing IQBasket reference: `docs/architecture/PLAYER_PASSPORT_V68_RELEASE_20261025.md`; `docs/product/IQBASKET_PRODUCT_GAP_MAP_V1.md`.
