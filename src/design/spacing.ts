/**
 * 📏 BETO OS — Spacing System v1.0
 * Governance: GOV-SPACE-001
 */

export const spacing = {
    // ── 8px GRID SYSTEM ────────────────────────────────────────────────────
    /** 4px - Micro adjustments */
    xs: "gap-1",
    pXs: "p-1",
    pxXs: "px-1",
    pyXs: "py-1",

    /** 8px - Compact */
    sm: "gap-2",
    pSm: "p-2",
    pxSm: "px-2",
    pySm: "py-2",

    /** 16px - Standard UI Padding/Gap */
    md: "gap-4",
    pMd: "p-4",
    pxMd: "px-4",
    pyMd: "py-4",

    /** 24px - Section Inner Padding */
    lg: "gap-6",
    pLg: "p-6",
    pxLg: "px-6",
    pyLg: "py-6",

    /** 32px - Module Spacing */
    xl: "gap-8",
    pXl: "p-8",
    pxXl: "px-8",
    pyXl: "py-8",

    /** 48px - Page Margin */
    '2xl': "gap-12",
    p2xl: "p-12",
    px2xl: "px-12",
    py2xl: "py-12",

    // ── CONTAINER WIDTHS ───────────────────────────────────────────────────
    container: {
        sm: "max-w-[640px]",
        md: "max-w-[768px]",
        lg: "max-w-[1024px]",
        xl: "max-w-[1280px]",
        full: "max-w-full",
    },

    // ── LEGACY COMPATIBILITY ──────────────────────────────────────────────
    page: "p-12",
} as const;
