/**
 * protectionEngine.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Capa 3 (Final) del Active Protection System.
 *
 * Responsabilidad:
 *   Consolidar el HealthReport (señales) + DecisionReport (acciones) en un
 *   único ProtectionReport que el Dashboard consume como única fuente de verdad.
 *
 * Fórmula de prioridad:
 *   priorityScore = estimatedImpact × probability × urgencyFactor
 *
 * El Dashboard responde exactamente tres preguntas:
 *   1. ¿Mi negocio está protegido?     → protectionStatus + healthScore
 *   2. ¿Cuánto dinero evito perder?    → totalProtectedValue
 *   3. ¿Qué debo hacer ahora?          → actions (ordenadas por priorityScore)
 */

import { runHealthCheck, type HealthCheckInput, type HealthReport, type KPI } from './businessHealthEngine';
import { buildDecisionReport, type DecisionReport, type RecommendedAction } from './decisionEngine';
import type { RiskSignal } from './businessHealthEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Acción final con priorityScore calculado */
export interface ProtectedAction extends RecommendedAction {
    /**
     * priorityScore = estimatedImpact × probability × urgencyFactor
     * Urgency factors:
     *   ≤ 0 días  → 1.0  (ya ocurrió)
     *   1–2 días  → 0.9
     *   3–4 días  → 0.7
     *   5–7 días  → 0.5
     *   > 7 días  → 0.2
     */
    priorityScore: number;
    urgencyFactor: number;
}

export type ProtectionStatus = 'PROTEGIDO' | 'EN_RIESGO' | 'CRITICO';

export interface ProtectionReport {
    generatedAt: string;
    /** Estado de protección global del negocio */
    protectionStatus: ProtectionStatus;
    /** 0–100. Temperatura del sistema. */
    healthScore: number;
    /** Dinero total que se evitaría perder si se actúa en todas las acciones hoy */
    totalProtectedValue: number;
    /** Frase resumen ejecutiva */
    executiveSummary: string;
    /** Las 5 acciones más urgentes ordenadas por priorityScore DESC */
    topActions: ProtectedAction[];
    /** Todas las acciones ordenadas */
    allActions: ProtectedAction[];
    /** KPIs financieros */
    kpis: KPI[];
    /** Señales crudas para auditoría / detalles de tooltips */
    signals: RiskSignal[];
}

// ─── Urgency mapping ──────────────────────────────────────────────────────────

function urgencyFactor(days: number): number {
    if (days <= 0) return 1.0;
    if (days <= 2) return 0.9;
    if (days <= 4) return 0.7;
    if (days <= 7) return 0.5;
    return 0.2;
}

// ─── priorityScore ────────────────────────────────────────────────────────────

function computePriorityScore(action: RecommendedAction): number {
    const { signal } = action;
    const urgency = urgencyFactor(signal.timeToImpactDays);
    return signal.estimatedImpact * signal.probability * urgency;
}

// ─── executiveSummary ─────────────────────────────────────────────────────────

const currency = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

function buildExecutiveSummary(
    status: ProtectionStatus,
    healthScore: number,
    totalProtectedValue: number,
    actionsCount: number
): string {
    if (status === 'PROTEGIDO') {
        return 'BETO OS no detecta riesgos críticos. El negocio opera dentro de parámetros saludables.';
    }
    if (status === 'EN_RIESGO') {
        return `El negocio presenta ${actionsCount} señal(es) de riesgo. Actuando hoy, puedes proteger hasta ${currency(totalProtectedValue)}.`;
    }
    // CRITICO
    return `⚠ Atención inmediata requerida. Se detectaron riesgos críticos. Sin intervención, el impacto estimado es de ${currency(totalProtectedValue)} en los próximos 7 días.`;
}

// ─── protectionStatus desde healthScore ──────────────────────────────────────

function toProtectionStatus(healthScore: number): ProtectionStatus {
    if (healthScore >= 80) return 'PROTEGIDO';
    if (healthScore >= 50) return 'EN_RIESGO';
    return 'CRITICO';
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

/**
 * runProtectionEngine — Punto de entrada único del Active Protection System.
 *
 * El Dashboard SOLO llama esta función. No importa ni usa businessHealthEngine
 * ni decisionEngine directamente.
 */
export function runProtectionEngine(input: HealthCheckInput): ProtectionReport {
    // Capa 1: Señales de riesgo
    const healthReport: HealthReport = runHealthCheck(input);

    // Capa 2: Acciones y simulación de escenarios
    const decisionReport: DecisionReport = buildDecisionReport(healthReport);

    // Capa 3: Consolidar con priorityScore
    const protectedActions: ProtectedAction[] = decisionReport.actions.map((action) => {
        const urgency = urgencyFactor(action.signal.timeToImpactDays);
        const priorityScore = computePriorityScore(action);
        return { ...action, priorityScore, urgencyFactor: urgency };
    });

    // Ordenar por priorityScore DESC (impact × probability × urgency)
    protectedActions.sort((a, b) => b.priorityScore - a.priorityScore);
    protectedActions.forEach((a, i) => { a.priority = i; });

    const protectionStatus = toProtectionStatus(healthReport.healthScore);
    const totalProtectedValue = decisionReport.totalProtectedValue;
    const executiveSummary = buildExecutiveSummary(
        protectionStatus,
        healthReport.healthScore,
        totalProtectedValue,
        protectedActions.length
    );

    return {
        generatedAt: healthReport.generatedAt,
        protectionStatus,
        healthScore: healthReport.healthScore,
        totalProtectedValue,
        executiveSummary,
        topActions: protectedActions.slice(0, 5),
        allActions: protectedActions,
        kpis: healthReport.kpis,
        signals: healthReport.signals,
    };
}
