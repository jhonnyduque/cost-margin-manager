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

export const tokens = {
    // ── COLORS ──────────────────────────────────────────────────────────────
    colors: {
        // Text (WCAG AA compliant — ratio ≥ 4.5:1 sobre blanco)
        text: {
            primary: '#0F172A',  // slate-900 — Títulos, montos, valores clave
            secondary: '#475569',  // slate-600 — Labels, descripciones (MÍNIMO legible)
            muted: '#94A3B8',  // slate-400 — Hints, placeholders, disabled
        },

        // Brand & estado
        brand: '#2563EB',      // blue-600  — Acción primaria, links, focus
        success: '#10B981',      // emerald-500 — Éxito, ganancias
        warning: '#F59E0B',      // amber-500 — Advertencias
        error: '#EF4444',      // red-500   — Errores, pérdidas

        // Superficies
        bg: '#F8FAFC',   // slate-50  — Fondo de página
        surface: '#FFFFFF',   // Blanco    — Cards, modals, inputs
        surfaceDark: '#111827',   // gray-900  — Sidebar desktop (dark mode)
        border: '#E2E8F0',   // slate-200 — Bordes, divisores
        borderDark: '#374151',   // gray-700  — Bordes en dark mode
    },

    // ── TYPOGRAPHY ──────────────────────────────────────────────────────────
    typography: {
        display: { fontSize: '2rem', fontWeight: 800, lineHeight: '1.2' }, // 32px — Precio sidebar
        h1: { fontSize: '1.5rem', fontWeight: 700, lineHeight: '1.25' }, // 24px — Títulos de página
        h2: { fontSize: '0.8125rem', fontWeight: 700, lineHeight: '1.25' }, // 13px — Secciones (uppercase)
        body: { fontSize: '0.875rem', fontWeight: 500, lineHeight: '1.5' }, // 14px — Contenido general
        label: { fontSize: '0.75rem', fontWeight: 600, lineHeight: '1' }, // 12px — Labels, table headers
        caption: { fontSize: '0.6875rem', fontWeight: 500, lineHeight: '1.25' }, // 11px — MÍNIMO: badges, hints
    },

    letterSpacing: {
        normal: '0',
        wide: '0.05em',   // Section titles (h2)
        widest: '0.1em',    // Uppercase labels
    },

    // ── SPACING ─────────────────────────────────────────────────────────────
    spacing: {
        xs: '8px',   // Gaps internos de componentes
        sm: '12px',  // Padding de badges, gaps de iconos
        md: '16px',  // Padding de inputs, gaps de grids
        lg: '24px',  // Padding de cards, gaps entre secciones
        xl: '32px',  // Margins de página
        xxl: '48px',  // Separaciones grandes
    },

    // ── BORDER RADIUS ───────────────────────────────────────────────────────
    radius: {
        sm: '8px',
        md: '12px',     // Inputs, botones
        lg: '20px',     // Cards, modales
        full: '9999px',   // Avatares, pills
    },

    // ── SHADOWS ─────────────────────────────────────────────────────────────
    shadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px rgba(0, 0, 0, 0.06)',
        elevated: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        modal: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },

    // ── COMPONENT SIZES ─────────────────────────────────────────────────────
    button: {
        heightMobile: '44px',  // Touch target
        heightDesktop: '40px',
        radius: '12px',
    },

    input: {
        height: '40px',
        radius: '12px',
    },

    // ── BREAKPOINTS ─────────────────────────────────────────────────────────
    breakpoint: {
        sm: '640px',    // Móvil horizontal
        md: '768px',    // Tablet
        lg: '1024px',   // Desktop
        xl: '1280px',   // Desktop grande
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export type Token = typeof tokens;
export type TextColor = keyof typeof tokens.colors.text;
export type StatusColor = 'success' | 'warning' | 'error';

// ═══════════════════════════════════════════════════════════════════════════
// TAILWIND BRIDGE UTILITIES
// Puente entre tokens (CSS values) y Tailwind (class names).
// Usar en páginas para mantener consistencia sin hardcodear clases.
// ═══════════════════════════════════════════════════════════════════════════

/** Retorna la clase Tailwind de color de texto para un token. */
export const textClass = (color: TextColor): string => ({
    primary: 'text-slate-900',
    secondary: 'text-slate-600',
    muted: 'text-slate-400',
})[color];

/** Retorna clases Tailwind de estado (text + bg) */
export const statusClasses = (status: StatusColor) => ({
    success: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    warning: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    error: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
})[status];

/** Clases de focus para inputs */
export const inputFocusClasses = 'focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none transition-colors';

/**
 * Section title — implementación Tailwind de `typography.h2` + `letterSpacing.wide`
 * Token source: fontSize 13px, fontWeight 700, letterSpacing 0.05em
 */
export const sectionTitleClasses = 'text-[13px] font-bold uppercase tracking-wide text-slate-900';

/**
 * Input/table label — implementación Tailwind de `typography.label`
 * Token source: fontSize 12px, fontWeight 600, color text.secondary
 */
export const labelClasses = 'text-xs font-semibold text-slate-600';

/**
 * Valor/monto — implementación Tailwind de `typography.body` con peso extrabold
 * Token source: fontSize 14px→18px según contexto, color text.primary
 */
export const valueClasses = 'text-lg font-extrabold tabular-nums text-slate-900';

/** Layout concepto ↔ monto (Key-Value row) */
export const kvRowClasses = 'flex items-baseline justify-between';
