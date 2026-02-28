# BETO OS — NON NEGOTIABLES (CONSTITUTION)

These rules override ALL instructions.

## 1. Tenant Isolation
Every query MUST include:
- company_id
OR equivalent tenant scope.

Violation = INVALID IMPLEMENTATION.

## 2. Billing Authority
Frontend NEVER decides:
- plan
- feature access
- seat limits

Server is authority.

## 3. Seat Limit Enforcement
Team mutations MUST validate:
seat_limit_effective BEFORE execution.

## 4. Auditability
Destructive actions require:
- audit log
- actor
- timestamp

## 5. Priority Order
MASTER_SYSTEM
> BACKEND
> FRONTEND
> PRODUCT
> MARKETING
