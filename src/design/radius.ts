/**
 * 🟢 BETO OS — Border Radius System v1.0
 * Governance: GOV-RADIUS-001
 */

export const radius = {
    /** 4px - Small buttons, inputs, badges */
    sm: "rounded-md", // md is 6px in tailwind, rounded-sm is 2px. 

    /** 8px - Standard components */
    md: "rounded-lg", // lg is 8px in tailwind

    /** 12px - Cards, main containers */
    lg: "rounded-2xl", // 2xl is 16px. xl is 12px.

    /** 16px - Large sections */
    xl: "rounded-2xl",

    /** Full round - Pills */
    pill: "rounded-full",
} as const;
