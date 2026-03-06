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
    const { type, estimatedImpact, timeToImpactDays, rawData } = signal;

    switch (type) {
        case 'debt': {
            const debt = rawData.totalDebt as number;
            return {
                projectedValue: -(debt),
                projectedMarginIn7Days: 0,
                narrative: `La deuda de ${currency(debt)} seguirá acumulándose. Cada producción adicional sin stock empeora la integridad contable.`,
            };
        }
        case 'stock_break': {
            const { dailyRate, avgUnitCost, daysUntilBreak } = rawData as any;
            const daysBlocked = Math.max(0, 7 - (daysUntilBreak as number));
            const lostProduction = dailyRate * daysBlocked * (avgUnitCost * 2); // margen perdido estimado
            return {
                projectedValue: -(lostProduction),
                projectedMarginIn7Days: 0,
                narrative: `Stock se agota en ~${Math.floor(daysUntilBreak as number)} días. Producción bloqueada por ~${Math.ceil(daysBlocked)} días. Pérdida estimada: ${currency(lostProduction)}.`,
            };
        }
        case 'margin_drift': {
            const { gap, avgMonthlySales } = rawData as any;
            // Use real monthly sales volume — no longer a hardcoded estimate
            const monthlySales = (avgMonthlySales as number) ?? 5;
            const salesLoss = (gap as number) * monthlySales;
            return {
                projectedValue: -(salesLoss),
                projectedMarginIn7Days: (rawData.actualMargin as number),
                narrative: `Cada venta pierde ${currency(gap)} vs. el margen objetivo. Con ~${Math.round(monthlySales)} uds/mes, la pérdida proyectada a 7 días es ${currency(salesLoss)}.`,
            };
        }
        case 'price_below_cost': {
            const { deficit, avgMonthlySales } = rawData as any;
            // Use real monthly sales volume — no longer a hardcoded estimate
            const monthlySales = (avgMonthlySales as number) ?? 5;
            const totalLoss = (deficit as number) * monthlySales;
            return {
                projectedValue: -(totalLoss),
                projectedMarginIn7Days: -(rawData.deficit as number),
                narrative: `Cada unidad vendida genera una pérdida de ${currency(deficit)}. Con ~${Math.round(monthlySales)} uds/mes, el negocio pierde ${currency(totalLoss)} mensuales en este producto.`,
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
    const { type, estimatedImpact, rawData } = signal;

    switch (type) {
        case 'debt':
            return {
                projectedValue: 0,
                projectedMarginIn7Days: 0,
                narrative: 'Regularizando el inventario, la deuda técnica queda a 0 y la integridad contable se restaura.',
            };
        case 'stock_break': {
            const lostProduction = estimatedImpact;
            const avgProductMargin = (rawData.avgProductMargin as number) ?? 0;
            return {
                projectedValue: lostProduction,
                // Use real average margin of dependent products — was hardcoded to 1 before
                projectedMarginIn7Days: avgProductMargin,
                narrative: 'Reabasteciendo hoy, la producción continúa sin interrupción durante los próximos 7 días.',
            };
        }
        case 'margin_drift': {
            const { targetMargin, gap, avgMonthlySales } = rawData as any;
            const monthlySales = (avgMonthlySales as number) ?? 5;
            const recovered = (gap as number) * monthlySales;
            return {
                projectedValue: recovered,
                projectedMarginIn7Days: targetMargin as number,
                narrative: `Ajustando el precio de venta, el margen regresa al objetivo de ${(targetMargin as number).toFixed(1)}%. Recuperación proyectada: ${currency(recovered)}/mes.`,
            };
        }
        case 'price_below_cost': {
            const { cost, avgMonthlySales, targetMargin } = rawData as any;
            const monthlySales = (avgMonthlySales as number) ?? 5;
            // Use the product's real target margin — not a hardcoded 20%
            const margin = ((targetMargin as number) ?? 30) / 100;
            const correctedPrice = cost / (1 - margin);
            const recovered = (correctedPrice - cost) * monthlySales;
            return {
                projectedValue: recovered,
                projectedMarginIn7Days: (targetMargin as number) ?? 30,
                narrative: `Corrigiendo el precio a ${currency(correctedPrice)}, las ventas generan margen positivo. Recuperación proyectada: ${currency(recovered)}/mes.`,
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
                description: `El margen cayó ${((signal.rawData.drift as number) || 0).toFixed(1)}% por debajo del objetivo. Revisa el escandallo o actualiza el precio de venta.`,
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
        default:
            return {
                title: 'Atender señal de riesgo',
                description: signal.affectedEntityName,
                actionLabel: 'Ver Detalles',
                actionRoute: '/',
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