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
};

export type UserRole = Enums<'user_role'>;
export type SubscriptionStatus = Enums<'subscription_status'>;
export type SubscriptionTier = Enums<'subscription_tier'>;

// We extend these to make certain fields optional in the UI/Logic if needed, 
// but keeping them compatible with Database Row.
export type RawMaterial = Tables<'raw_materials'>;
export type MaterialBatch = Tables<'material_batches'>;
export type StockMovement = Tables<'stock_movements'>;
export type ProductMovement = Tables<'product_movements'>;
export interface ProductMaterial {
  material_id: string;
  quantity: number;
  consumption_unit: Unit;
  mode?: 'linear' | 'pieces';
  pieces?: { length: number; width: number }[];
}

export type Product = Tables<'products'> & {
  materials: ProductMaterial[] | null;
};

// Custom Type Literals (Expanded based on UI usage)
export type Unit = 'metro' | 'cm' | 'kg' | 'gramo' | 'unidad' | 'bobina' | 'litro';
export type Status = 'activa' | 'inactiva' | 'borrador';
