import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, RawMaterial, Unit, ProductMaterial, MaterialBatch, StockMovement, UserRole, ProductMovement, STOCK_MOVEMENT_REF, UomCategory, UnitOfMeasure, MaterialType } from '@/types';
import { supabase } from './services/supabase';
import { fetchProductsFromSupabase } from './services/products.service';
import { calculatePiecesToLinearMeters, getLatestRollWidth } from '@/utils/materialCalculations';
import { InventoryEngineV2, UnitConverter } from './services/inventoryEngineV2';

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

  // 🔹 UOM V2 DATA
  uomCategories: UomCategory[];
  unitsOfMeasure: UnitOfMeasure[];
  materialTypes: MaterialType[];
  loadUomMetadata: () => Promise<void>;

  // 🔹 TAXONOMY MANAGEMENT (Super Admin Only)
  addMaterialType: (name: string) => Promise<void>;
  updateMaterialType: (id: string, name: string) => Promise<void>;
  deleteMaterialType: (id: string) => Promise<void>;

  addUomCategory: (name: string, key: string) => Promise<void>;
  updateUomCategory: (id: string, name: string, key: string) => Promise<void>;
  deleteUomCategory: (id: string) => Promise<void>;

  addUnitOfMeasure: (unit: Partial<UnitOfMeasure>) => Promise<void>;
  updateUnitOfMeasure: (id: string, unit: Partial<UnitOfMeasure>) => Promise<void>;
  deleteUnitOfMeasure: (id: string) => Promise<void>;
}


