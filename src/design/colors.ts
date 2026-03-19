/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  BETO OS — Color Tokens v4.0                                       ║
 * ║  Fuente de verdad: src/styles/global.css                           ║
 * ║  Governance: GOV-COLOR-001                                         ║
 * ║                                                                    ║
 * ║  REGLA: Estos tokens apuntan a variables CSS semánticas de         ║
 * ║  global.css. No hardcodear hex. No usar clases Tailwind.           ║
 * ║  Si necesitas un color nuevo, primero agrégalo a global.css.       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export const colors = {

    // ── MARCA ─────────────────────────────────────────────────────────────
    brand: 'var(--state-primary)',
    brandSoft: 'var(--surface-primary-soft)',
    brandHover: 'var(--state-primary-hover)',
    brandActive: 'var(--state-primary-active)',

    // ── SUPERFICIES ────────────────────────────────────────────────────────
    surface: 'var(--surface-card)',
    surfacePage: 'var(--surface-page)',
    surfaceMuted: 'var(--surface-muted)',
    surfaceInverse: 'var(--surface-inverse)',

    // ── TEXTO ──────────────────────────────────────────────────────────────
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
    textSoft: 'var(--text-soft)',
    textInverse: 'var(--text-inverse)',
    textLink: 'var(--text-link)',

    // ── BORDES ─────────────────────────────────────────────────────────────
    borderDefault: 'var(--border-color-default)',
    borderStrong: 'var(--border-color-strong)',
    borderPrimary: 'var(--border-color-primary)',

    // ── ESTADOS ────────────────────────────────────────────────────────────
    success: 'var(--state-success)',
    successSoft: 'var(--surface-success-soft)',
    borderSuccess: 'var(--border-color-success)',

    warning: 'var(--state-warning)',
    warningSoft: 'var(--surface-warning-soft)',
    borderWarning: 'var(--border-color-warning)',

    danger: 'var(--state-danger)',
    dangerSoft: 'var(--surface-danger-soft)',
    dangerHover: 'var(--state-danger-hover)',
    borderDanger: 'var(--border-color-danger)',

    info: 'var(--state-info)',
    infoSoft: 'var(--surface-info-soft)',
    borderInfo: 'var(--border-color-info)',

    // ── HELPERS (alias) ────────────────────────────────────────────────────
    bgSuccess: 'var(--surface-success-soft)',
    bgWarning: 'var(--surface-warning-soft)',
    bgDanger: 'var(--surface-danger-soft)',
    bgInfo: 'var(--surface-info-soft)',

    // ── CHARTS ─────────────────────────────────────────────────────────────
    chartA: 'var(--chart-a)',
    chartB: 'var(--chart-b)',
    chartC: 'var(--chart-c)',
    chartD: 'var(--chart-d)',
    chartE: 'var(--chart-e)',

} as const;

export type ColorToken = keyof typeof colors;
export type StatusColor = 'success' | 'warning' | 'danger' | 'info';