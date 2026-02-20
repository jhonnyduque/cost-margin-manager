
import { supabase } from './supabase';
import { RawMaterial, MaterialBatch } from '../types';

/**
 * Carga todas las materias primas de una empresa.
 * @param companyId ID de la empresa (obligatorio para RLS)
 */
export async function fetchRawMaterials(companyId: string): Promise<RawMaterial[]> {
    if (!companyId) return [];

    const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('name', { ascending: true });

    if (error) {
        console.error('❌ Error cargando materias primas:', error);
        throw error;
    }

    return (data || []).map(row => ({
        id: row.id,
        company_id: row.company_id,
        name: row.name,
        description: row.description,
        type: row.type,
        unit: row.unit,
        provider: row.provider,
        status: row.status as 'activa' | 'inactiva',
        created_at: row.created_at,
        updated_at: row.updated_at
    }));
}

/**
 * Carga solo los lotes activos (con stock remanente > 0).
 * Ideal para cálculos de Dashboard y FIFO en tiempo real.
 */
export async function fetchActiveBatches(companyId: string): Promise<MaterialBatch[]> {
    if (!companyId) return [];

    const { data, error } = await supabase
        .from('material_batches')
        .select('*')
        .eq('company_id', companyId)
        .gt('remaining_quantity', 0)
        .is('deleted_at', null)
        .order('date', { ascending: true }); // FIFO order

    if (error) {
        console.error('❌ Error cargando lotes activos:', error);
        throw error;
    }

    return mapBatches(data || []);
}

/**
 * Carga el histórico completo de lotes (incluyendo agotados).
 * Para reportes y auditoría.
 */
export async function fetchAllBatches(companyId: string): Promise<MaterialBatch[]> {
    if (!companyId) return [];

    const { data, error } = await supabase
        .from('material_batches')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('date', { ascending: false }); // Newest first for list view

    if (error) {
        console.error('❌ Error cargando histórico de lotes:', error);
        throw error;
    }

    return mapBatches(data || []);
}

// Mapper de utilidad interna
function mapBatches(data: any[]): MaterialBatch[] {
    return data.map(row => ({
        id: row.id,
        company_id: row.company_id,
        material_id: row.material_id,
        date: row.date ? row.date.split('T')[0] : new Date().toISOString().split('T')[0],
        provider: row.provider,
        initial_quantity: Number(row.initial_quantity),
        remaining_quantity: Number(row.remaining_quantity),
        unit_cost: Number(row.unit_cost),
        reference: row.reference,
        width: row.width ? Number(row.width) : undefined,
        length: row.length ? Number(row.length) : undefined,
        area: row.area ? Number(row.area) : undefined,
        entry_mode: row.entry_mode as 'rollo' | 'pieza',
        created_at: row.created_at,
        updated_at: row.updated_at
    }));
}
