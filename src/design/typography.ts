/**
 * 📘 BETO OS — Typography System v2.0
 * Strict Governance Typography Scale
 *
 * Principles:
 * - Limited font scale for UI consistency
 * - Hierarchy created with weight, not size
 * - Metrics constrained to dashboard standards
 * - Responsive but controlled scaling
 *
 * Governance: GOV-TYPE-001
 */

import { colors } from './colors';

export const typography = {
    // ── TEXT VARIANTS ───────────────────────────────────────────────────────
    text: {
        /** Hero titles, large displays (30px/36px) */
        display: "text-2xl md:text-3xl font-bold tracking-tight leading-tight",

        /** Primary page headers (24px) */
        title: "text-xl md:text-2xl font-bold tracking-tight leading-snug",

        /** Section headers, card titles (18px) */
        section: "text-lg font-semibold leading-relaxed",

        /** Standard body text (14px/16px) */
        body: "text-sm md:text-base font-normal leading-normal",

        /** Secondary/Small body text (12px/14px) */
        secondary: "text-xs md:text-sm font-normal leading-normal",

        /** Metadata, captions, labels (11px/12px) */
        caption: "text-[11px] md:text-xs font-medium uppercase tracking-wider",

        /** Micro text for high-density UI (10px) */
        micro: "text-[10px] leading-tight font-medium",

        /** Tiny text for metadata (9px) */
        tiny: "text-[9px] leading-tight font-medium",
    },

    // ── ICON SIZES ──────────────────────────────────────────────────────────
    icon: {
        /** Small action icons (14px) */
        xs: "14",
        /** Standard UI icons (16px) */
        sm: "16",
        /** Metric/Feature icons (20px) */
        md: "20",
        /** Large display icons (24px) */
        lg: "24",
    },

    // ── LEGACY COMPATIBILITY (TO BE DEPRECATED) ───────────────────────────
    pageTitle: "text-2xl md:text-3xl font-bold tracking-tight",
    sectionTitle: "text-lg md:text-xl font-semibold",
    cardTitle: "text-base font-semibold",
    body: "text-sm md:text-base font-normal",
    bodySm: "text-xs md:text-sm font-normal",
    uiLabel: "text-xs font-medium uppercase tracking-wide",
    caption: "text-xs",
    metric: "text-xl md:text-2xl font-semibold tabular-nums",
    metricSm: "text-base font-semibold tabular-nums",
} as const;


/**
 * Enforces valid typography variants
 */
export type TypographyVariant = keyof typeof typography;
