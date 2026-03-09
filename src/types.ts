import { Database } from './database.types';

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Domain Aliases with extensions for missing/calculated fields
export type User = Tables<'users'>;
export type UomCategory = Tables<'uom_categories'>;
export type UnitOfMeasure = Tables<'units_of_measure'>;
export type MaterialType = { id: string; name: string; created_at?: string };

export type Company = Tables<'companies'> & {
  // Added to support grace period logic in AuthProvider/subscription utils
  grace_period_ends_at?: string | null;
  seat_count?: number;
  seat_limit?: number;
  custom_price_cents?: number | null;
};

// ⚠️ CANONICAL FORMAT: target_margin is stored as a PERCENTAGE in the DB.
// Always use as a number 0–100 (e.g. 30 = 30%).
// When passing to financialMetricsEngine, divide by 100: (target_margin / 100).
// Never store or compare as a decimal (0.3) — that caused silent calculation errors.
export const DEFAULT_TARGET_MARGIN = 30; // 30% — used as fallback when target_margin is null

// 'super_admin' is a system-level role assigned server-side (not a tenant role).
// It must be included here so allowedRoles checks in UI components work correctly.
export type UserRole = 'owner' | 'admin' | 'manager' | 'operator' | 'viewer' | 'super_admin';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid';
export type SubscriptionTier = 'demo' | 'starter' | 'growth' | 'scale' | 'enterprise';

// We extend these to make certain fields optional in the UI/Logic if needed, 
// but keeping them compatible with Database Row.
export type RawMaterial = Tables<'raw_materials'> & {
  created_by?: string;
  updated_by?: string;
  deleted_at?: string | null;
  uom_category?: UomCategory;
  base_unit?: UnitOfMeasure;
  purchase_unit?: UnitOfMeasure;
  display_unit?: UnitOfMeasure;
};

export type MaterialBatch = Tables<'material_batches'> & {
  created_by?: string;
  updated_by?: string;
  deleted_at?: string | null;
  received_unit?: UnitOfMeasure;
};

export type MaterialUnitConversion = Tables<'material_unit_conversions'>;

/**
 * ⚠️ INVARIANT — StockMovement.reference field contract.
 *
 * The `reference` field encodes the movement origin as a human-readable string.
 * Several system functions parse this field to reconstruct business logic
 * (e.g. hasProductGeneratedActiveDebt, detectStockBreak in businessHealthEngine).
 *
 * NEVER change these formats without updating every consumer listed below.
 *
 * Canonical formats (defined in src/store.ts):
 *
 *   type='ingreso'            → batch.provider  (free text, not parsed)
 *   type='egreso'             → `Prod: ${product.name}`
 *                             | `Prod Lote: ${product.name}`
 *   type='egreso_asumido'     → `Faltante Asumido (Prod_ID: ${product.id}) - ${product.name}`
 *                             | `Faltante Lote (Prod_ID: ${product.id})`
 *   type='egreso_compensatorio' → 'Compensación Automática (Auto-Clearing)'
 *
 * Consumers that depend on these formats:
 *   - src/store.ts → hasProductGeneratedActiveDebt()
 *     Parses: `Prod_ID: ${productId}` substring match on egreso_asumido
 *   - src/services/businessHealthEngine.ts → detectStockBreak()
 *     Parses: pm.product_id substring match to find dependentProductIds
 *
 * If you need to change a format, use STOCK_MOVEMENT_REF helpers below
 * so all write sites stay in sync automatically.
 */
export const STOCK_MOVEMENT_REF = {
  egreso: (productName: string) => `Prod: ${productName}`,
  egresoLote: (productName: string) => `Prod Lote: ${productName}`,
  egresoAsumido: (productId: string, productName: string) => `Faltante Asumido (Prod_ID: ${productId}) - ${productName}`,
  egresoAsumidoLote: (productId: string) => `Faltante Lote (Prod_ID: ${productId})`,
  compensacion: () => 'Compensación Automática (Auto-Clearing)',
} as const;

export type StockMovement = Tables<'stock_movements'> & { deleted_at?: string | null; };
export type ProductMovement = Tables<'product_movements'>;
export interface ProductMaterial {
  material_id: string;
  quantity: number;
  consumption_unit: Unit;
  mode?: 'linear' | 'pieces';
  pieces?: { length: number; width: number }[];
}

export type Product = Tables<'products'> & {
  // NOTE: target_margin is already in database.types.ts (products.Row) as `number | null`.
  // Format: PERCENTAGE (e.g. 30 = 30%). Use DEFAULT_TARGET_MARGIN as fallback.
  // materials is stored as Json in the DB — we cast it to ProductMaterial[] here for type safety.
  materials: ProductMaterial[] | null;
  min_stock?: number | null;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string | null;
};

// Custom Type Literals (Expanded based on UI usage)
export type Unit = 'metro' | 'cm' | 'kg' | 'gramo' | 'unidad' | 'bobina' | 'litro';
export type Status = 'activa' | 'inactiva' | 'borrador';

export interface Client {
  id: string;
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  notes?: string;
  status: 'activo' | 'inactivo';
  created_at: string;
  created_by?: string | null;
  updated_at?: string;
  updated_by?: string | null;
  deleted_at?: string | null;
}

export interface DispatchItem {
  id: string;
  dispatch_id: string;
  company_id: string;
  product_id: string;
  product_name?: string;      // snapshot al confirmar
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
  created_at: string;
}

export interface Dispatch {
  id: string;
  company_id: string;
  number: string;             // 'DESP-2026-001'
  date: string;
  client_id?: string | null;
  client_name?: string | null; // snapshot al confirmar
  notes?: string | null;
  status: 'borrador' | 'confirmado' | 'anulado';
  total_value: number;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  created_at: string;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  // relación local (no en DB)
  items?: DispatchItem[];
}
