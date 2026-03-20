import React, { useMemo } from 'react';
import { FileDown, TrendingUp, ShoppingBag, Users, DollarSign } from 'lucide-react';
import { useStore } from '../../store';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Period, filterByPeriod, downloadCSV } from './Reports';

interface Props { period: Period; }

const SalesReport: React.FC<Props> = ({ period }) => {
    const { dispatches, products } = useStore();
    const { formatCurrency } = useCurrency();

    const confirmedDispatches = useMemo(() =>
        dispatches.filter(d => d.status === 'confirmado' && filterByPeriod(d.date, period)),
        [dispatches, period]
    );

    const kpis = useMemo(() => {
        const totalRevenue = confirmedDispatches.reduce((acc, d) => acc + (d.total_value || 0), 0);
        const totalOrders = confirmedDispatches.length;
        const uniqueClients = new Set(confirmedDispatches.map(d => d.client_name || 'Sin Cliente')).size;
        const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        return { totalRevenue, totalOrders, uniqueClients, avgOrder };
    }, [confirmedDispatches]);

    // Top productos por ingresos
    const productSales = useMemo(() => {
        const map = new Map<string, { name: string; qty: number; revenue: number }>();
        confirmedDispatches.forEach(d => {
            (d.items || []).forEach(item => {
                const existing = map.get(item.product_id) || { name: item.product_name || item.product_id, qty: 0, revenue: 0 };
                map.set(item.product_id, { name: existing.name, qty: existing.qty + item.quantity, revenue: existing.revenue + item.subtotal });
            });
        });
        return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    }, [confirmedDispatches]);

    // Top clientes
    const clientSales = useMemo(() => {
        const map = new Map<string, { name: string; orders: number; revenue: number }>();
        confirmedDispatches.forEach(d => {
            const key = d.client_name || 'Sin Cliente';
            const existing = map.get(key) || { name: key, orders: 0, revenue: 0 };
            map.set(key, { name: key, orders: existing.orders + 1, revenue: existing.revenue + (d.total_value || 0) });
        });
        return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    }, [confirmedDispatches]);

    const handleExport = () => {
        const headers = ['Número', 'Fecha', 'Cliente', 'Items', 'Total'];
        const rows = confirmedDispatches.map(d => [
            d.number, d.date.slice(0, 10), d.client_name || 'Sin Cliente',
            String(d.items?.length || 0), String(d.total_value || 0),
        ]);
        downloadCSV([headers, ...rows], 'reporte-ventas');
    };

    const KpiCard = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) => (
        <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', color: 'var(--text-muted)' }}>{icon}<span className="metric-label">{label}</span></div>
            <p style={{ fontSize: 'var(--text-h2-size)', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
            {sub && <p className="text-small text-muted">{sub}</p>}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: 'var(--space-16)' }}>
                <KpiCard icon={<DollarSign size={16} />} label="Ingresos Totales" value={formatCurrency(kpis.totalRevenue)} />
                <KpiCard icon={<ShoppingBag size={16} />} label="Despachos" value={String(kpis.totalOrders)} />
                <KpiCard icon={<Users size={16} />} label="Clientes únicos" value={String(kpis.uniqueClients)} />
                <KpiCard icon={<TrendingUp size={16} />} label="Ticket promedio" value={formatCurrency(kpis.avgOrder)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: 'var(--space-24)' }}>
                {/* Top productos */}
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: 'var(--space-20) var(--space-24)', borderBottom: 'var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Top Productos</h3>
                        <Button variant="ghost" size="sm" icon={<FileDown size={16} />} onClick={handleExport}>CSV</Button>
                    </div>
                    {productSales.length === 0 ? (
                        <div style={{ padding: 'var(--space-32)', textAlign: 'center' }}><p className="text-small text-muted">Sin ventas en el período.</p></div>
                    ) : (
                        <table className="table">
                            <thead><tr><th>Producto</th><th className="align-right">Und.</th><th className="align-right">Ingresos</th></tr></thead>
                            <tbody>
                                {productSales.map((row, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</td>
                                        <td className="align-right tabular">{row.qty}</td>
                                        <td className="align-right tabular" style={{ fontWeight: 700 }}>{formatCurrency(row.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>

                {/* Top clientes */}
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: 'var(--space-20) var(--space-24)', borderBottom: 'var(--border-default)' }}>
                        <h3 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Top Clientes</h3>
                    </div>
                    {clientSales.length === 0 ? (
                        <div style={{ padding: 'var(--space-32)', textAlign: 'center' }}><p className="text-small text-muted">Sin ventas en el período.</p></div>
                    ) : (
                        <table className="table">
                            <thead><tr><th>Cliente</th><th className="align-right">Órdenes</th><th className="align-right">Total</th></tr></thead>
                            <tbody>
                                {clientSales.map((row, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</td>
                                        <td className="align-right tabular">{row.orders}</td>
                                        <td className="align-right tabular" style={{ fontWeight: 700 }}>{formatCurrency(row.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            </div>

            {/* Detalle de despachos */}
            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-20) var(--space-24)', borderBottom: 'var(--border-default)' }}>
                    <h3 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Despachos Confirmados</h3>
                </div>
                {confirmedDispatches.length === 0 ? (
                    <div style={{ padding: 'var(--space-32)', textAlign: 'center' }}><p className="text-small text-muted">Sin despachos en el período.</p></div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table" style={{ minWidth: '36rem' }}>
                            <thead>
                                <tr>
                                    <th>Número</th>
                                    <th>Fecha</th>
                                    <th>Cliente</th>
                                    <th className="align-right">Items</th>
                                    <th className="align-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {confirmedDispatches.map(d => (
                                    <tr key={d.id}>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{d.number}</td>
                                        <td className="text-small text-muted">{new Date(d.date).toLocaleDateString('es-ES')}</td>
                                        <td style={{ fontWeight: 600 }}>{d.client_name || 'Sin Cliente'}</td>
                                        <td className="align-right tabular">{d.items?.length || 0}</td>
                                        <td className="align-right tabular" style={{ fontWeight: 700 }}>{formatCurrency(d.total_value || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default SalesReport;