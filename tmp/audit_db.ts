import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function auditData() {
    console.log('--- AUDITORÍA DE DATOS FINANCIEROS ---');

    const { data: plans } = await supabase.from('subscription_plans').select('*');
    console.log('\nPLANES:');
    console.table(plans?.map(p => ({ slug: p.slug, price: p.monthly_price_cents / 100 })));

    const { data: companies } = await supabase.from('companies').select('name, subscription_tier, subscription_status');
    console.log('\nEMPRESAS:');
    console.table(companies);

    const activeCompanies = companies?.filter(c => c.subscription_status === 'active' || c.subscription_status === 'trialing');
    console.log(`\nEmpresas Activas detectadas por el sistema: ${activeCompanies?.length}`);
}

auditData();
