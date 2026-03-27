
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function listMaterials() {
  const companyId = '266362fe-0cb3-46e0-8f33-14c9960f0d6f';
  console.log(`Listing materials for company: ${companyId}`);
  
  const { data, error } = await supabase
    .from('raw_materials')
    .select('id, name, type, generates_stock, standard_cost, deleted_at')
    .eq('company_id', companyId)
    .order('name');

  if (error) {
    console.error('Error fetching materials:', error.message);
    return;
  }

  console.log('\n--- MATERIAS PRIMAS EN SUPABASE ---');
  console.table(data.map(m => ({
    ...m,
    deleted: m.deleted_at ? 'SÍ' : 'NO'
  })));
}

listMaterials();
