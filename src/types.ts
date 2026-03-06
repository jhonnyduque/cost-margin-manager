import { Database } from './database.types';

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Domain Aliases with extensions for missing/calculated fields
export type User = Tables<'users'>;

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
export type RawMaterial = Tables<'raw_materials'> & { created_by?: string; updated_by?: string; deleted_at?: string | null; };
export type MaterialBatch = Tables<'material_batches'> & { created_by?: string; updated_by?: string; deleted_at?: string | null; };
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
  created_by?: string;
  updated_by?: string;
  deleted_at?: string | null;
};

// Custom Type Literals (Expanded based on UI usage)
export type Unit = 'metro' | 'cm' | 'kg' | 'gramo' | 'unidad' | 'bobina' | 'litro';
export type Status = 'activa' | 'inactiva' | 'borrador';