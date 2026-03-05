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
    borderBrand: "border-indigo-100",

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

    /** Functional States */
    success: "text-emerald-700",
    bgSuccess: "bg-emerald-50",
    borderSuccess: "border-emerald-200",

    warning: "text-amber-800",
    bgWarning: "bg-amber-50",
    borderWarning: "border-amber-200",

    danger: "text-red-700",
    bgDanger: "bg-red-50",
    borderDanger: "border-red-200",

    info: "text-blue-700",
    bgInfo: "bg-blue-50",
    borderInfo: "border-blue-200",

    // ── LEGACY COMPATIBILITY (TO BE DEPRECATED) ───────────────────────────
    statusSuccess: "text-emerald-700",
    statusWarning: "text-amber-800",
    statusDanger: "text-red-700",
    statusInfo: "text-blue-700",
    bgMain: "bg-slate-50",
    bgSurface: "bg-white",
} as const;

export type TextColorVariant = keyof typeof colors;
