import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function debug() {
  const targetId = '98285530-64c1-4187-9674-d0abbe8a934b';
  console.log('Searching for Material ID:', targetId);

  const { data, error } = await supabase
    .from('raw_materials')
    .select('id, name, company_id, deleted_at')
    .eq('id', targetId);

  if (error) {
    console.error('Error fetching material:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('Material NOT FOUND in database with ID:', targetId);
  } else {
    console.log('Material Found:', JSON.stringify(data[0], null, 2));
    console.log('Company ID Length:', data[0].company_id.length);
  }
}

debug();
