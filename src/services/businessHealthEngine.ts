/**
 * businessHealthEngine.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Capa 1 del Active Protection System.
 * Responsabilidad ÚNICA: detectar señales de riesgo a partir de los datos
 * del Single Ledger y emitir un HealthReport estructurado.
 *
 * REGLA: Este módulo es puro TypeScript. Sin React, sin efectos, sin imports
 * de UI. Cualquier función aquí debe ser determinista y testeable.
 */

import {
    Product,
    RawMaterial,
    MaterialBatch,
    StockMovement,
    ProductMovement,
} from '@/types';
import {
    calculateProductCost,
    calculateMargin,
    calculateTotalFinancialDebt,
    getMaterialDebt,
} from '../store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Severity = 'critico' | 'alto' | 'medio' | 'bajo';
export type SignalType =
    | 'debt'
    | 'margin_drift'
    | 'stock_break'
    | 'dead_stock'
    | 'price_below_cost';

export interface RiskSignal {
    id: string;
    type: SignalType;
    severity: Severity;
    affectedEntityId: string;
    affectedEntityName: string;
    /** 0.0 – 1.0. 1.0 = certeza absoluta (ej: deuda ya contabilizada) */
    probability: number;
    /** Pérdida monetaria estimada en la moneda del negocio */
    estimatedImpact: number;
    /** Días hasta que el riesgo se materializa (0 = ya ocurrió) */
    timeToImpactDays: number;
    /** Datos crudos útiles para el decisionEngine */
    rawData: Record<string, unknown>;
}

export interface KPI {
    label: string;
    value: number;
    formatted: string;
    trend: 'up' | 'down' | 'stable';
    riskLevel: Severity | 'ok';
}

export interface HealthReport {
    generatedAt: string;
    /** 0–100. La "temperatura" global del negocio */
    healthScore: number;
    overallStatus: 'saludable' | 'riesgo' | 'critico';
    signals: RiskSignal[];
    kpis: KPI[];
}

