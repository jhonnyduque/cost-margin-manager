/**
 * BETO OS — Financial Metrics Engine
 * Central motor for all pricing and profitability decisions.
 * No component should compute these values independently.
 */

export interface FinancialMetrics {
    /** Price minus FIFO cost (real money earned or lost) */
    profitVsCost: number;
    /** Human-readable label for profitability indicator */
    profitLabel: string;

    /** Real margin as a decimal: (price - cost) / price */
    realMargin: number;

    /** Price required to hit the target margin */
    priceTarget: number;

    /** How much to adjust current price to reach the target (positive = need to increase) */
    adjustmentNeeded: number;
    /** Human-readable label for target compliance indicator */
    adjustmentLabel: string;

    /** Categorical state for UI color/icon decisions */
    targetStatus: 'increase_required' | 'above_target' | 'on_target';
}

/**
 * Calculate all financial metrics from primitives.
 * @param cost       FIFO unit cost of the product
 * @param currentPrice  The price the user is entering / has set
 * @param marginTarget  Target margin as a decimal (e.g. 0.30 for 30%)
 */
export function calculateFinancialMetrics(
    cost: number,
    currentPrice: number,
    marginTarget: number
): FinancialMetrics {
    // ── Rentabilidad ──────────────────────────────────────────────────────────
    const profitVsCost = currentPrice - cost;

    const realMargin =
        currentPrice === 0
            ? 0
            : (currentPrice - cost) / currentPrice;

    // ── Precio objetivo según margen ──────────────────────────────────────────
    const priceTarget =
        marginTarget >= 1
            ? 0
            : cost / (1 - marginTarget);

    // ── Ajuste necesario ──────────────────────────────────────────────────────
    const adjustmentNeeded = priceTarget - currentPrice;

    // ── Labels ────────────────────────────────────────────────────────────────
    const profitLabel =
        profitVsCost >= 0
            ? `+$${profitVsCost.toFixed(2)} sobre costo FIFO`
            : `-$${Math.abs(profitVsCost).toFixed(2)} bajo costo FIFO`;

    const adjustmentLabel =
        adjustmentNeeded > 0.005
            ? `Sube $${adjustmentNeeded.toFixed(2)} para alcanzar el margen objetivo`
            : adjustmentNeeded < -0.005
                ? `Superas el objetivo por $${Math.abs(adjustmentNeeded).toFixed(2)}`
                : `Objetivo de margen alcanzado`;

    const targetStatus =
        adjustmentNeeded > 0.005
            ? 'increase_required'
            : adjustmentNeeded < -0.005
                ? 'above_target'
                : 'on_target';

    return {
        profitVsCost,
        profitLabel,
        realMargin,
        priceTarget,
        adjustmentNeeded,
        adjustmentLabel,
        targetStatus,
    };
}
