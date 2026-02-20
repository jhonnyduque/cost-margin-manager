import { supabase } from './supabase';
import { Product } from '../types';

export async function fetchProductsFromSupabase(): Promise<Product[]> {

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error cargando productos:', error);
    return [];
  }

  if (!data) return [];

  // 🔥 MAPEO CRÍTICO
  return data.map((row) => ({
    id: row.id,
    companyId: row.company_id, // Fix: Added missing field
    name: row.name,
    reference: row.sku,
    price: row.price ?? 0,
    targetMargin: row.target_margin ?? 0,
    // Fix: Mapeo correcto del JSONB materials, preservando la estructura guardada
    materials: Array.isArray(row.materials) ? row.materials : [],
    status: row.status as 'activa' | 'inactiva', // Fix: Added missing field
    createdAt: row.created_at
  }));
}
