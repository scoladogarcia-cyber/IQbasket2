# V41 · Mobile scorer viewport + orientation

## Problema

V40 converted the live scorer into a fixed `100dvh` surface, but the asynchronous single-writer lease panel was prepended after the grid had been composed. Because V40 relied on implicit grid placement and `overflow:hidden`, the lease panel displaced the expected rows and could leave the bottom stat actions below Safari's usable viewport.

V40 also had no dedicated landscape composition above 900 CSS pixels, which made wide iPhone landscape viewports fall back toward legacy layout rules.

## Solución

- `LiveScoreHUDViewV41` extends V40 without changing sporting event semantics.
- Explicit grid areas isolate top bar, writer lease, scoreboard, toolbar, period, five-player lineup and action pad.
- The owned writer lease becomes a compact status row during normal capture; transfer/release remain available from the existing `•••` expanded mode.
- Blocked, released and error writer states remain prominent and actionable.
- The stat pad has its own `overflow-y:auto` safety fallback so the last action can always be reached on short Safari viewports.
- A dedicated landscape layout uses two columns: match controls/lineup on the left and the action pad on the right.
- Responsive coverage is raised to 1024 CSS pixels so wide iPhones in landscape remain inside the scorer layout.
- No attempt is made to force `screen.orientation.lock`; Safari/iOS remains authoritative for physical device orientation.

## QA

`tests/live-scorer-v41-mobile-orientation-smoke.mjs` reproduces the writer lease panel that caused the reported failure and verifies portrait and landscape geometry in both Chromium and WebKit.

Release: `2026.09.08.24` · `mobile-scorer-viewport-orientation-v41`.
