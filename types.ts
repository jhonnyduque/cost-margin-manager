// ============================================================================
// TIPOS: Multi-Tenant Core
// ============================================================================
export type Status = 'activa' | 'inactiva';
export type Unit = 'metro' | 'cm' | 'kg' | 'gramo' | 'bobina' | 'unidad' | 'litro';
export type MovementType = 'ingreso' | 'egreso';

// Multi-Tenant Core Types
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled';
export type SubscriptionTier = 'starter' | 'professional' | 'enterprise';
export type UserRole = 'owner' | 'admin' | 'manager' | 'operator' | 'viewer';

export interface Company {
  id: string;
  slug: string;
  name: string;
  subscription_status: SubscriptionStatus;
  subscription_tier: SubscriptionTier;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;

  // Billing cycle fields
  current_period_ends_at?: string;
  cancel_at_period_end: boolean;
  trial_ends_at?: string;
  grace_period_ends_at?: string;

  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_super_admin: boolean;
  default_company_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  invited_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  slug: SubscriptionTier;
  name: string;
  monthly_price_cents: number;
  yearly_price_cents?: number;
  max_users: number;
  max_products: number;
  max_storage_mb: number;
  max_ai_requests_monthly: number;
  features: Record<string, any>;
}

// ============================================================================
// MODIFICACIONES A INTERFACES EXISTENTES
// ============================================================================

export interface RawMaterial {
  id: string;
  company_id: string; // NUEVO
  name: string;
  description: string;
  type: string;
  unit: Unit;
  provider: string;
  status: Status;
  deleted_at?: string; // NUEVO
  created_at?: string; // NUEVO
  updated_at?: string; // NUEVO
}

export interface StockMovement {
  id: string;
  company_id: string; // NUEVO
  materialId: string;
  batchId: string; // Referencia al lote original
  date: string;
  type: MovementType;
  quantity: number;
  unitCost: number;
  reference: string; // Nombre del proveedor o nombre del producto producido
  deleted_at?: string; // NUEVO
}

export interface MaterialBatch {
  id: string;
  company_id: string; // NUEVO
  materialId: string;
  date: string;
  provider: string;
  initialQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  reference?: string;
  width?: number; // Ancho útil en cm
  length?: number; // Largo en cm (para piezas)
  area?: number;  // Área total en m²
  entryMode?: 'rollo' | 'pieza';
  deleted_at?: string; // NUEVO
}

export interface ProductMaterial {
  materialId: string;
  quantity: number;
  consumptionUnit: Unit;
}

export interface Product {
  id: string;
  company_id: string; // NUEVO
  name: string;
  reference: string;
  price: number;
  targetMargin: number;
  materials: ProductMaterial[];
  status: Status;
  createdAt: string;
  deleted_at?: string; // NUEVO
  updated_at?: string; // NUEVO
}
