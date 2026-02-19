import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, RawMaterial, Unit, ProductMaterial, MaterialBatch, StockMovement, UserRole } from './types';
import { supabase } from './services/supabase';
import { fetchProductsFromSupabase } from './services/products.service';

interface AppState {
  // 🔹 TENANT CONTEXT
  currentCompanyId: string | null;
  currentUserRole: UserRole | null;
  setCurrentCompany: (companyId: string, role: UserRole) => void;
  // Impersonation Support
  isImpersonating: boolean;
  impersonatedCompanyId: string | null;
  setImpersonation: (active: boolean, companyId: string | null) => void;

  products: Product[];
  rawMaterials: RawMaterial[];
  batches: MaterialBatch[];
  movements: StockMovement[];

  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;

  loadProductsFromSupabase: () => Promise<void>;
  loadRawMaterialsFromSupabase: () => Promise<void>;
  loadBatchesFromSupabase: () => Promise<void>;
  loadMovementsFromSupabase: () => Promise<void>;
  logout: () => void;

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

  const breakdown: any[] = [];

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
  return breakdown.reduce((acc, item) => acc + (item.subtotal ?? 0), 0);
};

export const calculateProductCost = (
  product: Product,
  batches: MaterialBatch[],
  rawMaterials: RawMaterial[]
) => {
  const materials = product.materials ?? [];
  return materials.reduce((total, pm) => {
    const fifoCost = calculateFifoCost(
      pm.materialId,
      pm.quantity,
      pm.consumptionUnit,
      batches,
      rawMaterials
    );
    return total + fifoCost;
  }, 0);
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 🔹 INIT TENANT STATE
      currentCompanyId: null,
      currentUserRole: null,
      isImpersonating: false,
      impersonatedCompanyId: null,

      setCurrentCompany: (companyId, role) => {
        set({ currentCompanyId: companyId, currentUserRole: role });
        // Disparamos todas las cargas
        get().loadProductsFromSupabase();
        get().loadRawMaterialsFromSupabase();
        get().loadBatchesFromSupabase();
        get().loadMovementsFromSupabase();
      },

      setImpersonation: (active, companyId) => {
        set({ isImpersonating: active, impersonatedCompanyId: companyId });
      },

      products: [],
      rawMaterials: [],
      batches: [],
      movements: [],

      loadProductsFromSupabase: async () => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('company_id', companyId)
          .is('deleted_at', null);

        if (!error && data) {
          // Mapeo de DB a Store (camelCase)
          const mapped = (data as any[]).map(p => ({
            ...p,
            targetMargin: p.target_margin,
            createdAt: p.created_at
          }));
          set({ products: mapped as Product[] });
        }
      },

      loadRawMaterialsFromSupabase: async () => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        const { data, error } = await supabase
          .from('raw_materials')
          .select('*')
          .eq('company_id', companyId)
          .is('deleted_at', null);

        if (!error && data) set({ rawMaterials: data as RawMaterial[] });
      },

      loadBatchesFromSupabase: async () => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        const { data, error } = await supabase
          .from('material_batches')
          .select('*')
          .eq('company_id', companyId)
          .is('deleted_at', null);

        if (!error && data) {
          // Mapeo snake_case a camelCase si aplica (initial_quantity -> initialQuantity)
          const mapped = data.map((b: any) => ({
            ...b,
            initialQuantity: b.initial_quantity,
            remainingQuantity: b.remaining_quantity,
            unitCost: b.unit_cost,
            entryMode: b.entry_mode,
            materialId: b.material_id
          }));
          set({ batches: mapped as MaterialBatch[] });
        }
      },

      loadMovementsFromSupabase: async () => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        const { data, error } = await supabase
          .from('stock_movements')
          .select('*')
          .eq('company_id', companyId);

        if (!error && data) {
          const mapped = data.map((m: any) => ({
            ...m,
            materialId: m.material_id,
            batchId: m.batch_id,
            unitCost: m.unit_cost
          }));
          set({ movements: mapped as StockMovement[] });
        }
      },

      logout: () => {
        set({
          currentCompanyId: null,
          currentUserRole: null,
          isImpersonating: false,
          impersonatedCompanyId: null,
          products: [],
          rawMaterials: [],
          batches: [],
          movements: []
        });
      },

      addProduct: (product) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        set((state) => ({ products: [...state.products, product] }));

        supabase.from('products').insert({
          id: product.id,
          company_id: companyId,
          name: product.name,
          reference: product.reference,
          price: product.price,
          target_margin: product.targetMargin,
          cost_fifo: calculateProductCost(product, get().batches, get().rawMaterials),
          materials: product.materials, // JSONB
          status: product.status,
          created_at: product.createdAt,
        }).then(({ error }) => {
          if (error) console.error('[Supabase] addProduct Error:', error.message);
        });
      },

      updateProduct: (product) => {
        set((state) => ({
          products: state.products.map((p) => (p.id === product.id ? product : p)),
        }));

        supabase.from('products')
          .update({
            name: product.name,
            reference: product.reference,
            price: product.price,
            target_margin: product.targetMargin,
            materials: product.materials,
            cost_fifo: calculateProductCost(product, get().batches, get().rawMaterials),
            status: product.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id)
          .eq('company_id', get().currentCompanyId);
      },

      deleteProduct: (id) => {
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));

        supabase.from('products')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);
      },

      addRawMaterial: (material) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        set((state) => ({ rawMaterials: [...state.rawMaterials, material] }));

        supabase.from('raw_materials').insert({
          id: material.id,
          company_id: companyId,
          name: material.name,
          description: material.description,
          type: material.type,
          unit: material.unit,
          provider: material.provider,
          status: material.status,
          created_at: new Date().toISOString()
        }).then(({ error }) => {
          if (error) console.error('[Supabase] addRawMaterial Error:', error.message);
        });
      },

      updateRawMaterial: (material) => {
        set((state) => ({
          rawMaterials: state.rawMaterials.map((m) =>
            m.id === material.id ? material : m
          ),
        }));

        supabase.from('raw_materials').update({
          name: material.name,
          description: material.description,
          type: material.type,
          unit: material.unit,
          provider: material.provider,
          status: material.status,
          updated_at: new Date().toISOString()
        })
          .eq('id', material.id)
          .eq('company_id', get().currentCompanyId);
      },

      deleteRawMaterial: (id) => {
        set((state) => ({
          rawMaterials: state.rawMaterials.filter((m) => m.id !== id),
          batches: state.batches.filter((b) => b.materialId !== id),
          movements: state.movements.filter((mov) => mov.materialId !== id),
        }));

        supabase.from('raw_materials')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);
      },

      addBatch: (batch) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        const movement: StockMovement = {
          id: crypto.randomUUID(),
          company_id: companyId,
          materialId: batch.materialId,
          batchId: batch.id,
          date: batch.date,
          type: 'ingreso',
          quantity: batch.initialQuantity,
          unitCost: batch.unitCost,
          reference: batch.provider,
        };

        set((state) => ({
          batches: [...state.batches, batch],
          movements: [...state.movements, movement],
        }));

        // Multi-sync batch + movement
        supabase.from('material_batches').insert({
          id: batch.id,
          company_id: companyId,
          material_id: batch.materialId,
          date: batch.date,
          provider: batch.provider,
          initial_quantity: batch.initialQuantity,
          remaining_quantity: batch.remainingQuantity,
          unit_cost: batch.unitCost,
          reference: batch.reference,
          width: batch.width,
          length: batch.length,
          area: batch.area,
          entry_mode: batch.entryMode,
        }).then(({ error }) => {
          if (error) console.error('[Supabase] addBatch Error:', error.message);
        });

        supabase.from('stock_movements').insert({
          id: movement.id,
          company_id: companyId,
          material_id: movement.materialId,
          batch_id: movement.batchId,
          date: movement.date,
          type: movement.type,
          quantity: movement.quantity,
          unit_cost: movement.unitCost,
          reference: movement.reference,
        }).then(({ error }) => {
          if (error) console.error('[Supabase] addMovement Error:', error.message);
        });
      },

      deleteBatch: (id) => {
        const companyId = get().currentCompanyId;
        set((state) => ({
          batches: state.batches.filter((b) => b.id !== id),
          movements: state.movements.filter((mov) => mov.batchId !== id),
        }));

        supabase.from('material_batches')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('company_id', companyId);

        // Los movimientos hijos no tienen soft delete, pero podríamos borrarlos o ignorarlos
      },

      updateBatch: (batch) => {
        const companyId = get().currentCompanyId;
        set((state) => {
          const updatedMovements = state.movements.map((mov) =>
            mov.batchId === batch.id && mov.type === 'ingreso'
              ? {
                ...mov,
                quantity: batch.initialQuantity,
                unitCost: batch.unitCost,
                reference: batch.provider,
                date: batch.date,
              }
              : mov
          );
          return {
            batches: state.batches.map((b) =>
              b.id === batch.id ? batch : b
            ),
            movements: updatedMovements,
          };
        });

        supabase.from('material_batches').update({
          date: batch.date,
          provider: batch.provider,
          initial_quantity: batch.initialQuantity,
          remaining_quantity: batch.remainingQuantity,
          unit_cost: batch.unitCost,
          reference: batch.reference,
          width: batch.width,
          length: batch.length,
          area: batch.area,
          entry_mode: batch.entryMode,
          updated_at: new Date().toISOString()
        })
          .eq('id', batch.id)
          .eq('company_id', companyId);
      },

      updateBatchRemaining: (id, newQty) => {
        const companyId = get().currentCompanyId;
        set((state) => ({
          batches: state.batches.map((b) =>
            b.id === id ? { ...b, remainingQuantity: newQty } : b
          ),
        }));

        supabase.from('material_batches')
          .update({ remaining_quantity: newQty })
          .eq('id', id)
          .eq('company_id', companyId);
      },

      consumeStock: (productId) => {
        const companyId = get().currentCompanyId;
        const product = get().products.find(p => p.id === productId);
        if (!product || !companyId) return;

        set((state) => {
          let currentBatches = [...state.batches];
          const syncMovements: any[] = [];
          const now = new Date().toISOString();

          product.materials?.forEach(pm => {
            const breakdown = getFifoBreakdown(
              pm.materialId,
              pm.quantity,
              pm.consumptionUnit,
              currentBatches,
              state.rawMaterials
            );

            breakdown.forEach(item => {
              if (item.batchId === 'faltante') return;

              currentBatches = currentBatches.map(b => {
                if (b.id === item.batchId) {
                  const newRemaining = Math.max(0, b.remainingQuantity - item.quantityUsed);
                  // Sync update batch remaining
                  supabase.from('material_batches').update({ remaining_quantity: newRemaining }).eq('id', b.id).eq('company_id', companyId).then();
                  return { ...b, remainingQuantity: newRemaining };
                }
                return b;
              });

              const movId = crypto.randomUUID();
              syncMovements.push({
                id: movId,
                company_id: companyId,
                material_id: pm.materialId,
                batch_id: item.batchId,
                date: now,
                type: 'egreso',
                quantity: item.quantityUsed,
                unit_cost: item.unitCost,
                reference: `Prod: ${product.name}`,
              });
            });
          });

          // Sync insert movements
          if (syncMovements.length > 0) {
            supabase.from('stock_movements').insert(syncMovements).then();
          }

          return {
            batches: currentBatches,
            movements: [...state.movements, ...syncMovements.map(m => ({
              ...m,
              materialId: m.material_id,
              batchId: m.batch_id,
              unitCost: m.unit_cost
            } as StockMovement))],
          };
        });
      },
    }),
    {
      name: 'calculadora-pro-fifo-v4',
    }
  )
);

export const calculateMargin = (price: number, cost: number) => {
  if (price === 0) return 0;
  return ((price - cost) / price) * 100;
};