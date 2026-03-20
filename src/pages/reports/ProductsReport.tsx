import React, { useMemo } from 'react';
import { FileDown, Package, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useStore, calculateProductCost, calculateProductStock } from '../../store';
import { calculateFinancialMetrics } from '@/core/financialMetricsEngine';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Period, downloadCSV } from './Reports';

interface Props { period: Period; }

const ProductsReport: React.FC<Props> = ({ period }) => {
    const { products, productMovements, rawMaterials, batches, unitsOfMeasure } = useStore();
    const { formatCurrency, currencySymbol } = useCurrency();

    const productStats = useMemo(() => products.map(product => {
        const cost = calculateProductCost(product, batches, rawMaterials, unitsOfMeasure);
        const stock = calculateProductStock(product.id, productMovements);
        const metrics = calculateFinancialMetrics(cost, product.price || 0, (product.target_margin || 30) / 100, currencySymbol);
        const marginOk = metrics.realMargin >= (product.target_margin || 30) / 100;
        const valuation = stock * cost;
        return { product, cost, stock, metrics, marginOk, valuation };
    }), [products, productMovements, rawMaterials, batches, unitsOfMeasure]);

    const kpis = useMemo(() => {
        const active = productStats.filter(s => (s.product.status || 'activa') === 'activa').length;
        const healthyMargin = productStats.filter(s => s.marginOk).length;
        const lowMargin = productStats.filter(s => !s.marginOk && (s.product.status || 'activa') === 'activa').length;
        const totalValuation = productStats.reduce((acc, s) => acc + s.valuation, 0);
        return { active, healthyMargin, lowMargin, totalValuation };
    }, [productStats]);

    const handleExport = () => {
        const headers = ['Producto', 'SKU', 'Estado', 'Stock', 'Costo FIFO', 'Precio', 'Margen Real', 'Margen Objetivo', 'Valuación'];
        const rows = productStats.map(s => [
            s.product.name, s.product.reference || 'SIN SKU',
            s.product.status || 'activa',
            String(s.stock),
            String(s.cost.toFixed(2)),
            String(s.product.price || 0),
            String((s.metrics.realMargin * 100).toFixed(1)) + '%',
            String(s.product.target_margin || 30) + '%',
            String(s.valuation.toFixed(2)),
        ]);
        downloadCSV([headers, ...rows], 'reporte-productos');
    };

    const KpiCard = ({ icon, label, value, danger, success }: { icon: React.ReactNode; label: string; value: string; danger?: boolean; success?: boolean }) => (
        <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', color: 'var(--text-muted)' }}>{icon}<span className="metric-label">{label}</span></div>
            <p style={{ fontSize: 'var(--text-h2-size)', fontWeight: 800, color: danger ? 'var(--state-danger)' : success ? 'var(--state-success)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: 'var(--space-16)' }}>
                <KpiCard icon={<Package size={16} />} label="Activos" value={String(kpis.active)} />
                <KpiCard icon={<CheckCircle2 size={16} />} label="Margen saludable" value={String(kpis.healthyMargin)} success />
                <KpiCard icon={<AlertTriangle size={16} />} label="Margen bajo" value={String(kpis.lowMargin)} danger={kpis.lowMargin > 0} />
                <KpiCard icon={<TrendingUp size={16} />} label="Valuación en stock" value={formatCurrency(kpis.totalValuation)} />
            </div>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-20) var(--space-24)', borderBottom: 'var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Catálogo con Rentabilidad</h3>
                    <Button variant="ghost" size="sm" icon={<FileDown size={16} />} onClick={handleExport}>CSV</Button>
                </div>
                {productStats.length === 0 ? (
                    <div style={{ padding: 'var(--space-32)', textAlign: 'center' }}><p className="text-small text-muted">Sin productos registrados.</p></div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table" style={{ minWidth: '44rem' }}>
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th className="align-right">Stock</th>
                                    <th className="align-right">Costo FIFO</th>
                                    <th className="align-right">Precio</th>
                                    <th style={{ textAlign: 'center' }}>Margen</th>
                                    <th className="align-right">Valuación</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productStats.map(s => (
                                    <tr key={s.product.id}>
                                        <td>
                                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{s.product.name}</p>
                                            <p className="text-small text-muted" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' }}>{s.product.reference || 'SIN SKU'}</p>
                                        </td>
                                        <td className="align-right tabular" style={{ fontWeight: 700, color: s.stock > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.stock}</td>
                                        <td className="align-right tabular">{formatCurrency(s.cost)}</td>
                                        <td className="align-right tabular" style={{ fontWeight: 700 }}>{formatCurrency(s.product.price || 0)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ fontWeight: 700, color: s.marginOk ? 'var(--state-success)' : 'var(--state-warning)' }}>
                                                {(s.metrics.realMargin * 100).toFixed(1)}%
                                            </span>
                                            <p className="text-small text-muted">obj. {s.product.target_margin || 30}%</p>
                                        </td>
                                        <td className="align-right tabular" style={{ fontWeight: 700 }}>{formatCurrency(s.valuation)}</td>
                                        <td>
                                            <Badge variant={(s.product.status || 'activa') === 'activa' ? 'success' : 'neutral'}>
                                                {(s.product.status || 'activa') === 'activa' ? 'Activo' : 'Discontinuado'}
                                            </Badge>
                                        </td>
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

export default ProductsReport;