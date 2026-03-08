/**
 * BETO OS – UNIVERSAL INVENTORY ENGINE v2
 * Inventory & FIFO Logic Engine.
 * 
 * Regla de Oro: Todo el cálculo interno ocurre en UNIDADES BASE.
 */

import { RawMaterial, MaterialBatch, UnitOfMeasure } from '../types';

export interface ConsumptionResult {
    batch_id: string;
    base_quantity_consumed: number;
    cost_per_base_unit: number;
    total_base_cost: number;
}

export class InventoryEngineV2 {
    /**
     * Aplica la lógica FIFO para consumir una cantidad de material.
     * 
     * @param baseQuantityRequested Cantidad a consumir (en UNIDAD BASE)
     * @param activeBatches Lotes disponibles ordenados por fecha (ASC)
     */
    static calculateFifoConsumption(
        baseQuantityRequested: number,
        activeBatches: MaterialBatch[]
    ): {
        consumptions: ConsumptionResult[];
        remainingToConsume: number;
        totalCost: number;
    } {
        let remaining = baseQuantityRequested;
        const consumptions: ConsumptionResult[] = [];
        let totalCost = 0;

        for (const batch of activeBatches) {
            if (remaining <= 0) break;

            const available = batch.base_remaining_quantity || 0;
            if (available <= 0) continue;

            const toConsume = Math.min(remaining, available);
            const costPerBase = batch.cost_per_base_unit || 0;
            const batchCost = toConsume * costPerBase;

            consumptions.push({
                batch_id: batch.id,
                base_quantity_consumed: toConsume,
                cost_per_base_unit: costPerBase,
                total_base_cost: batchCost
            });

            totalCost += batchCost;
            remaining -= toConsume;
        }

        return {
            consumptions,
            remainingToConsume: Math.max(0, remaining),
            totalCost
        };
    }

    /**
     * Calcula el stock total disponible en unidad base para un material.
     */
    static getTotalBaseStock(batches: MaterialBatch[]): number {
        return batches.reduce((sum, b) => sum + (b.base_remaining_quantity || 0), 0);
    }

    /**
     * Determina si un material tiene stock suficiente para un requerimiento base.
     */
    static hasSufficientBaseStock(
        baseQuantityRequested: number,
        batches: MaterialBatch[]
    ): boolean {
        return this.getTotalBaseStock(batches) >= baseQuantityRequested;
    }
}

/**
 * Precisión decimal por símbolo de unidad base (Fallback).
 * Propuesta por el usuario para casos donde rounding no esté definido en BD.
 */
const BASE_UNIT_DECIMALS: Record<string, number> = {
    g: 3,   // 1.234 g
    cm: 2,   // 1.23 cm
    und: 0,   // 3 und (entero)
    m: 2,   // 1.23 m
    kg: 3,   // 1.234 kg
};

const DEFAULT_DECIMALS = 3;

/**
 * UnitConverter: El cerebro de conversión de unidades.
 */
export class UnitConverter {
    /**
     * Obtiene el factor de redondeo (step) basado en la BD o el símbolo.
     */
    private static getRoundingStep(uom: UnitOfMeasure): number {
        // Prioridad 1: Valor en Base de Datos (Rounding Step: 0.001)
        if (uom.rounding !== undefined && uom.rounding !== null) {
            return Number(uom.rounding);
        }

        // Prioridad 2: Fallback por Símbolo (User Proposal: g: 3 -> 0.001)
        const decimals = BASE_UNIT_DECIMALS[uom.symbol] ?? DEFAULT_DECIMALS;
        return 1 / Math.pow(10, decimals);
    }

    /**
     * Convierte una cantidad de una unidad específica a la Unidad Base.
     */
    static toBase(quantity: number, uom: UnitOfMeasure): number {
        const rawBase = quantity * uom.conversion_factor;
        return this.applyRounding(rawBase, this.getRoundingStep(uom));
    }

    /**
     * Convierte una cantidad desde la Unidad Base a una unidad de visualización.
     */
    static fromBase(baseQuantity: number, uom: UnitOfMeasure): number {
        const rawVisual = baseQuantity / uom.conversion_factor;
        return this.applyRounding(rawVisual, this.getRoundingStep(uom));
    }

    private static applyRounding(value: number, step: number): number {
        if (!step || step === 0) return value;
        const inv = 1.0 / step;
        return Math.round(value * inv) / inv;
    }

    static format(quantity: number, uom: UnitOfMeasure): string {
        const step = this.getRoundingStep(uom);
        const rounded = this.applyRounding(quantity, step);
        const decimals = step < 1 ? Math.max(0, Math.ceil(Math.abs(Math.log10(step)))) : 0;

        return `${rounded.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${uom.symbol}`;
    }

    /**
     * Convierte una cantidad base y la formatea en la unidad destino.
     */
    static formatFromBase(baseQuantity: number, targetUom: UnitOfMeasure): string {
        const visualQty = this.fromBase(baseQuantity, targetUom);
        return this.format(visualQty, targetUom);
    }
}
