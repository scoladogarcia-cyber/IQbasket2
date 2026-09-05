# IQBasket Match Capture UX V2

## Objective

Reduce cognitive and motor friction during live game capture without changing the
existing game data model, statistics engine, permissions or backend behavior.

The external Athlete360 feedback reinforces a practical reality already visible
in IQBasket usage: the person capturing a youth game is often operating on a
small mobile/tablet screen while also trying to watch the court. The product
therefore needs a clearer player -> action loop and an immediately accessible
recovery path for mistakes.

## V2 progressive enhancement

This first increment deliberately reuses `EasyStatsEntryView` instead of
rewriting it. `MatchCaptureUxEnhancer` only improves DOM semantics and
interaction ergonomics:

- explicit `1 · Elige jugador -> 2 · Registra acción` guidance in quick mode;
- quick actions disabled until a player is selected, preventing avoidable error
  alerts and accidental attribution;
- clearer selected-player state and accessible `aria-pressed` semantics;
- action labels expose the selected player to assistive technology;
- optional light device haptics where supported;
- floating mobile Undo that delegates to the existing Undo button;
- minimum touch targets enlarged for court-side use;
- mobile action grids reduce overly narrow four-column controls;
- reduced-motion accessibility support;
- the user's selected capture mode is remembered for the browser session on
  mobile, rather than forcing a product-wide default.

## Architectural boundary

The enhancer MUST NOT:

- write game/statistical data;
- call Supabase or RPCs;
- evaluate RBAC/ABAC;
- calculate scores or boxscore values;
- replace `StatsEngine`, `EasyStatsEntryView` or backend locking.

The existing runtime remains authoritative. If the enhancement is removed, the
original capture workflow still works.

## Next increments

After validated real-device use, Match Capture can evolve independently through:

1. telemetry for interaction count / correction rate without capturing sensitive
   player content;
2. faster substitution ergonomics;
3. explicit live-writer lease/handoff;
4. idempotent offline outbox and synchronization state;
5. competition-aware action/rule packs.

These are separate product/architecture changes and must not be hidden inside a
UI-only iteration.
