# BETO OS — AI System Rebuild (PowerShell)
# Run from: docs\AI
# This script ensures folder structure, writes canonical docs, and validates the system.

$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$path) {
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path | Out-Null }
}

function Write-File([string]$path, [string]$content) {
  $content | Set-Content -Path $path -Encoding UTF8
}

function Assert-NonEmpty([string]$path) {
  if (-not (Test-Path $path)) { throw "Missing file: $path" }
  $len = (Get-Item $path).Length
  if ($len -lt 40) { throw "File too small/empty: $path ($len bytes)" }
}

# 1) Ensure structure
Ensure-Dir ".\00_SYSTEM"
Ensure-Dir ".\01_SKILLS"
Ensure-Dir ".\02_AI_RUNTIME"
Ensure-Dir ".\03_ARCHITECTURE_MEMORY"
Ensure-Dir ".\04_PLAYBOOKS"

# 2) Write README
Write-File ".\README.md" @"
# BETO OS — AI Documentation

This folder is the governance and skill system for BETO OS.

## Reading Order (MUST)
1. 00_SYSTEM/BETO_OS_MASTER_SYSTEM_SKILL.md
2. 01_SKILLS/*.md
3. 02_AI_RUNTIME/*.md
4. 03_ARCHITECTURE_MEMORY/*.md
5. 04_PLAYBOOKS/*.md

## Rule
Any change to product, UI, backend, billing or messaging must comply with MASTER_SYSTEM.
"@

# 3) Write MASTER SYSTEM
Write-File ".\00_SYSTEM\BETO_OS_MASTER_SYSTEM_SKILL.md" @"
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
"@

# 4) Write SKILLS (v3.0 canon)
Write-File ".\01_SKILLS\BETO_OS_FRONTEND_SKILL.md" @"
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
"@

Write-File ".\01_SKILLS\BETO_OS_BACKEND_SKILL.md" @"
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
"@

Write-File ".\01_SKILLS\BETO_OS_PRODUCT_SKILL.md" @"
# BETO OS — PRODUCT SKILL (v3.0)

## Decision Filter
A feature must improve at least one:
- Retention
- ARPU / upgrade conversion
- Churn reduction
- Support cost reduction
- Operational clarity (better than spreadsheets)

## Subscription Alignment
Every feature must map to tiers and gating rules.
No random exceptions without documented Enterprise override rationale.

## Complexity Ceiling
Avoid feature overload. Prefer modular unlocks.

## Change Control
If a feature increases cognitive load, it must ship with UX simplification or not ship.
"@

Write-File ".\01_SKILLS\BETO_OS_MARKETING_SKILL.md" @"
# BETO OS — MARKETING SKILL (v3.0)

## Positioning
BETO OS is operational infrastructure (control, clarity, scale).
Not a hobby tool.

## Tone
Professional, precise, confident. No hype, no fluff.

## Messaging Pillars
- Replace chaos with structure
- Control operations and teams
- Scale securely with governance
- Protect revenue with tier + seat discipline

## Truth Rule
Never promise features not built or not available in the described tier.
"@

# 5) AI RUNTIME
Write-File ".\02_AI_RUNTIME\BETO_OS_AI_BOOTLOADER_PROMPT.md" @"
# BETO OS — AI BOOTLOADER (v1.0)

You are operating inside BETO OS.

Load and comply with:
1) 00_SYSTEM/BETO_OS_MASTER_SYSTEM_SKILL.md
2) 01_SKILLS/BETO_OS_BACKEND_SKILL.md
3) 01_SKILLS/BETO_OS_FRONTEND_SKILL.md
4) 01_SKILLS/BETO_OS_PRODUCT_SKILL.md
5) 01_SKILLS/BETO_OS_MARKETING_SKILL.md

Before output:
- Validate tenant isolation impact
- Validate billing/seat implications
- Validate scalability and maintainability
- Validate consistency with system doctrine

If misaligned: propose correction before implementation.
"@

Write-File ".\02_AI_RUNTIME\BETO_OS_AGENT_RULES.md" @"
# BETO OS — AGENT RULES (v1.0)

## Non-Negotiables
- Never bypass billing/seat validation
- Never cross tenant boundaries
- Never generate destructive operations without safe guards
- Prefer reversible changes and audit logs

## Execution Discipline
- Propose plan → execute minimal safe change → validate → iterate
"@

Write-File ".\02_AI_RUNTIME\BETO_OS_CONTEXT_LOADING.md" @"
# BETO OS — CONTEXT LOADING (v1.0)

## Session Start Checklist
1) Read MASTER_SYSTEM
2) Read BACKEND + FRONTEND + PRODUCT + MARKETING skills
3) Confirm current module/task
4) Apply relevant rules only (avoid irrelevant noise)
5) Validate impact (security, revenue, scale)
"@

# 6) Architecture Memory templates
Write-File ".\03_ARCHITECTURE_MEMORY\SYSTEM_DECISIONS.md" @"
# System Decisions (ADR-lite)

## Format
- Date:
- Decision:
- Context:
- Options considered:
- Chosen option:
- Consequences:
"@

Write-File ".\03_ARCHITECTURE_MEMORY\DOMAIN_RULES.md" @"
# Domain Rules

## Examples
- Seat limit enforcement rules
- Subscription tier gating rules
- Soft-delete vs hard-delete policy
- Audit requirements
"@

Write-File ".\03_ARCHITECTURE_MEMORY\LESSONS_LEARNED.md" @"
# Lessons Learned

Capture mistakes and fixes to prevent regressions.
Include: issue, root cause, fix, prevention.
"@

# 7) Playbooks templates
Write-File ".\04_PLAYBOOKS\FRONTEND_PLAYBOOK.md" @"
# Frontend Playbook

1) Clarify workflow + primary action
2) Identify reusable component(s)
3) Implement with OSLayout
4) Add empty/error/loading states
5) Validate performance + consistency
"@

Write-File ".\04_PLAYBOOKS\BACKEND_PLAYBOOK.md" @"
# Backend Playbook

1) Validate tenant scope
2) Validate billing/seat impact
3) Implement service layer first
4) Add typed domain errors
5) Add audit logging where needed
"@

Write-File ".\04_PLAYBOOKS\PRODUCT_PLAYBOOK.md" @"
# Product Playbook

1) Define problem + user + workflow
2) Estimate ROI (retention/ARPU/support)
3) Map to tiers/gating
4) Define success metrics
5) Ship smallest valuable slice
"@

Write-File ".\04_PLAYBOOKS\MARKETING_PLAYBOOK.md" @"
# Marketing Playbook

1) Define ICP + pain
2) Message with control/clarity/scale
3) Match tier reality
4) Provide proof (screens, flows, metrics)
5) CTA aligned to funnel stage
"@

# 8) Validate (auto-audit)
$files = @(
  ".\README.md",
  ".\00_SYSTEM\BETO_OS_MASTER_SYSTEM_SKILL.md",
  ".\01_SKILLS\BETO_OS_FRONTEND_SKILL.md",
  ".\01_SKILLS\BETO_OS_BACKEND_SKILL.md",
  ".\01_SKILLS\BETO_OS_PRODUCT_SKILL.md",
  ".\01_SKILLS\BETO_OS_MARKETING_SKILL.md",
  ".\02_AI_RUNTIME\BETO_OS_AI_BOOTLOADER_PROMPT.md",
  ".\02_AI_RUNTIME\BETO_OS_AGENT_RULES.md",
  ".\02_AI_RUNTIME\BETO_OS_CONTEXT_LOADING.md",
  ".\03_ARCHITECTURE_MEMORY\SYSTEM_DECISIONS.md",
  ".\03_ARCHITECTURE_MEMORY\DOMAIN_RULES.md",
  ".\03_ARCHITECTURE_MEMORY\LESSONS_LEARNED.md",
  ".\04_PLAYBOOKS\FRONTEND_PLAYBOOK.md",
  ".\04_PLAYBOOKS\BACKEND_PLAYBOOK.md",
  ".\04_PLAYBOOKS\PRODUCT_PLAYBOOK.md",
  ".\04_PLAYBOOKS\MARKETING_PLAYBOOK.md"
)

foreach ($f in $files) { Assert-NonEmpty $f }

Write-Host "✅ BETO OS AI System rebuilt + validated." -ForegroundColor Green
