import { supabase } from './supabase';
import { format, subMonths, isAfter, isBefore, startOfMonth, parseISO, differenceInDays, endOfMonth } from 'date-fns';

export interface PlatformMetrics {
    totalMRR: number;
    projectedMRR: number;
    mrrGrowth: number;
    activeTenants: number;
    newTenantsMonth: number;
    activeSeats: number;
    seatUtilization: number;
    churnRate: number;
    ltv: number;
    systemHealth: 'healthy' | 'degraded' | 'down';
}

export interface GrowthPoint {
    name: string;
    realMrr: number;
    projectedMrr: number;
    companies: number;
}

export interface VIPStatus {
    id: string;
    name: string;
    mrr: number;
    plan: string;
    usage: number;
}

export interface RevenueMetric {
    title: string;
    value: string | number;
    description: string;
    trend: { value: number; label: string; isPositive: boolean };
    sparklineData: { value: number }[];
    variant?: 'primary' | 'success' | 'warning' | 'danger';
}

export interface MRRWaterfallPoint {
    name: string;
    new: number;
    expansion: number;
    reactivation: number;
    churn: number;
    contraction: number;
    net: number;
}

export interface CohortPoint {
    month: string;
    age: number;
    percentage: number;
}

export interface BillingEvent {
    id: string;
    created_at: string;
    company_name: string;
    event_type: string;
    amount: number;
    status: 'success' | 'failed' | 'pending' | 'refunded';
    reference?: string;
}

export interface FinanceFilters {
    dateRange: string;
    startDate?: string;
    endDate?: string;
    plan: string;
    segment: string;
}

// ── NUEVO: Engagement por tenant ──
export interface TenantEngagement {
    id: string;
    name: string;
    slug: string;
    subscription_tier: string | null;
    subscription_status: string | null;
    seat_count: number;
    seat_limit: number;
    seat_usage_pct: number;
    last_activity_at: string | null;
    days_inactive: number | null;
    engagement_status: 'active' | 'at_risk' | 'dormant';
    total_products: number;
    total_raw_materials: number;
    dispatches_this_month: number;
    production_this_month: number;
    movements_this_month: number;
    active_members: number;
}

