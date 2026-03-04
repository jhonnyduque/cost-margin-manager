import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, RawMaterial, Unit, ProductMaterial, MaterialBatch, StockMovement, UserRole, ProductMovement } from '@/types';
import { supabase } from './services/supabase';
import { fetchProductsFromSupabase } from './services/products.service';
import { calculatePiecesToLinearMeters, getLatestRollWidth } from '@/utils/materialCalculations';

// 🔹 AUDIT TRAIL HELPER
const getActorId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

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
  productMovements: ProductMovement[];

  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  discontinueProduct: (id: string) => Promise<void>;

  loadProductsFromSupabase: () => Promise<void>;
  loadRawMaterialsFromSupabase: () => Promise<void>;
  loadBatchesFromSupabase: () => Promise<void>;
  loadMovementsFromSupabase: () => Promise<void>;
  loadProductMovementsFromSupabase: () => Promise<void>;
  logout: () => void;

  addRawMaterial: (material: RawMaterial) => Promise<void>;
  updateRawMaterial: (material: RawMaterial) => Promise<void>;
  deleteRawMaterial: (id: string) => Promise<void>;
  archiveMaterial: (id: string) => Promise<void>;

  addBatch: (batch: MaterialBatch) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  updateBatch: (batch: MaterialBatch) => Promise<void>;
  updateBatchRemaining: (id: string, newQty: number) => Promise<void>;
  consumeStock: (productId: string) => Promise<void>;
  consumeStockBatch: (productId: string, quantity: number, targetPrice?: number) => Promise<void>;
  registerFinishedGoodOutput: (productId: string, quantity: number, type: string, reference: string) => Promise<void>;
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

  const allMaterialBatches = batches
    .filter(b => b.material_id === material_id)
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
    const lastBatch = allMaterialBatches[allMaterialBatches.length - 1];
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
    // 🟠 AUDIT FIX: Usar calculatePiecesToLinearMeters centralizado
    // en lugar de duplicar la lógica dimensional aquí.
    let effectiveQty = pm.quantity;
    if ((pm as any).mode === 'pieces' && Array.isArray((pm as any).pieces) && (pm as any).pieces.length > 0) {
      const rollWidth = getLatestRollWidth(pm.material_id, batches);
      effectiveQty = calculatePiecesToLinearMeters((pm as any).pieces, rollWidth);
    }

    const fifoCost = calculateFifoCost(
      pm.material_id,
      effectiveQty,
      pm.consumption_unit,
      batches,
      rawMaterials
    );
    return total + fifoCost;
  }, 0);
};

export const getMaterialDebt = (material_id: string, movements: StockMovement[]) => {
  const assumed = movements.filter(m => m.material_id === material_id && m.type === 'egreso_asumido');
  const compensated = movements.filter(m => m.material_id === material_id && m.type === 'egreso_compensatorio');

  const totalAssumedQty = assumed.reduce((sum, m) => sum + m.quantity, 0);
  const totalCompensatedQty = compensated.reduce((sum, m) => sum + m.quantity, 0);

  const pendingQty = Math.max(0, totalAssumedQty - totalCompensatedQty);

  const totalAssumedCost = assumed.reduce((sum, m) => sum + (m.quantity * m.unit_cost), 0);
  const avgAssumedCost = totalAssumedQty > 0 ? totalAssumedCost / totalAssumedQty : 0;

  return {
    pendingQty,
    financialDebt: pendingQty * avgAssumedCost
  };
};

export const calculateTotalFinancialDebt = (movements: StockMovement[], materials: RawMaterial[]) => {
  return materials.reduce((total, mat) => {
    return total + getMaterialDebt(mat.id, movements).financialDebt;
  }, 0);
};

