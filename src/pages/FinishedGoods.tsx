import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, History, Printer, PackageSearch, FileDown,
    ChevronUp, ChevronDown, Package, LayoutDashboard,
    ArrowUpRight, ArrowDownRight, ClipboardList, Info,
    Clock, Tag, Truck, Filter, AlertCircle, Layers
} from 'lucide-react';
import { useStore } from '../store';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCurrency } from '@/hooks/useCurrency';
import { Badge } from '@/components/ui/Badge';

const FinishedGoods: React.FC = () => {
    const {
        products, productMovements, dispatches,
        rawMaterials, unitsOfMeasure, currentCompanyId
    } = useStore();
    const navigate = useNavigate();
    const { formatCurrency } = useCurrency();
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'with_stock'>('all');
    const [kardexPeriod, setKardexPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

    // ── CALCULATION ENGINE 2.0 ──
    const stockStats = useMemo(() => {
        return products.map(product => {
            const movements = productMovements.filter(m => m.product_id === product.id);

            // 1. Physical Stock (What's in the shelf)
            const physical = movements.reduce((acc, m) => {
                if (m.type === 'ingreso_produccion') return acc + m.quantity;
                if (m.type === 'salida_venta') return acc - m.quantity;
                if (m.type === 'ajuste') return acc + m.quantity;
                return acc;
            }, 0);

            // 2. Reserved Stock (In Borrador Dispatches)
            const reserved = dispatches
                .filter(d => d.status === 'borrador')
                .flatMap(d => d.items || [])
                .filter(i => i.product_id === product.id)
                .reduce((acc, i) => acc + i.quantity, 0);

            // 3. Available Stock
            const available = physical - reserved;

            // 4. Valuation (FIFO approximation using Physical stock)
            const entries = movements
                .filter(m => m.type === 'ingreso_produccion')
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const exits = movements
                .filter(m => m.type === 'salida_venta')
                .reduce((acc, m) => acc + m.quantity, 0);

            let remainingExits = exits;
            const productionLots = entries.map(entry => {
                const consumed = Math.min(entry.quantity, remainingExits);
                remainingExits = Math.max(0, remainingExits - consumed);
                const remaining = entry.quantity - consumed;
                return {
                    id: entry.id,
                    date: entry.created_at,
                    initial: entry.quantity,
                    remaining,
                    unit_cost: entry.unit_cost,
                    valuation: remaining * entry.unit_cost,
                    reference: entry.reference || '',
                    isExhausted: remaining === 0,
                };
            });

            const avgCost = entries.length > 0
                ? entries.reduce((acc, m) => acc + (m.quantity * m.unit_cost), 0) / entries.reduce((acc, m) => acc + m.quantity, 0)
                : 0;

            return {
                id: product.id,
                name: product.name,
                reference: product.reference,
                physical,
                reserved,
                available,
                avgCost,
                totalValuation: physical * avgCost,
                productionLots
            };
        });
    }, [products, productMovements, dispatches]);

    const filteredData = useMemo(() => {
        let data = stockStats;
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            data = data.filter(s =>
                s.name.toLowerCase().includes(term) ||
                (s.reference && s.reference.toLowerCase().includes(term))
            );
        }
        if (statusFilter === 'with_stock') data = data.filter(s => s.physical > 0);
        if (statusFilter === 'low') data = data.filter(s => s.physical > 0 && s.physical < 5); // Example threshold
        return data;
    }, [stockStats, searchTerm, statusFilter]);

    const globalValuation = useMemo(() =>
        filteredData.reduce((acc, s) => acc + s.totalValuation, 0)
        , [filteredData]);

    const pendingDispatchesCount = useMemo(() =>
        dispatches.filter(d => d.status === 'borrador').length
        , [dispatches]);

    const filterByPeriod = (date: string) => {
        if (kardexPeriod === 'all') return true;
        const days = kardexPeriod === '7d' ? 7 : kardexPeriod === '30d' ? 30 : 90;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return new Date(date) >= cutoff;
    };

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Stock & Kardex"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Módulo Stock</span>
                        </>
                    }
                    metadata={[
                        <span key="1" className="font-bold text-indigo-600">Valuación Total: {formatCurrency(globalValuation)}</span>,
                        <span key="2" className="flex items-center gap-1">
                            <Truck size={14} className="text-amber-500" />
                            {pendingDispatchesCount} Despachos Reservando Stock
                        </span>
                    ]}
                    actions={
                        <>
                            <Button variant="secondary" onClick={() => window.print()} icon={<Printer size={16} />}>
                                REPORTE
                            </Button>
                        </>
                    }
                />

                <div className="flex flex-wrap items-center gap-4 pt-6 mt-6 border-t border-slate-100 no-print">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${colors.textMuted}`} />
                        <input
                            type="text"
                            placeholder="Filtrar por nombre o referencia de producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.text.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none`}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className={`h-11 px-4 border border-slate-200 ${radius.xl} bg-white text-sm font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500/10 outline-none`}
                        >
                            <option value="all">Todos los productos</option>
                            <option value="with_stock">Solo con existencias</option>
                            <option value="low">Stock Bajo (&lt; 5 und)</option>
                        </select>
                        <Button variant="ghost" className="text-slate-500" icon={<FileDown size={20} />} />
                    </div>
                </div>
            </SectionBlock>

            <div className="mt-8 space-y-6">
                {filteredData.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed border-2 bg-slate-50/50">
                        <div className="h-20 w-20 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <PackageSearch size={40} />
                        </div>
                        <h3 className={`${typography.sectionTitle} text-slate-900 mb-2`}>Sin resultados</h3>
                        <p className="text-slate-500 text-sm max-w-md mx-auto">
                            No encontramos productos que coincidan con tu búsqueda o filtros actuales.
                        </p>
                    </Card>
                ) : (
                    <div className={`${radius['2xl']} border ${colors.borderStandard} overflow-hidden ${shadows.sm} bg-white`}>
                        <table className="w-full text-left">
                            <thead className={`bg-slate-50 ${typography.text.caption} text-slate-500 font-bold uppercase border-b ${colors.borderStandard}`}>
                                <tr>
                                    <th className="px-6 py-4">Producto / SKU</th>
                                    <th className="px-6 py-4 text-right">Físico</th>
                                    <th className="px-6 py-4 text-right">Reservado</th>
                                    <th className="px-6 py-4 text-right bg-indigo-50/30">Disponible</th>
                                    <th className="px-6 py-4 text-right">Costo Promedio</th>
                                    <th className="px-6 py-4 text-right">Valuación</th>
                                    <th className="px-6 py-4 w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.map(stat => {
                                    const product = products.find(p => p.id === stat.id);
                                    const isLowStock = product?.min_stock != null && stat.available <= product.min_stock;
                                    const isExpanded = expandedProductId === stat.id;
                                    const movements = productMovements
                                        .filter(m => m.product_id === stat.id && filterByPeriod(m.created_at))
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                                    const reservedDispatches = dispatches
                                        .filter(d => d.status === 'borrador' && (d.items || []).some(i => i.product_id === stat.id));

                                    return (
                                        <React.Fragment key={stat.id}>
                                            <tr
                                                className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                                                onClick={() => setExpandedProductId(isExpanded ? null : stat.id)}
                                            >
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 bg-slate-100 ${radius.lg} text-slate-400`}>
                                                            <Package size={20} />
                                                        </div>
                                                        <div>
                                                            <p className={`${typography.text.body} font-black ${colors.textPrimary} capitalize`}>{stat.name}</p>
                                                            <div className="flex flex-col">
                                                                <p className={`${typography.text.caption} font-bold text-slate-400 uppercase tracking-widest`}>{stat.reference || 'SIN SKU'}</p>
                                                                {isLowStock && (
                                                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                                                        <AlertCircle size={10} /> Stock Mínimo
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right font-bold text-slate-600">
                                                    {stat.physical}
                                                </td>
                                                <td className="px-6 py-5 text-right font-bold text-slate-500 tabular-nums">
                                                    <span className={stat.reserved > 0 ? 'text-amber-600' : colors.textMuted}>
                                                        {stat.reserved > 0 ? stat.reserved : '---'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <span className={`text-sm font-bold tabular-nums flex items-center justify-end gap-1.5 ${stat.available > 0 ? colors.statusSuccess : stat.available < 0 ? colors.statusDanger : colors.textMuted}`}>
                                                        {stat.available < 0 && <AlertCircle size={14} />}
                                                        {stat.available}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right tabular-nums text-slate-600 font-medium">
                                                    {formatCurrency(stat.avgCost)}
                                                </td>
                                                <td className="px-6 py-5 text-right tabular-nums font-black text-slate-900">
                                                    {formatCurrency(stat.totalValuation)}
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    {isExpanded ? <ChevronUp size={20} className="text-indigo-500" /> : <ChevronDown size={20} className="text-slate-300" />}
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan={7} className="p-0 border-b border-indigo-100">
                                                        <div className="px-8 py-8 animate-in slide-in-from-top-2 duration-300">
                                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                                                                {/* ── COL 1: KARDEX TIMELINE ── */}
                                                                <div className="lg:col-span-12">
                                                                    <div className="flex items-center justify-between mb-6">
                                                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                            <History size={16} className="text-indigo-400" /> Histórico de Movimientos (Kardex)
                                                                        </h4>
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400 uppercase">
                                                                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Entrada</span>
                                                                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Salida</span>
                                                                            </div>
                                                                            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                                                                                {(['7d', '30d', '90d', 'all'] as const).map((period) => (
                                                                                    <button
                                                                                        key={period}
                                                                                        onClick={(e) => { e.stopPropagation(); setKardexPeriod(period); }}
                                                                                        className={`
                                                                                            px-3 py-1 rounded-lg text-[11px] font-bold transition-all
                                                                                            ${kardexPeriod === period
                                                                                                ? 'bg-white text-indigo-600 shadow-sm'
                                                                                                : 'text-slate-500 hover:text-slate-700'}
                                                                                        `}
                                                                                    >
                                                                                        {period === '7d' ? '7 días' : period === '30d' ? '30 días' : period === '90d' ? '90 días' : 'Todo'}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {/* 1. Show Reservations First */}
                                                                        {reservedDispatches.map(d => (
                                                                            <div key={d.id} className={`flex items-center justify-between p-4 ${radius.xl} bg-white border-l-4 border-amber-300 shadow-sm border border-slate-100`}>
                                                                                <div className="flex items-center gap-4">
                                                                                    <div className="p-2 bg-amber-50 text-amber-500 rounded-lg">
                                                                                        <Clock size={18} />
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-sm font-bold text-slate-700">Reserva por Despacho #{d.number}</p>
                                                                                        <p className="text-[11px] text-slate-400 font-medium">Estado: BORRADOR &bull; Cliente: {d.client_name || 'Sin Cliente'}</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-6">
                                                                                    <div className="text-right">
                                                                                        <p className="text-sm font-black text-amber-600">-{d.items?.find(i => i.product_id === stat.id)?.quantity} und</p>
                                                                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Reservado</p>
                                                                                    </div>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        onClick={(e) => { e.stopPropagation(); navigate('/despachos'); }}
                                                                                        icon={<Truck size={14} />}
                                                                                    >
                                                                                        GESTIONAR
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        ))}

                                                                        {/* 2. Show Confirmed Movements */}
                                                                        {movements.map(m => {
                                                                            const isIncoming = m.type === 'ingreso_produccion' || (m.type === 'ajuste' && m.quantity > 0);
                                                                            return (
                                                                                <div key={m.id} className={`flex items-center justify-between p-4 ${radius.xl} bg-white shadow-sm border border-slate-100 hover:border-slate-300 transition-all`}>
                                                                                    <div className="flex items-center gap-4">
                                                                                        <div className={`p-2 ${isIncoming ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'} border rounded-lg`}>
                                                                                            {isIncoming ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="text-sm font-bold text-slate-800">
                                                                                                {m.type === 'ingreso_produccion' ? 'Ingreso por Producción' :
                                                                                                    m.type === 'salida_venta' ? 'Salida por Venta' :
                                                                                                        m.type === 'ajuste' ? 'Ajuste de Almacén' : m.reference}
                                                                                            </p>
                                                                                            <p className="text-[11px] text-slate-400 font-medium">
                                                                                                {new Date(m.created_at).toLocaleString()} &bull; {m.reference || 'Sin Referencia'}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className={`text-sm font-black ${isIncoming ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                                                            {isIncoming ? '+' : '-'}{Math.abs(m.quantity)} und
                                                                                        </p>
                                                                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Costo: {formatCurrency(m.unit_cost)}</p>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}

                                                                        {movements.length === 0 && reservedDispatches.length === 0 && (
                                                                            <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-2xl">
                                                                                <Info className="mx-auto text-slate-300 mb-2" size={24} />
                                                                                <p className="text-sm text-slate-400 font-medium">
                                                                                    {kardexPeriod === 'all'
                                                                                        ? 'No se registran movimientos históricos para este producto.'
                                                                                        : `Sin movimientos en los últimos ${kardexPeriod === '7d' ? '7' : kardexPeriod === '30d' ? '30' : '90'} días. Prueba con "Todo".`
                                                                                    }
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* ── LOTES DE PRODUCCIÓN FIFO ── */}
                                                                <div className="lg:col-span-12 mt-4 pt-6 border-t border-slate-100">
                                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                                                                        <Layers size={14} className="text-indigo-400" /> Lotes de Producción (First-In, First-Out)
                                                                    </h4>

                                                                    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                                                                        <table className="w-full text-left">
                                                                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                                                                <tr>
                                                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Ingreso</th>
                                                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Referencia</th>
                                                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Inicial</th>
                                                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Restante</th>
                                                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Costo Unit.</th>
                                                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valuación</th>
                                                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-50">
                                                                                {stat.productionLots.length === 0 ? (
                                                                                    <tr>
                                                                                        <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-xs font-medium">
                                                                                            No hay registros de producción para este producto.
                                                                                        </td>
                                                                                    </tr>
                                                                                ) : (
                                                                                    stat.productionLots.map(lot => (
                                                                                        <tr key={lot.id} className={`transition-colors ${lot.isExhausted ? 'opacity-40' : 'hover:bg-slate-50/30'}`}>
                                                                                            <td className="px-4 py-3 text-xs font-medium text-slate-600">
                                                                                                {new Date(lot.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                                            </td>
                                                                                            <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate" title={lot.reference}>
                                                                                                {lot.reference || '—'}
                                                                                            </td>
                                                                                            <td className="px-4 py-3 text-center text-xs font-medium text-slate-500">
                                                                                                {lot.initial} und
                                                                                            </td>
                                                                                            <td className="px-4 py-3 text-center">
                                                                                                <span className={`text-xs font-black ${lot.isExhausted ? 'text-slate-400' : 'text-emerald-600'}`}>
                                                                                                    {lot.remaining} und
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="px-4 py-3 text-right text-xs font-bold text-slate-600">
                                                                                                {formatCurrency(lot.unit_cost)}
                                                                                            </td>
                                                                                            <td className="px-4 py-3 text-right text-xs font-black text-slate-900">
                                                                                                {lot.isExhausted ? '—' : formatCurrency(lot.valuation)}
                                                                                            </td>
                                                                                            <td className="px-4 py-3 text-center">
                                                                                                {lot.isExhausted ? (
                                                                                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Agotado</span>
                                                                                                ) : (
                                                                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Activo</span>
                                                                                                )}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
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

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white; }
                    table { border: none !important; box-shadow: none !important; }
                }
            `}</style>
        </PageContainer>
    );
};

export default FinishedGoods;



