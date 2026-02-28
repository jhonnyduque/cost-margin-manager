import React, { useState, useMemo } from 'react';
import { PackageSearch, Search, Info, Plus, FileDown, Printer, History, ArrowUpRight, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useStore } from '../store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { tokens } from '@/design/design-tokens';
import { useCurrency } from '@/hooks/useCurrency';
import { useNavigate } from 'react-router-dom';

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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <PageHeader
                title="Inventario de Productos Terminado"
                subtitle="Rastreo de Kardex, existencias físicas y valorización de inventario listo para venta."
            />

            {/* UNIFIED TOOLBAR */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200 no-print">
                {/* Left: Search */}
                <div className="relative flex-1 w-full max-w-md group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" size={18} />
                    <Input
                        placeholder="Buscar producto, referencia..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-10 py-2.5 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm w-full"
                        fullWidth
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Right: Tools */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button variant="outline" className="flex-1 md:flex-none border-slate-200 text-slate-600 hover:bg-slate-50 h-10 px-3" title="Imprimir Reporte" onClick={() => window.print()}>
                        <Printer size={18} />
                    </Button>
                    <Button variant="outline" className="flex-1 md:flex-none border-slate-200 text-slate-600 hover:bg-slate-50 h-10 px-3" title="Exportar CSV">
                        <FileDown size={18} />
                    </Button>
                    <Button variant="primary" onClick={() => navigate('/products')} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 h-10 px-4" title="Producir más desde el Catálogo">
                        <Plus size={18} className="mr-2 hidden sm:block" />
                        Catálogo
                    </Button>
                </div>
            </div>

            {!searchTerm.trim() ? (
                <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed border-2 bg-gray-50/50">
                    <div className="h-20 w-20 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <PackageSearch size={40} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">Buscador Inteligente</h3>
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
                                <thead className="bg-gray-50/80 text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
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
                                                        <p className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{p.name}</p>
                                                        <p className="text-xs font-mono text-gray-500">{p.reference || 'Sin Ref'}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-black ${stock > 0 ? 'bg-emerald-100 text-emerald-800' : stock < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                                                            {stock} und.
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono font-medium text-gray-600">
                                                        {formatCurrency(avgCost)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="font-mono font-black text-indigo-900">
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
                                                                <h4 className="text-[11px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2 tracking-widest">
                                                                    <History size={12} /> Kardex de Movimientos
                                                                </h4>
                                                                {pMovements.length > 0 ? (
                                                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                                                        <table className="w-full text-sm text-left">
                                                                            <thead className="bg-slate-50 text-slate-500 font-semibold border-b text-xs uppercase tracking-wider">
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
                                                                                            <td className="px-4 py-3 font-mono text-gray-500 text-xs">
                                                                                                {new Date(m.created_at).toLocaleString()}
                                                                                            </td>
                                                                                            <td className="px-4 py-3">
                                                                                                <div className="flex flex-col gap-1 items-start">
                                                                                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.type === 'ingreso_produccion' ? 'bg-emerald-100 text-emerald-700' : m.type === 'merma' ? 'bg-red-100 text-red-700' : m.type === 'ajuste' ? 'bg-slate-100 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                                                        {m.type.replace('_', ' ')}
                                                                                                    </span>
                                                                                                    {m.produced_with_debt && (
                                                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-wider border border-red-100/50" title="Este lote se produjo asumiendo faltantes de insumos (Deuda de Inventario)">
                                                                                                            ⚠️ Con Deuda
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className={`px-4 py-3 text-right font-mono font-bold ${m.type === 'ingreso_produccion' ? 'text-emerald-600' : m.type === 'ajuste' ? 'text-slate-600' : 'text-red-500'}`}>
                                                                                                {m.type === 'ingreso_produccion' ? '+' : '-'}{m.quantity}
                                                                                            </td>
                                                                                            <td className="px-4 py-3 text-right font-mono text-gray-500">
                                                                                                {formatCurrency(m.unit_cost)}
                                                                                            </td>
                                                                                            <td className="px-4 py-3 text-gray-600">
                                                                                                <div className="flex items-center justify-between">
                                                                                                    <span className="truncate max-w-[150px]" title={m.reference || ''}>{m.reference || '-'}</span>
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
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-gray-400 text-center py-4 bg-white rounded-lg border border-dashed border-gray-200">
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                    <ArrowUpRight className="text-orange-500" />
                                    Registrar Salida
                                </h2>
                                <button onClick={() => setOutputModal(prev => ({ ...prev, isOpen: false }))} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-5 bg-slate-50/50">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Producto a retirar</p>
                                    <p className="text-lg font-bold text-slate-800">{outputModal.productName}</p>
                                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-md">
                                        <span className="text-xs text-slate-500 font-medium">Stock Físico Actual:</span>
                                        <span className={`text-sm font-bold ${outputModal.currentStock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{outputModal.currentStock} und.</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 mb-1">CANTIDAD</label>
                                        <Input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={outputModal.quantity || ''}
                                            onChange={(e) => setOutputModal(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                                            className="text-lg font-bold text-slate-800"
                                            fullWidth
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 mb-1">TIPO DE SALIDA</label>
                                        <select
                                            value={outputModal.type}
                                            onChange={(e) => setOutputModal(prev => ({ ...prev, type: e.target.value }))}
                                            className="w-full text-sm rounded-lg border-slate-200 bg-white px-3 py-2.5 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700"
                                        >
                                            <option value="salida_venta">Venta (Normal)</option>
                                            <option value="merma">Merma / Pérdida</option>
                                            <option value="salida_manual">Salida Manual</option>
                                            <option value="ajuste">Ajuste de Stock</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">REFERENCIA / NOTA (OPCIONAL)</label>
                                    <Input
                                        placeholder="Ej: Factura #0012, Dañado en almacén..."
                                        value={outputModal.reference}
                                        onChange={(e) => setOutputModal(prev => ({ ...prev, reference: e.target.value }))}
                                        fullWidth
                                    />
                                </div>

                                {/* Backorder / Debt Alert */}
                                {outputModal.quantity > outputModal.currentStock && (
                                    <div className="p-3 mt-4 rounded-xl bg-orange-50 border border-orange-200 flex items-start gap-3">
                                        <AlertTriangle className="text-orange-500 flex-shrink-0 mt-0.5" size={18} />
                                        <div>
                                            <h4 className="text-sm font-bold text-orange-800">Deuda de Stock Detectada</h4>
                                            <p className="text-xs text-orange-600 mt-1 leading-snug">
                                                Estás retirando más unidades de las que posees físicamente en el almacén. Esta acción dejará tu stock en <span className="font-bold font-mono">{(outputModal.currentStock - outputModal.quantity).toString()}</span> generando una <span className="font-bold">Deuda de Producto Terminado</span>.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
                                <Button variant="ghost" className="text-slate-500 hover:text-slate-700" onClick={() => setOutputModal(prev => ({ ...prev, isOpen: false }))}>
                                    Cancelar
                                </Button>
                                <Button
                                    variant={outputModal.quantity > outputModal.currentStock ? "warning" : "primary"}
                                    onClick={handleConfirmOutput}
                                    isLoading={isSaving}
                                >
                                    {outputModal.quantity > outputModal.currentStock ? `Aceptar y Generar Deuda` : `Confirmar Salida`}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default FinishedGoods;
