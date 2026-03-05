import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
    console.log("==================================================");
    console.log("⚖️ AUDITORÍA DE LA VERDAD ABSOLUTA - CONTROL CENTER");
    console.log("==================================================\n");

    // 1. Get Plans
    const { data: plans } = await supabase.from('subscription_plans').select('slug, monthly_price_cents');
    const planPrices: Record<string, number> = {};
    plans?.forEach(p => planPrices[p.slug] = p.monthly_price_cents / 100);

    // 2. Get active/trialing companies
    const { data: companies } = await supabase
        .from('companies')
        .select('name, subscription_tier, subscription_status, seat_count, seat_limit, custom_price_cents')
        .is('deleted_at', null)
        .in('subscription_status', ['active', 'trialing']);

    let totalMRR = 0;
    const activeCompanies = companies || [];

    console.log("🏢 EMPRESAS ACTIVAS (Top VIPs):");
    const vips = activeCompanies.map(c => {
        const customPrice = c.custom_price_cents != null ? (c.custom_price_cents / 100) : null;
        const standardPrice = c.subscription_tier ? (planPrices[c.subscription_tier] || 0) : 0;
        const finalMrr = customPrice !== null ? customPrice : standardPrice;
        totalMRR += finalMrr;
        return {
            Empresa: c.name,
            Plan: c.subscription_tier,
            PrecioManual: customPrice,
            MRR_CRUDA: finalMrr
        };
    }).sort((a, b) => b.MRR_CRUDA - a.MRR_CRUDA);

    console.table(vips.slice(0, 5));

    console.log("\n💰 MÉTRICAS FINANCIERAS REALES:");
    console.log(`- MRR Total en DB: $${totalMRR}`);
    console.log(`- Total Empresas Activas en DB: ${activeCompanies.length}`);

    const arpu = activeCompanies.length > 0 ? totalMRR / activeCompanies.length : 0;
    console.log(`- ARPU (Promedio x Empresa): $${arpu.toFixed(2)}`);
    console.log(`- LTV Asumido (Churn 0% -> 36 meses x ARPU): $${Math.round(arpu * 36)}`);

    console.log("\n✅ ESTOS SON LOS NÚMEROS QUE DEBEN APARECER EXACTAMENTE EN EL UI.");
    console.log("==================================================");
}

runAudit().catch(console.error);