export const getFifoBreakdown = (
  material_id: string,
  requiredQuantity: number,
  targetUnitSymbol: string, // Cambiado a string para mayor flexibilidad v2
  batches: MaterialBatch[],
  rawMaterials: RawMaterial[],
  unitsOfMeasure: UnitOfMeasure[]
) => {
  const uoms = unitsOfMeasure || [];
  const material = rawMaterials.find(m => m.id === material_id);
  if (!material || !material.base_unit_id) return [];

  const baseUnit = uoms.find(u => u.id === material.base_unit_id);
  const targetUnit = uoms.find(u => u.symbol.toLowerCase() === (targetUnitSymbol || '').toLowerCase()) || baseUnit;

  if (!baseUnit || !targetUnit) return [];

  // 1. Convertir la cantidad requerida a UNIDADES BASE
  const baseQuantityRequested = UnitConverter.toBase(requiredQuantity, targetUnit);

  // 2. Ejecutar Lógica FIFO sobre columnas BASE
  const activeBatches = batches
    .filter(b => b.material_id === material_id && (b.base_remaining_quantity ?? 0) > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const engineResult = InventoryEngineV2.calculateFifoConsumption(baseQuantityRequested, activeBatches);

  // 3. Mapear al formato de UI esperado
  const breakdown = engineResult.consumptions.map(c => {
    const batch = batches.find(b => b.id === c.batch_id);
    return {
      batch_id: c.batch_id,
      date: batch?.date || 'N/A',
      unit_cost: c.cost_per_base_unit * targetUnit.conversion_factor,
      cost_per_base_unit: c.cost_per_base_unit,
      quantity_used: UnitConverter.fromBase(c.base_quantity_consumed, targetUnit), // En la unidad que pidió el usuario
      base_quantity_consumed: c.base_quantity_consumed,
      subtotal: c.total_base_cost
    };
  });

  if (engineResult.remainingToConsume > 0) {
    const lastBatch = batches
      .filter(b => b.material_id === material_id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    const fallbackCost = lastBatch?.cost_per_base_unit || 0;

    breakdown.push({
      batch_id: 'faltante',
      date: 'N/A (Sin Stock)',
      unit_cost: fallbackCost * targetUnit.conversion_factor,
      cost_per_base_unit: fallbackCost,
      quantity_used: UnitConverter.fromBase(engineResult.remainingToConsume, targetUnit),
      base_quantity_consumed: engineResult.remainingToConsume,
      subtotal: engineResult.remainingToConsume * fallbackCost,
      is_missing: true
    } as any);
  }

  return breakdown;
};

export const calculateFifoCost = (
  material_id: string,
  requiredQuantity: number,
  targetUnit: string,
  batches: MaterialBatch[],
  rawMaterials: RawMaterial[],
  unitsOfMeasure: UnitOfMeasure[]
): number => {
  const breakdown = getFifoBreakdown(material_id, requiredQuantity, targetUnit, batches, rawMaterials, unitsOfMeasure);
  return breakdown.reduce((acc, item: any) => acc + (item.subtotal ?? 0), 0);
};

export const calculateProductCost = (
  product: Product,
  batches: MaterialBatch[],
  rawMaterials: RawMaterial[],
  unitsOfMeasure: UnitOfMeasure[]
) => {
  const materials = product.materials ?? [];
  return materials.reduce((total, pm) => {
    let effectiveQty = pm.quantity;
    if (pm.mode === 'pieces' && Array.isArray(pm.pieces) && pm.pieces.length > 0) {
      const rollWidth = getLatestRollWidth(pm.material_id, batches);
      effectiveQty = calculatePiecesToLinearMeters(pm.pieces, rollWidth);
    }

    const fifoCost = calculateFifoCost(
      pm.material_id,
      effectiveQty,
      pm.consumption_unit,
      batches,
      rawMaterials,
      unitsOfMeasure
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
        get().loadUomMetadata(); // Load units first
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
      uomCategories: [],
      unitsOfMeasure: [],
      materialTypes: [],

      loadUomMetadata: async () => {
        const { data: catData } = await supabase.from('uom_categories').select('*').order('name');
        const { data: unitData } = await supabase.from('units_of_measure').select('*').order('name');
        const { data: typeData } = await supabase.from('material_types').select('*').order('name');

        if (catData) set({ uomCategories: catData });
        if (unitData) set({ unitsOfMeasure: unitData });
        if (typeData) set({ materialTypes: typeData });
      },

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
          .eq('company_id', companyId)
          .is('deleted_at', null);
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
          cost_fifo: calculateProductCost(product, get().batches, get().rawMaterials, get().unitsOfMeasure),
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
            cost_fifo: calculateProductCost(product, get().batches, get().rawMaterials, get().unitsOfMeasure),
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

        const { error } = await supabase.from('raw_materials').insert({
          id: material.id,
          company_id: companyId,
          name: material.name,
          description: material.description,
          type: material.type,
          category_id: material.category_id,
          base_unit_id: material.base_unit_id,
          purchase_unit_id: material.purchase_unit_id,
          display_unit_id: material.display_unit_id,
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

        set((state) => ({ rawMaterials: [...state.rawMaterials, material] }));
      },

      updateRawMaterial: async (material) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;
        const actorId = await getActorId();

        const { error } = await supabase.from('raw_materials').update({
          name: material.name,
          description: material.description,
          type: material.type,
          category_id: material.category_id,
          base_unit_id: material.base_unit_id,
          purchase_unit_id: material.purchase_unit_id,
          display_unit_id: material.display_unit_id,
          provider: material.provider,
          status: material.status,
          updated_at: new Date().toISOString(),
          updated_by: actorId,
        })
          .eq('id', material.id)
          .eq('company_id', companyId);

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
            reference: STOCK_MOVEMENT_REF.compensacion(),
            created_at: now,
            deleted_at: null
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
          created_at: now,
          deleted_at: null
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
          base_initial_quantity: batch.base_initial_quantity,
          base_remaining_quantity: batch.base_remaining_quantity,
          base_consumed_quantity: batch.base_consumed_quantity || 0,
          cost_per_base_unit: batch.cost_per_base_unit,
          received_unit_id: batch.received_unit_id,
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
          base_initial_quantity: batch.base_initial_quantity,
          base_remaining_quantity: batch.base_remaining_quantity,
          base_consumed_quantity: batch.base_consumed_quantity,
          cost_per_base_unit: batch.cost_per_base_unit,
          received_unit_id: batch.received_unit_id,
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
        const actorId = await getActorId();

        let currentBatches = [...get().batches];
        const syncMovements: any[] = [];
        const now = new Date().toISOString();

        product.materials?.forEach(pm => {
          // 🟢 AUDIT FIX #3: Soporte modo pieces via getEffectiveQuantity
          const effectiveQty = pm.mode === 'pieces' && Array.isArray(pm.pieces) && pm.pieces.length > 0
            ? calculatePiecesToLinearMeters(pm.pieces, getLatestRollWidth(pm.material_id, currentBatches))
            : pm.quantity;

          const breakdown = getFifoBreakdown(
            pm.material_id,
            effectiveQty,
            pm.consumption_unit,
            currentBatches,
            get().rawMaterials,
            get().unitsOfMeasure
          );

          breakdown.forEach(item => {
            if (item.batch_id !== 'faltante') {
              currentBatches = currentBatches.map(b => {
                if (b.id === item.batch_id) {
                  const newBaseRemaining = Math.max(0, (b.base_remaining_quantity ?? 0) - (item as any).base_quantity_consumed);
                  const material = get().rawMaterials.find(m => m.id === b.material_id);
                  const baseUnit = get().unitsOfMeasure.find(u => u.id === material?.base_unit_id);
                  const receivedUnit = get().unitsOfMeasure.find(u => u.id === b.received_unit_id) || baseUnit;
                  const newLegacyRemaining = receivedUnit ? UnitConverter.fromBase(newBaseRemaining, receivedUnit) : b.remaining_quantity;

                  return {
                    ...b,
                    base_remaining_quantity: newBaseRemaining,
                    base_consumed_quantity: (b.base_consumed_quantity ?? 0) + (item as any).base_quantity_consumed,
                    remaining_quantity: newLegacyRemaining
                  };
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
              type: (item as any).is_missing ? 'egreso_asumido' : 'egreso',
              quantity: item.quantity_used,
              unit_cost: item.unit_cost,
              reference: (item as any).is_missing
                ? STOCK_MOVEMENT_REF.egresoAsumido(product.id, product.name)
                : STOCK_MOVEMENT_REF.egreso(product.name),
              created_at: now
            });
          });
        });

        // 🟢 AUDIT FIX #1: Persist to DB with await + error handling
        for (const batch of currentBatches) {
          const original = get().batches.find(b => b.id === batch.id);
          if (original && (original.base_remaining_quantity !== batch.base_remaining_quantity)) {
            const { error } = await supabase.from('material_batches')
              .update({
                remaining_quantity: batch.remaining_quantity,
                base_remaining_quantity: batch.base_remaining_quantity,
                base_consumed_quantity: batch.base_consumed_quantity,
                updated_at: now,
                updated_by: actorId
              })
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
        const actorId = await getActorId();

        let currentBatches = [...get().batches];
        const syncMovements: any[] = [];
        const now = new Date().toISOString();
        let totalCostForBatch = 0;
        let hasMissingMaterials = false;

        product.materials?.forEach(pm => {
          // 🟠 AUDIT FIX: Usar calculatePiecesToLinearMeters centralizado
          let reqQty = pm.quantity * quantity;
          if (pm.mode === 'pieces' && pm.pieces) {
            const rollWidth = getLatestRollWidth(pm.material_id, currentBatches);
            reqQty = calculatePiecesToLinearMeters(pm.pieces, rollWidth) * quantity;
          }

          const breakdown = getFifoBreakdown(
            pm.material_id,
            reqQty,
            pm.consumption_unit,
            currentBatches,
            get().rawMaterials,
            get().unitsOfMeasure
          );

          breakdown.forEach(item => {
            if (item.batch_id !== 'faltante') {
              currentBatches = currentBatches.map(b => {
                if (b.id === item.batch_id) {
                  const newBaseRemaining = Math.max(0, (b.base_remaining_quantity ?? 0) - (item as any).base_quantity_consumed);

                  const material = get().rawMaterials.find(m => m.id === b.material_id);
                  const baseUnit = get().unitsOfMeasure.find(u => u.id === material?.base_unit_id);
                  const receivedUnit = get().unitsOfMeasure.find(u => u.id === b.received_unit_id) || baseUnit;
                  const newLegacyRemaining = receivedUnit ? UnitConverter.fromBase(newBaseRemaining, receivedUnit) : b.remaining_quantity;

                  return {
                    ...b,
                    base_remaining_quantity: newBaseRemaining,
                    base_consumed_quantity: (b.base_consumed_quantity ?? 0) + (item as any).base_quantity_consumed,
                    remaining_quantity: newLegacyRemaining
                  };
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
              type: (item as any).is_missing ? 'egreso_asumido' : 'egreso',
              quantity: item.quantity_used,
              unit_cost: item.unit_cost,
              reference: (item as any).is_missing
                ? STOCK_MOVEMENT_REF.egresoAsumidoLote(product.id)
                : STOCK_MOVEMENT_REF.egresoLote(product.name),
              created_at: now
            });
            if ((item as any).is_missing) hasMissingMaterials = true;
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
          const original = get().batches.find(b => b.id === batch.id);
          if (original && (original.base_remaining_quantity !== batch.base_remaining_quantity)) {
            const { error } = await supabase.from('material_batches')
              .update({
                remaining_quantity: batch.remaining_quantity,
                base_remaining_quantity: batch.base_remaining_quantity,
                base_consumed_quantity: batch.base_consumed_quantity,
                updated_at: now,
                updated_by: actorId
              })
              .eq('id', batch.id)
              .eq('company_id', companyId);
            if (error) {
              console.error(`[store] consumeStockBatch batch update failed for ${batch.id}:`, error.message);
              throw error;
            }
          }
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
          created_at: new Date().toISOString(),
          produced_with_debt: false
        };

        const { error } = await supabase.from('product_movements').insert([newMovement]);
        if (error) throw error;

        set(state => ({
          productMovements: [newMovement, ...state.productMovements]
        }));
      },

      // 🔹 TAXONOMY CRUD (Super Admin Only)
      addMaterialType: async (name) => {
        const { error } = await supabase.from('material_types').insert({ name });
        if (error) throw error;
        get().loadUomMetadata();
      },
      updateMaterialType: async (id, name) => {
        const { error } = await supabase.from('material_types').update({ name }).eq('id', id);
        if (error) throw error;
        get().loadUomMetadata();
      },
      deleteMaterialType: async (id) => {
        const { error } = await supabase.from('material_types').delete().eq('id', id);
        if (error) throw error;
        set(state => ({ materialTypes: state.materialTypes.filter(t => t.id !== id) }));
      },

      addUomCategory: async (name, key) => {
        const { error } = await supabase.from('uom_categories').insert({ name, key });
        if (error) throw error;
        get().loadUomMetadata();
      },
      updateUomCategory: async (id, name, key) => {
        const { error } = await supabase.from('uom_categories').update({ name, key }).eq('id', id);
        if (error) throw error;
        get().loadUomMetadata();
      },
      deleteUomCategory: async (id) => {
        const { error } = await supabase.from('uom_categories').delete().eq('id', id);
        if (error) throw error;
        set(state => ({ uomCategories: state.uomCategories.filter(c => c.id !== id) }));
      },

      addUnitOfMeasure: async (unit) => {
        if (unit.is_base) {
          await supabase.from('units_of_measure').update({ is_base: false }).eq('category_id', unit.category_id);
        }
        // 🧹 Clean payload
        const payload = {
          name: unit.name,
          symbol: unit.symbol,
          conversion_factor: unit.conversion_factor,
          category_id: unit.category_id,
          is_base: unit.is_base
        };
        const { data, error } = await supabase.from('units_of_measure').insert(payload).select().single();
        if (error) throw error;
        if (data) {
          set(state => {
            let units = state.unitsOfMeasure;
            if (unit.is_base) {
              units = units.map(u => u.category_id === unit.category_id ? { ...u, is_base: false } : u);
            }
            return { unitsOfMeasure: [...units, data].sort((a, b) => a.name.localeCompare(b.name)) };
          });
        }
      },
      updateUnitOfMeasure: async (id, unit) => {
        // 🧹 Clean payload
        const payload = {
          name: unit.name,
          symbol: unit.symbol,
          conversion_factor: unit.conversion_factor,
          category_id: unit.category_id,
          is_base: unit.is_base
        };

        if (unit.is_base) {
          const uom = get().unitsOfMeasure.find(u => u.id === id);
          if (uom) {
            await supabase.from('units_of_measure').update({ is_base: false }).eq('category_id', uom.category_id);
          }
        }
        const { error } = await supabase.from('units_of_measure').update(payload).eq('id', id);
        if (error) throw error;
        set(state => {
          let units = state.unitsOfMeasure;
          const uom = units.find(u => u.id === id);
          if (unit.is_base && uom) {
            units = units.map(u => u.category_id === uom.category_id ? { ...u, is_base: false } : u);
          }
          return {
            unitsOfMeasure: units.map(u => u.id === id ? { ...u, ...unit } : u).sort((a, b) => a.name.localeCompare(b.name))
          };
        });
      },
      deleteUnitOfMeasure: async (id) => {
        const { error } = await supabase.from('units_of_measure').delete().eq('id', id);
        if (error) throw error;
        set(state => ({ unitsOfMeasure: state.unitsOfMeasure.filter(u => u.id !== id) }));
      },
    }),
    {
      // 🔒 SECURITY FIX: Only persist session identifiers — NEVER operational data.
      // Persisting products/batches/movements in localStorage creates a cross-tenant
      // data leak risk in multi-tenant environments: switching companies would show
      // stale data from the previous tenant until Supabase reloads.
      // All operational data is always loaded fresh from Supabase on session start.
      name: 'beto-os-session-v1',
      partialize: (state) => ({
        currentCompanyId: state.currentCompanyId,
        currentUserRole: state.currentUserRole,
        isImpersonating: state.isImpersonating,
        impersonatedCompanyId: state.impersonatedCompanyId,
      }),
    }
  )
);