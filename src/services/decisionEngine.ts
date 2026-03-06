/**
 * decisionEngine.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Capa 2 del Active Protection System.
 * Responsabilidad: Transformar señales de riesgo en acciones concretas,
 * calculando el netBenefit de actuar vs. no actuar en cada caso.
 *
 * Responde la pregunta: "¿Qué pasa si actúo hoy vs. si no hago nada?"
 */

import type { RiskSignal, HealthReport, HealthCheckInput } from './businessHealthEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScenarioResult {
    /** Valor monetario proyectado del negocio en 7 días */
    projectedValue: number;
    /** Margen promedio estimado en 7 días */
    projectedMarginIn7Days: number;
    /** Descripción de lo que ocurre si no se actúa */
    narrative: string;
}

export interface RecommendedAction {
    id: string;
    signal: RiskSignal;
    title: string;
    description: string;
    actionLabel: string;
    actionRoute: string;
    /** Escenario A: no hacer nada */
    inactionScenario: ScenarioResult;
    /** Escenario B: actuar hoy */
    actionScenario: ScenarioResult;
    /**
     * Dinero protegido = actionScenario.projectedValue - inactionScenario.projectedValue
     * ESTE es el criterio de ordenamiento, no la severidad.
     */
    netBenefit: number;
    priority: number; // Ordinal de presentación en el Dashboard
}

export interface DecisionReport {
    /** Acciones ordenadas por netBenefit DESC */
    actions: RecommendedAction[];
    /** Suma de todos los netBenefit: cuánto dinero total se protege actuando hoy */
    totalProtectedValue: number;
    /** Resumen ejecutivo en 1 frase */
    inactionSummary: string;
}

// ─── simulateScenario ─────────────────────────────────────────────────────────

function simulateInaction(signal: RiskSignal): ScenarioResult {
    const { type, estimatedImpact, timeToImpactDays } = signal;

    switch (type) {
        case 'debt': {
            const { totalDebt } = signal.rawData;
            return {
                projectedValue: -totalDebt,
                projectedMarginIn7Days: 0,
                narrative: `La deuda de ${currency(totalDebt)} seguirá acumulándose. Cada producción adicional sin stock empeora la integridad contable.`,
            };
        }
        case 'stock_break': {
            const { dailyRate, avgUnitCost, daysUntilBreak } = signal.rawData;
            const daysBlocked = Math.max(0, 7 - daysUntilBreak);
            const lostProduction = dailyRate * daysBlocked * (avgUnitCost * 2);
            return {
                projectedValue: -lostProduction,
                projectedMarginIn7Days: 0,
                narrative: `Stock se agota en ~${Math.floor(daysUntilBreak)} días. Producción bloqueada por ~${Math.ceil(daysBlocked)} días. Pérdida estimada: ${currency(lostProduction)}.`,
            };
        }
        case 'margin_drift': {
            const { gap, avgMonthlySales, actualMargin, salesConfidence } = signal.rawData;
            const salesLoss = gap * avgMonthlySales;
            const confidenceNote = salesConfidence === 'low'
                ? ` (estimación orientativa — menos de 2 meses de datos)`
                : salesConfidence === 'medium' ? ` (estimación media — posible estacionalidad)` : '';
            return {
                projectedValue: -salesLoss,
                projectedMarginIn7Days: actualMargin,
                narrative: `Cada venta pierde ${currency(gap)} vs. el margen objetivo. Con ~${Math.round(avgMonthlySales)} uds/mes${confidenceNote}, la pérdida proyectada es ${currency(salesLoss)}.`,
            };
        }
        case 'price_below_cost': {
            const { deficit, avgMonthlySales, salesConfidence } = signal.rawData;
            const totalLoss = deficit * avgMonthlySales;
            const confidenceNote = salesConfidence === 'low'
                ? ` (estimación orientativa — menos de 2 meses de datos)`
                : salesConfidence === 'medium' ? ` (estimación media — posible estacionalidad)` : '';
            return {
                projectedValue: -totalLoss,
                projectedMarginIn7Days: -deficit,
                narrative: `Cada unidad vendida genera una pérdida de ${currency(deficit)}. Con ~${Math.round(avgMonthlySales)} uds/mes${confidenceNote}, el negocio pierde ${currency(totalLoss)} mensuales.`,
            };
        }
        case 'dead_stock': {
            const { frozenValue } = signal.rawData;
            return {
                projectedValue: -frozenValue,
                projectedMarginIn7Days: 0,
                narrative: `Capital inmovilizado de ${currency(frozenValue)} sin rotación. El costo de oportunidad aumenta cada semana.`,
            };
        }
        default:
            return {
                projectedValue: -(estimatedImpact * 0.5),
                projectedMarginIn7Days: 0,
                narrative: `Riesgo no resuelto con impacto potencial de ${currency(estimatedImpact)}.`,
            };
    }
}

