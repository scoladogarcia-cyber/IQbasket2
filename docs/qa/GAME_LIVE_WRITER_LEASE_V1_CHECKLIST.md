# Game Live Writer Lease V1 · Acceptance Checklist

## Backend

- [ ] V28 migration applies without warnings/errors.
- [ ] RLS enabled on all V28 public tables.
- [ ] `anon` cannot execute V28 RPCs.
- [ ] authenticated users can only acquire a lease when they already have real capture authorization.
- [ ] V21 public/private write bypass is closed after V28 apply.

## Single-writer behavior

- [ ] User A opens an existing READY/LIVE game and obtains the writer lease.
- [ ] User B opens the same game and sees capture controls disabled.
- [ ] User B cannot save by directly invoking the capture UI while A owns the lease.
- [ ] Heartbeat extends A's lease while the HUD remains open.
- [ ] An expired lease can be acquired by a different authorized user.

## Handoff

- [ ] User A creates a one-use handoff code.
- [ ] User B accepts the code and immediately becomes writer.
- [ ] User A's old lease token can no longer save.
- [ ] The handoff code cannot be reused.
- [ ] Handoff creation/acceptance is audited.

## Existing behavior regression

- [ ] Historical `edit_state=LOCKED` still prevents mutation independently of the live lease.
- [ ] Team-season freeze still prevents mutation independently of the live lease.
- [ ] Delegated `RECORD_LIVE_GAME` still works when the delegate owns the lease.
- [ ] BoxScore editing for a non-LIVE finished/open game does not require a live lease.
- [ ] Mobile HUD remains usable and all interactive targets remain reachable.

## User check

When automated gates are green, verify with two sessions/devices on the same LIVE game:
1. Session A starts capture.
2. Session B opens the same game and confirms read-only/block state.
3. A creates a transfer code.
4. B accepts it.
5. B can capture; A cannot.
