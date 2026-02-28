# BETO OS — SELF GOVERNANCE RULES (v1.0)
This file defines the self-governing guardrails for BETO OS work.

## Governance Sources (order)
1) 00_SYSTEM/BETO_OS_MASTER_SYSTEM_SKILL.md
2) 05_GOVERNANCE/BETO_OS_AI_TEAM_ORCHESTRATOR.md
3) 01_SKILLS/* (backend > frontend > product > marketing)
4) 02_AI_RUNTIME/*
5) 03_ARCHITECTURE_MEMORY/* (past decisions)
6) 04_PLAYBOOKS/* (execution patterns)

## Self-Validation (mandatory before final answer)
AI must run a “policy check”:
- Security Check: tenant isolation, auth, RLS scope.
- Revenue Check: seat_limit_effective enforced, tier gating respected.
- Consistency Check: matches existing patterns; no duplicate paradigms.
- Performance Check: works with large datasets and concurrency.
- UX Check: reduces steps and cognitive load.

If any check fails:
- Do not output final solution.
- Output a corrected plan first.

## Drift Prevention
- If a new pattern is introduced, justify why existing patterns are insufficient.
- Prefer extending current components/services over creating new paradigms.
- Document significant decisions in 03_ARCHITECTURE_MEMORY/SYSTEM_DECISIONS.md.

## “Stop Conditions”
AI must stop and propose safer alternatives if:
- A change could leak cross-tenant data
- A change could allow unpaid access
- A change introduces destructive deletes where history matters
- A change increases complexity without ROI
