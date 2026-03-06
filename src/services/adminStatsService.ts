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
    age: number; // meses después del mes inicial
    percentage: number; // retención
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

export const adminStatsService = {
    /**
     * Obtiene un resumen estratégico avanzado.
     */
    async getPlatformSummary(): Promise<PlatformMetrics> {
        // Obtenemos los planes reales para tener los precios actualizados
        const { data: plans } = await supabase
            .from('subscription_plans')
            .select('slug, monthly_price_cents');

        const planPrices: Record<string, number> = {};
        plans?.forEach(p => {
            planPrices[p.slug] = p.monthly_price_cents / 100;
        });

        const { data: companies, error: companiesError } = await supabase
            .from('companies')
            .select('name, subscription_tier, subscription_status, seat_count, seat_limit, custom_price_cents, created_at, deleted_at')
            .is('deleted_at', null);

        if (companiesError) throw new Error(`Could not fetch companies: ${companiesError.message}`);
        if (!companies) throw new Error('No companies data received');

        const activeCompanies = companies.filter(c => c.subscription_status === 'active' || c.subscription_status === 'trialing');

        const totalMRR = activeCompanies.reduce((acc, c) => {
            const tier = c.subscription_tier;
            // Prioritize custom_price_cents if present, otherwise use standard plan price
            const customPrice = c.custom_price_cents ? (c.custom_price_cents / 100) : null;
            const standardPrice = tier ? (planPrices[tier] || 0) : 0;
            const finalPrice = customPrice !== null ? customPrice : standardPrice;

            if (customPrice !== null) {
                console.log(`[OVERRIDE] Empresa: ${c.name} | Custom Price: $${customPrice} (Plan: ${tier})`);
            }

            return acc + finalPrice;
        }, 0);

        // Logs de auditoría silenciados para producción/soporte
        // console.group("⚖️ EL JUEZ: AUDITORÍA DE DATOS DE SUPABASE");
        // ...

        const projectedMRR = totalMRR;

        const totalSeats = companies.reduce((acc, c) => acc + (c.seat_count || 0), 0);
        const maxSeats = companies.reduce((acc, c) => acc + (c.seat_limit || 0), 0);

        // Calcular Métricas Reales (Eliminando hardcodes)
        const startOfCurrentMonth = startOfMonth(new Date());
        const startOfLastMonth = startOfMonth(subMonths(new Date(), 1));
        const endOfLastMonth = endOfMonth(subMonths(new Date(), 1));

        let activeLastMonth = 0;
        let churnedThisMonth = 0;
        let mrrLastMonth = 0;
        let newTenantsMonth = 0;

        companies.forEach(c => {
            const createdAt = new Date(c.created_at);
            const deletedAt = c.deleted_at ? new Date(c.deleted_at) : null;

            // Nuevos tenants este mes activo
            if (createdAt >= startOfCurrentMonth && (c.subscription_status === 'active' || c.subscription_status === 'trialing')) {
                newTenantsMonth++;
            }

            // Churn y activos del mes pasado
            // A company was active last month if it was created before or during last month,
            // and not deleted before or during last month.
            const wasActiveLastMonth = isBefore(createdAt, endOfLastMonth) && (!deletedAt || isAfter(deletedAt, endOfLastMonth));

            if (wasActiveLastMonth) {
                activeLastMonth++;
                const tier = c.subscription_tier;
                const customPrice = c.custom_price_cents ? (c.custom_price_cents / 100) : null;
                const standardPrice = tier ? (planPrices[tier] || 0) : 0;
                mrrLastMonth += customPrice !== null ? customPrice : standardPrice;
            }

            // A company churned this month if it was deleted this month
            if (deletedAt && isAfter(deletedAt, startOfCurrentMonth) && isBefore(deletedAt, new Date())) {
                churnedThisMonth++;
            }
        });

        const churnRate = activeLastMonth > 0 ? Number(((churnedThisMonth / activeLastMonth) * 100).toFixed(2)) : 0;
        const mrrGrowth = mrrLastMonth > 0 ? Number((((totalMRR - mrrLastMonth) / mrrLastMonth) * 100).toFixed(2)) : (totalMRR > 0 ? 100 : 0);
        const activeLength = activeCompanies.length || 1;
        const arpu = totalMRR / activeLength;
        // Lifetime Value realista: si churn es 0, asumimos 36 meses promedio en SaaS B2B, si no, es ARPU / Churn Rate.
        const ltv = churnRate > 0 ? (arpu / (churnRate / 100)) : (arpu * 36);

        return {
            totalMRR,
            projectedMRR,
            mrrGrowth,
            activeTenants: activeCompanies.length,
            newTenantsMonth,
            activeSeats: totalSeats,
            seatUtilization: maxSeats > 0 ? Number(((totalSeats / maxSeats) * 100).toFixed(1)) : 0,
            churnRate,
            ltv: Math.round(ltv),
            systemHealth: 'healthy'
        };
    },

    /**
     * Obtiene inteligencia de ingresos profunda (Nivel 2026).
     */
    async getRevenueIntelligence(filters?: FinanceFilters): Promise<RevenueMetric[]> {
        // Obtenemos los planes reales para los cálculos de MRR/ARPU
        const { data: plans } = await supabase
            .from('subscription_plans')
            .select('slug, monthly_price_cents');

        const planPrices: Record<string, number> = {};
        plans?.forEach(p => {
            planPrices[p.slug] = p.monthly_price_cents / 100;
        });

        // 1. Ingresos Netos (30d o Rango seleccionado)
        let eventQuery = supabase.from('subscription_events').select('payload, created_at, status');

        if (filters?.dateRange === 'last-7') {
            const date = new Date();
            date.setDate(date.getDate() - 7);
            eventQuery = eventQuery.gte('created_at', date.toISOString());
        } else if (filters?.dateRange === 'last-30') {
            const date = new Date();
            date.setDate(date.getDate() - 30);
            eventQuery = eventQuery.gte('created_at', date.toISOString());
        } else if (filters?.dateRange === 'last-90') {
            const date = new Date();
            date.setDate(date.getDate() - 90);
            eventQuery = eventQuery.gte('created_at', date.toISOString());
        } else if (filters?.dateRange === 'custom' && filters.startDate && filters.endDate) {
            eventQuery = eventQuery.gte('created_at', filters.startDate).lte('created_at', filters.endDate);
        }

        const { data: events } = await eventQuery;

        const netRevenue = (events || [])
            .filter(e => e.status === 'processed')
            .reduce((acc, e) => acc + (Number((e.payload as any)?.amount) || 0), 0);

        const pendingRevenue = (events || [])
            .filter(e => e.status === 'pending' || e.status === 'failed')
            .reduce((acc, e) => acc + (Number((e.payload as any)?.amount) || 0), 0);

        // 2. MRR Actual y ARPU (Basado en tablas reales)
        let companyQuery = supabase.from('companies').select('subscription_tier, subscription_status');
        if (filters?.plan && filters.plan !== 'all') {
            companyQuery = companyQuery.eq('subscription_tier', filters.plan);
        }
        const { data: companies } = await companyQuery;

        const activeCompanies = (companies || []).filter(c => c.subscription_status === 'active' || c.subscription_status === 'trialing');
        const totalMRR = activeCompanies.reduce((acc, c) => {
            const price = c.subscription_tier ? (planPrices[c.subscription_tier] || 0) : 0;
            return acc + price;
        }, 0);
        const arpu = activeCompanies.length > 0 ? totalMRR / activeCompanies.length : 0;

        return [
            {
                title: "Ingresos Netos",
                value: `$${Math.round(netRevenue).toLocaleString()}`,
                description: "Ingresos netos reales procesados en el periodo seleccionado.",
                trend: { value: 0, label: "Real", isPositive: true },
                sparklineData: [], // Requerirá endpoints históricos en el futuro
                variant: 'primary'
            },
            {
                title: "MRR Actual",
                value: `$${Math.round(totalMRR).toLocaleString()}`,
                description: "Ingresos Mensuales Recurrentes base de suscripciones activas.",
                trend: { value: 0, label: "Real", isPositive: true },
                sparklineData: [],
                variant: 'success'
            },
            {
                title: "NRR (Retención)",
                value: "N/A",
                description: "Net Revenue Retention. Requiere histórico de eventos > 12 meses. Sin suficientes datos.",
                trend: { value: 0, label: "Requiere Datos", isPositive: true },
                sparklineData: [],
                variant: 'primary'
            },
            {
                title: "Churn Neto (MM)",
                value: "Calculando...", // Se calculará dinámicamente arriba en otra versión, o vacío.
                description: "Churn neto real basado en cancelaciones procesadas.",
                trend: { value: 0, label: "Real", isPositive: true },
                sparklineData: [],
                variant: 'success'
            },
            {
                title: "ARPU",
                value: `$${Math.round(arpu)}`,
                description: "Average Revenue Per User. Ingreso promedio real por cliente activo.",
                trend: { value: 0, label: "Real", isPositive: true },
                sparklineData: [],
                variant: 'warning'
            },
            {
                title: "Facturas Pendientes",
                value: `$${Math.round(pendingRevenue).toLocaleString()}`,
                description: "Facturas en estado vencido o pendientes de cobro real.",
                trend: { value: 0, label: "Vencido", isPositive: pendingRevenue === 0 },
                sparklineData: [],
                variant: 'danger'
            }
        ];
    },

    /**
     * MRR Waterfall (Nivel 2026).
     */
    async getMRRWaterfall(filters?: FinanceFilters): Promise<MRRWaterfallPoint[]> {
        const { data: plans } = await supabase.from('subscription_plans').select('slug, monthly_price_cents');
        const planPrices: Record<string, number> = {};
        plans?.forEach(p => planPrices[p.slug] = p.monthly_price_cents / 100);

        const { data: events } = await supabase
            .from('subscription_events')
            .select('event_type, created_at, payload, companies(subscription_tier)')
            .order('created_at', { ascending: true });

        const months: string[] = [];
        for (let i = 5; i >= 0; i--) {
            months.push(format(subMonths(new Date(), i), 'MMM'));
        }

        const waterfall: Record<string, MRRWaterfallPoint> = {};

        months.forEach(m => {
            waterfall[m] = { name: m, new: 0, expansion: 0, reactivation: 0, churn: 0, contraction: 0, net: 0 };
        });

        (events || []).forEach(e => {
            const date = new Date(e.created_at);
            const monthName = format(date, 'MMM');
            if (!waterfall[monthName]) return;

            const amount = Number((e.payload as any)?.amount) || planPrices[(e.companies as any)?.subscription_tier] || 0;

            if (e.event_type.includes('created')) waterfall[monthName].new += amount;
            if (e.event_type.includes('updated') && amount > 0) waterfall[monthName].expansion += amount;
            if (e.event_type.includes('deleted')) waterfall[monthName].churn -= amount;
        });

        return Object.values(waterfall);
    },

    /**
     * Retención por Cohortes (Real).
     */
    async getCohortRetention(filters?: FinanceFilters): Promise<CohortPoint[]> {
        const { data: companies } = await supabase
            .from('companies')
            .select('created_at, deleted_at, subscription_status, id');

        if (!companies) return [];

        const data: CohortPoint[] = [];

        // Generamos últimos 6 meses
        const months: { label: string; start: Date; end: Date }[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = subMonths(new Date(), i);
            months.push({
                label: format(d, 'MMM yy'),
                start: startOfMonth(d),
                end: endOfMonth(d)
            });
        }

        months.forEach((m, idx) => {
            // Compañías creadas en este mes (el Cohorte)
            const cohortCompanies = companies.filter(c => {
                const createdAt = new Date(c.created_at);
                return createdAt >= m.start && createdAt <= m.end;
            });

            const cohortSize = cohortCompanies.length;

            for (let age = 0; age <= (5 - idx); age++) {
                if (cohortSize === 0) {
                    data.push({ month: m.label, age, percentage: 0 });
                    continue;
                }

                if (age === 0) {
                    data.push({ month: m.label, age, percentage: 100 });
                } else {
                    // Comprobamos retención al inicio del mes N
                    const checkMonthStart = startOfMonth(subMonths(new Date(), 5 - (idx + age)));

                    const retained = cohortCompanies.filter(c => {
                        if (!c.deleted_at) return true; // Sigue activa
                        const deletedAt = new Date(c.deleted_at);
                        return deletedAt >= checkMonthStart; // Fue eliminada DESPUÉS de este mes
                    }).length;

                    const percentage = Math.round((retained / cohortSize) * 100);
                    data.push({ month: m.label, age, percentage });
                }
            }
        });

        return data;
    },

    /**
     * Eventos de facturación en tiempo real.
     */
    async getBillingEvents(limit = 10, filters?: FinanceFilters): Promise<BillingEvent[]> {
        let query = supabase
            .from('subscription_events')
            .select(`
                id,
                created_at,
                event_type,
                status,
                payload,
                companies ( name, subscription_tier )
            `);

        // Aplicar filtros a la query real si es posible
        if (filters?.plan && filters.plan !== 'all') {
            // Nota: Esto requiere que la relación permita filtrar por el tier de la compañía
            // Como es una simulación avanzada, lo manejaremos en el mapeo si es necesario
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        let filteredData = data || [];

        // Filtrar localmente para la simulación si no se puede en SQL fácilmente por la estructura
        if (filters?.plan && filters.plan !== 'all') {
            filteredData = filteredData.filter(event => (event.companies as any)?.subscription_tier === filters.plan);
        }

        return filteredData.map(event => {
            let eventTypeEs = event.event_type.replace(/_/g, ' ');
            if (eventTypeEs.includes('subscription')) eventTypeEs = eventTypeEs.replace('subscription', 'Suscripción');
            if (eventTypeEs.includes('created')) eventTypeEs = eventTypeEs.replace('created', 'creada');
            if (eventTypeEs.includes('updated')) eventTypeEs = eventTypeEs.replace('updated', 'actualizada');
            if (eventTypeEs.includes('deleted')) eventTypeEs = eventTypeEs.replace('deleted', 'cancelada');

            return {
                id: event.id,
                created_at: event.created_at,
                company_name: (event.companies as any)?.name || 'Sistema',
                event_type: eventTypeEs,
                amount: event.payload?.amount || 0,
                status: event.status as any,
                reference: event.payload?.invoice_id
            };
        });
    },

    /**
     * Obtiene los Tenants VIP (Mayores ingresos).
     */
    async getVIPTenants(limit = 5): Promise<VIPStatus[]> {
        // Obtenemos los planes reales
        const { data: plans } = await supabase
            .from('subscription_plans')
            .select('slug, monthly_price_cents');

        const planPrices: Record<string, number> = {};
        plans?.forEach(p => {
            planPrices[p.slug] = p.monthly_price_cents / 100;
        });

        // Solo vemos empresas activas para los VIPs
        const { data: companies } = await supabase
            .from('companies')
            .select('id, name, subscription_tier, seat_count, seat_limit, custom_price_cents, subscription_status')
            .in('subscription_status', ['active', 'trialing'])
            .is('deleted_at', null);

        const activeCompanies = companies || [];

        // Calculamos el MRR de cada una y luego ordenamos
        const processedCompanies = activeCompanies.map(c => {
            const customPrice = c.custom_price_cents != null ? (c.custom_price_cents / 100) : null;
            const standardPrice = c.subscription_tier ? (planPrices[c.subscription_tier] || 0) : 0;
            const finalMrr = customPrice !== null ? customPrice : standardPrice;

            return {
                id: c.id,
                name: c.name,
                mrr: finalMrr,
                plan: c.subscription_tier || 'Sin Plan',
                usage: c.seat_limit && c.seat_limit > 0 ? ((c.seat_count || 0) / c.seat_limit) * 100 : 0
            };
        });

        // Ordenamos por MRR descendente
        processedCompanies.sort((a, b) => b.mrr - a.mrr);

        return processedCompanies.slice(0, limit);
    },

    /**
     * Obtiene datos históricos (Real vs Proyectado).
     */
    async getGrowthData(): Promise<GrowthPoint[]> {
        const { data: plans } = await supabase.from('subscription_plans').select('slug, monthly_price_cents');
        const planPrices: Record<string, number> = {};
        plans?.forEach(p => planPrices[p.slug] = p.monthly_price_cents / 100);

        const { data: companies } = await supabase
            .from('companies')
            .select('created_at, deleted_at, subscription_tier, custom_price_cents, subscription_status');

        const data: GrowthPoint[] = [];

        // Generar los últimos 6 meses
        for (let i = 5; i >= 0; i--) {
            const date = subMonths(new Date(), i);
            const endOfMonthDate = endOfMonth(date);
            const monthName = format(date, 'MMM');

            let monthMrr = 0;
            let activeCount = 0;

            companies?.forEach(c => {
                const createdAt = new Date(c.created_at);
                const deletedAt = c.deleted_at ? new Date(c.deleted_at) : null;

                // Si la empresa se creó después de este mes, no cuenta
                if (createdAt > endOfMonthDate) return;
                // Si la empresa se canceló/eliminó ANTES o DURANTE este mes, no cuenta al final del mes
                if (deletedAt && deletedAt <= endOfMonthDate) return;
                // Asumimos que si no ha sido eliminada, estaba activa o en trial

                // Excluimos explícitamente si actualmente está cancelada o suspendida y la fecha actual es el último mes
                if (i === 0 && !['active', 'trialing'].includes(c.subscription_status)) return;

                const customPrice = c.custom_price_cents != null ? (c.custom_price_cents / 100) : null;
                const standardPrice = c.subscription_tier ? (planPrices[c.subscription_tier] || 0) : 0;
                const finalMrr = customPrice !== null ? customPrice : standardPrice;

                monthMrr += finalMrr;
                activeCount++;
            });

            // Piso histórico: Si es antes de 2024, devolvemos 0 para evitar ruidos de simulación
            if (date.getFullYear() < 2024) {
                monthMrr = 0;
                activeCount = 0;
            }

            // Proyección realista: 10% más del real
            const projectedMrr = monthMrr * 1.1;

            data.push({
                name: monthName,
                realMrr: monthMrr,
                projectedMrr: projectedMrr,
                companies: activeCount
            });
        }
        return data;
    },

    /**
     * Obtiene la distribución de empresas por plan.
     */
    async getPlanDistribution() {
        const { data: companies } = await supabase
            .from('companies')
            .select('subscription_tier, subscription_status')
            .in('subscription_status', ['active', 'trialing'])
            .is('deleted_at', null);

        const counts: Record<string, number> = {};
        companies?.forEach(c => {
            const tier = c.subscription_tier;
            if (tier) {
                counts[tier] = (counts[tier] || 0) + 1;
            }
        });

        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },

    /**
     * Obtiene los eventos más recientes del bus para el feed de actividad.
     */
    async getRecentActivity(limit = 15) {
        const { data, error } = await supabase
            .from('event_bus')
            .select(`
                *,
                companies ( name )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    }
};
