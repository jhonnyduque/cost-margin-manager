
📘 BETO OS — TYPOGRAPHY GOVERNANCE v1.3
Document Type: Sub-Governance Rule
Governance Parent: BETO_OS_GOVERNANCE_MASTER_v2.0
Rule ID: GOV-TYPE-001
Effective Date: 2026-03-04
Status: ✅ APPROVED
Owner: BETO OS Design Architecture

---

# 🎨 RULE: TYPOGRAPHIC CONSISTENCY

This document defines the official typographic governance for BETO OS.

It extends and operationalizes the rule defined in:

MASTER DOCUMENT → Section 1.2 Typographic Consistency

All UI components, modules, dashboards, pages, and AI-generated code MUST comply with this document.

Violation of this rule is considered a **Design System Governance Breach** and may block CI/CD pipelines.

---

# 1. SINGLE SOURCE FONT

BETO OS uses **one single font family across the entire system**.

Official Font

Inter (Variable Font)

Fallback Stack

font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;

Implementation Requirements

• Font must be self-hosted  
• Use variable font format (woff2)  
• Use font-display: swap  
• Loaded globally in the root layout  

Example

@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-var.woff2") format("woff2");
  font-display: swap;
}

PROHIBITED

• Adding additional font families  
• Loading Google Fonts per component  
• Mixing serif/sans-serif families in UI  
• Inline font-family declarations  

Any font change requires explicit approval from the BETO OS Design Architect.

---

# 2. TYPOGRAPHIC SCALE (MANDATORY)

Font sizes must follow the official BETO OS scale.

Hardcoded pixel values are **strictly prohibited**.

Approved Scale

| Token | Size | Usage |
|------|------|------|
| xs | 12px | Metadata, captions |
| sm | 14px | Labels, secondary text |
| base | 16px | Body text |
| lg | 18px | Subtitles |
| xl | 20px | Section headers |
| 2xl | 24px | Page sections |
| 3xl | 30px | Dashboard headings |
| 4xl | 36px | Critical metrics |

Correct usage must reference **design tokens**, never raw values.

Example

tokens.typography.base

PROHIBITED

text-[14px]  
style={{ fontSize: "17px" }}

---

# 3. DESIGN TOKENS (SOURCE OF TRUTH)

All typography must derive from **BETO OS Design Tokens**.

Token Source

src/design/design-tokens.ts

Example structure

export const tokens = {
  typography: {
    xs: "12px",
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "20px"
  },
  colors: {
    textPrimary: "#0f172a",
    textSecondary: "#475569"
  }
}

Tokens define **values**, not Tailwind classes.

Benefits

• Framework independence  
• Future migration safety  
• Centralized design control  

---

# 4. TYPOGRAPHY HELPERS

To avoid repeated styling logic, typography helpers must exist.

File

src/design/typography.ts

Example

export const typography = {
  pageTitle: "text-4xl font-bold text-slate-900",
  sectionTitle: "text-2xl font-semibold text-slate-800",
  body: "text-base text-slate-700",
  caption: "text-sm text-slate-500"
}

Components should import helpers instead of manually writing styles.

---

# 5. UI COMPONENT WRAPPERS (RECOMMENDED)

For stronger design control, BETO OS may implement wrapper UI components.

Example

src/ui/Text.tsx

export function Text({ variant = "body", children }) {
  const map = {
    body: "text-base text-slate-700",
    caption: "text-sm text-slate-600",
    title: "text-xl font-semibold text-slate-900"
  };

  return <p className={map[variant]}>{children}</p>;
}

Benefits

• Prevents raw Tailwind usage  
• Enforces visual consistency  
• Simplifies component styling  

---

# 6. FONT WEIGHTS

Allowed weights

| Weight | Usage |
|------|------|
| 400 | Body text |
| 500 | Labels |
| 600 | Section titles |
| 700 | Page headings |

PROHIBITED

100, 200, 300, 800, 900

Reasons

• Reduce font payload  
• Maintain visual hierarchy  
• Avoid design fragmentation  

---

# 7. LINE HEIGHT GOVERNANCE

Line height must follow the approved readability scale.

| Text Size | Line Height |
|----------|-------------|
| xs | 1.4 |
| sm | 1.45 |
| base | 1.5 |
| lg | 1.55 |
| headings | 1.2 |

Example

className="text-base leading-relaxed"

---

# 8. ACCESSIBILITY (WCAG 2.1 AA)

Typography must meet WCAG AA accessibility standards.

Minimum contrast requirements

| Text Type | Size | Minimum Contrast |
|----------|------|-----------------|
| Normal text | <18px | 4.5:1 |
| Large text | ≥18px | 3:1 |

Recommended text colors

text-slate-900 → primary text  
text-slate-700 → body text  
text-slate-600 → secondary text  

PROHIBITED

text-gray-400  
text-slate-400  
low contrast color combinations

---

# 9. RESPONSIVE TYPOGRAPHY

Typography must follow **mobile-first scaling**.

| Level | Desktop | Mobile |
|------|--------|-------|
| H1 | 32px | 24px |
| H2 | 24px | 20px |
| H3 | 18px | 16px |
| Body | 16px | 16px |
| Label | 12px | 12px |

Correct implementation

className="text-xl lg:text-2xl"

PROHIBITED

Manual CSS media queries for font-size.

---

# 10. AUTOMATED GOVERNANCE AUDIT

Typography compliance must be verified automatically.

Script

scripts/audit-governance.js

The script must detect prohibited patterns.

Examples

text-[\d+px]  
font-size:  
text-gray-400  
text-slate-400  
style={{ fontSize  

If violations are found

console.error("Design governance violation detected")
process.exit(1)

---

# 11. CI/CD ENFORCEMENT

CI/CD pipelines must execute the governance audit before build.

Example package.json

"scripts": {
  "audit:design": "node scripts/audit-governance.js"
}

If violations exist the pipeline must fail.

---

# 12. COMPLIANCE SUMMARY

This governance rule guarantees

• Consistent typography across the SaaS  
• Accessibility compliance (WCAG)  
• Design system integrity  
• Maintainable frontend architecture  
• AI-safe code generation  

All BETO OS interfaces must comply with this rule.

Failure to comply will block merge requests.

---

BETO OS Design Governance
