/**
 * 🎨 BETO OS — Color System v2.0
 * Semantic Color Governance
 *
 * Governance: GOV-COLOR-001
 */

export const colors = {
    // ── CORE SEMANTIC TOKENS ────────────────────────────────────────────────
    /** Main brand identity color */
    brand: "text-indigo-600",
    bgBrand: "bg-indigo-600",
    bgBrandSubtle: "bg-indigo-50",
    borderBrand: "border-indigo-200",

    /** Base surfaces */
    surface: "bg-white",
    surfaceMuted: "bg-slate-50",
    surfaceElevated: "bg-white shadow-lg",

    /** Text Hierarchy */
    textPrimary: "text-slate-900",    // Titles, main values
    textSecondary: "text-slate-600",  // Descriptions, labels
    textMuted: "text-slate-500",      // Captions, hints
    textInverted: "text-white",       // Text on dark/brand backgrounds

    /** Borders & Dividers */
    borderSubtle: "border-slate-100",
    borderStandard: "border-slate-200",
    borderStrong: "border-slate-300",

    /** Functional States — Monochrome */
    success: "text-slate-700",
    bgSuccess: "bg-slate-50",
    borderSuccess: "border-slate-200",

    warning: "text-slate-600",
    bgWarning: "bg-slate-50",
    borderWarning: "border-slate-200",

    danger: "text-red-600",
    bgDanger: "bg-red-50",
    borderDanger: "border-red-200",

    info: "text-slate-600",
    bgInfo: "bg-slate-50",
    borderInfo: "border-slate-200",

    // ── LEGACY COMPATIBILITY ────────────────────────────────────────────────
    statusSuccess: "text-slate-700",
    statusWarning: "text-slate-600",
    statusDanger: "text-slate-500",
    statusInfo: "text-slate-600",
    bgMain: "bg-slate-50",
    bgSurface: "bg-white",
} as const;

export type TextColorVariant = keyof typeof colors;
