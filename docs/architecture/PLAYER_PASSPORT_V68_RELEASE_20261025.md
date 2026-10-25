# IQBasket Player Passport V68 — complete functional implementation and deployment

## Principle: the player is the durable subject
All joins and evaluations are anchored on `players.id`; team-season is the **access-control and competition context**, never ownership of the passport. Past club evaluations are visible only under their independent licence/RBAC permission; historical evaluations explicitly shared with the player may also be viewed via a verified SELF/GUARDIAN relation. Old clubs' private evaluations are **never transferred implicitly**.

## Current competition category
The passport keeps the established hero, the player's DOB-derived age, roster-correct position and number, and adds the actual `teams.category` from the selected team-season. Season and competition remain contextual. A vocabulary in `config/playerPassportCategoriesV68.config.js` covers School, Escobol, Premini and first year, Mini and first year, Preinfantil, Infantil and first year, Cadete and first year, Junior and first year, Sub20/Sub21/Sub22/Sub25 and Senior. Federation-specific competition age rules remain configurable by season. No birthday points and no assumed equivalence between overlapping categories.

## Eight distinct responsive sections
Resumen, Competencias, Evolución, Entrenamientos, Partidos, Evidencias, Hábitos and Valorar. The existing visual hero and export actions are retained. The UI displays only one section at a time. Old assessments and original rubrics are preserved.

## Evaluation methodology (all 69 catalog attributes, no partial pilot)
- Score 1–5 is a **contextual ordinal description**, not a universal raw comparable number.
- D1–D5 is an **independent difficulty tier** chosen per observed attribute, regardless of age. A score 5 on D1 is not equal to a score 5 on D4.
- Category/season/competition are captured separately in metadata and do not add points to an OVR. No unvalidated universal "overall score".
- The existing 69-attribute catalog provides definitions, five qualitative behavioral anchors, appropriate contexts and a minimum number of observations (5–8 as currently configured).
- On every new scored attribute, frontend and Supabase require tier, rubric version, valid context and at least the catalogued number of observations; unchanged scores are not duplicated.
- **Provisional does not mean zero:** historical scores with evidence_count=0 are preserved, visible and marked unverified. Verified evidence coverage is separate from rated-attribute coverage.
- A counted observation is still declared by the evaluator, not independently verified by a video or event: **scientific calibration, inter-rater reliability and objective task thresholds are not yet proven**. Metadata marks new evaluations `PENDING_CALIBRATION`; never advertise an officially certified diagnostic scale.

## Training and matches
`iq_passport_training_minutes_v68` (security_invoker + RLS) distinguishes:
- Attended minutes recorded on/past the session date, regardless of a pending completion flag;
- Accredited minutes from completed sessions with recorded attendance only;
- Planned future minutes, not treated as attended;
- Category review flags and unknown minutes; no invented zero for inaccessible records.
Parties can explicitly validate/reopen sessions via preexisting RBAC V65 RPC. No historical validation is performed in bulk.

`iq_passport_game_evidence_v68` (security_invoker + RLS) includes finalised games only and observed boxscore statistics and actual recorded game minutes. Null minutes remain N/D; no single game statistic generates a skill level.

Actual time spent on an evaluation is optionally captured in `player_evaluations.assessment_duration_minutes`, different from training or game minutes. Absence remains unknown.

## Sensitive habits
Existing `WellnessService` and `iq_v4e2_...` RPC permission checks retain independent recovery/nutrition grants and purpose limitations; the passport does not bypass them, cross-share them or activate AI processing.

## AI readiness, NOT automatic AI
Build future permitted temporal joins on player_id + source_event_id + event_date + team_season_id + rubric_version + protocol/difficulty + evidence confidence. Keep outcome and prediction datasets versioned and reproducible. An AI feature store must include consent/legal basis, model provenance, opt-outs, human oversight, bias/relative-age checks, longitudinal validation and disabled automation by default. No training on unconsented child wellness data.

## Security and rollback
- Existing paid passport check on *current* context is mandatory for every career/assessment call; previous seasons are authorized separately.
- Verified player/guardian relation additionally permits reading only `share_with_player=true`, non-private historical evaluations.
- Views are invoker-security, subject to both parent tables' RLS. RPCs are authenticated only; deny anonymous callers and check identity+permissions at runtime.
- Private `iqbasket_recovery_20261025` contains a pre-change snapshot of training/evaluations/scores/games stats. It is **inside the same database**, not a complete external backup.
- Additive migrations do not alter or approve historical sessions or scores.
- To rollback UI, revert release merge on GitHub. Keep new SQL objects idle rather than destructively dropping them; a later controlled rollback should consider dependencies.

## Verification gates
1. V68 domain/service/SQL test, including required-evidence guard, category taxonomy and pending-versus-accredited mathematics.
2. Playwright Chromium and WebKit passport navigation/edit flow at mobile width.
3. Existing IQBasket CI, training editor, game flow, global responsive QA and GitHub Pages deployment.
4. Database checks: 69 rules, backup counts, no anonymous RPC execute, snapshots intact, actual sample training distinction.
5. Confirm published git SHA and the Github Pages run finish as success. User-visible real-account testing remains recommended after deployment.
