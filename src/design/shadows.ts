/**
 * 🌑 BETO OS — Depth & Shadows v1.0
 * Governance: GOV-SHADOW-001
 */

export const shadows = {
    /** Barely visible depth for subtle elements */
    sm: "shadow-sm",

    /** Standard Card depth */
    card: "shadow-sm border-slate-200/60",

    /** Elevated popovers and dropdowns */
    popover: "shadow-md border-slate-200/80",

    /** High elevation for modals */
    modal: "shadow-xl border-white/10",

    // ── LEGACY COMPATIBILITY ──────────────────────────────────────────────
    md: "shadow",
    lg: "shadow-md",
    xl: "shadow-lg",
} as const;