function simulateAction(signal: RiskSignal): ScenarioResult {
    const { type, estimatedImpact } = signal;

    switch (type) {
        case 'debt':
            return {
                projectedValue: 0,
                projectedMarginIn7Days: 0,
                narrative: 'Regularizando el inventario, la deuda técnica queda a 0 y la integridad contable se restaura.',
            };
        case 'stock_break': {
            const { avgProductMargin } = signal.rawData;
            return {
                projectedValue: estimatedImpact,
                projectedMarginIn7Days: avgProductMargin,
                narrative: 'Reabasteciendo hoy, la producción continúa sin interrupción durante los próximos 7 días.',
            };
        }
        case 'margin_drift': {
            const { targetMargin, gap, avgMonthlySales } = signal.rawData;
            const recovered = gap * avgMonthlySales;
            return {
                projectedValue: recovered,
                projectedMarginIn7Days: targetMargin,
                narrative: `Ajustando el precio de venta, el margen regresa al objetivo de ${targetMargin.toFixed(1)}%. Recuperación proyectada: ${currency(recovered)}/mes.`,
            };
        }
        case 'price_below_cost': {
            const { cost, avgMonthlySales, targetMargin } = signal.rawData;
            const margin = targetMargin / 100;
            const correctedPrice = cost / (1 - margin);
            const recovered = (correctedPrice - cost) * avgMonthlySales;
            return {
                projectedValue: recovered,
                projectedMarginIn7Days: targetMargin,
                narrative: `Corrigiendo el precio a ${currency(correctedPrice)}, las ventas generan margen positivo. Recuperación proyectada: ${currency(recovered)}/mes.`,
            };
        }
        case 'dead_stock': {
            const { frozenValue } = signal.rawData;
            return {
                projectedValue: frozenValue * 0.7, // Capital liberado estimado al rotar el stock
                projectedMarginIn7Days: 0,
                narrative: 'Rotando el stock inmovilizado, el capital se libera para nuevas compras de mayor rentabilidad.',
            };
        }
        default:
            return {
                projectedValue: estimatedImpact * 0.8,
                projectedMarginIn7Days: 0,
                narrative: 'Actuando hoy, se evita el impacto proyectado.',
            };
    }
}

// ─── Route + Label mapping ────────────────────────────────────────────────────

function getActionMeta(signal: RiskSignal): { title: string; description: string; actionLabel: string; actionRoute: string } {
    switch (signal.type) {
        case 'debt':
            return {
                title: 'Regularizar deuda de inventario',
                description: `El ledger registra ${currency(signal.estimatedImpact)} en producción sin respaldo. Ingresa lotes físicos para cuadrar la contabilidad.`,
                actionLabel: 'Ir a Materias Primas',
                actionRoute: '/materias-primas',
            };
        case 'stock_break':
            return {
                title: `Reabastecer ${signal.affectedEntityName}`,
                description: `Stock se agota en ~${signal.timeToImpactDays} día(s). Sin reposición, la producción se detiene.`,
                actionLabel: 'Ingresar Lote',
                actionRoute: '/materias-primas',
            };
        case 'margin_drift':
            return {
                title: `Ajustar precio de ${signal.affectedEntityName}`,
                description: `El margen cayó ${signal.rawData.drift.toFixed(1)}% por debajo del objetivo. Revisa el escandallo o actualiza el precio de venta.`,
                actionLabel: 'Editar Producto',
                actionRoute: '/productos',
            };
        case 'price_below_cost':
            return {
                title: `Corregir precio de ${signal.affectedEntityName}`,
                description: `El precio de venta está por debajo del costo FIFO real. Cada venta genera pérdida neta.`,
                actionLabel: 'Editar Precio',
                actionRoute: '/productos',
            };
        case 'dead_stock':
            return {
                title: 'Liberar capital inmovilizado',
                description: `Hay ${currency(signal.estimatedImpact)} en material sin movimiento por más de 60 días.`,
                actionLabel: 'Revisar Inventario',
                actionRoute: '/materias-primas',
            };
    }
}

const currency = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

// ─── Entry Point ──────────────────────────────────────────────────────────────

export function buildDecisionReport(healthReport: HealthReport): DecisionReport {
    const { signals } = healthReport;

    const actions: RecommendedAction[] = signals.map((signal) => {
        const inaction = simulateInaction(signal);
        const action = simulateAction(signal);
        const netBenefit = action.projectedValue - inaction.projectedValue;
        const meta = getActionMeta(signal);

        return {
            id: `action-${signal.id}`,
            signal,
            ...meta,
            inactionScenario: inaction,
            actionScenario: action,
            netBenefit,
            priority: 0, // Assigned after sort below
        };
    });

    // Ordenar por netBenefit DESC — principio: el dinero manda, no la etiqueta de severidad
    actions.sort((a, b) => b.netBenefit - a.netBenefit);
    actions.forEach((a, i) => { a.priority = i; });

    const totalProtectedValue = actions.reduce((acc, a) => acc + Math.max(0, a.netBenefit), 0);

    const inactionSummary =
        totalProtectedValue > 0
            ? `Si no actúas hoy, en los próximos 7 días el negocio podría perder hasta ${currency(totalProtectedValue)}. Hay ${actions.length} acción(es) recomendada(s).`
            : 'El negocio está operando sin riesgos críticos detectados.';

    return { actions, totalProtectedValue, inactionSummary };
}