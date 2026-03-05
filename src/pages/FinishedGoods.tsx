import React, { useState, useMemo } from 'react';
import { PackageSearch, Search, Info, Plus, FileDown, Printer, History, ArrowUpRight, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useStore } from '../store';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useCurrency } from '@/hooks/useCurrency';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';

const FinishedGoods: React.FC = () => {
    const { products, productMovements, movements, rawMaterials } = useStore();
    const { formatCurrency } = useCurrency();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [expandedMovementId, setExpandedMovementId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [outputModal, setOutputModal] = useState<{
        isOpen: boolean;
        productId: string;
        productName: string;
        currentStock: number;
        quantity: number;
        type: string;
        reference: string;
    }>({
        isOpen: false,
        productId: '',
        productName: '',
        currentStock: 0,
        quantity: 1,
        type: 'salida_venta',
        reference: ''
    });

    const getProductStock = (productId: string) => {
        const movements = productMovements.filter(m => m.product_id === productId);
        const inQty = movements.filter(m => m.type === 'ingreso_produccion').reduce((acc, m) => acc + m.quantity, 0);
        const outQty = movements.filter(m => ['salida_venta', 'salida_manual', 'merma'].includes(m.type)).reduce((acc, m) => acc + m.quantity, 0);
        const adjQty = movements.filter(m => m.type === 'ajuste').reduce((acc, m) => acc + (m.quantity || 0), 0);

        // Simplification: adjQty positive means more stock, negative means less.
        return inQty - outQty + adjQty;
    };

    const getProductAvgCost = (productId: string) => {
        const movements = productMovements.filter(m => m.product_id === productId && m.type === 'ingreso_produccion');
        if (movements.length === 0) return 0;

        const totalCost = movements.reduce((acc, m) => acc + (m.quantity * m.unit_cost), 0);
        const totalQty = movements.reduce((acc, m) => acc + m.quantity, 0);

        return totalQty > 0 ? totalCost / totalQty : 0;
    };

    const filteredProducts = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const term = searchTerm.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(term) ||
            (p.reference && p.reference.toLowerCase().includes(term)) ||
            p.price.toString().includes(term)
        );
    }, [products, searchTerm]);

    const handleConfirmOutput = async () => {
        setIsSaving(true);
        try {
            await useStore.getState().registerFinishedGoodOutput(
                outputModal.productId,
                outputModal.quantity < 0 ? outputModal.quantity * -1 : outputModal.quantity, // Enforce positive sum for ledger since 'type' defines direction
                outputModal.type,
                outputModal.reference
            );
            setOutputModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <PageContainer>
            <SectionBlock>
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div className="space-y-1">
                        <h1 className={`${typography.text.title} ${colors.textPrimary} tracking-tight`}>Inventario de Productos Terminado</h1>
                        <p className={`${typography.text.body} ${colors.textSecondary}`}>Rastreo de Kardex, existencias físicas y valorización de inventario listo para venta.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" onClick={() => window.print()} icon={<Printer size={18} />}>
                            IMPRIMIR
                        </Button>
                        <Button variant="primary" onClick={() => navigate('/products')} icon={<PackageSearch />}>
                            CATÁLOGO
                        </Button>
                    </div>
                </header>

                <div className="flex flex-wrap items-center gap-4 pt-6 mt-6 border-t border-slate-100 no-print">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${colors.textMuted}`} />
                        <input
                            type="text"
                            placeholder="Buscar producto, referencia..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.text.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white`}
                        />
                    </div>
                    <Button variant="ghost" className="text-slate-500" title="Exportar CSV" icon={<FileDown size={20} />} />
                </div>
            </SectionBlock>

            {!searchTerm.trim() ? (
                <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed border-2 bg-gray-50/50">
                    <div className="h-20 w-20 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <PackageSearch size={40} />
                    </div>
                    <h3 className={`${typography.sectionTitle} text-gray-900 mb-2`}>Buscador Inteligente</h3>
                    <p className="text-gray-500 text-sm max-w-md mx-auto">
                        Utiliza la barra de búsqueda superior indicando el nombre, SKU o precio de tu producto para revelar sus existencias físicas y movimientos de inventario.
                    </p>
                </Card>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {filteredProducts.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            No se encontraron coincidencias para "<span className="font-bold">{searchTerm}</span>".
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left">
                                <thead className={`bg-slate-50 ${typography.text.caption} text-slate-500 font-bold uppercase border-b border-slate-100`}>
                                    <tr>
                                        <th className="px-6 py-4">Producto</th>
                                        <th className="px-6 py-4 text-center">Stock Disponible</th>
                                        <th className="px-6 py-4 text-right">Costo Promedio Lotes</th>
                                        <th className="px-6 py-4 text-right">Valorización Total</th>
                                        <th className="px-6 py-4 text-center">Movimientos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredProducts.map(p => {
                                        const stock = getProductStock(p.id);
                                        const avgCost = getProductAvgCost(p.id);
                                        const isExpanded = expandedProductId === p.id;
                                        const pMovements = productMovements.filter(m => m.product_id === p.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                                        return (
                                            <React.Fragment key={p.id}>
                                                <tr className="hover:bg-indigo-50/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <p className={`${typography.text.body} font-black ${colors.textPrimary} group-hover:text-indigo-700 transition-colors capitalize`}>{p.name}</p>
                                                        <p className={`${typography.text.caption} font-bold text-slate-400 uppercase tracking-wider mt-0.5`}>{p.reference || 'SIN REF'}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full ${typography.uiLabel} ${stock > 0 ? 'bg-emerald-100 text-emerald-800' : stock < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                                                            {stock} und.
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-600">
                                                        {formatCurrency(avgCost)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`${typography.text.body} font-black text-indigo-600 tabular-nums`}>
                                                            {formatCurrency(stock * avgCost)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 transition-colors border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                                onClick={() => setOutputModal({
                                                                    isOpen: true,
                                                                    productId: p.id,
                                                                    productName: p.name,
                                                                    currentStock: stock,
                                                                    quantity: 1,
                                                                    type: 'salida_venta',
                                                                    reference: ''
                                                                })}
                                                                title="Registrar Salida / Venta"
                                                            >
                                                                <ArrowUpRight size={16} className="mr-1" /> Sacar
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className={`h-8 transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100 text-gray-500'}`}
                                                                onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                                                            >
                                                                <History size={16} className="mr-2" /> Histórico ({pMovements.length})
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr className="bg-slate-50 border-b border-gray-200 shadow-inner">
                                                        <td colSpan={5} className="p-0">
                                                            <div className="px-6 py-6 ring-1 ring-inset ring-black/5">
                                                                <h4 className={`${typography.uiLabel} text-slate-500 mb-4 flex items-center gap-2`}>
                                                                    <History size={12} /> Kardex de Movimientos
                                                                </h4>
                                                                {pMovements.length > 0 ? (
                                                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                                                        <table className="w-full text-sm text-left">
                                                                            <thead className={`bg-slate-50 text-slate-500 border-b ${typography.uiLabel} uppercase tracking-wider`}>
                                                                                <tr>
                                                                                    <th className="px-4 py-3">Fecha</th>
                                                                                    <th className="px-4 py-3">Tipo</th>
                                                                                    <th className="px-4 py-3 text-right">Cant.</th>
                                                                                    <th className="px-4 py-3 text-right">Costo U.</th>
                                                                                    <th className="px-4 py-3">Referencia</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-100">
                                                                                {pMovements.map(m => (
                                                                                    <React.Fragment key={m.id}>
                                                                                        <tr className="hover:bg-slate-50/50">
                                                                                            <td className={`px-4 py-3 ${typography.text.caption} font-bold text-slate-500 tabular-nums`}>
                                                                                                {new Date(m.created_at).toLocaleString()}
                                                                                            </td>
                                                                                            <td className="px-4 py-3">
                                                                                                <div className="flex flex-col gap-1 items-start">
                                                                                                    <Badge variant={m.type === 'ingreso_produccion' ? 'success' : 'warning'}>
                                                                                                        {(m.type as string).replace('_', ' ').toUpperCase()}
                                                                                                    </Badge>
                                                                                                    {m.produced_with_debt && (
                                                                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 ${typography.text.caption} font-bold border border-red-100/50`} title="Este lote se produjo asumiendo faltantes de insumos (Deuda de Inventario)">
                                                                                                            ⚠️ CON DEUDA
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className={`px-4 py-3 text-right ${typography.text.body} font-black ${m.type === 'ingreso_produccion' ? 'text-emerald-600' : 'text-slate-600'} tabular-nums`}>
                                                                                                {m.type === 'ingreso_produccion' ? '+' : '-'}{m.quantity}
                                                                                            </td>
                                                                                            <td className={`px-4 py-3 text-right ${typography.text.body} font-bold text-slate-600 tabular-nums`}>
                                                                                                {formatCurrency(m.unit_cost)}
                                                                                            </td>
                                                                                            <td className={`px-4 py-3 ${typography.text.body} text-slate-600`}>
                                                                                                <div className="flex items-center justify-between gap-4">
                                                                                                    <span className="truncate max-w-[150px] font-medium" title={m.reference || ''}>{m.reference || '-'}</span>
                                                                                                    {m.type === 'ingreso_produccion' && (
                                                                                                        <Button
                                                                                                            variant="ghost"
                                                                                                            size="sm"
                                                                                                            onClick={() => setExpandedMovementId(expandedMovementId === m.id ? null : m.id)}
                                                                                                            className={`h-7 px-2 ${typography.text.caption} font-bold ${expandedMovementId === m.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50'}`}
                                                                                                        >
                                                                                                            {expandedMovementId === m.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} DETALLE
                                                                                                        </Button>
                                                                                                    )}
                                                                                                </div>
                                                                                            </td>
                                                                                        </tr>
                                                                                        {expandedMovementId === m.id && m.type === 'ingreso_produccion' && (
                                                                                            <tr className="bg-slate-50/50">
                                                                                                <td colSpan={5} className="p-0 border-b border-slate-100">
                                                                                                    <div className="px-8 py-6 bg-white shadow-inner">
                                                                                                        <h5 className={`${typography.text.caption} text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-4`}>
                                                                                                            <PackageSearch size={14} /> Desglose de Consumo (Lote Producción)
                                                                                                        </h5>
                                                                                                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                                                                                                            <table className="w-full text-left">
                                                                                                                <thead className={`bg-slate-50 ${typography.text.caption} text-slate-500 font-bold uppercase`}>
                                                                                                                    <tr>
                                                                                                                        <th className="px-4 py-3">Insumo Consumido</th>
                                                                                                                        <th className="px-4 py-3 text-right">Cantidad</th>
                                                                                                                        <th className="px-4 py-3 text-center">Estado de Cobertura</th>
                                                                                                                        <th className="px-4 py-3 text-right">Costo Asumido</th>
                                                                                                                    </tr>
                                                                                                                </thead>
                                                                                                                <tbody className="divide-y divide-slate-50">
                                                                                                                    {movements.filter(sm => sm.date === m.created_at && ['egreso', 'egreso_asumido'].includes(sm.type)).map((sm) => {
                                                                                                                        const material = rawMaterials.find(rm => rm.id === sm.material_id);
                                                                                                                        return (
                                                                                                                            <tr key={sm.id} className="hover:bg-slate-50/50">
                                                                                                                                <td className={`px-4 py-3 ${typography.text.body} font-black text-slate-700 capitalize`}>
                                                                                                                                    {material?.name || 'Insumo Eliminado'}
                                                                                                                                </td>
                                                                                                                                <td className={`px-4 py-3 text-right ${typography.text.body} font-bold text-slate-600 tabular-nums`}>
                                                                                                                                    {sm.quantity.toFixed(2)} <span className="text-[10px] text-slate-400 uppercase">{material?.unit || ''}</span>
                                                                                                                                </td>
                                                                                                                                <td className="px-4 py-3 text-center">
                                                                                                                                    <Badge variant={sm.type === 'egreso_asumido' ? 'danger' : 'success'}>
                                                                                                                                        {sm.type === 'egreso_asumido' ? 'DEUDA TÉCNICA' : 'CUBIERTO'}
                                                                                                                                    </Badge>
                                                                                                                                </td>
                                                                                                                                <td className={`px-4 py-3 text-right ${typography.text.body} font-black ${sm.type === 'egreso_asumido' ? 'text-red-600' : 'text-indigo-600'} tabular-nums`}>
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
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-slate-500 text-center py-4 bg-white rounded-lg border border-dashed border-gray-200">
                                                                        No hay movimientos registrados para este producto.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                                }
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )
            }

            {
                outputModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <Card className="w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 p-0">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h2 className={`${typography.text.section} flex items-center gap-2 text-slate-800`}>
                                    <ArrowUpRight className="text-orange-500" />
                                    Registrar Salida
                                </h2>
                                <button onClick={() => setOutputModal(prev => ({ ...prev, isOpen: false }))} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <p className={`${typography.text.caption} text-slate-400 font-bold uppercase tracking-widest mb-1`}>Producto a retirar</p>
                                    <p className={`${typography.text.title} text-slate-800 leading-tight`}>{outputModal.productName}</p>
                                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                                        <span className={`${typography.text.caption} text-indigo-400 font-bold uppercase`}>Stock Físico:</span>
                                        <span className={`${typography.text.body} font-black ${outputModal.currentStock > 0 ? 'text-indigo-600' : 'text-red-500'} tabular-nums`}>{outputModal.currentStock} und.</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-1">
                                        <label className={`block ${typography.text.caption} text-slate-500 font-bold uppercase mb-2`}>CANTIDAD</label>
                                        <Input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={outputModal.quantity || ''}
                                            onChange={(e) => setOutputModal(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                                            className={`${typography.text.title} text-slate-800 font-black h-12`}
                                            fullWidth
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className={`block ${typography.text.caption} text-slate-500 font-bold uppercase mb-2`}>TIPO DE SALIDA</label>
                                        <Select
                                            value={outputModal.type}
                                            onChange={(e) => setOutputModal(prev => ({ ...prev, type: e.target.value }))}
                                            className="h-12"
                                        >
                                            <option value="salida_venta">Venta (Normal)</option>
                                            <option value="merma">Merma / Pérdida</option>
                                            <option value="salida_manual">Salida Manual</option>
                                            <option value="ajuste">Ajuste de Stock</option>
                                        </Select>
                                    </div>
                                </div>

                                <div>
                                    <label className={`block ${typography.text.caption} text-slate-500 font-bold uppercase mb-2`}>REFERENCIA / NOTA (OPCIONAL)</label>
                                    <Input
                                        placeholder="Ej: Factura #0012, Dañado en almacén..."
                                        value={outputModal.reference}
                                        onChange={(e) => setOutputModal(prev => ({ ...prev, reference: e.target.value }))}
                                        className="h-11"
                                        fullWidth
                                    />
                                </div>

                                {/* Backorder / Debt Alert */}
                                {outputModal.quantity > outputModal.currentStock && (
                                    <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 flex items-start gap-3 animate-pulse">
                                        <AlertTriangle className="text-orange-500 flex-shrink-0 mt-0.5" size={20} />
                                        <div>
                                            <h4 className={`${typography.text.body} font-black text-orange-800 uppercase text-[11px]`}>Deuda de Stock Detectada</h4>
                                            <p className={`${typography.text.caption} text-orange-700 mt-1 leading-relaxed font-medium`}>
                                                Estás retirando más unidades de las que posees físicamente. Esto dejará tu stock en <span className="font-black font-mono">{(outputModal.currentStock - outputModal.quantity).toString()}</span> generando una <span className="font-black">Deuda de Producto</span>.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-3">
                                <Button
                                    variant={outputModal.quantity > outputModal.currentStock ? "warning" : "primary"}
                                    onClick={handleConfirmOutput}
                                    isLoading={isSaving}
                                    className="w-full py-6 font-black uppercase tracking-widest h-14"
                                >
                                    {outputModal.quantity > outputModal.currentStock ? `Aceptar y Generar Deuda` : `Confirmar Salida`}
                                </Button>
                                <Button variant="ghost" className="w-full text-slate-400 font-bold" onClick={() => setOutputModal(prev => ({ ...prev, isOpen: false }))}>
                                    CANCELAR REGISTRO
                                </Button>
                            </div>
                        </Card>
                    </div>
                )
            }
        </PageContainer>
    );
};

export default FinishedGoods;


