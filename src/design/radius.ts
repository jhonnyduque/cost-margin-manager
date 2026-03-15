/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  BETO OS — Border Radius Tokens v2.0                               ║
 * ║  Fuente de verdad: src/styles/global.css                           ║
 * ║  Governance: GOV-RADIUS-001                                        ║
 * ║                                                                    ║
 * ║  REGLA: Estos tokens apuntan a variables CSS de global.css.        ║
 * ║  No hardcodear px o rem aquí. No usar clases Tailwind.             ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export const radius = {

    /** 6px — badges, chips, detalles pequeños */
    sm: 'var(--radius-sm)',

    /** 8px — botones, inputs, nav items */
    md: 'var(--radius-md)',

    /** 12px — metric cards, panels internos */
    lg: 'var(--radius-lg)',

    /** 16px — cards principales, modales */
    xl: 'var(--radius-xl)',

    /** 9999px — pills, avatares */
    pill: '9999px',

} as const;

export type RadiusToken = keyof typeof radius;