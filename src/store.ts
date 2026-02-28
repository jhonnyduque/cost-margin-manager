import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, RawMaterial, Unit, ProductMaterial, MaterialBatch, StockMovement, UserRole } from '@/types';
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

  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  loadProductsFromSupabase: () => Promise<void>;
  loadRawMaterialsFromSupabase: () => Promise<void>;
  loadBatchesFromSupabase: () => Promise<void>;
  loadMovementsFromSupabase: () => Promise<void>;
  logout: () => void;

  addRawMaterial: (material: RawMaterial) => Promise<void>;
  updateRawMaterial: (material: RawMaterial) => Promise<void>;
  deleteRawMaterial: (id: string) => Promise<void>;

  addBatch: (batch: MaterialBatch) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  updateBatch: (batch: MaterialBatch) => Promise<void>;
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
  material_id: string,
  requiredQuantity: number,
  targetUnit: Unit,
  batches: MaterialBatch[],
  rawMaterials: RawMaterial[]
) => {
  const material = rawMaterials.find(m => m.id === material_id);
  if (!material) return [];

  const factor = getConversionFactor(material.unit as Unit, targetUnit);
  let remainingToCover = requiredQuantity / factor;

  const materialBatches = batches
    .filter(b => b.material_id === material_id && b.remaining_quantity > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const breakdown: any[] = [];

  for (const batch of materialBatches) {
    if (remainingToCover <= 0) break;
    const amountFromThisBatch = Math.min(remainingToCover, batch.remaining_quantity);

    breakdown.push({
      batch_id: batch.id,
      date: batch.date,
      unit_cost: batch.unit_cost,
      quantity_used: amountFromThisBatch,
      quantity_used_in_target_unit: amountFromThisBatch * factor,
      subtotal: amountFromThisBatch * batch.unit_cost
    });

    remainingToCover -= amountFromThisBatch;
  }

  if (remainingToCover > 0) {
    const lastBatch = materialBatches[materialBatches.length - 1];
    const fallbackPrice = lastBatch ? lastBatch.unit_cost : 0;
    breakdown.push({
      batch_id: 'faltante',
      date: 'N/A (Sin Stock)',
      unit_cost: fallbackPrice,
      quantity_used: remainingToCover,
      quantity_used_in_target_unit: remainingToCover * factor,
      subtotal: remainingToCover * fallbackPrice,
      is_missing: true
    });
  }

  return breakdown;
};

export const calculateFifoCost = (
  material_id: string,
  requiredQuantity: number,
  targetUnit: Unit,
  batches: MaterialBatch[],
  rawMaterials: RawMaterial[]
): number => {
  const breakdown = getFifoBreakdown(material_id, requiredQuantity, targetUnit, batches, rawMaterials);
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
      pm.material_id,
      pm.quantity,
      pm.consumption_unit,
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
          set({ products: data as Product[] });
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
          set({ batches: data as MaterialBatch[] });
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
          set({ movements: data as StockMovement[] });
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

      addProduct: async (product) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        const { error } = await supabase.from('products').insert({
          id: product.id,
          company_id: companyId,
          name: product.name,
          reference: product.reference,
          price: product.price,
          target_margin: product.target_margin,
          cost_fifo: calculateProductCost(product, get().batches, get().rawMaterials),
          materials: product.materials, // JSONB
          status: product.status,
          created_at: product.created_at,
        });

        if (error) throw error;

        set((state) => ({ products: [...state.products, product] }));
      },

      updateProduct: async (product) => {
        const { error } = await supabase.from('products')
          .update({
            name: product.name,
            reference: product.reference,
            price: product.price,
            target_margin: product.target_margin,
            materials: product.materials,
            cost_fifo: calculateProductCost(product, get().batches, get().rawMaterials),
            status: product.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id)
          .eq('company_id', get().currentCompanyId);

        if (error) throw error;

        set((state) => ({
          products: state.products.map((p) => (p.id === product.id ? product : p)),
        }));
      },

      deleteProduct: async (id) => {
        const { error } = await supabase.from('products')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);

        if (error) throw error;

        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
      },

      addRawMaterial: async (material) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        set((state) => ({ rawMaterials: [...state.rawMaterials, material] }));

        const { error } = await supabase.from('raw_materials').insert({
          id: material.id,
          company_id: companyId,
          name: material.name,
          description: material.description,
          type: material.type,
          unit: material.unit,
          provider: material.provider,
          status: material.status,
          created_at: new Date().toISOString()
        });

        if (error) {
          console.error('[Supabase] addRawMaterial Error:', error.message);
          throw error;
        }
      },

      updateRawMaterial: async (material) => {
        const { error } = await supabase.from('raw_materials').update({
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

        if (error) throw error;

        set((state) => ({
          rawMaterials: state.rawMaterials.map((m) =>
            m.id === material.id ? material : m
          ),
        }));
      },

      deleteRawMaterial: async (id) => {
        const { error } = await supabase.from('raw_materials')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);

        if (error) throw error;

        set((state) => ({
          rawMaterials: state.rawMaterials.filter((m) => m.id !== id),
          batches: state.batches.filter((b) => b.material_id !== id),
          movements: state.movements.filter((mov) => mov.material_id !== id),
        }));
      },

      addBatch: async (batch) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        const movement: StockMovement = {
          id: crypto.randomUUID(),
          company_id: companyId,
          material_id: batch.material_id,
          batch_id: batch.id,
          date: batch.date,
          type: 'ingreso',
          quantity: batch.initial_quantity,
          unit_cost: batch.unit_cost,
          reference: batch.provider,
          created_at: new Date().toISOString()
        };

        const { error: batchError } = await supabase.from('material_batches').insert({
          id: batch.id,
          company_id: companyId,
          material_id: batch.material_id,
          date: batch.date,
          provider: batch.provider,
          initial_quantity: batch.initial_quantity,
          remaining_quantity: batch.remaining_quantity,
          unit_cost: batch.unit_cost,
          reference: batch.reference,
          width: batch.width,
          length: batch.length,
          area: batch.area,
          entry_mode: batch.entry_mode,
        });

        if (batchError) throw batchError;

        const { error: movementError } = await supabase.from('stock_movements').insert({
          id: movement.id,
          company_id: companyId,
          material_id: movement.material_id,
          batch_id: movement.batch_id,
          date: movement.date,
          type: movement.type,
          quantity: movement.quantity,
          unit_cost: movement.unit_cost,
          reference: movement.reference,
        });

        if (movementError) console.error('[Supabase] Non-fatal addMovement Error:', movementError.message);

        set((state) => ({
          batches: [...state.batches, batch],
          movements: [...state.movements, movement],
        }));
      },

      deleteBatch: async (id) => {
        const companyId = get().currentCompanyId;

        const { error } = await supabase.from('material_batches')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('company_id', companyId);

        if (error) throw error;

        set((state) => ({
          batches: state.batches.filter((b) => b.id !== id),
          movements: state.movements.filter((mov) => mov.batch_id !== id),
        }));
      },

      updateBatch: async (batch) => {
        const companyId = get().currentCompanyId;

        const { error } = await supabase.from('material_batches').update({
          date: batch.date,
          provider: batch.provider,
          initial_quantity: batch.initial_quantity,
          remaining_quantity: batch.remaining_quantity,
          unit_cost: batch.unit_cost,
          reference: batch.reference,
          width: batch.width,
          length: batch.length,
          area: batch.area,
          entry_mode: batch.entry_mode,
          updated_at: new Date().toISOString()
        })
          .eq('id', batch.id)
          .eq('company_id', companyId);

        if (error) throw error;

        set((state) => {
          const updatedMovements = state.movements.map((mov) =>
            mov.batch_id === batch.id && mov.type === 'ingreso'
              ? {
                ...mov,
                quantity: batch.initial_quantity,
                unit_cost: batch.unit_cost,
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
      },

      updateBatchRemaining: (id, newQty) => {
        const companyId = get().currentCompanyId;
        set((state) => ({
          batches: state.batches.map((b) =>
            b.id === id ? { ...b, remaining_quantity: newQty } : b
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
              pm.material_id,
              pm.quantity,
              pm.consumption_unit,
              currentBatches,
              state.rawMaterials
            );

            breakdown.forEach(item => {
              if (item.batch_id === 'faltante') return;

              currentBatches = currentBatches.map(b => {
                if (b.id === item.batch_id) {
                  const newRemaining = Math.max(0, b.remaining_quantity - item.quantity_used);
                  // Sync update batch remaining
                  supabase.from('material_batches').update({ remaining_quantity: newRemaining }).eq('id', b.id).eq('company_id', companyId).then();
                  return { ...b, remaining_quantity: newRemaining };
                }
                return b;
              });

              const movId = crypto.randomUUID();
              syncMovements.push({
                id: movId,
                company_id: companyId,
                material_id: pm.material_id,
                batch_id: item.batch_id,
                date: now,
                type: 'egreso',
                quantity: item.quantity_used,
                unit_cost: item.unit_cost,
                reference: `Prod: ${product.name}`,
                created_at: now
              });
            });
          });

          // Sync insert movements
          if (syncMovements.length > 0) {
            supabase.from('stock_movements').insert(syncMovements).then();
          }

          return {
            batches: currentBatches,
            movements: [...state.movements, ...syncMovements] as StockMovement[],
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
