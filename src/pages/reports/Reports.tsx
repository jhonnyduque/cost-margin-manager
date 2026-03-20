import React, { useState } from 'react';
import { TrendingUp, Package, Layers, Factory } from 'lucide-react';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import SalesReport from './SalesReport';
import ProductionReport from './ProductionReport';
import InventoryReport from './InventoryReport';
import ProductsReport from './ProductsReport';

type ReportTab = 'sales' | 'production' | 'inventory' | 'products';
export type Period = '7d' | '30d' | '90d' | 'all';

export interface ReportPeriod {
    value: Period;
    label: string;
    days: number | null;
}

export const PERIODS: ReportPeriod[] = [
    { value: '7d', label: 'Últimos 7 días', days: 7 },
    { value: '30d', label: 'Últimos 30 días', days: 30 },
    { value: '90d', label: 'Últimos 90 días', days: 90 },
    { value: 'all', label: 'Todo el tiempo', days: null },
];

export function filterByPeriod(dateStr: string, period: Period): boolean {
    if (period === 'all') return true;
    const days = PERIODS.find(p => p.value === period)?.days ?? 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(dateStr) >= cutoff;
}

export function downloadCSV(rows: string[][], filename: string) {
    const escape = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = rows.map(r => r.map(escape).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

const TABS: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
    { id: 'sales', label: 'Ventas', icon: <TrendingUp size={15} /> },
    { id: 'production', label: 'Producción', icon: <Factory size={15} /> },
    { id: 'inventory', label: 'Inventario', icon: <Layers size={15} /> },
    { id: 'products', label: 'Productos', icon: <Package size={15} /> },
];

const Reports: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ReportTab>('sales');
    const [period, setPeriod] = useState<Period>('30d');

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Reportes"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Reportes</span></>}
                    metadata={[<span key="1">Análisis de ventas, producción e inventario</span>]}
                />

                <div style={{ marginTop: 'var(--space-24)', borderTop: 'var(--border-default)', paddingTop: 'var(--space-24)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-12)' }}>
                    <div style={{ display: 'flex', background: 'var(--surface-muted)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', gap: 'var(--space-2)', overflowX: 'auto' }}>
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={activeTab === tab.id ? 'tab is-active' : 'tab'}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-6)', whiteSpace: 'nowrap', minHeight: '2rem', padding: '0 var(--space-12)' }}>
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', background: 'var(--surface-muted)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', gap: 'var(--space-2)' }}>
                        {PERIODS.map(p => (
                            <button key={p.value} onClick={() => setPeriod(p.value)} className={period === p.value ? 'tab is-active' : 'tab'}
                                style={{ minHeight: '2rem', padding: '0 var(--space-12)', fontSize: 'var(--text-small-size)', whiteSpace: 'nowrap' }}>
                                {p.value === 'all' ? 'Todo' : p.value === '7d' ? '7d' : p.value === '30d' ? '30d' : '90d'}
                            </button>
                        ))}
                    </div>
                </div>
            </SectionBlock>

            <div style={{ marginTop: 'var(--space-24)' }}>
                {activeTab === 'sales' && <SalesReport period={period} />}
                {activeTab === 'production' && <ProductionReport period={period} />}
                {activeTab === 'inventory' && <InventoryReport period={period} />}
                {activeTab === 'products' && <ProductsReport period={period} />}
            </div>
        </PageContainer>
    );
};

export default Reports;