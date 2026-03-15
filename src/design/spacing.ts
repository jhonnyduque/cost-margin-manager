/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  BETO OS — Spacing Tokens v2.0                                     ║
 * ║  Fuente de verdad: src/styles/global.css                           ║
 * ║  Governance: GOV-SPACE-001                                         ║
 * ║                                                                    ║
 * ║  REGLA: Estos tokens apuntan a variables CSS de global.css.        ║
 * ║  No hardcodear px o rem aquí. No usar clases Tailwind.             ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export const spacing = {

    // ── VALORES BASE (para style prop) ────────────────────────────────────
    /** 2px — micro ajustes */
    s2: 'var(--space-2)',
    /** 4px — gaps mínimos */
    s4: 'var(--space-4)',
    /** 8px — compacto */
    s8: 'var(--space-8)',
    /** 12px — padding interno pequeño */
    s12: 'var(--space-12)',
    /** 16px — padding estándar */
    s16: 'var(--space-16)',
    /** 24px — padding de cards, gaps de sección */
    s24: 'var(--space-24)',
    /** 32px — padding de contenido */
    s32: 'var(--space-32)',
    /** 48px — separación entre secciones */
    s48: 'var(--space-48)',
    /** 64px — separación mayor */
    s64: 'var(--space-64)',

    // ── ALIAS SEMÁNTICOS ───────────────────────────────────────────────────
    /** Padding interno de componentes pequeños */
    componentSm: 'var(--space-8)',
    /** Padding interno estándar de componentes */
    component: 'var(--space-16)',
    /** Padding de cards */
    card: 'var(--space-24)',
    /** Padding del área de contenido */
    content: 'var(--space-32)',
    /** Separación entre secciones de página */
    section: 'var(--space-48)',

    // ── CONTENEDORES ──────────────────────────────────────────────────────
    container: {
        sm: 'var(--container-sm)',
        md: 'var(--container-md)',
        lg: 'var(--container-lg)',
        /** 1280px — max-width de BETO OS */
        xl: 'var(--container-xl)',
    },

} as const;

export type SpacingToken = keyof typeof spacing;