import React, { useMemo } from 'react';
import { FileDown, Factory, Package, CheckCircle2, Clock } from 'lucide-react';
import { useStore, calculateProductCost } from '../../store';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Period, filterByPeriod, downloadCSV } from './Reports';

interface Props { period: Period; }

const ProductionReport: React.FC<Props> = ({ period }) => {
    const { productMovements, productionOrders, products, batches, rawMaterials, unitsOfMeasure } = useStore();
    const { formatCurrency } = useCurrency();

    const ingresos = useMemo(() =>
        productMovements.filter(m => m.type === 'ingreso_produccion' && filterByPeriod(m.created_at, period)),
        [productMovements, period]
    );

    const orders = useMemo(() =>
        productionOrders.filter(o => filterByPeriod(o.created_at, period)),
        [productionOrders, period]
    );

    const kpis = useMemo(() => {
        const totalUnits = ingresos.reduce((acc, m) => acc + m.quantity, 0);
        const totalCost = ingresos.reduce((acc, m) => acc + m.quantity * (m.unit_cost || 0), 0);
        const finishedOrders = orders.filter(o => o.status === 'finished').length;
        const activeOrders = orders.filter(o => ['planned', 'preparation', 'processing'].includes(o.status)).length;
        return { totalUnits, totalCost, finishedOrders, activeOrders };
    }, [ingresos, orders]);

    // Producción por producto
    const byProduct = useMemo(() => {
        const map = new Map<string, { name: string; qty: number; cost: number }>();
        ingresos.forEach(m => {
            const product = products.find(p => p.id === m.product_id);
            const name = product?.name || m.product_id;
            const existing = map.get(m.product_id) || { name, qty: 0, cost: 0 };
            map.set(m.product_id, { name, qty: existing.qty + m.quantity, cost: existing.cost + m.quantity * (m.unit_cost || 0) });
        });
        return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
    }, [ingresos, products]);

    const handleExport = () => {
        const headers = ['Producto', 'Unidades Producidas', 'Costo Total'];
        const rows = byProduct.map(r => [r.name, String(r.qty), String(r.cost.toFixed(2))]);
        downloadCSV([headers, ...rows], 'reporte-produccion');
    };

    const statusLabel = (s: string) => {
        switch (s) {
            case 'planned': return <Badge variant="neutral">Planeado</Badge>;
            case 'preparation': return <Badge variant="warning">Preparación</Badge>;
            case 'processing': return <Badge variant="warning">Procesamiento</Badge>;
            case 'finished': return <Badge variant="success">Finalizado</Badge>;
            case 'cancelled': return <Badge variant="danger">Cancelado</Badge>;
            default: return <Badge variant="neutral">{s}</Badge>;
        }
    };

    const KpiCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
        <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', color: 'var(--text-muted)' }}>{icon}<span className="metric-label">{label}</span></div>
            <p style={{ fontSize: 'var(--text-h2-size)', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: 'var(--space-16)' }}>
                <KpiCard icon={<Package size={16} />} label="Unidades producidas" value={String(kpis.totalUnits)} />
                <KpiCard icon={<Factory size={16} />} label="Costo producción" value={formatCurrency(kpis.totalCost)} />
                <KpiCard icon={<CheckCircle2 size={16} />} label="Órdenes finalizadas" value={String(kpis.finishedOrders)} />
                <KpiCard icon={<Clock size={16} />} label="Órdenes activas" value={String(kpis.activeOrders)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: 'var(--space-24)' }}>
                {/* Por producto */}
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: 'var(--space-20) var(--space-24)', borderBottom: 'var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Producción por Producto</h3>
                        <Button variant="ghost" size="sm" icon={<FileDown size={16} />} onClick={handleExport}>CSV</Button>
                    </div>
                    {byProduct.length === 0 ? (
                        <div style={{ padding: 'var(--space-32)', textAlign: 'center' }}><p className="text-small text-muted">Sin producción en el período.</p></div>
                    ) : (
                        <table className="table">
                            <thead><tr><th>Producto</th><th className="align-right">Und.</th><th className="align-right">Costo</th></tr></thead>
                            <tbody>
                                {byProduct.map((row, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</td>
                                        <td className="align-right tabular">{row.qty}</td>
                                        <td className="align-right tabular" style={{ fontWeight: 700 }}>{formatCurrency(row.cost)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>

                {/* Órdenes recientes */}
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: 'var(--space-20) var(--space-24)', borderBottom: 'var(--border-default)' }}>
                        <h3 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Órdenes de Producción</h3>
                    </div>
                    {orders.length === 0 ? (
                        <div style={{ padding: 'var(--space-32)', textAlign: 'center' }}><p className="text-small text-muted">Sin órdenes en el período.</p></div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table" style={{ minWidth: '28rem' }}>
                                <thead><tr><th>Producto</th><th className="align-right">Cant.</th><th className="align-right">Costo</th><th>Estado</th></tr></thead>
                                <tbody>
                                    {orders.slice(0, 20).map(o => {
                                        const product = products.find(p => p.id === o.product_id);
                                        return (
                                            <tr key={o.id}>
                                                <td style={{ fontWeight: 600 }}>{product?.name || 'Desconocido'}</td>
                                                <td className="align-right tabular">{o.quantity}</td>
                                                <td className="align-right tabular">{formatCurrency(o.total_cost || 0)}</td>
                                                <td>{statusLabel(o.status)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default ProductionReport;