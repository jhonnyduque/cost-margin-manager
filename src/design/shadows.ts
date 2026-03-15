/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  BETO OS — Shadow Tokens v2.0                                      ║
 * ║  Fuente de verdad: src/styles/global.css                           ║
 * ║  Governance: GOV-SHADOW-001                                        ║
 * ║                                                                    ║
 * ║  REGLA: Estos tokens apuntan a variables CSS de global.css.        ║
 * ║  No hardcodear valores de sombra aquí. No usar clases Tailwind.    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export const shadows = {

    /** Sombra sutil — cards estándar */
    sm: 'var(--shadow-sm)',

    /** Sombra estándar — popovers, dropdowns elevados */
    md: 'var(--shadow-md)',

    /** Sombra alta — modales, overlays */
    lg: 'var(--shadow-lg)',

    // ── ALIAS SEMÁNTICOS ───────────────────────────────────────────────────
    /** Cards — alias de sm */
    card: 'var(--shadow-sm)',
    /** Popovers y dropdowns — alias de md */
    popover: 'var(--shadow-md)',
    /** Modales — alias de lg */
    modal: 'var(--shadow-lg)',

} as const;

export type ShadowToken = keyof typeof shadows;