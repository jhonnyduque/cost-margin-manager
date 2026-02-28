# BETO OS — BACKEND SKILL (v3.0)

## Tenancy & Security
All access must be scoped by company_id + role + subscription_tier.
RLS (or equivalent enforcement) is mandatory.

## Billing Authority
Billing state is server-side only.
Stripe/webhook is the source of truth. Never trust frontend state.

## Seat Enforcement
seat_limit_effective = seat_limit_override ?? tier_limit
Enforce on any operation that increases active seats.

## Architecture Rules
Controller → Service → Domain → Persistence
No business logic in controllers/routes.

## Audit
Log sensitive actions with: user_id, company_id, action_type, timestamp.

## Failure Isolation
One tenant failure must not cascade.
