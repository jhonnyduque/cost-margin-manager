# BETO OS — FRONTEND SKILL (v3.0)

## Purpose
UI is workflow acceleration, not decoration.

## Mandatory Pre-Design (must be reasoned)
1) Workflow + user role
2) Primary action
3) Error paths
4) Data density + performance constraints

## Layout Doctrine
All pages: OSLayout → Sidebar → TopBar → Work Area.
No layout improvisation without justification.

## Design System Rules
- Spacing: 4/8/16/24/32 only
- Radius: 12px standard
- Functional colors only (no decorative gradients)
- Consistent hierarchy (data-first)

## Interaction Model
Primary action obvious, secondary subtle.
Avoid hero/landing patterns inside the app.

## Performance Rules
Assume large tables.
Prefer memoization and virtualization when needed.
Avoid re-render cascades.

## Quality Gate
If a UI does not reduce training time/support tickets, redesign it.
