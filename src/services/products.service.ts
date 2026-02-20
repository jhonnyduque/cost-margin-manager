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

  return data.map((row) => ({
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    reference: row.reference || '',
    price: row.price ?? 0,
    target_margin: row.target_margin ?? 0,
    cost_fifo: row.cost_fifo ?? 0,
    materials: Array.isArray(row.materials) ? row.materials : [],
    status: row.status as 'activa' | 'inactiva',
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}
