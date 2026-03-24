import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, RawMaterial, Unit, ProductMaterial, MaterialBatch, StockMovement, UserRole, ProductMovement, STOCK_MOVEMENT_REF, UomCategory, UnitOfMeasure, MaterialType, Client, Dispatch, DispatchItem, Supplier, SupplierMaterial, PurchaseOrder, PurchaseOrderItem, ProductionOrder, ProductionStatus } from '@/types';
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
  productionOrders: ProductionOrder[];

  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  discontinueProduct: (id: string, status?: 'activa' | 'inactiva') => Promise<void>;

  loadProductsFromSupabase: () => Promise<void>;
  loadRawMaterialsFromSupabase: () => Promise<void>;
  loadBatchesFromSupabase: () => Promise<void>;
  loadMovementsFromSupabase: () => Promise<void>;
  loadProductMovementsFromSupabase: () => Promise<void>;
  loadProductionOrdersFromSupabase: () => Promise<void>;
  logout: () => void;

  clients: Client[];
  loadClientsFromSupabase: () => Promise<void>;
  addClient: (client: Client) => Promise<void>;
  updateClient: (client: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  archiveClient: (id: string) => Promise<void>;

  addRawMaterial: (material: RawMaterial) => Promise<void>;
  updateRawMaterial: (material: RawMaterial) => Promise<void>;
  deleteRawMaterial: (id: string) => Promise<void>;
  archiveMaterial: (id: string) => Promise<void>;

  addBatch: (batch: MaterialBatch) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  updateBatch: (batch: MaterialBatch) => Promise<void>;
  updateBatchRemaining: (id: string, newQty: number) => Promise<void>;
  consumeStockBatch: (productId: string, quantity: number, targetPrice?: number, initialStatus?: ProductionStatus) => Promise<void>;
  transitionProductionOrder: (orderId: string, newStatus: ProductionStatus) => Promise<void>;
  registerFinishedGoodOutput: (productId: string, quantity: number, type: string, reference: string) => Promise<void>;
  registerBulkFinishedGoodOutput: (outputs: { productId: string; quantity: number; type: string; reference: string }[]) => Promise<void>;

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

  // 🚚 DISPATCHES
  dispatches: Dispatch[];
  loadDispatchesFromSupabase: () => Promise<void>;
  createDispatch: (dispatch: Dispatch, items: DispatchItem[]) => Promise<void>;
  updateDispatch: (dispatch: Dispatch, items: DispatchItem[]) => Promise<void>;
  confirmDispatch: (dispatchId: string) => Promise<void>;
  cancelDispatch: (dispatchId: string) => Promise<void>;
  deleteDispatch: (id: string) => Promise<void>;
  generateDispatchNumber: () => string;

  // 🤝 SUPPLIERS
  suppliers: Supplier[];
  supplierMaterials: SupplierMaterial[];
  loadSuppliersFromSupabase: () => Promise<void>;
  loadSupplierMaterialsFromSupabase: () => Promise<void>;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => Promise<Supplier | null>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  archiveSupplier: (id: string, status: 'activo' | 'inactivo' | 'bloqueado') => Promise<void>;
  syncSupplierMaterials: (supplier_id: string, raw_material_ids: string[]) => Promise<void>;

  // 📝 PURCHASE ORDERS (OC)
  purchaseOrders: PurchaseOrder[];
  loadPurchaseOrdersFromSupabase: () => Promise<void>;
  addPurchaseOrder: (order: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at' | 'total_value' | 'items'>, items: Omit<PurchaseOrderItem, 'id' | 'created_at' | 'subtotal'>[]) => Promise<void>;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => Promise<void>;
  confirmPurchaseOrder: (id: string) => Promise<void>;
  cancelPurchaseOrder: (id: string) => Promise<void>;
  receivePurchaseOrder: (id: string, receivedItems: { item_id: string; received_quantity: number; received_unit_price: number; purchase_unit_id?: string; width?: number | null }[]) => Promise<void>;
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

export const calculateProductStock = (productId: string, productMovements: ProductMovement[]) => {
  return productMovements
    .filter(m => m.product_id === productId)
    .reduce((acc, mov) => {
      if (mov.type === 'ingreso_produccion') return acc + mov.quantity;
      if (mov.type === 'salida_venta') return acc - mov.quantity;
      if (mov.type === 'ajuste') return acc + mov.quantity;
      return acc;
    }, 0);
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
        // Carga de datos
        get().loadUomMetadata();
        get().loadProductsFromSupabase();
        get().loadRawMaterialsFromSupabase();
        get().loadBatchesFromSupabase();
        get().loadMovementsFromSupabase();
        get().loadProductMovementsFromSupabase();
        get().loadClientsFromSupabase();
        get().loadDispatchesFromSupabase();
        get().loadSuppliersFromSupabase();
        get().loadSupplierMaterialsFromSupabase();
        get().loadPurchaseOrdersFromSupabase();
        get().loadProductionOrdersFromSupabase();
      },

      setImpersonation: (active, companyId) => {
        set({ isImpersonating: active, impersonatedCompanyId: companyId });
      },

      products: [],
      rawMaterials: [],
      batches: [],
      movements: [],
      productMovements: [],
      clients: [],
      dispatches: [],
      uomCategories: [],
      unitsOfMeasure: [],
      materialTypes: [],
      suppliers: [],
      supplierMaterials: [],
      purchaseOrders: [],
      productionOrders: [],

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

      loadProductionOrdersFromSupabase: async () => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;
        const { data, error } = await supabase
          .from('production_orders')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (!error && data) set({ productionOrders: data as ProductionOrder[] });
      },

      logout: () => {
        set({
          currentCompanyId: null,
          currentUserRole: null,
          isImpersonating: false,
          impersonatedCompanyId: null,
          dispatches: [],
          products: [],
          rawMaterials: [],
          batches: [],
          movements: [],
          productMovements: [],
          clients: [],
          suppliers: [],
          supplierMaterials: [],
          purchaseOrders: [],
          productionOrders: [],
        });
      },

      loadClientsFromSupabase: async () => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('name');
        if (!error && data) set({ clients: data as Client[] });
      },

      addClient: async (client) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;
        const actorId = await getActorId();
        const { error } = await supabase.from('clients').insert({
          id: client.id,
          company_id: companyId,
          name: client.name,
          email: client.email || null,
          phone: client.phone || null,
          address: client.address || null,
          tax_id: client.tax_id || null,
          notes: client.notes || null,
          status: client.status,
          created_at: new Date().toISOString(),
          created_by: actorId,
          updated_by: actorId,
        });
        if (error) throw error;
        set((state) => ({ clients: [...state.clients, client].sort((a, b) => a.name.localeCompare(b.name)) }));
      },

      updateClient: async (client) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;
        const actorId = await getActorId();
        const { error } = await supabase.from('clients').update({
          name: client.name,
          email: client.email || null,
          phone: client.phone || null,
          address: client.address || null,
          tax_id: client.tax_id || null,
          notes: client.notes || null,
          status: client.status,
          updated_at: new Date().toISOString(),
          updated_by: actorId,
        })
          .eq('id', client.id)
          .eq('company_id', companyId);
        if (error) throw error;
        set((state) => ({
          clients: state.clients.map((c) => c.id === client.id ? client : c),
        }));
      },

      deleteClient: async (id) => {
        const actorId = await getActorId();
        const { error } = await supabase.from('clients')
          .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);
        if (error) throw error;
        set((state) => ({ clients: state.clients.filter((c) => c.id !== id) }));
      },

      archiveClient: async (id) => {
        const actorId = await getActorId();
        const { error } = await supabase.from('clients')
          .update({ status: 'inactivo', updated_at: new Date().toISOString(), updated_by: actorId })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);
        if (error) throw error;
        set((state) => ({
          clients: state.clients.map((c) => c.id === id ? { ...c, status: 'inactivo' } : c),
        }));
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
          min_stock: product.min_stock ?? null,
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
            min_stock: product.min_stock ?? null,
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

      discontinueProduct: async (id, status = 'inactiva') => {
        const actorId = await getActorId();
        const { error } = await supabase.from('products')
          .update({ status: status, updated_at: new Date().toISOString(), updated_by: actorId })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);
        if (error) throw error;
        set((state) => ({
          products: state.products.map((p) => p.id === id ? { ...p, status: status } : p),
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

        const { data, error } = await supabase
          .from('material_batches')
          .update({
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
          .eq('company_id', companyId)
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (!data?.id) throw new Error('No se pudo actualizar el lote.');

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

      consumeStockBatch: async (productId: string, quantity: number, targetPrice?: number, initialStatus: ProductionStatus = 'finished') => {
        const companyId = get().currentCompanyId;
        const product = get().products.find(p => p.id === productId);
        if (!product || !companyId || quantity <= 0) return;

        const actorId = await getActorId();

        // 🚀 FASE 4: Flujo Planificado (RPC v4)
        const { error } = await supabase.rpc('create_production_order_v4', {
          p_product_id: productId,
          p_quantity: quantity,
          p_company_id: companyId,
          p_actor_id: actorId,
          p_status: initialStatus
        });

        if (error) {
          console.error('[Store] consumeStockBatch RPC failed:', error.message);
          throw error;
        }

        // Si se pidió un precio objetivo y se finalizó de inmediato
        if (targetPrice !== undefined && initialStatus === 'finished') {
           await get().updateProduct({ ...product, price: targetPrice });
        }

        // Recargar datos
        await Promise.all([
          get().loadBatchesFromSupabase(),
          get().loadMovementsFromSupabase(),
          get().loadProductMovementsFromSupabase(),
          get().loadProductionOrdersFromSupabase(),
          ...(targetPrice !== undefined ? [get().loadProductsFromSupabase()] : [])
        ]);
      },

      transitionProductionOrder: async (orderId: string, newStatus: ProductionStatus) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        const actorId = await getActorId();

        const { error } = await supabase.rpc('transition_production_order', {
          p_order_id: orderId,
          p_new_status: newStatus,
          p_company_id: companyId,
          p_actor_id: actorId
        });

        if (error) {
          console.error('[Store] transitionProductionOrder failed:', error.message);
          throw error;
        }

        // Recargar todo para asegurar consistencia
        await Promise.all([
          get().loadBatchesFromSupabase(),
          get().loadMovementsFromSupabase(),
          get().loadProductMovementsFromSupabase(),
          get().loadProductionOrdersFromSupabase()
        ]);
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

      registerBulkFinishedGoodOutput: async (outputs) => {
        const companyId = get().currentCompanyId;
        if (!companyId) throw new Error("No hay compañía activa");

        const newMovements: ProductMovement[] = outputs.map(out => {
          const inMovements = get().productMovements.filter(m => m.product_id === out.productId && m.type === 'ingreso_produccion');
          const avgCost = inMovements.length > 0
            ? inMovements.reduce((acc, m) => acc + (m.quantity * m.unit_cost), 0) / inMovements.reduce((acc, m) => acc + m.quantity, 0)
            : 0;

          return {
            id: crypto.randomUUID(),
            company_id: companyId,
            product_id: out.productId,
            type: out.type as any,
            quantity: out.quantity,
            unit_cost: avgCost,
            reference: out.reference,
            created_at: new Date().toISOString(),
            produced_with_debt: false
          };
        });

        const { error } = await supabase.from('product_movements').insert(newMovements);
        if (error) throw error;

        set(state => ({
          productMovements: [...newMovements, ...state.productMovements]
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

      // 🚚 DISPATCHES IMPLEMENTATION
      generateDispatchNumber: () => {
        const year = new Date().getFullYear();
        const existing = get().dispatches
          .filter(d => d.number.startsWith(`DESP-${year}-`))
          .map(d => parseInt(d.number.split('-')[2] || '0', 10))
          .filter(n => !isNaN(n));
        const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
        return `DESP-${year}-${String(next).padStart(3, '0')}`;
      },

      loadDispatchesFromSupabase: async () => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;

        const { data: dispatchData, error } = await supabase
          .from('dispatches')
          .select('*')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (error || !dispatchData) return;

        const { data: itemsData } = await supabase
          .from('dispatch_items')
          .select('*')
          .eq('company_id', companyId);

        const dispatches = dispatchData.map(d => ({
          ...d,
          items: (itemsData || []).filter(i => i.dispatch_id === d.id)
        }));

        set({ dispatches: dispatches as Dispatch[] });
      },

      createDispatch: async (dispatch, items) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;
        const actorId = await getActorId();

        const { error: dispatchError } = await supabase.from('dispatches').insert({
          id: dispatch.id,
          company_id: companyId,
          number: dispatch.number,
          date: dispatch.date,
          client_id: dispatch.client_id || null,
          client_name: dispatch.client_name || null,
          notes: dispatch.notes || null,
          status: 'borrador',
          total_value: dispatch.total_value,
          created_at: new Date().toISOString(),
          created_by: actorId,
          updated_by: actorId,
        });
        if (dispatchError) throw dispatchError;

        if (items.length > 0) {
          const { error: itemsError } = await supabase.from('dispatch_items').insert(
            items.map(item => ({
              id: item.id,
              dispatch_id: dispatch.id,
              company_id: companyId,
              product_id: item.product_id,
              product_name: item.product_name || null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
              notes: item.notes || null,
              created_at: new Date().toISOString(),
            }))
          );
          if (itemsError) throw itemsError;
        }

        const newDispatch = { ...dispatch, items, status: 'borrador' as const };
        set(state => ({ dispatches: [newDispatch, ...state.dispatches] }));
      },

      updateDispatch: async (dispatch, items) => {
        const companyId = get().currentCompanyId;
        if (!companyId) return;
        const actorId = await getActorId();

        const { error: dispatchError } = await supabase.from('dispatches').update({
          date: dispatch.date,
          client_id: dispatch.client_id || null,
          client_name: dispatch.client_name || null,
          notes: dispatch.notes || null,
          total_value: dispatch.total_value,
          updated_at: new Date().toISOString(),
          updated_by: actorId,
        })
          .eq('id', dispatch.id)
          .eq('company_id', companyId);
        if (dispatchError) throw dispatchError;

        await supabase.from('dispatch_items')
          .delete()
          .eq('dispatch_id', dispatch.id)
          .eq('company_id', companyId);

        if (items.length > 0) {
          await supabase.from('dispatch_items').insert(
            items.map(item => ({
              id: item.id,
              dispatch_id: dispatch.id,
              company_id: companyId,
              product_id: item.product_id,
              product_name: item.product_name || null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
              notes: item.notes || null,
              created_at: new Date().toISOString(),
            }))
          );
        }

        set(state => ({
          dispatches: state.dispatches.map(d =>
            d.id === dispatch.id ? { ...dispatch, items } : d
          )
        }));
      },

      confirmDispatch: async (dispatchId) => {
        const companyId = get().currentCompanyId;
        const actorId = await getActorId();
        const now = new Date().toISOString();

        const dispatch = get().dispatches.find(d => d.id === dispatchId);
        if (!dispatch || dispatch.status !== 'borrador') return;

        const items = dispatch.items || [];

        for (const item of items) {
          const movements = get().productMovements.filter(m => m.product_id === item.product_id);
          const stock = movements.reduce((acc, m) => {
            if (m.type === 'ingreso_produccion') return acc + m.quantity;
            if (m.type === 'salida_venta') return acc - m.quantity;
            if (m.type === 'ajuste') return acc + m.quantity;
            return acc;
          }, 0);
          if (item.quantity > stock) {
            const product = get().products.find(p => p.id === item.product_id);
            throw new Error(`Stock insuficiente para "${product?.name || item.product_id}". Disponible: ${stock}, requerido: ${item.quantity}`);
          }
        }

        const { error } = await supabase.from('dispatches').update({
          status: 'confirmado',
          confirmed_at: now,
          confirmed_by: actorId,
          client_name: dispatch.client_id
            ? (get().clients.find(c => c.id === dispatch.client_id)?.name || dispatch.client_name)
            : dispatch.client_name,
          updated_at: now,
          updated_by: actorId,
        })
          .eq('id', dispatchId)
          .eq('company_id', companyId);
        if (error) throw error;

        const newMovements = items.map(item => ({
          id: crypto.randomUUID(),
          company_id: companyId,
          product_id: item.product_id,
          type: 'salida_venta',
          quantity: item.quantity,
          unit_cost: item.unit_price,
          reference: `Despacho ${dispatch.number}`,
          created_at: now,
          produced_with_debt: false,
        }));

        const { error: movError } = await supabase.from('product_movements').insert(newMovements);
        if (movError) throw movError;

        set(state => ({
          dispatches: state.dispatches.map(d =>
            d.id === dispatchId
              ? { ...d, status: 'confirmado', confirmed_at: now, confirmed_by: actorId }
              : d
          ),
          productMovements: [...newMovements, ...state.productMovements] as any,
        }));
      },

      cancelDispatch: async (dispatchId) => {
        const companyId = get().currentCompanyId;
        const actorId = await getActorId();
        const now = new Date().toISOString();

        const dispatch = get().dispatches.find(d => d.id === dispatchId);
        if (!dispatch) return;

        const { error } = await supabase.from('dispatches').update({
          status: 'anulado',
          cancelled_at: now,
          cancelled_by: actorId,
          updated_at: now,
          updated_by: actorId,
        })
          .eq('id', dispatchId)
          .eq('company_id', companyId);
        if (error) throw error;

        let reversals: any[] = [];
        if (dispatch.status === 'confirmado') {
          const items = dispatch.items || [];
          reversals = items.map(item => ({
            id: crypto.randomUUID(),
            company_id: companyId,
            product_id: item.product_id,
            type: 'ajuste',
            quantity: item.quantity,
            unit_cost: item.unit_price,
            reference: `Anulación ${dispatch.number}`,
            created_at: now,
            produced_with_debt: false,
          }));
          await supabase.from('product_movements').insert(reversals);
        }

        set(state => ({
          dispatches: state.dispatches.map(d =>
            d.id === dispatchId ? { ...d, status: 'anulado', cancelled_at: now, cancelled_by: actorId } : d
          ),
          productMovements: reversals.length > 0
            ? [...reversals, ...state.productMovements] as any
            : state.productMovements,
        }));
      },

      deleteDispatch: async (id) => {
        const actorId = await getActorId();
        const dispatch = get().dispatches.find(d => d.id === id);
        if (dispatch?.status !== 'borrador') {
          throw new Error('Solo se pueden eliminar despachos en estado borrador.');
        }
        const { error } = await supabase.from('dispatches')
          .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
          .eq('id', id)
          .eq('company_id', get().currentCompanyId);
        if (error) throw error;
        set(state => ({ dispatches: state.dispatches.filter(d => d.id !== id) }));
      },

      // 🤝 SUPPLIERS IMPLEMENTATION
      loadSuppliersFromSupabase: async () => {
        const { currentCompanyId } = get();
        if (!currentCompanyId) return;
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('company_id', currentCompanyId)
          .order('name', { ascending: true });
        if (!error && data) set({ suppliers: data });
      },

      loadSupplierMaterialsFromSupabase: async () => {
        const { currentCompanyId } = get();
        if (!currentCompanyId) return;
        const { data, error } = await supabase
          .from('supplier_materials')
          .select('*')
          .eq('company_id', currentCompanyId);
        if (!error && data) set({ supplierMaterials: data });
      },

      addSupplier: async (supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => {
        const { currentCompanyId } = get();
        const user = (await supabase.auth.getUser()).data.user;
        if (!currentCompanyId || !user) return null;
        const { data, error } = await supabase
          .from('suppliers')
          .insert({ ...supplier, company_id: currentCompanyId, created_by: user.id, updated_by: user.id })
          .select()
          .single();
        if (!error && data) { set(state => ({ suppliers: [...state.suppliers, data] })); return data as Supplier; }
        return null;
      },

      updateSupplier: async (id: string, updates: Partial<Supplier>) => {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;
        const { data, error } = await supabase
          .from('suppliers')
          .update({ ...updates, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) set(state => ({
          suppliers: state.suppliers.map(s => s.id === id ? data : s)
        }));
      },

      archiveSupplier: async (id: string, status: 'activo' | 'inactivo' | 'bloqueado') => {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;
        const { data, error } = await supabase
          .from('suppliers')
          .update({ status, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) set(state => ({
          suppliers: state.suppliers.map(s => s.id === id ? data : s)
        }));
      },

      syncSupplierMaterials: async (supplier_id: string, raw_material_ids: string[]) => {
        const { currentCompanyId } = get();
        if (!currentCompanyId) return;
        // Borrar relaciones existentes
        await supabase.from('supplier_materials').delete().eq('supplier_id', supplier_id);
        // Insertar nuevas
        if (raw_material_ids.length > 0) {
          const rows = raw_material_ids.map(raw_material_id => ({
            supplier_id,
            raw_material_id,
            company_id: currentCompanyId
          }));
          await supabase.from('supplier_materials').insert(rows);
        }
        // Recargar
        const { data } = await supabase
          .from('supplier_materials')
          .select('*')
          .eq('company_id', currentCompanyId);
        if (data) set({ supplierMaterials: data });
      },

      // 📝 PURCHASE ORDERS IMPLEMENTATION
      loadPurchaseOrdersFromSupabase: async () => {
        const { currentCompanyId } = get();
        if (!currentCompanyId) return;
        const { data: orders, error } = await supabase
          .from('purchase_orders')
          .select('*')
          .eq('company_id', currentCompanyId)
          .order('created_at', { ascending: false });
        if (error || !orders) return;

        const { data: items } = await supabase
          .from('purchase_order_items')
          .select('*')
          .eq('company_id', currentCompanyId);

        const ordersWithItems = orders.map(o => ({
          ...o,
          items: (items || []).filter(i => i.purchase_order_id === o.id)
        }));
        set({ purchaseOrders: ordersWithItems });
      },

      addPurchaseOrder: async (order, items) => {
        const { currentCompanyId } = get();
        const user = (await supabase.auth.getUser()).data.user;
        if (!currentCompanyId || !user) return;

        const { count } = await supabase
          .from('purchase_orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', currentCompanyId);
        const year = new Date().getFullYear();
        const number = `OC-${year}-${String((count || 0) + 1).padStart(3, '0')}`;

        const total_value = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

        const { data: newOrder, error } = await supabase
          .from('purchase_orders')
          .insert({ ...order, company_id: currentCompanyId, number, total_value, created_by: user.id, updated_by: user.id })
          .select()
          .single();
        if (error || !newOrder) return;

        const itemRows = items.map(i => ({ ...i, purchase_order_id: newOrder.id, company_id: currentCompanyId }));
        const { data: savedItems } = await supabase
          .from('purchase_order_items')
          .insert(itemRows)
          .select();

        set(state => ({
          purchaseOrders: [{ ...newOrder, items: savedItems || [] }, ...state.purchaseOrders]
        }));
      },

      updatePurchaseOrder: async (id, updates) => {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;
        const { data, error } = await supabase
          .from('purchase_orders')
          .update({ ...updates, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) set(state => ({
          purchaseOrders: state.purchaseOrders.map(o => o.id === id ? { ...data, items: o.items } : o)
        }));
      },

      confirmPurchaseOrder: async (id) => {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;
        const { data, error } = await supabase
          .from('purchase_orders')
          .update({
            status: 'confirmada',
            confirmed_at: new Date().toISOString(),
            confirmed_by: user.id,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) set(state => ({
          purchaseOrders: state.purchaseOrders.map(o => o.id === id ? { ...data, items: o.items } : o)
        }));
      },

      cancelPurchaseOrder: async (id) => {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;
        const { data, error } = await supabase
          .from('purchase_orders')
          .update({
            status: 'anulada',
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) set(state => ({
          purchaseOrders: state.purchaseOrders.map(o => o.id === id ? { ...data, items: o.items } : o)
        }));
      },

      receivePurchaseOrder: async (id, receivedItems) => {
        const { currentCompanyId } = get();
        const user = (await supabase.auth.getUser()).data.user;
        if (!currentCompanyId || !user) return;

        const order = get().purchaseOrders.find(o => o.id === id);
        if (!order || !order.items) return;

        // 1. Actualizar received_quantity y received_unit_price en cada ítem
        for (const ri of receivedItems) {
          await supabase
            .from('purchase_order_items')
            .update({
              received_quantity: ri.received_quantity,
              received_unit_price: ri.received_unit_price
            })
            .eq('id', ri.item_id);
        }

        // 2. Crear un material_batch por cada ítem recibido vía addBatch
        // Conversión UoM: cantidad y precio se convierten de unidad de compra a unidad base
        const now = new Date().toISOString();
        for (const ri of receivedItems) {
          const item = order.items.find(i => i.id === ri.item_id);
          if (!item || !item.raw_material_id) continue;

          const material = get().rawMaterials.find(m => m.id === item.raw_material_id);
          const baseUnitId = material?.base_unit_id ?? null;

          // Resolver la unidad de compra y su factor de conversión
          let purchaseUnitId = ri.purchase_unit_id || '';
          let conversionFactor = 1;

          if (purchaseUnitId) {
            const purchaseUnit = get().unitsOfMeasure.find(u => u.id === purchaseUnitId);
            conversionFactor = purchaseUnit?.conversion_factor || 1;
          } else {
            // Fallback: buscar por símbolo + categoría del material
            const baseUnit = baseUnitId ? get().unitsOfMeasure.find(u => u.id === baseUnitId) : null;
            if (baseUnit?.category_id && item.unit) {
              const match = get().unitsOfMeasure.find(u =>
                u.category_id === baseUnit.category_id && u.symbol === item.unit
              );
              if (match) {
                purchaseUnitId = match.id;
                conversionFactor = match.conversion_factor;
              }
            }
          }

          // Calcular valores base
          // baseQty = received_quantity × conversion_factor
          // costPerBase = received_unit_price / conversion_factor
          const baseQty = ri.received_quantity * conversionFactor;
          const costPerBase = conversionFactor > 0 ? ri.received_unit_price / conversionFactor : ri.received_unit_price;

          // Determinar entry_mode y calcular área si hay width
          const hasWidth = ri.width && ri.width > 0;
          const entryMode = hasWidth ? 'rollo' : 'pieza';
          // Área en m²: baseQty (en cm) × width (en cm) / 10000
          const area = hasWidth ? (baseQty * ri.width!) / 10000 : null;

          await get().addBatch({
            id: crypto.randomUUID(),
            company_id: currentCompanyId,
            material_id: item.raw_material_id,
            date: order.date,
            provider: order.supplier_name || 'Compra OC',
            // Display fields (en unidad de compra — metros, kg, etc.)
            initial_quantity: ri.received_quantity,
            remaining_quantity: ri.received_quantity,
            unit_cost: ri.received_unit_price,
            // Base fields (en unidad base — cm, g, etc.)
            base_initial_quantity: baseQty,
            base_remaining_quantity: baseQty,
            base_consumed_quantity: 0,
            cost_per_base_unit: costPerBase,
            // Metadata
            reference: order.number,
            received_unit_id: purchaseUnitId || baseUnitId,
            width: ri.width || null,
            length: null,
            area: area,
            entry_mode: entryMode,
            deleted_at: null,
            created_at: now,
            updated_at: now,
          } as any);
        }

        // 3. Marcar orden como recibida
        const { data, error } = await supabase
          .from('purchase_orders')
          .update({
            status: 'recibida',
            received_at: now,
            received_by: user.id,
            updated_by: user.id,
            updated_at: now
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          await get().loadBatchesFromSupabase();
          await get().loadMovementsFromSupabase();

          set(state => ({
            purchaseOrders: state.purchaseOrders.map(o =>
              o.id === id ? { ...data, items: o.items } : o
            )
          }));
        }
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