export const adminStatsService = {

    // ── NUEVO ──────────────────────────────────────────────────────────────
    /**
     * Engagement real por tenant desde la vista tenant_engagement_summary.
     */
    async getTenantEngagement(): Promise<TenantEngagement[]> {
        const { data, error } = await supabase
            .from('tenant_engagement_summary')
            .select('*')
            .order('last_activity_at', { ascending: false, nullsFirst: false });

        if (error) throw new Error(`getTenantEngagement: ${error.message}`);
        return (data || []) as TenantEngagement[];
    },
    // ───────────────────────────────────────────────────────────────────────

    async getPlatformSummary(): Promise<PlatformMetrics> {
        const { data: plans } = await supabase
            .from('subscription_plans')
            .select('slug, monthly_price_cents');

        const planPrices: Record<string, number> = {};
        plans?.forEach(p => { planPrices[p.slug] = p.monthly_price_cents / 100; });

        const { data: companies, error: companiesError } = await supabase
            .from('companies')
            .select('name, subscription_tier, subscription_status, seat_count, seat_limit, custom_price_cents, created_at, deleted_at')
            .is('deleted_at', null);

        if (companiesError) throw new Error(`Could not fetch companies: ${companiesError.message}`);
        if (!companies) throw new Error('No companies data received');

        const activeCompanies = companies.filter(c => c.subscription_status === 'active' || c.subscription_status === 'trialing');

        const totalMRR = activeCompanies.reduce((acc, c) => {
            const tier = c.subscription_tier;
            const customPrice = c.custom_price_cents ? (c.custom_price_cents / 100) : null;
            const standardPrice = tier ? (planPrices[tier] || 0) : 0;
            return acc + (customPrice !== null ? customPrice : standardPrice);
        }, 0);

        const projectedMRR = totalMRR;
        const totalSeats = companies.reduce((acc, c) => acc + (c.seat_count || 0), 0);
        const maxSeats = companies.reduce((acc, c) => acc + (c.seat_limit || 0), 0);

        const startOfCurrentMonth = startOfMonth(new Date());
        const startOfLastMonth = startOfMonth(subMonths(new Date(), 1));
        const endOfLastMonth = endOfMonth(subMonths(new Date(), 1));

        let activeLastMonth = 0, churnedThisMonth = 0, mrrLastMonth = 0, newTenantsMonth = 0;

        companies.forEach(c => {
            const createdAt = new Date(c.created_at);
            const deletedAt = c.deleted_at ? new Date(c.deleted_at) : null;

            if (createdAt >= startOfCurrentMonth && (c.subscription_status === 'active' || c.subscription_status === 'trialing')) newTenantsMonth++;

            const wasActiveLastMonth = isBefore(createdAt, endOfLastMonth) && (!deletedAt || isAfter(deletedAt, endOfLastMonth));
            if (wasActiveLastMonth) {
                activeLastMonth++;
                const customPrice = c.custom_price_cents ? (c.custom_price_cents / 100) : null;
                const standardPrice = c.subscription_tier ? (planPrices[c.subscription_tier] || 0) : 0;
                mrrLastMonth += customPrice !== null ? customPrice : standardPrice;
            }

            if (deletedAt && isAfter(deletedAt, startOfCurrentMonth) && isBefore(deletedAt, new Date())) churnedThisMonth++;
        });

        const churnRate = activeLastMonth > 0 ? Number(((churnedThisMonth / activeLastMonth) * 100).toFixed(2)) : 0;
        const mrrGrowth = mrrLastMonth > 0 ? Number((((totalMRR - mrrLastMonth) / mrrLastMonth) * 100).toFixed(2)) : (totalMRR > 0 ? 100 : 0);
        const activeLength = activeCompanies.length || 1;
        const arpu = totalMRR / activeLength;
        const ltv = churnRate > 0 ? (arpu / (churnRate / 100)) : (arpu * 36);

        return {
            totalMRR, projectedMRR, mrrGrowth,
            activeTenants: activeCompanies.length,
            newTenantsMonth,
            activeSeats: totalSeats,
            seatUtilization: maxSeats > 0 ? Number(((totalSeats / maxSeats) * 100).toFixed(1)) : 0,
            churnRate,
            ltv: Math.round(ltv),
            systemHealth: 'healthy'
        };
    },

    async getRevenueIntelligence(filters?: FinanceFilters): Promise<RevenueMetric[]> {
        const { data: plans } = await supabase.from('subscription_plans').select('slug, monthly_price_cents');
        const planPrices: Record<string, number> = {};
        plans?.forEach(p => { planPrices[p.slug] = p.monthly_price_cents / 100; });

        let eventQuery = supabase.from('subscription_events').select('payload, created_at, status');
        if (filters?.dateRange === 'last-7') { const d = new Date(); d.setDate(d.getDate() - 7); eventQuery = eventQuery.gte('created_at', d.toISOString()); }
        else if (filters?.dateRange === 'last-30') { const d = new Date(); d.setDate(d.getDate() - 30); eventQuery = eventQuery.gte('created_at', d.toISOString()); }
        else if (filters?.dateRange === 'last-90') { const d = new Date(); d.setDate(d.getDate() - 90); eventQuery = eventQuery.gte('created_at', d.toISOString()); }
        else if (filters?.dateRange === 'custom' && filters.startDate && filters.endDate) { eventQuery = eventQuery.gte('created_at', filters.startDate).lte('created_at', filters.endDate); }

        const { data: events } = await eventQuery;
        const netRevenue = (events || []).filter(e => e.status === 'processed').reduce((acc, e) => acc + (Number((e.payload as any)?.amount) || 0), 0);
        const pendingRevenue = (events || []).filter(e => e.status === 'pending' || e.status === 'failed').reduce((acc, e) => acc + (Number((e.payload as any)?.amount) || 0), 0);

        let companyQuery = supabase.from('companies').select('subscription_tier, subscription_status');
        if (filters?.plan && filters.plan !== 'all') companyQuery = companyQuery.eq('subscription_tier', filters.plan);
        const { data: companies } = await companyQuery;

        const activeCompanies = (companies || []).filter(c => c.subscription_status === 'active' || c.subscription_status === 'trialing');
        const totalMRR = activeCompanies.reduce((acc, c) => acc + (c.subscription_tier ? (planPrices[c.subscription_tier] || 0) : 0), 0);
        const arpu = activeCompanies.length > 0 ? totalMRR / activeCompanies.length : 0;

        return [
            { title: "Ingresos Netos", value: `$${Math.round(netRevenue).toLocaleString()}`, description: "Ingresos netos reales procesados en el periodo.", trend: { value: 0, label: "Real", isPositive: true }, sparklineData: [], variant: 'primary' },
            { title: "MRR Actual", value: `$${Math.round(totalMRR).toLocaleString()}`, description: "Ingresos Mensuales Recurrentes de suscripciones activas.", trend: { value: 0, label: "Real", isPositive: true }, sparklineData: [], variant: 'success' },
            { title: "NRR (Retención)", value: "N/A", description: "Requiere histórico > 12 meses.", trend: { value: 0, label: "Sin datos", isPositive: true }, sparklineData: [], variant: 'primary' },
            { title: "Churn Neto (MM)", value: "Calculando...", description: "Churn neto basado en cancelaciones procesadas.", trend: { value: 0, label: "Real", isPositive: true }, sparklineData: [], variant: 'success' },
            { title: "ARPU", value: `$${Math.round(arpu)}`, description: "Ingreso promedio real por cliente activo.", trend: { value: 0, label: "Real", isPositive: true }, sparklineData: [], variant: 'warning' },
            { title: "Facturas Pendientes", value: `$${Math.round(pendingRevenue).toLocaleString()}`, description: "Facturas pendientes o vencidas.", trend: { value: 0, label: "Vencido", isPositive: pendingRevenue === 0 }, sparklineData: [], variant: 'danger' },
        ];
    },

    async getMRRWaterfall(filters?: FinanceFilters): Promise<MRRWaterfallPoint[]> {
        const { data: plans } = await supabase.from('subscription_plans').select('slug, monthly_price_cents');
        const planPrices: Record<string, number> = {};
        plans?.forEach(p => planPrices[p.slug] = p.monthly_price_cents / 100);

        const { data: events } = await supabase.from('subscription_events').select('event_type, created_at, payload, companies(subscription_tier)').order('created_at', { ascending: true });

        const months: string[] = [];
        for (let i = 5; i >= 0; i--) months.push(format(subMonths(new Date(), i), 'MMM'));

        const waterfall: Record<string, MRRWaterfallPoint> = {};
        months.forEach(m => { waterfall[m] = { name: m, new: 0, expansion: 0, reactivation: 0, churn: 0, contraction: 0, net: 0 }; });

        (events || []).forEach(e => {
            const monthName = format(new Date(e.created_at), 'MMM');
            if (!waterfall[monthName]) return;
            const amount = Number((e.payload as any)?.amount) || planPrices[(e.companies as any)?.subscription_tier] || 0;
            if (e.event_type.includes('created')) waterfall[monthName].new += amount;
            if (e.event_type.includes('updated') && amount > 0) waterfall[monthName].expansion += amount;
            if (e.event_type.includes('deleted')) waterfall[monthName].churn -= amount;
        });

        return Object.values(waterfall);
    },

    async getCohortRetention(filters?: FinanceFilters): Promise<CohortPoint[]> {
        const { data: companies } = await supabase.from('companies').select('created_at, deleted_at, subscription_status, id');
        if (!companies) return [];

        const data: CohortPoint[] = [];
        const months: { label: string; start: Date; end: Date }[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = subMonths(new Date(), i);
            months.push({ label: format(d, 'MMM yy'), start: startOfMonth(d), end: endOfMonth(d) });
        }

        months.forEach((m, idx) => {
            const cohortCompanies = companies.filter(c => { const ca = new Date(c.created_at); return ca >= m.start && ca <= m.end; });
            const cohortSize = cohortCompanies.length;
            for (let age = 0; age <= (5 - idx); age++) {
                if (cohortSize === 0) { data.push({ month: m.label, age, percentage: 0 }); continue; }
                if (age === 0) { data.push({ month: m.label, age, percentage: 100 }); }
                else {
                    const checkMonthStart = startOfMonth(subMonths(new Date(), 5 - (idx + age)));
                    const retained = cohortCompanies.filter(c => { if (!c.deleted_at) return true; return new Date(c.deleted_at) >= checkMonthStart; }).length;
                    data.push({ month: m.label, age, percentage: Math.round((retained / cohortSize) * 100) });
                }
            }
        });

        return data;
    },

    async getBillingEvents(limit = 10, filters?: FinanceFilters): Promise<BillingEvent[]> {
        const { data, error } = await supabase
            .from('subscription_events')
            .select('id, created_at, event_type, status, payload, companies ( name, subscription_tier )')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        let filteredData = data || [];
        if (filters?.plan && filters.plan !== 'all') filteredData = filteredData.filter(e => (e.companies as any)?.subscription_tier === filters.plan);

        return filteredData.map(event => {
            let eventTypeEs = event.event_type.replace(/_/g, ' ').replace('subscription', 'Suscripción').replace('created', 'creada').replace('updated', 'actualizada').replace('deleted', 'cancelada');
            return { id: event.id, created_at: event.created_at, company_name: (event.companies as any)?.name || 'Sistema', event_type: eventTypeEs, amount: event.payload?.amount || 0, status: event.status as any, reference: event.payload?.invoice_id };
        });
    },

    async getVIPTenants(limit = 5): Promise<VIPStatus[]> {
        const { data: plans } = await supabase.from('subscription_plans').select('slug, monthly_price_cents');
        const planPrices: Record<string, number> = {};
        plans?.forEach(p => { planPrices[p.slug] = p.monthly_price_cents / 100; });

        const { data: companies } = await supabase.from('companies').select('id, name, subscription_tier, seat_count, seat_limit, custom_price_cents, subscription_status').in('subscription_status', ['active', 'trialing']).is('deleted_at', null);

        return ((companies || []).map(c => {
            const customPrice = c.custom_price_cents != null ? (c.custom_price_cents / 100) : null;
            const standardPrice = c.subscription_tier ? (planPrices[c.subscription_tier] || 0) : 0;
            return { id: c.id, name: c.name, mrr: customPrice !== null ? customPrice : standardPrice, plan: c.subscription_tier || 'Sin Plan', usage: c.seat_limit && c.seat_limit > 0 ? ((c.seat_count || 0) / c.seat_limit) * 100 : 0 };
        })).sort((a, b) => b.mrr - a.mrr).slice(0, limit);
    },

    async getGrowthData(): Promise<GrowthPoint[]> {
        const { data: plans } = await supabase.from('subscription_plans').select('slug, monthly_price_cents');
        const planPrices: Record<string, number> = {};
        plans?.forEach(p => planPrices[p.slug] = p.monthly_price_cents / 100);

        const { data: companies } = await supabase.from('companies').select('created_at, deleted_at, subscription_tier, custom_price_cents, subscription_status');
        const data: GrowthPoint[] = [];

        for (let i = 5; i >= 0; i--) {
            const date = subMonths(new Date(), i);
            const endOfMonthDate = endOfMonth(date);
            let monthMrr = 0, activeCount = 0;

            companies?.forEach(c => {
                const createdAt = new Date(c.created_at);
                const deletedAt = c.deleted_at ? new Date(c.deleted_at) : null;
                if (createdAt > endOfMonthDate) return;
                if (deletedAt && deletedAt <= endOfMonthDate) return;
                if (i === 0 && !['active', 'trialing'].includes(c.subscription_status)) return;
                if (date.getFullYear() < 2024) return;
                const customPrice = c.custom_price_cents != null ? (c.custom_price_cents / 100) : null;
                const standardPrice = c.subscription_tier ? (planPrices[c.subscription_tier] || 0) : 0;
                monthMrr += customPrice !== null ? customPrice : standardPrice;
                activeCount++;
            });

            data.push({ name: format(date, 'MMM'), realMrr: monthMrr, projectedMrr: monthMrr * 1.1, companies: activeCount });
        }
        return data;
    },

    async getPlanDistribution() {
        const { data: companies } = await supabase.from('companies').select('subscription_tier, subscription_status').in('subscription_status', ['active', 'trialing']).is('deleted_at', null);
        const counts: Record<string, number> = {};
        companies?.forEach(c => { if (c.subscription_tier) counts[c.subscription_tier] = (counts[c.subscription_tier] || 0) + 1; });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },

    async getRecentActivity(limit = 15) {
        const { data, error } = await supabase.from('event_bus').select('*, companies ( name )').order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return data;
    }
};