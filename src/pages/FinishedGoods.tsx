import React, { useState, useMemo } from 'react';
import { PackageSearch, Search, Info, Plus, FileDown, Printer, History } from 'lucide-react';
import { useStore } from '../store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { tokens } from '@/design/design-tokens';
import { useCurrency } from '@/hooks/useCurrency';
import { useNavigate } from 'react-router-dom';

const FinishedGoods: React.FC = () => {
    const { products, productMovements } = useStore();
    const { formatCurrency } = useCurrency();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

    const getProductStock = (productId: string) => {
        const movements = productMovements.filter(m => m.product_id === productId);
        const inQty = movements.filter(m => m.type === 'ingreso_produccion').reduce((acc, m) => acc + m.quantity, 0);
        const outQty = movements.filter(m => m.type === 'salida_venta').reduce((acc, m) => acc + m.quantity, 0);
        const adjQty = movements.filter(m => m.type === 'ajuste').reduce((acc, m) => acc + m.quantity, 0);

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

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <PageHeader
                title="Inventario de Productos Terminado"
                subtitle="Rastreo de Kardex, existencias físicas y valorización de inventario listo para venta."
            />

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full max-w-2xl group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" size={20} />
                    <Input
                        placeholder="Buscar por nombre, referencia o precio..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-12 py-3 text-lg rounded-2xl border-gray-200 shadow-sm transition-all focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
                        fullWidth
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button variant="outline" className="flex-1 md:flex-none border-gray-200 text-gray-600 hover:bg-gray-50" title="Imprimir Reporte">
                        <Printer size={18} />
                    </Button>
                    <Button variant="outline" className="flex-1 md:flex-none border-gray-200 text-gray-600 hover:bg-gray-50" title="Exportar CSV">
                        <FileDown size={18} />
                    </Button>
                    <Button variant="primary" onClick={() => navigate('/products')} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700" title="Producir más desde el Catálogo">
                        <Plus size={18} className="mr-2" />
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
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={`h-8 transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100 text-gray-500'}`}
                                                            onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                                                        >
                                                            <History size={16} className="mr-2" /> Histórico ({pMovements.length})
                                                        </Button>
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
                                                                                    <tr key={m.id} className="hover:bg-slate-50/50">
                                                                                        <td className="px-4 py-3 font-mono text-gray-500 text-xs">
                                                                                            {new Date(m.created_at).toLocaleString()}
                                                                                        </td>
                                                                                        <td className="px-4 py-3">
                                                                                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.type === 'ingreso_produccion' ? 'bg-emerald-100 text-emerald-700' : m.type === 'salida_venta' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                                                                                                {m.type.replace('_', ' ')}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className={`px-4 py-3 text-right font-mono font-bold ${m.type === 'salida_venta' ? 'text-red-500' : 'text-emerald-600'}`}>
                                                                                            {m.type === 'salida_venta' ? '-' : '+'}{m.quantity}
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-right font-mono text-gray-500">
                                                                                            {formatCurrency(m.unit_cost)}
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]" title={m.reference || ''}>
                                                                                            {m.reference || '-'}
                                                                                        </td>
                                                                                    </tr>
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
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FinishedGoods;
