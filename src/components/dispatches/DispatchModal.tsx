import React, { useState, useEffect } from 'react';
import {
    X, Plus, Trash2, AlertCircle, Info, Scan,
    Save, Calculator, UserPlus, BoxSelect, FileText, Clock
} from 'lucide-react';
import { useStore } from '../../store';
import { Dispatch, DispatchItem, Product, Client } from '../../types';
import { colors, radius, spacing, shadows, typography } from '@/design/design-tokens';

interface DispatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingDispatch: Dispatch | null;
}

const DispatchModal: React.FC<DispatchModalProps> = ({ isOpen, onClose, editingDispatch }) => {
    const {
        currentCompanyId, products, clients, generateDispatchNumber,
        createDispatch, updateDispatch, productMovements
    } = useStore();

    // Form State
    const [dispatchNumber, setDispatchNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [clientId, setClientId] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<DispatchItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Load initial data
    useEffect(() => {
        if (editingDispatch) {
            setDispatchNumber(editingDispatch.number);
            setDate(new Date(editingDispatch.date).toISOString().split('T')[0]);
            setClientId(editingDispatch.client_id || '');
            setNotes(editingDispatch.notes || '');
            setItems(editingDispatch.items || []);
        } else {
            setDispatchNumber(generateDispatchNumber());
            setItems([]);
        }
    }, [editingDispatch, isOpen, generateDispatchNumber]);

    const calculateStock = (productId: string) => {
        return productMovements
            .filter(m => m.product_id === productId)
            .reduce((acc, m) => {
                if (m.type === 'ingreso_produccion') return acc + m.quantity;
                if (m.type === 'salida_venta') return acc - m.quantity;
                if (m.type === 'ajuste') return acc + m.quantity;
                return acc;
            }, 0);
    };

    const handleAddItem = () => {
        const newItem: DispatchItem = {
            id: crypto.randomUUID(),
            dispatch_id: editingDispatch?.id || '',
            company_id: currentCompanyId || '',
            product_id: '',
            quantity: 1,
            unit_price: 0,
            subtotal: 0,
            created_at: new Date().toISOString()
        };
        setItems([...items, newItem]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const handleItemChange = (id: string, field: keyof DispatchItem, value: any) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };

                // Auto-fill price if product changes
                if (field === 'product_id') {
                    const product = products.find(p => p.id === value);
                    updatedItem.unit_price = product?.price || 0;
                    updatedItem.product_name = product?.name;
                }

                // Recalculate subtotal
                updatedItem.subtotal = updatedItem.quantity * updatedItem.unit_price;
                return updatedItem;
            }
            return item;
        }));
    };

    const totalValue = items.reduce((acc, i) => acc + i.subtotal, 0);

    const handleSave = async () => {
        if (!currentCompanyId) return;
        if (items.length === 0) {
            alert('Debes agregar al menos un producto.');
            return;
        }

        // Validate stock before saving draft (optional but helpful)
        const hasStockError = items.some(item => {
            const stock = calculateStock(item.product_id);
            return item.quantity > stock;
        });

        if (hasStockError && !window.confirm('Algunos productos no tienen stock suficiente. ¿Deseas guardar el borrador de todas formas? (No podrás confirmarlo después sin stock)')) {
            return;
        }

        setIsSaving(true);
        try {
            const client = clients.find(c => c.id === clientId);

            const dispatchData: Dispatch = {
                id: editingDispatch?.id || crypto.randomUUID(),
                company_id: currentCompanyId,
                number: dispatchNumber,
                date: new Date(date).toISOString(),
                client_id: clientId || null,
                client_name: client?.name || null,
                notes: notes,
                status: 'borrador',
                total_value: totalValue,
                created_at: editingDispatch?.created_at || new Date().toISOString()
            };

            if (editingDispatch) {
                await updateDispatch(dispatchData, items);
            } else {
                await createDispatch(dispatchData, items);
            }
            onClose();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className={`bg-white ${radius['3xl']} w-full max-w-5xl max-h-[90vh] flex flex-col ${shadows.xl} overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200`}>

                {/* Header */}
                <div className={`p-6 border-b ${colors.borderSubtle} flex items-center justify-between bg-slate-50/50`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${radius.xl} bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner`}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingDispatch ? `Editar Despacho ${dispatchNumber}` : 'Nueva Nota de Entrega'}
                            </h2>
                            <p className="text-sm text-slate-500 font-medium">Completa los datos para el registro formal de salida.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 hover:bg-slate-200/50 ${radius.full} text-slate-400 hover:text-slate-600 transition-all`}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">

                    {/* Top Section: Header Data */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <BoxSelect size={16} className="text-indigo-500" /> Número de Documento
                            </label>
                            <input
                                type="text"
                                value={dispatchNumber}
                                readOnly
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-indigo-600 cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Clock size={16} className="text-indigo-500" /> Fecha del Despacho
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className={`w-full px-4 py-3 border border-slate-200 ${radius.xl} focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all`}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <UserPlus size={16} className="text-indigo-500" /> Cliente Destino
                            </label>
                            <select
                                value={clientId}
                                onChange={(e) => setClientId(e.target.value)}
                                className={`w-full px-4 py-3 border border-slate-200 ${radius.xl} focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none bg-white`}
                            >
                                <option value="">Sin Cliente (Venta directa/Mostrador)</option>
                                {clients.filter(c => c.status === 'activo').map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Middle Section: Items Table */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Calculator size={18} className="text-indigo-500" /> Detalle de Productos
                            </h3>
                            <button
                                onClick={handleAddItem}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors text-sm font-bold"
                            >
                                <Plus size={16} /> Agregar Item
                            </button>
                        </div>

                        <div className={`overflow-hidden border border-slate-100 ${radius['2xl']} ${shadows.sm}`}>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider w-1/3">Producto</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Cantidad</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Precio Unit.</th>
                                        <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider text-right">Subtotal</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 overflow-y-visible">
                                    {items.map((item) => {
                                        const stockAvailable = calculateStock(item.product_id);
                                        const isOutOfStock = item.product_id && item.quantity > stockAvailable;

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <select
                                                        value={item.product_id}
                                                        onChange={(e) => handleItemChange(item.id, 'product_id', e.target.value)}
                                                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700"
                                                    >
                                                        <option value="" disabled>Seleccionar producto...</option>
                                                        {products.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                            className={`w-24 px-2 py-1 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all ${isOutOfStock ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200'}`}
                                                        />
                                                        {item.product_id && (
                                                            <span className={`text-[10px] font-bold ${isOutOfStock ? 'text-rose-500' : 'text-slate-400'}`}>
                                                                Disp: {stockAvailable}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1 text-sm font-medium text-slate-500">
                                                        $
                                                        <input
                                                            type="number"
                                                            value={item.unit_price}
                                                            onChange={(e) => handleItemChange(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                            className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all bg-transparent"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="text-sm font-bold text-slate-800">
                                                        ${item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {items.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-10 text-center text-slate-400 italic text-sm">
                                                No hay productos en esta nota de entrega. Haz clic en "Agregar Item".
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bottom Section: Notes & Alerts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Observaciones Internas</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Instrucciones de entrega, referencias adicionales..."
                                    className="w-full h-32 px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none text-sm"
                                />
                            </div>
                            <div className={`p-4 ${radius.xl} bg-amber-50 border border-amber-100 flex gap-3`}>
                                <Info className="text-amber-500 flex-shrink-0" size={20} />
                                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                    Este documento se guardará como **BORRADOR**. Puedes imprimirlo para control,
                                    pero **el stock no se descontará** hasta que confirmes el despacho desde la tabla principal.
                                </p>
                            </div>
                        </div>

                        {/* Order Summary Card */}
                        <div className={`p-6 ${radius['2xl']} bg-slate-50 border border-slate-200 flex flex-col justify-between`}>
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Resumen de Entrega</h4>

                            <div className="space-y-3">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal Productos</span>
                                    <span>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Impuestos Estimados</span>
                                    <span>$0.00</span>
                                </div>
                                <div className="border-t border-slate-200 pt-3 flex justify-between items-end">
                                    <span className="text-lg font-bold text-slate-800">TOTAL</span>
                                    <span className="text-3xl font-black text-indigo-600">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`p-6 border-t ${colors.borderSubtle} bg-slate-50/50 flex justify-end gap-3`}>
                    <button
                        onClick={onClose}
                        className={`px-6 py-3 ${radius.xl} text-slate-500 font-bold hover:bg-slate-200/50 transition-colors`}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`
                            flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white font-bold ${radius.xl} 
                            hover:bg-indigo-700 ${shadows.md} transition-all active:scale-95 disabled:opacity-50
                        `}
                    >
                        <Save size={20} />
                        {isSaving ? 'Guardando...' : (editingDispatch ? 'Actualizar Borrador' : 'Guardar Borrador')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DispatchModal;
