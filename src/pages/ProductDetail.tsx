import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Edit3, PlayCircle, History, ChevronDown, ChevronUp,
    PackageSearch, User, Calendar, Clock, Tag, DollarSign, TrendingUp, AlertTriangle
} from 'lucide-react';
import { useStore, calculateProductCost } from '../store';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { calculateFinancialMetrics } from '@/core/financialMetricsEngine';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const ProductDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentCompany } = useAuth();
    const { formatCurrency } = useCurrency();

    const { products, productMovements, movements, rawMaterials, batches } = useStore();

    const product = products.find(p => p.id === id);
    const [creatorName, setCreatorName] = useState<string | null>(null);
    const [updaterName, setUpdaterName] = useState<string | null>(null);
    const [expandedMovementId, setExpandedMovementId] = useState<string | null>(null);

    // ── Resolve created_by / updated_by to user names ──
    useEffect(() => {
        if (!product) return;
        const resolveUsers = async () => {
            try {
                const { data } = await supabase.rpc('get_team_members', {
                    p_company_id: currentCompany?.id
                });
                if (data) {
                    const members = data as { user_id: string; full_name: string }[];
                    if (product.created_by) {
                        const creator = members.find(m => m.user_id === product.created_by);
                        setCreatorName(creator?.full_name || product.created_by.slice(0, 8) + '…');
                    }
                    if (product.updated_by) {
                        const updater = members.find(m => m.user_id === product.updated_by);
                        setUpdaterName(updater?.full_name || product.updated_by.slice(0, 8) + '…');
                    }
                }
            } catch (err) {
                console.error('[ProductDetail] Error resolving users:', err);
            }
        };
        resolveUsers();
    }, [product?.id, product?.created_by, product?.updated_by, currentCompany?.id]);

    // ── Computed data ──
    const cost = useMemo(() => {
        if (!product) return 0;
        return calculateProductCost(product, batches, rawMaterials);
    }, [product, batches, rawMaterials]);

    const metrics = useMemo(() => {
        if (!product) return null;
        return calculateFinancialMetrics(cost, product.price, product.target_margin ?? 0);
    }, [product, cost]);

    const pMovements = useMemo(() => {
        if (!id) return [];
        return productMovements
            .filter(m => m.product_id === id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [productMovements, id]);

    const stock = useMemo(() => {
        const inQty = pMovements.filter(m => m.type === 'ingreso_produccion').reduce((a, m) => a + m.quantity, 0);
        const outQty = pMovements.filter(m => ['salida_venta', 'salida_manual', 'merma'].includes(m.type)).reduce((a, m) => a + m.quantity, 0);
        const adjQty = pMovements.filter(m => m.type === 'ajuste').reduce((a, m) => a + (m.quantity || 0), 0);
        return inQty - outQty + adjQty;
    }, [pMovements]);

    // ── Guards ──
    if (!product) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center">
                <PackageSearch size={48} className="text-slate-300 mb-4" />
                <h2 className="text-lg font-bold text-slate-600">Producto no encontrado</h2>
                <p className="text-sm text-slate-400 mt-1">Este producto no existe o ha sido eliminado.</p>
                <Button variant="outline" className="mt-6" onClick={() => navigate('/productos')}>
                    <ArrowLeft size={16} className="mr-2" /> Volver al Catálogo
                </Button>
            </div>
        );
    }

    const marginPct = (metrics?.realMargin ?? 0) * 100;
    const marginColor = marginPct >= 30
        ? 'text-emerald-600' : marginPct >= 15
            ? 'text-amber-600' : 'text-red-600';

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* ── HEADER ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/productos')}
                        className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{product.name || 'Sin nombre'}</h1>
                            <Badge variant={product.status === 'activa' ? 'default' : 'secondary'}>
                                {product.status === 'activa' ? 'Activo' : product.status === 'inactiva' ? 'Discontinuado' : product.status}
                            </Badge>
                        </div>
                        <p className="text-sm text-slate-500 font-mono mt-0.5">{product.reference || 'Sin referencia'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => navigate(`/productos/editar/${product.id}`)}>
                        <Edit3 size={16} className="mr-1.5" /> Editar
                    </Button>
                    <Button variant="primary" className="bg-emerald-600 hover:bg-emerald-700">
                        <PlayCircle size={16} className="mr-1.5" /> Producir
                    </Button>
                </div>
            </div>

            {/* ── PRODUCT INFO CARDS ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Cost */}
                <Card className="p-4 bg-white border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <DollarSign size={16} className="text-blue-500" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Costo FIFO</span>
                    </div>
                    <p className="text-xl font-black text-slate-900 font-mono">{formatCurrency(cost)}</p>
                </Card>

                {/* Price */}
                <Card className="p-4 bg-white border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Tag size={16} className="text-indigo-500" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Precio Venta</span>
                    </div>
                    <p className="text-xl font-black text-indigo-600 font-mono">{formatCurrency(product.price)}</p>
                </Card>

                {/* Margin */}
                <Card className="p-4 bg-white border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <TrendingUp size={16} className="text-emerald-500" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Margen Real</span>
                    </div>
                    <p className={`text-xl font-black font-mono ${marginColor}`}>
                        {marginPct.toFixed(1)}%
                    </p>
                </Card>

                {/* Stock */}
                <Card className="p-4 bg-white border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                            <PackageSearch size={16} className="text-orange-500" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stock</span>
                    </div>
                    <p className={`text-xl font-black font-mono ${stock > 0 ? 'text-emerald-600' : stock < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {stock} und.
                    </p>
                </Card>
            </div>

            {/* ── METADATA STRIP ── */}
            <Card className="p-4 bg-white border border-slate-200">
                <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                    {creatorName && (
                        <div className="flex items-center gap-2 text-slate-600">
                            <User size={14} className="text-slate-400" />
                            <span className="text-slate-400 font-medium">Creado por</span>
                            <span className="font-bold text-slate-800">{creatorName}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-600">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-slate-400 font-medium">Creado</span>
                        <span className="font-bold text-slate-800">{new Date(product.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {updaterName && (
                        <div className="flex items-center gap-2 text-slate-600">
                            <Clock size={14} className="text-slate-400" />
                            <span className="text-slate-400 font-medium">Actualizado por</span>
                            <span className="font-bold text-slate-800">{updaterName}</span>
                            <span className="text-xs text-slate-400 font-mono">
                                {new Date(product.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-600">
                        <History size={14} className="text-slate-400" />
                        <span className="text-slate-400 font-medium">Movimientos</span>
                        <span className="font-bold text-slate-800">{pMovements.length}</span>
                    </div>
                </div>
            </Card>

            {/* ── MOVEMENT KARDEX ── */}
            <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                    <History size={14} /> Kardex de Movimientos
                </h2>

                {pMovements.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2 bg-slate-50/50">
                        <div className="h-16 w-16 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mb-4">
                            <History size={32} />
                        </div>
                        <h3 className="text-base font-bold text-slate-600 mb-1">Sin movimientos</h3>
                        <p className="text-sm text-slate-400 max-w-sm">
                            Este producto no tiene movimientos de inventario registrados. Produce unidades para comenzar el historial.
                        </p>
                    </Card>
                ) : (
                    <Card className="bg-white border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold border-b text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3">Fecha</th>
                                        <th className="px-5 py-3">Tipo</th>
                                        <th className="px-5 py-3 text-right">Cantidad</th>
                                        <th className="px-5 py-3 text-right">Costo Unitario</th>
                                        <th className="px-5 py-3">Referencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pMovements.map(m => {
                                        const typeLabels: Record<string, string> = {
                                            ingreso_produccion: 'Producción',
                                            salida_venta: 'Venta',
                                            salida_manual: 'Salida Manual',
                                            merma: 'Merma',
                                            ajuste: 'Ajuste'
                                        };
                                        const typeColors: Record<string, string> = {
                                            ingreso_produccion: 'bg-emerald-100 text-emerald-700',
                                            salida_venta: 'bg-orange-100 text-orange-700',
                                            salida_manual: 'bg-orange-100 text-orange-700',
                                            merma: 'bg-red-100 text-red-700',
                                            ajuste: 'bg-slate-100 text-slate-700'
                                        };

                                        return (
                                            <React.Fragment key={m.id}>
                                                <tr className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-5 py-3.5 font-mono text-slate-500 text-xs">
                                                        {new Date(m.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${typeColors[m.type] || 'bg-slate-100 text-slate-600'}`}>
                                                                {typeLabels[m.type] || m.type.replace('_', ' ')}
                                                            </span>
                                                            {m.produced_with_debt && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-wider border border-red-100/50" title="Este lote se produjo asumiendo faltantes de insumos">
                                                                    <AlertTriangle size={10} /> Con Deuda
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className={`px-5 py-3.5 text-right font-mono font-bold ${m.type === 'ingreso_produccion' ? 'text-emerald-600' : m.type === 'ajuste' ? 'text-slate-600' : 'text-red-500'}`}>
                                                        {m.type === 'ingreso_produccion' ? '+' : '-'}{m.quantity}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-mono text-slate-500">
                                                        {formatCurrency(m.unit_cost)}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-slate-600">
                                                        <div className="flex items-center justify-between">
                                                            <span className="truncate max-w-[200px]" title={m.reference || ''}>{m.reference || '—'}</span>
                                                            {m.type === 'ingreso_produccion' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setExpandedMovementId(expandedMovementId === m.id ? null : m.id)}
                                                                    className={`ml-2 h-7 px-2 text-[10px] ${expandedMovementId === m.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50'}`}
                                                                >
                                                                    {expandedMovementId === m.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Detalle
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* ── Expanded: consumption breakdown ── */}
                                                {expandedMovementId === m.id && m.type === 'ingreso_produccion' && (
                                                    <tr className="bg-slate-50/50">
                                                        <td colSpan={5} className="p-0 border-b border-slate-100">
                                                            <div className="px-8 py-4 bg-white shadow-inner">
                                                                <h5 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 mb-3">
                                                                    <PackageSearch size={12} /> Desglose de Consumo (Lote Producción)
                                                                </h5>
                                                                <div className="overflow-x-auto rounded border border-slate-100">
                                                                    <table className="w-full text-xs text-left">
                                                                        <thead className="bg-slate-50 text-slate-500 uppercase">
                                                                            <tr>
                                                                                <th className="px-3 py-2 font-bold">Insumo Consumido</th>
                                                                                <th className="px-3 py-2 text-right font-bold">Cantidad</th>
                                                                                <th className="px-3 py-2 font-bold text-center">Estado de Cobertura</th>
                                                                                <th className="px-3 py-2 text-right font-bold">Costo Asumido</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-50">
                                                                            {movements.filter(sm => sm.date === m.created_at && ['egreso', 'egreso_asumido'].includes(sm.type)).map((sm) => {
                                                                                const material = rawMaterials.find(rm => rm.id === sm.material_id);
                                                                                return (
                                                                                    <tr key={sm.id} className="hover:bg-slate-50/50">
                                                                                        <td className="px-3 py-2 font-semibold text-slate-700">
                                                                                            {material?.name || 'Insumo Eliminado'}
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-right font-mono text-slate-600">
                                                                                            {sm.quantity.toFixed(2)} {material?.unit || ''}
                                                                                        </td>
                                                                                        <td className="px-3 py-2">
                                                                                            <div className="flex justify-center w-full">
                                                                                                {sm.type === 'egreso_asumido' ? (
                                                                                                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                                                                                        ⚠️ DEUDA TÉCNICA
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                                                                        CUBIERTO
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className={`px-3 py-2 text-right font-mono font-semibold ${sm.type === 'egreso_asumido' ? 'text-red-600' : 'text-slate-600'}`}>
                                                                                            {formatCurrency(sm.quantity * sm.unit_cost)}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
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
                    </Card>
                )}
            </div>
        </div>
    );
};

export default ProductDetail;
