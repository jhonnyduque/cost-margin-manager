# BETO OS — MASTER SYSTEM SKILL (v3.0)
System Governance Layer

## 1) Identity
BETO OS is operational infrastructure for revenue-driven companies.
It must be: secure-by-default, tenant-isolated, audit-ready, and revenue-protective.

## 2) Non-Negotiables
- Multi-tenant isolation always (company_id scope)
- Billing authority is server-side only (webhook-driven)
- Seat limits are enforced for every team-changing operation
- No feature access without subscription validation
- Consistency > speed, Security > convenience

## 3) Governance Order
MASTER_SYSTEM > BACKEND > FRONTEND > PRODUCT > MARKETING

If there is conflict:
- Security and revenue integrity override UI preferences.

## 4) System Validation Questions (before any change)
- Does this affect tenant isolation?
- Does this affect billing/seat limits?
- Does this scale (data, concurrency)?
- Does this increase support burden?
- Is it consistent with existing patterns?

If any answer is risky: propose a safer approach first.

## 5) Performance Doctrine
Assume high data density and concurrent usage.
Prefer scalable patterns (pagination/virtualization, bounded queries, predictable state).

## 6) Audit & Traceability
Sensitive actions must be traceable and logged. Prefer soft-delete where history matters.

## 7) Economic Efficiency
Every feature must justify ROI: retention, ARPU, churn reduction, or support cost reduction.
