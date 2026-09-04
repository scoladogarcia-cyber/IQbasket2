# IQBasket Family-First SaaS Entitlements V1

## Decision

IQBasket separates sports identity, security and commercial ownership.
The player is the longitudinal product subject; the family is the primary B2C
customer; teams, clubs and academies remain B2B customers and data channels.

The commercial model must never use `club_id` as the universal payer. Instead:

`BillingAccount -> BillingSubject -> Subscription -> Entitlements`

A billing account can be `FAMILY`, `TEAM`, `CLUB`, `ACADEMY` or `INTERNAL`.
A billing subject can be a `PLAYER`, `TEAM` or `CLUB`.

## Security boundary

Entitlements do not grant data access. The request order is always:

1. Active account lifecycle check.
2. Existing RBAC/ABAC or verified subject relationship.
3. Commercial entitlement resolution.
4. Usage/quota check where applicable.
5. Business operation.
A parent paying for Family Pro therefore cannot bypass a missing/revoked
parent-player relationship, nor an ABAC restriction on sensitive data.

## Beneficiary scopes

Plan entitlements declare who benefits from a purchased capability:

- `ACCOUNT_MEMBERS`: household/account members; primary Family mode.
- `AUTHORIZED_STAFF`: coaches/analysts/managers authorized in sports context.
- `ALL_AUTHORIZED`: future organization bundle that intentionally includes all
  already-authorized users, including families where product strategy allows it.

This prevents a Club subscription from accidentally giving Family Pro to every
parent, while still allowing a future club-funded family package.

## Subject inheritance

A direct PLAYER subscription has highest commercial specificity.
TEAM subscriptions can cover players in the selected team-season.
CLUB subscriptions can cover teams and their players in context.

For equal capability values, the resolver prefers PLAYER over TEAM over CLUB,
and then FAMILY over organization account types. This makes family attribution
explicit when Family and Club subscriptions coexist.
## Provider independence

No Stripe, Redsys, App Store, Play Store or other provider concepts are stored
in authorization code. Billing adapters may populate opaque external references,
but entitlement resolution depends only on IQBasket tables and stable codes.

## Rollout rule

V1 is intentionally inert after installation:

- no billing account is auto-created;
- no existing route is gated;
- all paid-plan hypotheses stay `DRAFT`;
- AI quota is zero in commercial draft plans until a real-cost pilot is complete;
- no price is encoded in RBAC, frontend routing or entitlement codes.

The first paid integration should be a Family player surface, not a global app
lock. Existing staff workflows remain unchanged until their own entitlement gate
is introduced and grandfathered safely.

## AI evolution

The existing AI usage ledger already records `club_id`; a later migration will
add `billing_account_id` and commercial subject context without deleting historic
club attribution. Provider cost remains metered separately from the customer-facing
product unit (insight, report or weekly plan).