export const hasProductGeneratedActiveDebt = (productId: string, movements: StockMovement[]) => {
  const generatedDebts = movements.filter(m => m.type === 'egreso_asumido' && m.reference?.includes(`Prod_ID: ${productId}`));

  for (const mov of generatedDebts) {
    const debt = getMaterialDebt(mov.material_id, movements);
    if (debt.pendingQty > 0) {
      return true;
    }
  }
  return false;
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentCompanyId: null,
      currentUserRole: null,
      isImpersonating: false,
      impersonatedCompanyId: null,

      setCurrentCompany: (companyId, role) => {
        set({ currentCompanyId: companyId, currentUserRole: role });
        get().loadProductsFromSupabase();
        get().loadRawMaterialsFromSupabase();
        get().loadBatchesFromSupabase();
        get().loadMovementsFromSupabase();
        get().loadProductMovementsFromSupabase();
      },

      setImpersonation: (active, companyId) => {
        set({ isImpersonating: active, impersonatedCompanyId: companyId });
      },

      products: [],
      rawMaterials: [],
      batches: [],
      movements: [],
      productMovements: [],

      loadProductsFromSupabase: async () => {
        const companyId = get().currentCompanyId;
        if (!companyId) { console.warn('[Store] loadProducts skipped — no companyId'); return; }
        console.log('[Store] Loading products for company:', companyId);
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('company_id', companyId)
          .is('deleted_at', null);
        if (error) {
          console.error('[Store] Error loading products:', error);
          return;
        }
        console.log('[Store] Products loaded:', data?.length, data);
        if (data) set({ products: data as Product[] });
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
        if (!error && data) set({ batches: data as MaterialBatch[] });
      },

      loadMovementsFromSupabase: async () => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;
        const { data, error } = await supabase
          .from('stock_movements')
          .select('*')
          .eq('company_id', companyId);
        if (!error && data) set({ movements: data as StockMovement[] });
      },

      loadProductMovementsFromSupabase: async () => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;
        const { data, error } = await supabase
          .from('product_movements')
          .select('*')
          .eq('company_id', companyId);
        if (!error && data) set({ productMovements: data as ProductMovement[] });
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
          movements: [],
          productMovements: []
        });
      },

      addProduct: async (product) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;
        const actorId = await getActorId();

        const { error } = await supabase.from('products').insert({
          id: product.id,
          company_id: companyId,
          name: product.name,
          reference: product.reference,
          price: product.price,
          target_margin: product.target_margin,
          cost_fifo: calculateProductCost(product, get().batches, get().rawMaterials),
          materials: product.materials,
          status: product.status,
          created_at: product.created_at,
          created_by: actorId,
          updated_by: actorId,
        });

        if (error) throw error;
        set((state) => ({ products: [...state.products, product] }));
      },

      updateProduct: async (product) => {
        const actorId = await getActorId();
        const { error } = await supabase.from('products')
          .update({
            name: product.name,
            reference: product.reference,
            price: product.price,
            target_margin: product.target_margin,
            materials: product.materials,
            cost_fifo: calculateProductCost(product, get().batches, get().rawMaterials),
            status: product.status,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          })
          .eq('id', product.id)
          .eq('company_id', get().currentCompanyId);

        if (error) throw error;
        set((state) => ({
          products: state.products.map((p) => (p.id === product.id ? product : p)),
        }));
      },

      deleteProduct: async (id) => {
        const hasHistory = get().productMovements.some(m => m.product_id === id);
        if (hasHistory) {
          throw new Error('No se puede eliminar un producto con historial de inventario activo. Desactívelo en su lugar.');
        }
        const actorId = await getActorId();
        const { error } = await supabase.from('products')
          .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);

        if (error) throw error;
        set((state) => ({ products: state.products.filter((p) => p.id !== id) }));
      },

      discontinueProduct: async (id) => {
        const actorId = await getActorId();
        const { error } = await supabase.from('products')
          .update({ status: 'inactiva', updated_at: new Date().toISOString(), updated_by: actorId })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);
        if (error) throw error;
        set((state) => ({
          products: state.products.map((p) => p.id === id ? { ...p, status: 'inactiva' } : p),
        }));
      },

      addRawMaterial: async (material) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;
        const actorId = await getActorId();

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
          created_at: new Date().toISOString(),
          created_by: actorId,
          updated_by: actorId,
        });

        if (error) {
          console.error('[Supabase] addRawMaterial Error:', error.message);
          throw error;
        }
      },

      updateRawMaterial: async (material) => {
        const actorId = await getActorId();
        const { error } = await supabase.from('raw_materials').update({
          name: material.name,
          description: material.description,
          type: material.type,
          unit: material.unit,
          provider: material.provider,
          status: material.status,
          updated_at: new Date().toISOString(),
          updated_by: actorId,
        })
          .eq('id', material.id)
          .eq('company_id', get().currentCompanyId);

        if (error) throw error;
        set((state) => ({
          rawMaterials: state.rawMaterials.map((m) => m.id === material.id ? material : m),
        }));
      },

      deleteRawMaterial: async (id) => {
        const debt = getMaterialDebt(id, get().movements);
        if (debt.pendingQty > 0) {
          throw new Error('Integridad Contable: No se puede eliminar una materia prima con deuda activa.');
        }
        const actorId = await getActorId();
        const { error } = await supabase.from('raw_materials')
          .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);

        if (error) throw error;
        set((state) => ({
          rawMaterials: state.rawMaterials.filter((m) => m.id !== id),
          batches: state.batches.filter((b) => b.material_id !== id),
          movements: state.movements.filter((mov) => mov.material_id !== id),
        }));
      },

      archiveMaterial: async (id) => {
        const actorId = await getActorId();
        const { error } = await supabase.from('raw_materials')
          .update({ status: 'inactiva', updated_at: new Date().toISOString(), updated_by: actorId })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);
        if (error) throw error;
        set((state) => ({
          rawMaterials: state.rawMaterials.map((m) => m.id === id ? { ...m, status: 'inactiva' } : m),
        }));
      },

      addBatch: async (batch) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        const now = new Date().toISOString();
        let finalRemaining = batch.initial_quantity;
        const syncMovements: StockMovement[] = [];

        const debt = getMaterialDebt(batch.material_id, get().movements);
        if (debt.pendingQty > 0) {
          const qtyToCompensate = Math.min(debt.pendingQty, batch.initial_quantity);
          finalRemaining = batch.initial_quantity - qtyToCompensate;

          syncMovements.push({
            id: crypto.randomUUID(),
            company_id: companyId,
            material_id: batch.material_id,
            batch_id: batch.id,
            date: now,
            type: 'egreso_compensatorio',
            quantity: qtyToCompensate,
            unit_cost: batch.unit_cost,
            reference: 'Compensación Automática (Auto-Clearing)',
            created_at: now
          });
        }

        batch.remaining_quantity = finalRemaining;

        const mainMovement: StockMovement = {
          id: crypto.randomUUID(),
          company_id: companyId,
          material_id: batch.material_id,
          batch_id: batch.id,
          date: batch.date,
          type: 'ingreso',
          quantity: batch.initial_quantity,
          unit_cost: batch.unit_cost,
          reference: batch.provider,
          created_at: now
        };
        syncMovements.unshift(mainMovement);

        const actorId = await getActorId();
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
          created_by: actorId,
          updated_by: actorId,
        });

        if (batchError) throw batchError;

        const { error: movementError } = await supabase.from('stock_movements').insert(syncMovements);
        if (movementError) console.error('[Supabase] Non-fatal addMovement Error:', movementError.message);

        set((state) => ({
          batches: [...state.batches, batch],
          movements: [...state.movements, ...syncMovements],
        }));
      },

      deleteBatch: async (id) => {
        const companyId = get().currentCompanyId;
        // 🔴 AUDIT FIX: updated_by en soft-delete de lote
        const actorId = await getActorId();

        const { error } = await supabase.from('material_batches')
          .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
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
        const actorId = await getActorId();

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
          updated_at: new Date().toISOString(),
          updated_by: actorId,
        })
          .eq('id', batch.id)
          .eq('company_id', companyId);

        if (error) throw error;

        set((state) => {
          const updatedMovements = state.movements.map((mov) =>
            mov.batch_id === batch.id && mov.type === 'ingreso'
              ? { ...mov, quantity: batch.initial_quantity, unit_cost: batch.unit_cost, reference: batch.provider, date: batch.date }
              : mov
          );
          return {
            batches: state.batches.map((b) => b.id === batch.id ? batch : b),
            movements: updatedMovements,
          };
        });
      },

      updateBatchRemaining: async (id, newQty) => {
        const companyId = get().currentCompanyId;
        const actorId = await getActorId();

        // Optimistic update — revert on failure
        const previousBatches = get().batches;
        set((state) => ({
          batches: state.batches.map((b) => b.id === id ? { ...b, remaining_quantity: newQty } : b),
        }));

        const { error } = await supabase.from('material_batches')
          .update({ remaining_quantity: newQty, updated_at: new Date().toISOString(), updated_by: actorId })
          .eq('id', id)
          .eq('company_id', companyId);

        if (error) {
          console.error('[store] updateBatchRemaining failed:', error.message);
          // Rollback optimistic update
          set({ batches: previousBatches });
          throw error;
        }
      },

      consumeStock: async (productId) => {
        const companyId = get().currentCompanyId;
        const product = get().products.find(p => p.id === productId);
        if (!product || !companyId) return;

        let currentBatches = [...get().batches];
        const syncMovements: any[] = [];
        const now = new Date().toISOString();

        product.materials?.forEach(pm => {
          // 🟢 AUDIT FIX #3: Soporte modo pieces via getEffectiveQuantity
          const effectiveQty = (pm as any).mode === 'pieces' && Array.isArray((pm as any).pieces) && (pm as any).pieces.length > 0
            ? calculatePiecesToLinearMeters((pm as any).pieces, getLatestRollWidth(pm.material_id, currentBatches))
            : pm.quantity;

          const breakdown = getFifoBreakdown(
            pm.material_id,
            effectiveQty,
            pm.consumption_unit,
            currentBatches,
            get().rawMaterials
          );

          breakdown.forEach(item => {
            if (item.batch_id !== 'faltante') {
              currentBatches = currentBatches.map(b => {
                if (b.id === item.batch_id) {
                  const newRemaining = Math.max(0, b.remaining_quantity - item.quantity_used);
                  return { ...b, remaining_quantity: newRemaining };
                }
                return b;
              });
            }

            syncMovements.push({
              id: crypto.randomUUID(),
              company_id: companyId,
              material_id: pm.material_id,
              batch_id: item.batch_id === 'faltante' ? null : item.batch_id,
              date: now,
              type: item.is_missing ? 'egreso_asumido' : 'egreso',
              quantity: item.quantity_used,
              unit_cost: item.unit_cost,
              reference: item.is_missing ? `Faltante Asumido (Prod_ID: ${product.id}) - ${product.name}` : `Prod: ${product.name}`,
              created_at: now
            });
          });
        });

        // 🟢 AUDIT FIX #1: Persist to DB with await + error handling
        for (const batch of currentBatches) {
          const original = get().batches.find(b => b.id === batch.id);
          if (original && original.remaining_quantity !== batch.remaining_quantity) {
            const { error } = await supabase.from('material_batches')
              .update({ remaining_quantity: batch.remaining_quantity })
              .eq('id', batch.id)
              .eq('company_id', companyId);
            if (error) {
              console.error(`[store] consumeStock batch update failed for ${batch.id}:`, error.message);
              throw error;
            }
          }
        }

        if (syncMovements.length > 0) {
          const { error } = await supabase.from('stock_movements').insert(syncMovements);
          if (error) {
            console.error('[store] consumeStock movements insert failed:', error.message);
            throw error;
          }
        }

        set((state) => ({
          batches: currentBatches,
          movements: [...state.movements, ...syncMovements] as StockMovement[],
        }));
      },

      consumeStockBatch: async (productId: string, quantity: number, targetPrice?: number) => {
        const companyId = get().currentCompanyId;
        const product = get().products.find(p => p.id === productId);
        if (!product || !companyId || quantity <= 0) return;

        let currentBatches = [...get().batches];
        const syncMovements: any[] = [];
        const now = new Date().toISOString();
        let totalCostForBatch = 0;
        let hasMissingMaterials = false;

        product.materials?.forEach(pm => {
          // 🟠 AUDIT FIX: Usar calculatePiecesToLinearMeters centralizado
          let reqQty = pm.quantity * quantity;
          if ((pm as any).mode === 'pieces' && (pm as any).pieces) {
            const rollWidth = getLatestRollWidth(pm.material_id, currentBatches);
            reqQty = calculatePiecesToLinearMeters((pm as any).pieces, rollWidth) * quantity;
          }

          const breakdown = getFifoBreakdown(
            pm.material_id,
            reqQty,
            pm.consumption_unit,
            currentBatches,
            get().rawMaterials
          );

          breakdown.forEach(item => {
            if (item.batch_id !== 'faltante') {
              currentBatches = currentBatches.map(b => {
                if (b.id === item.batch_id) {
                  const newRemaining = Math.max(0, b.remaining_quantity - item.quantity_used);
                  return { ...b, remaining_quantity: newRemaining };
                }
                return b;
              });
            }
            totalCostForBatch += item.subtotal;
            syncMovements.push({
              id: crypto.randomUUID(),
              company_id: companyId,
              material_id: pm.material_id,
              batch_id: item.batch_id === 'faltante' ? null : item.batch_id,
              date: now,
              type: item.is_missing ? 'egreso_asumido' : 'egreso',
              quantity: item.quantity_used,
              unit_cost: item.unit_cost,
              reference: item.is_missing ? `Faltante Lote (Prod_ID: ${product.id})` : `Prod Lote: ${product.name}`,
              created_at: now
            });
            if (item.is_missing) hasMissingMaterials = true;
          });
        });

        const perUnitCost = totalCostForBatch / quantity;

        const productMovement: ProductMovement = {
          id: crypto.randomUUID(),
          company_id: companyId,
          product_id: productId,
          type: 'ingreso_produccion',
          quantity: quantity,
          unit_cost: perUnitCost,
          reference: `Lote Producción: ${quantity} uds`,
          created_at: now,
          produced_with_debt: hasMissingMaterials
        };

        for (const batch of currentBatches) {
          await supabase.from('material_batches').update({ remaining_quantity: batch.remaining_quantity }).eq('id', batch.id).eq('company_id', companyId);
        }

        if (syncMovements.length > 0) {
          const { error } = await supabase.from('stock_movements').insert(syncMovements);
          if (error) {
            console.error('[store] consumeStockBatch movements insert failed:', error.message);
            throw error;
          }
        }

        await supabase.from('product_movements').insert([productMovement]);

        if (targetPrice !== undefined && targetPrice !== product.price) {
          await supabase.from('products').update({ price: targetPrice }).eq('id', productId).eq('company_id', companyId);
          await get().updateProduct({ ...product, price: targetPrice });
        }

        set((state) => ({
          batches: currentBatches,
          movements: [...state.movements, ...syncMovements] as StockMovement[],
          productMovements: [productMovement, ...state.productMovements]
        }));
      },

      registerFinishedGoodOutput: async (productId, quantity, type, reference) => {
        const companyId = get().currentCompanyId;
        if (!companyId) throw new Error("No hay compañía activa");

        const inMovements = get().productMovements.filter(m => m.product_id === productId && m.type === 'ingreso_produccion');
        const avgCost = inMovements.length > 0
          ? inMovements.reduce((acc, m) => acc + (m.quantity * m.unit_cost), 0) / inMovements.reduce((acc, m) => acc + m.quantity, 0)
          : 0;

        const newMovement: ProductMovement = {
          id: crypto.randomUUID(),
          company_id: companyId,
          product_id: productId,
          type: type as any,
          quantity: quantity,
          unit_cost: avgCost,
          reference: reference,
          created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('product_movements').insert([newMovement]);
        if (error) throw error;

        set(state => ({
          productMovements: [newMovement, ...state.productMovements]
        }));
      },
    }),
    {
      name: 'calculadora-pro-fifo-v4',
    }
  )
);