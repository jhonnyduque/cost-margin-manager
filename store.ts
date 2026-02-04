
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, RawMaterial, Unit, ProductMaterial, MaterialBatch, StockMovement } from './types';

interface AppState {
  products: Product[];
  rawMaterials: RawMaterial[];
  batches: MaterialBatch[];
  movements: StockMovement[];
  
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  
  addRawMaterial: (material: RawMaterial) => void;
  updateRawMaterial: (material: RawMaterial) => void;
  deleteRawMaterial: (id: string) => void;
  
  addBatch: (batch: MaterialBatch) => void;
  deleteBatch: (id: string) => void;
  updateBatch: (batch: MaterialBatch) => void;
  updateBatchRemaining: (id: string, newQty: number) => void;
  consumeStock: (productId: string) => void;
}

export const getConversionFactor = (buyUnit: Unit, useUnit: Unit): number => {
  if (buyUnit === useUnit) return 1;
  if (buyUnit === 'metro' && useUnit === 'cm') return 100;
  if (buyUnit === 'cm' && useUnit === 'metro') return 0.01;
  if (buyUnit === 'kg' && useUnit === 'gramo') return 1000;
  if (buyUnit === 'gramo' && useUnit === 'kg') return 0.001;
  return 1;
};

export const getFifoBreakdown = (
  materialId: string,
  requiredQuantity: number,
  targetUnit: Unit,
  batches: MaterialBatch[],
  rawMaterials: RawMaterial[]
) => {
  const material = rawMaterials.find(m => m.id === materialId);
  if (!material) return [];

  const factor = getConversionFactor(material.unit, targetUnit);
  let remainingToCover = requiredQuantity / factor;
  
  const materialBatches = batches
    .filter(b => b.materialId === materialId && b.remainingQuantity > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const breakdown = [];

  for (const batch of materialBatches) {
    if (remainingToCover <= 0) break;
    const amountFromThisBatch = Math.min(remainingToCover, batch.remainingQuantity);
    
    breakdown.push({
      batchId: batch.id,
      date: batch.date,
      unitCost: batch.unitCost,
      quantityUsed: amountFromThisBatch,
      quantityUsedInTargetUnit: amountFromThisBatch * factor,
      subtotal: amountFromThisBatch * batch.unitCost
    });
    
    remainingToCover -= amountFromThisBatch;
  }

  if (remainingToCover > 0) {
    const lastBatch = materialBatches[materialBatches.length - 1];
    const fallbackPrice = lastBatch ? lastBatch.unitCost : 0;
    breakdown.push({
      batchId: 'faltante',
      date: 'N/A (Sin Stock)',
      unitCost: fallbackPrice,
      quantityUsed: remainingToCover,
      quantityUsedInTargetUnit: remainingToCover * factor,
      subtotal: remainingToCover * fallbackPrice,
      isMissing: true
    });
  }

  return breakdown;
};

export const calculateFifoCost = (
  materialId: string, 
  requiredQuantity: number, 
  targetUnit: Unit,
  batches: MaterialBatch[],
  rawMaterials: RawMaterial[]
): number => {
  const breakdown = getFifoBreakdown(materialId, requiredQuantity, targetUnit, batches, rawMaterials);
  return breakdown.reduce((acc, item) => acc + item.subtotal, 0);
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      products: [],
      rawMaterials: [],
      batches: [],
      movements: [],
      
      addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
      updateProduct: (product) => set((state) => ({
        products: state.products.map((p) => (p.id === product.id ? product : p)),
      })),
      deleteProduct: (id) => set((state) => ({
        products: state.products.filter((p) => p.id !== id),
      })),
      
      addRawMaterial: (material) => set((state) => ({ rawMaterials: [...state.rawMaterials, material] })),
      updateRawMaterial: (material) => set((state) => ({
        rawMaterials: state.rawMaterials.map((m) => (m.id === material.id ? material : m)),
      })),
      deleteRawMaterial: (id) => set((state) => ({
        rawMaterials: state.rawMaterials.filter((m) => m.id !== id),
        batches: state.batches.filter((b) => b.materialId !== id),
        movements: state.movements.filter((mov) => mov.materialId !== id)
      })),

      addBatch: (batch) => set((state) => {
        const movement: StockMovement = {
          id: `mov-${Date.now()}`,
          materialId: batch.materialId,
          batchId: batch.id,
          date: batch.date,
          type: 'ingreso',
          quantity: batch.initialQuantity,
          unitCost: batch.unitCost,
          reference: batch.provider
        };
        return { 
          batches: [...state.batches, batch],
          movements: [...state.movements, movement]
        };
      }),

      deleteBatch: (id) => set((state) => ({
        batches: state.batches.filter((b) => b.id !== id),
        movements: state.movements.filter((mov) => mov.batchId !== id)
      })),

      updateBatch: (batch) => set((state) => {
        const updatedMovements = state.movements.map(mov => 
          (mov.batchId === batch.id && mov.type === 'ingreso')
          ? { ...mov, quantity: batch.initialQuantity, unitCost: batch.unitCost, reference: batch.provider, date: batch.date }
          : mov
        );
        return {
          batches: state.batches.map((b) => (b.id === batch.id ? batch : b)),
          movements: updatedMovements
        };
      }),

      updateBatchRemaining: (id, newQty) => set((state) => ({
        batches: state.batches.map((b) => (b.id === id ? { ...b, remainingQuantity: newQty } : b)),
      })),

      consumeStock: (productId) => {
        const product = get().products.find(p => p.id === productId);
        if (!product) return;

        set((state) => {
          let currentBatches = [...state.batches];
          const newMovements: StockMovement[] = [];
          const now = new Date().toISOString().split('T')[0];
          
          product.materials.forEach(pm => {
            const breakdown = getFifoBreakdown(pm.materialId, pm.quantity, pm.consumptionUnit, currentBatches, state.rawMaterials);
            
            breakdown.forEach(item => {
              if (item.batchId === 'faltante') return;
              
              currentBatches = currentBatches.map(b => 
                b.id === item.batchId 
                  ? { ...b, remainingQuantity: Math.max(0, b.remainingQuantity - item.quantityUsed) }
                  : b
              );

              newMovements.push({
                id: `mov-${Date.now()}-${Math.random()}`,
                materialId: pm.materialId,
                batchId: item.batchId,
                date: now,
                type: 'egreso',
                quantity: item.quantityUsed,
                unitCost: item.unitCost,
                reference: `Prod: ${product.name}`
              });
            });
          });

          return { 
            batches: currentBatches,
            movements: [...state.movements, ...newMovements]
          };
        });
      }
    }),
    {
      name: 'calculadora-pro-fifo-v4',
    }
  )
);

export const calculateProductCost = (product: Product, batches: MaterialBatch[], rawMaterials: RawMaterial[]) => {
  return product.materials.reduce((total, pm) => {
    return total + calculateFifoCost(pm.materialId, pm.quantity, pm.consumptionUnit, batches, rawMaterials);
  }, 0);
};

export const calculateMargin = (price: number, cost: number) => {
  if (price === 0) return 0;
  return ((price - cost) / price) * 100;
};