export interface HealthCheckInput {
    products: Product[];
    rawMaterials: RawMaterial[];
    batches: MaterialBatch[];
    movements: StockMovement[];
    productMovements: ProductMovement[];
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

const currency = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const pct = (n: number) => `${n.toFixed(1)}%`;

/** Consumo diario promedio de un material en los últimos 30 días, en unidades del material */
function avgDailyConsumption(materialId: string, movements: StockMovement[]): number {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = movements.filter(
        (m) =>
            m.material_id === materialId &&
            (m.type === 'egreso' || m.type === 'egreso_asumido' || m.type === 'egreso_compensatorio') &&
            new Date(m.created_at).getTime() > cutoff
    );
    const totalConsumed = recent.reduce((acc, m) => acc + m.quantity, 0);
    return totalConsumed / 30;
}

/** Días estimados hasta quiebre de stock dado el consumo diario */
function daysUntilBreak(remaining: number, daily: number): number {
    if (daily <= 0) return Infinity;
    return remaining / daily;
}

// ─── Detectores de señales ────────────────────────────────────────────────────

/** SEÑAL: Producción con deuda activa no regularizada */
function detectDebt(
    movements: StockMovement[],
    rawMaterials: RawMaterial[],
    batches: MaterialBatch[]
): RiskSignal[] {
    const totalDebt = calculateTotalFinancialDebt(movements, rawMaterials);
    if (totalDebt <= 0) return [];

    // Calcular impacto como proporción del valor total del inventario
    const totalInventoryValue = batches.reduce(
        (acc, b) => acc + b.remaining_quantity * b.unit_cost,
        0
    );

    return [
        {
            id: 'debt-active',
            type: 'debt',
            severity: 'critico',
            affectedEntityId: 'ledger',
            affectedEntityName: 'Ledger de Inventario',
            probability: 1.0, // La deuda YA existe, certeza total
            estimatedImpact: totalDebt,
            timeToImpactDays: 0, // Ya ocurrió
            rawData: { totalDebt, totalInventoryValue },
        },
    ];
}

/** SEÑAL: Margen por debajo del costo real (venta en pérdida) */
function detectPriceBelowCost(
    products: Product[],
    batches: MaterialBatch[],
    rawMaterials: RawMaterial[]
): RiskSignal[] {
    const signals: RiskSignal[] = [];
    for (const p of products) {
        const cost = calculateProductCost(p, batches, rawMaterials);
        if (cost > 0 && p.price < cost) {
            signals.push({
                id: `price-below-cost-${p.id}`,
                type: 'price_below_cost',
                severity: 'critico',
                affectedEntityId: p.id,
                affectedEntityName: p.name,
                probability: 1.0,
                estimatedImpact: (cost - p.price) * 10, // Estimado: 10 unidades de venta perdida
                timeToImpactDays: 0,
                rawData: { cost, price: p.price, deficit: cost - p.price },
            });
        }
    }
    return signals;
}

/** SEÑAL: Margen real por debajo del target configurado */
function detectMarginDrift(
    products: Product[],
    batches: MaterialBatch[],
    rawMaterials: RawMaterial[]
): RiskSignal[] {
    const signals: RiskSignal[] = [];
    for (const p of products) {
        const targetMargin: number = (p as any).target_margin ?? 30;
        const cost = calculateProductCost(p, batches, rawMaterials);
        const actualMargin = calculateMargin(p.price, cost);
        const drift = targetMargin - actualMargin;

        if (drift > 5 && cost > 0) {
            const severity: Severity = drift > 20 ? 'alto' : 'medio';
            // Impacto estimado: cuánto dinero extra se necesita subir el precio para alcanzar el target
            const targetPrice = cost / (1 - targetMargin / 100);
            const gap = targetPrice - p.price;
            signals.push({
                id: `margin-drift-${p.id}`,
                type: 'margin_drift',
                severity,
                affectedEntityId: p.id,
                affectedEntityName: p.name,
                probability: 0.9,
                estimatedImpact: gap > 0 ? gap * 10 : 0, // Estimado 10 unidades
                timeToImpactDays: 1, // Cada venta que se haga hoy pierde margen
                rawData: { actualMargin, targetMargin, drift, cost, targetPrice, gap },
            });
        }
    }
    return signals;
}

/** SEÑAL: Quiebre inminente de stock de materia prima */
function detectStockBreak(
    rawMaterials: RawMaterial[],
    batches: MaterialBatch[],
    movements: StockMovement[],
    productMovements: ProductMovement[]
): RiskSignal[] {
    const signals: RiskSignal[] = [];

    // Calcular consumo mensual real de cada material usando ingreso_produccion
    // Si hay 0 producciones recientes, usamos los egreso movements como proxy
    const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentProductions = productMovements.filter(
        (pm) => pm.type === 'ingreso_produccion' && new Date(pm.created_at).getTime() > cutoff30
    );
    // Contar cuántas veces se produjo cada producto en el último mes
    const productionFrequency = new Map<string, number>();
    for (const pm of recentProductions) {
        productionFrequency.set(pm.product_id, (productionFrequency.get(pm.product_id) || 0) + 1);
    }

    for (const mat of rawMaterials) {
        const matBatches = batches.filter((b) => b.material_id === mat.id);
        const remaining = matBatches.reduce((acc, b) => acc + b.remaining_quantity, 0);
        const debtQty = getMaterialDebt(mat.id, movements).pendingQty;
        const effectiveRemaining = Math.max(0, remaining - debtQty);

        // Consumo diario: primero intentamos con movimientos reales, luego producción
        const dailyRate = avgDailyConsumption(mat.id, movements);
        const days = daysUntilBreak(effectiveRemaining, dailyRate);

        if (days < 7 && days !== Infinity) {
            const avgUnitCost =
                matBatches.length > 0
                    ? matBatches.reduce((acc, b) => acc + b.unit_cost * b.initial_quantity, 0) /
                    matBatches.reduce((acc, b) => acc + b.initial_quantity, 1)
                    : 0;

            const daysRound = Math.floor(days);
            const severity: Severity =
                daysRound <= 1 ? 'critico' : daysRound <= 3 ? 'alto' : 'medio';

            // ¿Cuántos productos dependen de esta materia prima?
            const dependentProductIds = new Set(
                recentProductions.filter((pm) =>
                    movements.some((m) => m.material_id === mat.id && m.reference?.includes(pm.product_id))
                ).map((pm) => pm.product_id)
            );

            signals.push({
                id: `stock-break-${mat.id}`,
                type: 'stock_break',
                severity,
                affectedEntityId: mat.id,
                affectedEntityName: mat.name,
                probability: 1.0 - daysRound * 0.08,
                estimatedImpact: dailyRate * avgUnitCost * (7 - daysRound),
                timeToImpactDays: daysRound,
                rawData: {
                    remaining: effectiveRemaining,
                    dailyRate,
                    daysUntilBreak: days,
                    avgUnitCost,
                    dependentProducts: dependentProductIds.size,
                    recentProductionRuns: recentProductions.length,
                },
            });
        }
    }
    return signals;
}

/** SEÑAL: Capital inmovilizado en lotes sin movimiento > 60 días */
function detectDeadStock(
    batches: MaterialBatch[],
    movements: StockMovement[],
    rawMaterials: RawMaterial[]
): RiskSignal[] {
    const signals: RiskSignal[] = [];
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;

    const grouped = new Map<string, MaterialBatch[]>();
    for (const b of batches) {
        if (!grouped.has(b.material_id)) grouped.set(b.material_id, []);
        grouped.get(b.material_id)!.push(b);
    }

    for (const [materialId, matBatches] of grouped) {
        const stale = matBatches.filter(
            (b) =>
                b.remaining_quantity > 0 &&
                new Date(b.date).getTime() < cutoff
        );
        if (stale.length === 0) continue;

        const frozenValue = stale.reduce(
            (acc, b) => acc + b.remaining_quantity * b.unit_cost,
            0
        );
        if (frozenValue < 5) continue;

        // FIX #2: Resolver el nombre real del material desde rawMaterials
        const matName = rawMaterials.find((m) => m.id === materialId)?.name ?? `Material: ${materialId.slice(0, 8)}`;

        signals.push({
            id: `dead-stock-${materialId}`,
            type: 'dead_stock',
            severity: 'bajo',
            affectedEntityId: materialId,
            affectedEntityName: matName,
            probability: 0.7,
            estimatedImpact: frozenValue,
            timeToImpactDays: 30,
            rawData: { frozenValue, staleBatchCount: stale.length },
        });
    }
    return signals;
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

function buildKPIs(
    products: Product[],
    batches: MaterialBatch[],
    rawMaterials: RawMaterial[],
    movements: StockMovement[]
): KPI[] {
    const totalDebt = calculateTotalFinancialDebt(movements, rawMaterials);

    const productMargins = products.map((p) => {
        const cost = calculateProductCost(p, batches, rawMaterials);
        return calculateMargin(p.price, cost);
    });
    const avgMargin =
        productMargins.length > 0
            ? productMargins.reduce((a, b) => a + b, 0) / productMargins.length
            : 0;

    const inventoryValue = batches.reduce(
        (acc, b) => acc + b.remaining_quantity * b.unit_cost,
        0
    );

    const cutoff60 = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const frozenCapital = batches
        .filter((b) => b.remaining_quantity > 0 && new Date(b.date).getTime() < cutoff60)
        .reduce((acc, b) => acc + b.remaining_quantity * b.unit_cost, 0);

    return [
        {
            label: 'Margen Real Promedio',
            value: avgMargin,
            formatted: pct(avgMargin),
            trend: avgMargin >= 30 ? 'up' : avgMargin >= 20 ? 'stable' : 'down',
            riskLevel: avgMargin >= 30 ? 'ok' : avgMargin >= 20 ? 'medio' : 'alto',
        },
        {
            label: 'Deuda Técnica',
            value: totalDebt,
            formatted: currency(totalDebt),
            trend: totalDebt > 0 ? 'down' : 'stable',
            riskLevel: totalDebt > 0 ? 'critico' : 'ok',
        },
        {
            label: 'Valor de Inventario',
            value: inventoryValue,
            formatted: currency(inventoryValue),
            trend: 'stable',
            riskLevel: 'ok',
        },
        {
            label: 'Capital Inmovilizado',
            value: frozenCapital,
            formatted: currency(frozenCapital),
            trend: frozenCapital > 0 ? 'down' : 'stable',
            riskLevel: frozenCapital > 50 ? 'medio' : 'ok',
        },
    ];
}

// ─── healthScore ──────────────────────────────────────────────────────────────

function computeHealthScore(signals: RiskSignal[]): number {
    let score = 100;
    const types = new Set(signals.map((s) => s.type));

    if (types.has('debt')) score -= 30;
    if (types.has('price_below_cost')) score -= 25;
    if (types.has('margin_drift')) {
        const worstDrift = signals
            .filter((s) => s.type === 'margin_drift')
            .sort((a, b) => b.estimatedImpact - a.estimatedImpact)[0];
        score -= worstDrift?.severity === 'alto' ? 15 : 8;
    }
    if (types.has('stock_break')) {
        const worstBreak = signals
            .filter((s) => s.type === 'stock_break')
            .sort((a, b) => a.timeToImpactDays - b.timeToImpactDays)[0];
        score -= (worstBreak?.timeToImpactDays ?? 99) <= 3 ? 20 : 10;
    }
    if (types.has('dead_stock')) score -= 5;

    return Math.max(0, Math.min(100, score));
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export function runHealthCheck(input: HealthCheckInput): HealthReport {
    const { products, rawMaterials, batches, movements, productMovements } = input;

    const signals: RiskSignal[] = [
        ...detectDebt(movements, rawMaterials, batches),
        ...detectPriceBelowCost(products, batches, rawMaterials),
        ...detectMarginDrift(products, batches, rawMaterials),
        ...detectStockBreak(rawMaterials, batches, movements, productMovements),
        ...detectDeadStock(batches, movements, rawMaterials),
    ].sort((a, b) => b.estimatedImpact * b.probability - a.estimatedImpact * a.probability);

    const healthScore = computeHealthScore(signals);
    const overallStatus =
        healthScore < 50 ? 'critico' : healthScore < 80 ? 'riesgo' : 'saludable';

    const kpis = buildKPIs(products, batches, rawMaterials, movements);

    return {
        generatedAt: new Date().toISOString(),
        healthScore,
        overallStatus,
        signals,
        kpis,
    };
}
