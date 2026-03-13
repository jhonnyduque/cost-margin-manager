import { Product, RawMaterial, MaterialBatch, UnitOfMeasure } from '@/types';
import { getFifoBreakdown } from '@/store';
import { getEffectiveQuantity } from '@/utils/materialCalculations';

export interface ProductionMissingItem {
  materialName: string;
  missingQuantity: number;
  unit: string;
  unitCost: number;
  totalDebt: number;
}

export interface ProductionBreakdownItem {
  materialName: string;
  requiredQuantity: number;
  coveredQuantity: number;
  missingQuantity: number;
  unit: string;
  unitCost: number;
}

export interface ProductionAnalysisResult {
  missingItems: ProductionMissingItem[];
  fullBreakdown: ProductionBreakdownItem[];
  totalCostForBatch: number;
  maxCoveredProduction: number;
}

interface AnalyzeBatchProductionParams {
  product: Product;
  quantity: number;
  batches: MaterialBatch[];
  rawMaterials: RawMaterial[];
  unitsOfMeasure: UnitOfMeasure[];
}

export const analyzeBatchProduction = ({
  product,
  quantity,
  batches,
  rawMaterials,
  unitsOfMeasure,
}: AnalyzeBatchProductionParams): ProductionAnalysisResult => {
  const missingItems: ProductionMissingItem[] = [];
  const fullBreakdown: ProductionBreakdownItem[] = [];
  let totalCostForBatch = 0;
  let maxCoveredProduction = quantity;

  (product.materials || []).forEach(pm => {
    const uom = unitsOfMeasure.find(u => u.symbol === pm.consumption_unit);
    const baseQtyPerUnit = getEffectiveQuantity(pm, batches, pm.material_id, uom);
    const qtyPerUnit = getEffectiveQuantity(pm, batches, pm.material_id);

    const availableBaseStock = batches
      .filter(b => b.material_id === pm.material_id)
      .reduce((acc, b) => acc + (b.base_remaining_quantity || b.remaining_quantity || 0), 0);

    const possibleUnits = baseQtyPerUnit > 0 ? Math.floor(availableBaseStock / baseQtyPerUnit) : quantity;
    if (possibleUnits < maxCoveredProduction) {
      maxCoveredProduction = Math.max(0, possibleUnits);
    }

    const effectiveQty = qtyPerUnit * quantity;
    const breakdown = getFifoBreakdown(pm.material_id, effectiveQty, pm.consumption_unit, batches, rawMaterials, unitsOfMeasure);
    const totalMissing = breakdown
      .filter((entry: any) => entry.is_missing)
      .reduce((acc: number, entry: any) => acc + entry.quantity_used, 0);

    breakdown.forEach((entry: any) => {
      totalCostForBatch += entry.subtotal;
    });

    const material = rawMaterials.find(m => m.id === pm.material_id);
    const coveredQty = effectiveQty - totalMissing;
    const lastBatch = batches
      .filter(b => b.material_id === pm.material_id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const lastBatchCost = lastBatch?.unit_cost || 0;

    if (totalMissing > 0) {
      missingItems.push({
        materialName: material?.name || 'Insumo desconocido',
        missingQuantity: totalMissing,
        unit: pm.consumption_unit,
        unitCost: lastBatchCost,
        totalDebt: lastBatchCost * totalMissing,
      });
    }

    fullBreakdown.push({
      materialName: material?.name || 'Insumo desconocido',
      requiredQuantity: effectiveQty,
      coveredQuantity: coveredQty,
      missingQuantity: totalMissing,
      unit: pm.consumption_unit,
      unitCost: lastBatchCost,
    });
  });

  return {
    missingItems,
    fullBreakdown,
    totalCostForBatch,
    maxCoveredProduction,
  };
};
