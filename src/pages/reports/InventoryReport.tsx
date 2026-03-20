import React, { useMemo } from 'react';
import { FileDown, Layers, AlertCircle, TrendingDown, DollarSign } from 'lucide-react';
import { useStore, getMaterialDebt } from '../../store';
import { UnitConverter } from '../../services/inventoryEngineV2';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Period, downloadCSV } from './Reports';

interface Props { period: Period; }

const InventoryReport: React.FC<Props> = ({ period }) => {
    const { rawMaterials, batches, movements, unitsOfMeasure } = useStore();
    const { formatCurrency } = useCurrency();

    const materialStats = useMemo(() => rawMaterials.map(material => {
        const matBatches = batches.filter(b => b.material_id === material.id);
        const totalOriginal = matBatches.reduce((acc, b) => acc + ((b as any).base_initial_quantity ?? b.initial_quantity ?? 0), 0);
        let totalRemaining = matBatches.reduce((acc, b) => acc + ((b as any).base_remaining_quantity ?? b.remaining_quantity ?? 0), 0);
        const totalValue = matBatches.reduce((acc, b) => {
            const qty = (b as any).base_initial_quantity ?? b.initial_quantity ?? 0;
            const cost = (b as any).cost_per_base_unit ?? b.unit_cost ?? 0;
            return acc + qty * cost;
        }, 0);
        const totalArea = matBatches.reduce((acc, b) => acc + (b.area || 0), 0);
        const debt = getMaterialDebt(material.id, movements);
        totalRemaining -= debt.pendingQty;
        const avgCost = totalOriginal > 0 ? totalValue / totalOriginal : 0;
        const displayUom = unitsOfMeasure.find(u => u.id === material.display_unit_id) || unitsOfMeasure.find(u => u.id === material.base_unit_id) || { symbol: material.unit || '', conversion_factor: 1 } as any;
        const displayQty = UnitConverter.fromBase(totalRemaining, displayUom);
        return { material, totalRemaining, displayQty, displayUom, avgCost, totalValue: totalRemaining * avgCost, totalArea, debtQty: debt.pendingQty, debtValue: debt.financialDebt };
    }), [rawMaterials, batches, movements, unitsOfMeasure]);

    const kpis = useMemo(() => {
        const totalValuation = materialStats.reduce((acc, s) => acc + s.totalValue, 0);
        const totalDebt = materialStats.reduce((acc, s) => acc + s.debtValue, 0);
        const withStock = materialStats.filter(s => s.totalRemaining > 0).length;
        const withDebt = materialStats.filter(s => s.debtQty > 0).length;
        return { totalValuation, totalDebt, withStock, withDebt };
    }, [materialStats]);

    const handleExport = () => {
        const headers = ['Materia Prima', 'Tipo', 'Stock', 'Unidad', 'Costo Promedio', 'Valuación', 'Deuda'];
        const rows = materialStats.map(s => [
            s.material.name, s.material.type,
            String(s.displayQty.toFixed(3)), s.displayUom.symbol,
            String(s.avgCost.toFixed(4)), String(s.totalValue.toFixed(2)),
            String(s.debtValue.toFixed(2)),
        ]);
        downloadCSV([headers, ...rows], 'reporte-inventario');
    };

    const KpiCard = ({ icon, label, value, danger }: { icon: React.ReactNode; label: string; value: string; danger?: boolean }) => (
        <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', color: 'var(--text-muted)' }}>{icon}<span className="metric-label">{label}</span></div>
            <p style={{ fontSize: 'var(--text-h2-size)', fontWeight: 800, color: danger ? 'var(--state-danger)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: 'var(--space-16)' }}>
                <KpiCard icon={<DollarSign size={16} />} label="Valuación Total" value={formatCurrency(kpis.totalValuation)} />
                <KpiCard icon={<Layers size={16} />} label="Insumos con stock" value={String(kpis.withStock)} />
                <KpiCard icon={<AlertCircle size={16} />} label="Con deuda activa" value={String(kpis.withDebt)} danger={kpis.withDebt > 0} />
                <KpiCard icon={<TrendingDown size={16} />} label="Deuda financiera" value={formatCurrency(kpis.totalDebt)} danger={kpis.totalDebt > 0} />
            </div>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-20) var(--space-24)', borderBottom: 'var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Inventario de Materias Primas</h3>
                    <Button variant="ghost" size="sm" icon={<FileDown size={16} />} onClick={handleExport}>CSV</Button>
                </div>
                {materialStats.length === 0 ? (
                    <div style={{ padding: 'var(--space-32)', textAlign: 'center' }}><p className="text-small text-muted">Sin materias primas registradas.</p></div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table" style={{ minWidth: '40rem' }}>
                            <thead>
                                <tr>
                                    <th>Materia Prima</th>
                                    <th>Tipo</th>
                                    <th className="align-right">Stock</th>
                                    <th className="align-right">Costo Prom.</th>
                                    <th className="align-right">Valuación</th>
                                    <th className="align-right">Deuda</th>
                                </tr>
                            </thead>
                            <tbody>
                                {materialStats.map(s => (
                                    <tr key={s.material.id}>
                                        <td>
                                            <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.material.name}</p>
                                            <p className="text-small text-muted">{s.material.provider || 'Varios'}</p>
                                        </td>
                                        <td className="text-small" style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.material.type}</td>
                                        <td className="align-right">
                                            <span style={{ fontWeight: 700, color: s.totalRemaining > 0 ? 'var(--state-success)' : s.totalRemaining < 0 ? 'var(--state-danger)' : 'var(--text-muted)' }}>
                                                {s.displayQty.toFixed(3)} {s.displayUom.symbol}
                                            </span>
                                        </td>
                                        <td className="align-right tabular" style={{ color: 'var(--text-muted)' }}>{formatCurrency(s.avgCost)}</td>
                                        <td className="align-right tabular" style={{ fontWeight: 700 }}>{formatCurrency(s.totalValue)}</td>
                                        <td className="align-right tabular" style={{ color: s.debtValue > 0 ? 'var(--state-danger)' : 'var(--text-muted)' }}>
                                            {s.debtValue > 0 ? formatCurrency(s.debtValue) : '—'}
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

export default InventoryReport;