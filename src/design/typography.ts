/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  BETO OS — Typography Tokens v2.0                                  ║
 * ║  Fuente de verdad: src/styles/global.css                           ║
 * ║  Governance: GOV-TYPE-001                                          ║
 * ║                                                                    ║
 * ║  REGLA: Estos tokens apuntan a variables CSS de global.css.        ║
 * ║  Usar clases CSS (.text-h1, .text-body, etc.) cuando sea posible.  ║
 * ║  Usar style prop con estas variables solo cuando no haya clase.    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export const typography = {

    // ── TAMAÑOS ────────────────────────────────────────────────────────────
    size: {
        /** 32px — hero, displays grandes */
        display: 'var(--text-display-size)',
        /** 28px — títulos de página */
        h1: 'var(--text-h1-size)',
        /** 22px — títulos de sección */
        h2: 'var(--text-h2-size)',
        /** 18px — títulos de card */
        h3: 'var(--text-h3-size)',
        /** 15px — cuerpo de texto estándar */
        body: 'var(--text-body-size)',
        /** 13px — texto secundario, labels */
        small: 'var(--text-small-size)',
    },

    // ── PESOS ──────────────────────────────────────────────────────────────
    weight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
    },

    // ── LINE HEIGHT ────────────────────────────────────────────────────────
    lineHeight: {
        display: 'var(--text-display-line)',
        h1: 'var(--text-h1-line)',
        h2: 'var(--text-h2-line)',
        h3: 'var(--text-h3-line)',
        body: 'var(--text-body-line)',
        small: 'var(--text-small-line)',
    },

    // ── LETTER SPACING ─────────────────────────────────────────────────────
    tracking: {
        tight: '-0.02em',   /* display, h1 */
        snug: '-0.01em',   /* h2 */
        normal: '0',         /* h3, body */
        wide: '0.01em',    /* small */
        wider: '0.02em',    /* table headers */
        widest: '0.06em',    /* nav section labels */
    },

    // ── FAMILIAS ───────────────────────────────────────────────────────────
    family: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
    },

    // ── ICON SIZES (px como número para props de iconos) ───────────────────
    icon: {
        xs: 14,   /* acciones pequeñas */
        sm: 16,   /* iconos estándar de UI */
        md: 20,   /* iconos de métricas */
        lg: 24,   /* iconos decorativos */
    },

    // ── CLASES CSS DISPONIBLES (preferir estas sobre style prop) ───────────
    // .text-display · .text-h1 · .text-h2 · .text-h3
    // .text-body    · .text-small
    // .text-primary · .text-secondary · .text-muted
    // .text-success · .text-warning · .text-danger · .text-info
    // .font-mono    · .tabular

} as const;

export type TypographyToken = keyof typeof typography;