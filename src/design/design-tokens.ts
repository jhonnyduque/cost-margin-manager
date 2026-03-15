/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  BETO OS — Design Tokens v2.0                                      ║
 * ║  Índice central de todos los tokens de diseño.                     ║
 * ║                                                                    ║
 * ║  Fuente de verdad visual: src/styles/global.css                    ║
 * ║  Estos tokens son un puente TypeScript → variables CSS.            ║
 * ║  Last updated: 2026-03-15                                          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * USO CORRECTO:
 *
 *   // En componentes — con style prop:
 *   import { colors, spacing, radius } from '@/design/design-tokens';
 *   <div style={{ color: colors.textPrimary, padding: spacing.card }}>
 *
 *   // En componentes — con clases CSS (preferido):
 *   <div className="card">
 *   <p className="text-muted">
 *
 * REGLA: Si el valor que necesitas no existe aquí ni en global.css,
 * propónlo primero. No lo inventes.
 */

import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';

export const tokens = {
    colors,
    typography,
    spacing,
    radius,
    shadows,
} as const;

// ── STATUS HELPER ──────────────────────────────────────────────────────────
export type StatusColor = 'success' | 'warning' | 'danger' | 'info';

export const getStatusColors = (status: StatusColor) => ({
    success: {
        text: colors.success,
        bg: colors.bgSuccess,
        border: colors.borderSuccess,
    },
    warning: {
        text: colors.warning,
        bg: colors.bgWarning,
        border: colors.borderWarning,
    },
    danger: {
        text: colors.danger,
        bg: colors.bgDanger,
        border: colors.borderDanger,
    },
    info: {
        text: colors.info,
        bg: colors.bgInfo,
        border: colors.borderInfo,
    },
})[status];

// ── EXPORTS INDIVIDUALES ───────────────────────────────────────────────────
export { colors, typography, spacing, radius, shadows };
export type { ColorToken } from './colors';
export type { SpacingToken } from './spacing';
export type { RadiusToken } from './radius';
export type { ShadowToken } from './shadows';
export type { TypographyToken } from './typography';