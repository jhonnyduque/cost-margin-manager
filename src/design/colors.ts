/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  BETO OS — Color Tokens v2.0                                       ║
 * ║  Fuente de verdad: src/styles/global.css                           ║
 * ║  Governance: GOV-COLOR-001                                         ║
 * ║                                                                    ║
 * ║  REGLA: Estos tokens apuntan a variables CSS de global.css.        ║
 * ║  No hardcodear hex aquí. No usar clases Tailwind.                  ║
 * ║  Si necesitas un color nuevo, primero agrégalo a global.css.       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export const colors = {

    // ── BRAND ─────────────────────────────────────────────────────────────
    /** Acciones principales, estados activos */
    brand: 'var(--color-primary)',
    brandSoft: 'var(--color-primary-soft)',

    // ── SUPERFICIES ────────────────────────────────────────────────────────
    /** Fondo blanco base — cards, modales */
    surface: 'var(--color-neutral-0)',
    /** Canvas de página */
    surfacePage: 'var(--color-neutral-50)',
    /** Superficie muted — headers de tabla, fondos inset */
    surfaceMuted: 'var(--color-neutral-100)',

    // ── TEXTO ──────────────────────────────────────────────────────────────
    /** Títulos, valores principales */
    textPrimary: 'var(--color-neutral-900)',
    /** Descripciones, labels */
    textSecondary: 'var(--color-neutral-700)',
    /** Captions, hints, placeholders */
    textMuted: 'var(--color-neutral-400)',
    /** Texto sobre fondos oscuros o de marca */
    textInverted: 'var(--color-neutral-0)',

    // ── BORDES ─────────────────────────────────────────────────────────────
    /** Borde estándar — cards, inputs, divisores */
    borderDefault: 'var(--color-neutral-200)',
    /** Borde sutil — separadores internos */
    borderSubtle: 'var(--color-neutral-100)',
    /** Borde fuerte — hover, énfasis */
    borderStrong: 'var(--color-neutral-400)',

    // ── ESTADOS SEMÁNTICOS ─────────────────────────────────────────────────
    success: 'var(--color-success)',
    successSoft: 'var(--color-success-soft)',

    warning: 'var(--color-warning)',
    warningSoft: 'var(--color-warning-soft)',

    danger: 'var(--color-danger)',
    dangerSoft: 'var(--color-danger-soft)',

    info: 'var(--color-info)',
    infoSoft: 'var(--color-info-soft)',

    // ── HELPERS DE ESTADO (para style prop en componentes) ─────────────────
    bgSuccess: 'var(--color-success-soft)',
    bgWarning: 'var(--color-warning-soft)',
    bgDanger: 'var(--color-danger-soft)',
    bgInfo: 'var(--color-info-soft)',

    borderSuccess: 'var(--color-success)',
    borderWarning: 'var(--color-warning)',
    borderDanger: 'var(--color-danger)',
    borderInfo: 'var(--color-info)',

    // ── CHARTS ─────────────────────────────────────────────────────────────
    chartA: 'var(--color-chart-a)',
    chartB: 'var(--color-chart-b)',
    chartC: 'var(--color-chart-c)',
    chartD: 'var(--color-chart-d)',
    chartE: 'var(--color-chart-e)',

} as const;

export type ColorToken = keyof typeof colors;
export type StatusColor = 'success' | 'warning' | 'danger' | 'info';