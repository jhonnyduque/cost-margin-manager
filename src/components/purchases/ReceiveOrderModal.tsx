import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Package, AlertTriangle, CheckCircle2, Truck, Ruler
} from 'lucide-react';
import { useStore } from '../../store';
import { PurchaseOrder } from '../../types';
import { colors, radius, shadows, typography } from '@/design/design-tokens';
import { Button } from '@/components/ui/Button';

interface ReceiveOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: PurchaseOrder | null;
}

interface ReceivedItemForm {
    item_id: string;
    raw_material_id: string | null;
    raw_material_name: string;
    unit: string;
    purchase_unit_id: string;
    ordered_quantity: number;
    ordered_unit_price: number;
    received_quantity: number;
    received_unit_price: number;
    width: number | null;        // ancho en cm, solo para telas
    is_textile: boolean;         // flag para mostrar/ocultar campo ancho
}

const ReceiveOrderModal: React.FC<ReceiveOrderModalProps> = ({ isOpen, onClose, order }) => {
    const { receivePurchaseOrder, unitsOfMeasure, rawMaterials } = useStore();

    const [items, setItems] = useState<ReceivedItemForm[]>([]);
    const [isReceiving, setIsReceiving] = useState(false);

    useEffect(() => {
        if (isOpen && order?.items) {
            setItems(order.items.map(item => {
                let purchaseUnitId = '';
                const mat = rawMaterials.find(m => m.id === item.raw_material_id);
                const baseUnit = mat?.base_unit_id ? unitsOfMeasure.find(u => u.id === mat.base_unit_id) : null;

                if (item.notes && unitsOfMeasure.find(u => u.id === item.notes)) {
                    purchaseUnitId = item.notes;
                } else if (baseUnit?.category_id) {
                    const match = unitsOfMeasure.find(u =>
                        u.category_id === baseUnit.category_id && u.symbol === item.unit
                    );
                    purchaseUnitId = match?.id || mat?.purchase_unit_id || mat?.base_unit_id || '';
                } else {
                    purchaseUnitId = mat?.purchase_unit_id || mat?.base_unit_id || '';
                }

                // Detectar si es tela (material dimensional)
                const isTextile = mat?.type === 'Tela' && (mat?.unit === 'metro' || mat?.unit === 'cm');

                return {
                    item_id: item.id,
                    raw_material_id: item.raw_material_id || null,
                    raw_material_name: item.raw_material_name,
                    unit: item.unit,
                    purchase_unit_id: purchaseUnitId,
                    ordered_quantity: item.quantity,
                    ordered_unit_price: item.unit_price,
                    received_quantity: item.quantity,
                    received_unit_price: item.unit_price,
                    width: isTextile ? 140 : null,  // default 140cm para telas
                    is_textile: isTextile,
                };
            }));
        }
    }, [isOpen, order]);

    const handleItemChange = (itemId: string, field: 'received_quantity' | 'received_unit_price' | 'width', value: number) => {
        setItems(prev => prev.map(i => i.item_id === itemId ? { ...i, [field]: value } : i));
    };

    const totalReceived = useMemo(() =>
        items.reduce((sum, i) => sum + (i.received_quantity * i.received_unit_price), 0),
    [items]);

    const hasDifferences = useMemo(() =>
        items.some(i => i.received_quantity !== i.ordered_quantity),
    [items]);

    const handleConfirmReceive = async () => {
        if (!order) return;

        const invalidItems = items.filter(i => i.received_quantity <= 0 || i.received_unit_price <= 0);
        if (invalidItems.length > 0) {
            alert('Todos los ítems deben tener cantidad recibida > 0 y precio > 0.');
            return;
        }

        const textileWithoutWidth = items.filter(i => i.is_textile && (!i.width || i.width <= 0));
        if (textileWithoutWidth.length > 0) {
            alert('Los materiales tipo Tela requieren ancho (cm) para calcular el área.');
            return;
        }

        if (!window.confirm('¿Confirmar recepción? Se crearán los lotes de materia prima automáticamente.')) return;

        setIsReceiving(true);
        try {
            await receivePurchaseOrder(order.id, items.map(i => ({
                item_id: i.item_id,
                received_quantity: i.received_quantity,
                received_unit_price: i.received_unit_price,
                purchase_unit_id: i.purchase_unit_id,
                width: i.width,
            })));
            onClose();
        } catch (err: any) {
            alert(err.message || 'Error al procesar la recepción');
        } finally {
            setIsReceiving(false);
        }
    };

    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 pt-[5vh] overflow-y-auto">
            <div className={`w-full max-w-4xl ${colors.bgSurface} ${radius['2xl']} ${shadows['2xl']} animate-in fade-in zoom-in duration-200 overflow-hidden`}>
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className={`${typography.sectionTitle} flex items-center gap-2`}>
                            <Truck size={20} className="text-emerald-500" />
                            Recepción de Mercancía
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{order.number}</span>
                            {order.supplier_name && (
                                <span className="text-xs font-medium text-slate-500">
                                    Proveedor: <span className="text-slate-700 font-bold">{order.supplier_name}</span>
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
                    {/* Warning Banner */}
                    {hasDifferences && (
                        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-amber-800 font-medium">
                                Las cantidades recibidas difieren de las ordenadas. Se registrarán los valores reales.
                            </p>
                        </div>
                    )}

                    {/* Items */}
                    <div className="space-y-4">
                        {items.map(item => {
                            const subtotal = item.received_quantity * item.received_unit_price;
                            const qtyDiffers = item.received_quantity !== item.ordered_quantity;

                            return (
                                <div key={item.item_id} className={`${colors.bgSurface} ${radius.xl} border ${colors.borderStandard} overflow-hidden`}>
                                    {/* Item Header */}
                                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                                        <Package size={14} className="text-indigo-500" />
                                        <span className="text-sm font-bold text-slate-700">{item.raw_material_name}</span>
                                        <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">{item.unit.toUpperCase()}</span>
                                        {item.is_textile && (
                                            <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <Ruler size={10} /> TELA
                                            </span>
                                        )}
                                    </div>

                                    {/* Item Body */}
                                    <div className="p-4">
                                        <div className={`grid ${item.is_textile ? 'grid-cols-3 md:grid-cols-6' : 'grid-cols-2 md:grid-cols-5'} gap-3`}>
                                            {/* Ordenado */}
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cant. Ordenada</label>
                                                <div className="h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 flex items-center text-sm tabular-nums text-slate-500">
                                                    {item.ordered_quantity} <span className="text-[10px] ml-1 text-slate-400">{item.unit}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">P.U. Ordenado</label>
                                                <div className="h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 flex items-center text-sm tabular-nums text-slate-500">
                                                    ${item.ordered_unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>

                                            {/* Recibido */}
                                            <div>
                                                <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1">Cant. Recibida ({item.unit})</label>
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="any"
                                                    value={item.received_quantity || ''}
                                                    onChange={(e) => handleItemChange(item.item_id, 'received_quantity', parseFloat(e.target.value) || 0)}
                                                    onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                                                    className={`w-full h-9 px-3 rounded-lg bg-white border ${qtyDiffers ? 'border-amber-300 ring-1 ring-amber-200' : 'border-emerald-200'} text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1">P.U. Recibido (/{item.unit})</label>
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="any"
                                                    value={item.received_unit_price || ''}
                                                    onChange={(e) => handleItemChange(item.item_id, 'received_unit_price', parseFloat(e.target.value) || 0)}
                                                    onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                                                    className="w-full h-9 px-3 rounded-lg bg-white border border-emerald-200 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                                />
                                            </div>

                                            {/* Ancho — solo para telas */}
                                            {item.is_textile && (
                                                <div>
                                                    <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1 flex items-center gap-1">
                                                        <Ruler size={10} /> Ancho (cm)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        value={item.width || ''}
                                                        onChange={(e) => handleItemChange(item.item_id, 'width', parseInt(e.target.value) || 0)}
                                                        onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                                                        placeholder="140"
                                                        className="w-full h-9 px-3 rounded-lg bg-white border border-emerald-200 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-emerald-700 font-bold"
                                                    />
                                                </div>
                                            )}

                                            {/* Subtotal */}
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Subtotal</label>
                                                <div className="h-9 px-3 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center text-sm font-bold text-indigo-700 tabular-nums">
                                                    ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Total Summary */}
                    <div className={`p-4 ${radius.xl} bg-indigo-50/50 border border-indigo-100 flex items-center justify-between`}>
                        <span className="text-sm font-bold text-indigo-800 uppercase">Total Recibido</span>
                        <span className="text-xl font-black text-indigo-700 tabular-nums">
                            ${totalReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isReceiving}>
                        CANCELAR
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirmReceive}
                        isLoading={isReceiving}
                        icon={<CheckCircle2 size={18} />}
                    >
                        CONFIRMAR RECEPCIÓN
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ReceiveOrderModal;
