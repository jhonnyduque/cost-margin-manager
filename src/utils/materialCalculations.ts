import { MaterialBatch, UnitOfMeasure } from '@/types';
import { UnitConverter } from '@/services/inventoryEngineV2';

/**
 * Calculate the effective linear meters consumed from piece dimensions.
 *
 * Formula:
 *   totalAreaCm² = Σ (piece.length × piece.width)
 *   linearMeters = (totalAreaCm² / rollWidth) / 100
 *
 * @param pieces - Array of { length: number, width: number } in cm
 * @param rollWidthCm - Width of the fabric roll in cm (defaults to 140)
 * @returns Effective quantity in linear meters
 */
export const calculatePiecesToLinearMeters = (
    pieces: { length: number; width: number }[],
    rollWidthCm: number = 140
): number => {
    if (!pieces || pieces.length === 0) return 0;
    const totalAreaCm2 = pieces.reduce((acc, p) => acc + (p.length * p.width), 0);
    return (totalAreaCm2 / rollWidthCm) / 100;
};

/**
 * Calculate the total area in m² from piece dimensions.
 */
export const calculatePiecesAreaM2 = (
    pieces: { length: number; width: number }[]
): number => {
    if (!pieces || pieces.length === 0) return 0;
    return pieces.reduce((acc, p) => acc + (p.length * p.width), 0) / 10000;
};

/**
 * Get the roll width from the latest batch of a material, falling back to 140cm.
 */
export const getLatestRollWidth = (
    materialId: string,
    batches: MaterialBatch[]
): number => {
    const latest = batches
        .filter(b => b.material_id === materialId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return latest?.width || 140;
};

/**
 * Given a ProductMaterial, compute the effective quantity for FIFO costing.
 * This is the single source of truth for pieces-to-linear conversion.
 */
/**
 * Calculate the area of a batch entry (roll or piece) in m².
 * Centralized from RawMaterials.tsx local utility.
 */
export const calculateBatchArea = (
    mode: 'rollo' | 'pieza',
    params: { initial_quantity?: number; length?: number; width: number }
): number => {
    if (mode === 'rollo') {
        return (params.initial_quantity || 0) * (params.width / 100);
    }
    return ((params.length || 0) * params.width) / 10000;
};

export const getEffectiveQuantity = (
    pm: any, // ProductMaterialUI structure
    batches: MaterialBatch[],
    materialId: string,
    uom?: UnitOfMeasure
): number => {
    let qty = pm.quantity;
    if (pm.mode === 'pieces' && pm.pieces && pm.pieces.length > 0) {
        const rollWidth = getLatestRollWidth(materialId, batches);
        qty = calculatePiecesToLinearMeters(pm.pieces, rollWidth);
    }

    if (uom) {
        return UnitConverter.toBase(qty, uom);
    }
    return qty;
};
