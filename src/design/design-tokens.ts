/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  BETO OS — Design Tokens v1.0                                      ║
 * ║  Single source of truth for visual identity.                       ║
 * ║  Governance: design_system_governance.md                           ║
 * ║  Last updated: 2026-03-03                                          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * REGLAS:
 * 1. NUNCA hardcodear colores/tamaños en páginas — usar tokens.
 * 2. Si necesitas un valor Tailwind, usa las utilities al final.
 * 3. Para agregar tokens, documentar en design_system_governance.md.
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
    shadow: shadows,
} as const;

export type Token = typeof tokens;
export type StatusColor = 'success' | 'warning' | 'error' | 'info';

/** Status classes helper consuming semantic tokens */
export const getStatusClasses = (status: StatusColor) => ({
    success: { text: colors.success, bg: colors.bgSuccess, border: colors.borderSuccess },
    warning: { text: colors.warning, bg: colors.bgWarning, border: colors.borderWarning },
    error: { text: colors.danger, bg: colors.bgDanger, border: colors.borderDanger },
    info: { text: colors.info, bg: colors.bgInfo, border: colors.borderInfo },
})[status];

export { colors, typography, spacing, radius, shadows };
