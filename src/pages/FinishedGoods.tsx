import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, History, Printer, PackageSearch, FileDown,
    ChevronUp, ChevronDown, Package, ArrowUpRight, ArrowDownRight,
    Info, Clock, Truck, AlertCircle, Layers,
} from 'lucide-react';
import { useStore } from '../store';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCurrency } from '@/hooks/useCurrency';
import { Badge } from '@/components/ui/Badge';

const FinishedGoods: React.FC = () => {
    const { products, productMovements, dispatches, rawMaterials, unitsOfMeasure, currentCompanyId } = useStore();
    const navigate = useNavigate();
    const { formatCurrency } = useCurrency();

    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'with_stock'>('all');
    const [kardexPeriod, setKardexPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

    const stockStats = useMemo(() => {
        return products.map(product => {
            const movements = productMovements.filter(m => m.product_id === product.id);
            const physical = movements.reduce((acc, m) => {
                if (m.type === 'ingreso_produccion') return acc + m.quantity;
                if (m.type === 'salida_venta') return acc - m.quantity;
                if (m.type === 'ajuste') return acc + m.quantity;
                return acc;
            }, 0);
            const reserved = dispatches.filter(d => d.status === 'borrador').flatMap(d => d.items || []).filter(i => i.product_id === product.id).reduce((acc, i) => acc + i.quantity, 0);
            const available = physical - reserved;
            const entries = movements.filter(m => m.type === 'ingreso_produccion').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const exits = movements.filter(m => m.type === 'salida_venta').reduce((acc, m) => acc + m.quantity, 0);
            let remainingExits = exits;
            const productionLots = entries.map(entry => {
                const consumed = Math.min(entry.quantity, remainingExits);
                remainingExits = Math.max(0, remainingExits - consumed);
                const remaining = entry.quantity - consumed;
                return { id: entry.id, date: entry.created_at, initial: entry.quantity, remaining, unit_cost: entry.unit_cost, valuation: remaining * entry.unit_cost, reference: entry.reference || '', isExhausted: remaining === 0 };
            });
            const avgCost = entries.length > 0 ? entries.reduce((acc, m) => acc + m.quantity * m.unit_cost, 0) / entries.reduce((acc, m) => acc + m.quantity, 0) : 0;
            return { id: product.id, name: product.name, reference: product.reference, physical, reserved, available, avgCost, totalValuation: physical * avgCost, productionLots };
        });
    }, [products, productMovements, dispatches]);

    const filteredData = useMemo(() => {
        let data = stockStats;
        if (searchTerm.trim()) { const term = searchTerm.toLowerCase(); data = data.filter(s => s.name.toLowerCase().includes(term) || (s.reference && s.reference.toLowerCase().includes(term))); }
        if (statusFilter === 'with_stock') data = data.filter(s => s.physical > 0);
        if (statusFilter === 'low') data = data.filter(s => s.physical > 0 && s.physical < 5);
        return data;
    }, [stockStats, searchTerm, statusFilter]);

    const globalValuation = useMemo(() => filteredData.reduce((acc, s) => acc + s.totalValuation, 0), [filteredData]);
    const pendingDispatchesCount = useMemo(() => dispatches.filter(d => d.status === 'borrador').length, [dispatches]);

    const filterByPeriod = (date: string) => {
        if (kardexPeriod === 'all') return true;
        const days = kardexPeriod === '7d' ? 7 : kardexPeriod === '30d' ? 30 : 90;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
        return new Date(date) >= cutoff;
    };

    const exportToCSV = () => {
        if (filteredData.length === 0) return;
        const headers = ['Producto', 'SKU', 'Fisico', 'Reservado', 'Disponible', 'Costo Promedio', 'Valuacion'];
        const escape = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = filteredData.map(s => [s.name, s.reference || 'SIN SKU', s.physical, s.reserved, s.available, s.avgCost.toFixed(2), s.totalValuation.toFixed(2)]);
        const csv = [headers.map(escape).join(';'), ...rows.map(r => r.map(escape).join(';'))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.setAttribute('download', `stock-kardex-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    };

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Stock & Kardex"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Módulo Stock</span></>}
                    metadata={[
                        <span key="1" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Valuación Total: {formatCurrency(globalValuation)}</span>,
                        <span key="2" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                            <Truck size={14} style={{ color: 'var(--text-muted)' }} />
                            {pendingDispatchesCount} Despachos Reservando Stock
                        </span>,
                    ]}
                    actions={<Button variant="secondary" onClick={() => window.print()} icon={<Printer size={16} />}>REPORTE</Button>}
                />

                <div className="no-print" style={{ marginTop: 'var(--space-32)', borderTop: 'var(--border-default)', paddingTop: 'var(--space-32)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 14rem auto', gap: 'var(--space-12)', alignItems: 'center' }}>
                        <div style={{ position: 'relative', minWidth: 0 }}>
                            <Search size={18} style={{ position: 'absolute', left: 'var(--space-16)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="text" placeholder="Filtrar por nombre o referencia..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input" style={{ paddingLeft: 'var(--space-48)', width: '100%' }} />
                        </div>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="input" style={{ width: '100%' }}>
                            <option value="all">Todos los productos</option>
                            <option value="with_stock">Solo con existencias</option>
                            <option value="low">Stock Bajo (&lt; 5 und)</option>
                        </select>
                        <Button variant="ghost" size="sm" icon={<FileDown size={18} />} title="Exportar" onClick={exportToCSV} />
                    </div>
                </div>
            </SectionBlock>

            <div style={{ marginTop: 'var(--space-32)', display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
                {filteredData.length === 0 ? (
                    <div className="empty-state" style={{ border: '2px dashed var(--border-color-default)', borderRadius: 'var(--radius-xl)' }}>
                        <div className="empty-state-icon" style={{ width: '5rem', height: '5rem', borderRadius: '50%' }}><PackageSearch size={40} /></div>
                        <h3 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 700, color: 'var(--text-primary)' }}>Sin resultados</h3>
                        <p className="text-small text-muted" style={{ maxWidth: '32rem' }}>No encontramos productos que coincidan con tu búsqueda o filtros.</p>
                    </div>
                ) : (
                    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Producto / SKU</th>
                                    <th className="align-right">Físico</th>
                                    <th className="align-right">Reservado</th>
                                    <th className="align-right">Disponible</th>
                                    <th className="align-right">Costo Promedio</th>
                                    <th className="align-right">Valuación</th>
                                    <th style={{ width: '3rem', textAlign: 'center' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(stat => {
                                    const product = products.find(p => p.id === stat.id);
                                    const isLowStock = product?.min_stock != null && stat.available <= product.min_stock;
                                    const isExpanded = expandedProductId === stat.id;
                                    const movements = productMovements.filter(m => m.product_id === stat.id && filterByPeriod(m.created_at)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                                    const reservedDispatches = dispatches.filter(d => d.status === 'borrador' && (d.items || []).some(i => i.product_id === stat.id));

                                    return (
                                        <React.Fragment key={stat.id}>
                                            <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedProductId(isExpanded ? null : stat.id)}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                                                        <div style={{ padding: 'var(--space-8)', background: 'var(--surface-muted)', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)' }}>
                                                            <Package size={20} />
                                                        </div>
                                                        <div>
                                                            <p style={{ fontWeight: 800, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{stat.name}</p>
                                                            <p className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.reference || 'SIN SKU'}</p>
                                                            {isLowStock && (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-4)', fontSize: '10px', fontWeight: 800, color: 'var(--state-warning)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                                    <AlertCircle size={10} /> Stock Mínimo
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="align-right tabular" style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{stat.physical}</td>
                                                <td className="align-right tabular" style={{ fontWeight: 700, color: stat.reserved > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                                    {stat.reserved > 0 ? stat.reserved : '---'}
                                                </td>
                                                <td className="align-right">
                                                    <span className="tabular" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-4)', fontWeight: 700, color: stat.available > 0 ? 'var(--state-success)' : stat.available < 0 ? 'var(--state-danger)' : 'var(--text-muted)' }}>
                                                        {stat.available < 0 && <AlertCircle size={14} />}
                                                        {stat.available}
                                                    </span>
                                                </td>
                                                <td className="align-right tabular" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{formatCurrency(stat.avgCost)}</td>
                                                <td className="align-right tabular" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(stat.totalValuation)}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {isExpanded
                                                        ? <ChevronUp size={20} style={{ color: 'var(--text-secondary)' }} />
                                                        : <ChevronDown size={20} style={{ color: 'var(--text-muted)' }} />}
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={7} style={{ padding: 0, borderTop: 'var(--border-default)', background: 'var(--surface-page)' }}>
                                                        <div style={{ padding: 'var(--space-32)' }}>

                                                            {/* Kardex header */}
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-24)', flexWrap: 'wrap', gap: 'var(--space-16)' }}>
                                                                <h4 className="text-small text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-8)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                                                    <History size={16} style={{ color: 'var(--text-muted)' }} /> Histórico de Movimientos (Kardex)
                                                                </h4>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)', flexWrap: 'wrap' }}>
                                                                    <div className="text-small text-muted" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)', fontWeight: 700, textTransform: 'uppercase' }}>
                                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                                                            <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '999px', background: 'var(--text-secondary)' }} /> Entrada
                                                                        </span>
                                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                                                            <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '999px', background: 'var(--text-muted)' }} /> Salida
                                                                        </span>
                                                                    </div>
                                                                    <div className="tabs" style={{ display: 'inline-flex', overflowX: 'auto' }}>
                                                                        {(['7d', '30d', '90d', 'all'] as const).map(period => (
                                                                            <button key={period} onClick={e => { e.stopPropagation(); setKardexPeriod(period); }} className={kardexPeriod === period ? 'tab is-active' : 'tab'}>
                                                                                {period === '7d' ? '7 días' : period === '30d' ? '30 días' : period === '90d' ? '90 días' : 'Todo'}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Movement cards */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
                                                                {reservedDispatches.map(d => (
                                                                    <div key={d.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-16)', borderLeft: '4px solid var(--state-warning)' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)' }}>
                                                                            <div style={{ padding: 'var(--space-8)', background: 'var(--surface-muted)', color: 'var(--text-muted)', borderRadius: 'var(--radius-lg)' }}><Clock size={18} /></div>
                                                                            <div>
                                                                                <p style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Reserva por Despacho #{d.number}</p>
                                                                                <p className="text-small text-muted">Estado: BORRADOR · Cliente: {d.client_name || 'Sin Cliente'}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-24)' }}>
                                                                            <div style={{ textAlign: 'right' }}>
                                                                                <p style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>-{d.items?.find(i => i.product_id === stat.id)?.quantity} und</p>
                                                                                <p className="text-small text-muted">Reservado</p>
                                                                            </div>
                                                                            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); navigate('/despachos'); }} icon={<Truck size={14} />}>GESTIONAR</Button>
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {movements.map(m => {
                                                                    const isIncoming = m.type === 'ingreso_produccion' || (m.type === 'ajuste' && m.quantity > 0);
                                                                    return (
                                                                        <div key={m.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-16)' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)' }}>
                                                                                <div style={{ padding: 'var(--space-8)', background: isIncoming ? 'var(--surface-muted)' : 'var(--surface-page)', color: 'var(--text-secondary)', border: 'var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
                                                                                    {isIncoming ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                                                                                </div>
                                                                                <div>
                                                                                    <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                                                                        {m.type === 'ingreso_produccion' ? 'Ingreso por Producción' : m.type === 'salida_venta' ? 'Salida por Venta' : m.type === 'ajuste' ? 'Ajuste de Almacén' : m.reference}
                                                                                    </p>
                                                                                    <p className="text-small text-muted">{new Date(m.created_at).toLocaleString()} · {m.reference || 'Sin Referencia'}</p>
                                                                                </div>
                                                                            </div>
                                                                            <div style={{ textAlign: 'right' }}>
                                                                                <p style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>{isIncoming ? '+' : '-'}{Math.abs(m.quantity)} und</p>
                                                                                <p className="text-small text-muted">Costo: {formatCurrency(m.unit_cost)}</p>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}

                                                                {movements.length === 0 && reservedDispatches.length === 0 && (
                                                                    <div className="empty-state" style={{ padding: 'var(--space-32)', background: 'var(--surface-card)', border: '2px dashed var(--border-color-default)', borderRadius: 'var(--radius-xl)' }}>
                                                                        <div className="empty-state-icon"><Info size={24} /></div>
                                                                        <p className="text-small text-muted">
                                                                            {kardexPeriod === 'all' ? 'No se registran movimientos históricos.' : `Sin movimientos en los últimos ${kardexPeriod === '7d' ? '7' : kardexPeriod === '30d' ? '30' : '90'} días.`}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Lotes FIFO */}
                                                            <div style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-24)', borderTop: 'var(--border-default)' }}>
                                                                <h4 className="text-small text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-8)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 'var(--space-16)' }}>
                                                                    <Layers size={14} style={{ color: 'var(--text-muted)' }} /> Lotes de Producción (First-In, First-Out)
                                                                </h4>
                                                                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                                                    <table className="table">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Fecha Ingreso</th>
                                                                                <th>Referencia</th>
                                                                                <th style={{ textAlign: 'center' }}>Inicial</th>
                                                                                <th style={{ textAlign: 'center' }}>Restante</th>
                                                                                <th className="align-right">Costo Unit.</th>
                                                                                <th className="align-right">Valuación</th>
                                                                                <th style={{ textAlign: 'center' }}>Estado</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {stat.productionLots.length === 0 ? (
                                                                                <tr><td colSpan={7} style={{ padding: 'var(--space-32)', textAlign: 'center' }}><span className="text-small text-muted">No hay registros de producción.</span></td></tr>
                                                                            ) : stat.productionLots.map(lot => (
                                                                                <tr key={lot.id} style={{ opacity: lot.isExhausted ? 0.45 : 1 }}>
                                                                                    <td className="text-small">{new Date(lot.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                                                                    <td className="text-small text-muted" title={lot.reference}>{lot.reference || '—'}</td>
                                                                                    <td style={{ textAlign: 'center' }}><span className="text-small">{lot.initial} und</span></td>
                                                                                    <td style={{ textAlign: 'center' }}><span className="text-small tabular" style={{ fontWeight: 800, color: lot.isExhausted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{lot.remaining} und</span></td>
                                                                                    <td className="align-right"><span className="text-small tabular">{formatCurrency(lot.unit_cost)}</span></td>
                                                                                    <td className="align-right"><span className="text-small tabular" style={{ fontWeight: 800 }}>{lot.isExhausted ? '—' : formatCurrency(lot.valuation)}</span></td>
                                                                                    <td style={{ textAlign: 'center' }}>
                                                                                        {lot.isExhausted
                                                                                            ? <span className="text-small text-muted">Agotado</span>
                                                                                            : <span className="text-small text-secondary">Activo</span>}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style>{`@media print { .no-print { display: none !important; } body { background: white; } table { border: none !important; box-shadow: none !important; } }`}</style>
        </PageContainer>
    );
};

export default FinishedGoods;