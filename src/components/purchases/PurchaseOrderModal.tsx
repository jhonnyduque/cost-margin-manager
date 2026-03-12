import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Plus, Trash2, Save, Package, ShoppingCart, AlertCircle
} from 'lucide-react';
import { useStore } from '../../store';
import { PurchaseOrder, PurchaseOrderItem } from '../../types';
import { colors, radius, spacing, shadows, typography } from '@/design/design-tokens';
import { Button } from '@/components/ui/Button';

interface PurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingOrder: PurchaseOrder | null;
}

interface LocalItem {
    id: string;
    raw_material_id: string;
    raw_material_name: string;
    quantity: number;
    unit_price: number;
    unit: string;           // símbolo de la unidad seleccionada (ej: "m", "kg")
    purchase_unit_id: string; // ID de la unidad seleccionada para compra
    notes: string;
}

const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({ isOpen, onClose, editingOrder }) => {
    const {
        rawMaterials, suppliers, unitsOfMeasure,
        addPurchaseOrder, updatePurchaseOrder
    } = useStore();

    // Form state
    const [supplierId, setSupplierId] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [expectedDate, setExpectedDate] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<LocalItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const activeSuppliers = useMemo(() => suppliers.filter(s => s.status === 'activo'), [suppliers]);
    const activeMaterials = useMemo(() => rawMaterials.filter(m => !m.deleted_at), [rawMaterials]);

    // Obtener unidades compatibles (misma categoría UoM) para un material dado
    const getCompatibleUnits = (materialId: string) => {
        const mat = activeMaterials.find(m => m.id === materialId);
        if (!mat?.base_unit_id) return [];
        const baseUnit = unitsOfMeasure.find(u => u.id === mat.base_unit_id);
        if (!baseUnit?.category_id) return [];
        return unitsOfMeasure
            .filter(u => u.category_id === baseUnit.category_id)
            .sort((a, b) => b.conversion_factor - a.conversion_factor); // Mayores primero (m > cm)
    };

    // Load initial data
    useEffect(() => {
        if (!isOpen) return;

        if (editingOrder) {
            setSupplierId(editingOrder.supplier_id || '');
            setSupplierName(editingOrder.supplier_name || '');
            setDate(editingOrder.date);
            setExpectedDate(editingOrder.expected_date || '');
            setNotes(editingOrder.notes || '');
            setItems(
                (editingOrder.items || []).map(item => {
                    // Encontrar unit_id a partir del símbolo + categoría del material
                    const mat = activeMaterials.find(m => m.id === item.raw_material_id);
                    const baseUnit = mat?.base_unit_id ? unitsOfMeasure.find(u => u.id === mat.base_unit_id) : null;
                    const matchingUnit = baseUnit?.category_id
                        ? unitsOfMeasure.find(u => u.category_id === baseUnit.category_id && u.symbol === item.unit)
                        : null;

                    return {
                        id: item.id,
                        raw_material_id: item.raw_material_id || '',
                        raw_material_name: item.raw_material_name,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        unit: item.unit,
                        purchase_unit_id: matchingUnit?.id || mat?.purchase_unit_id || mat?.base_unit_id || '',
                        notes: item.notes || '',
                    };
                })
            );
        } else {
            setSupplierId('');
            setSupplierName('');
            setDate(new Date().toISOString().split('T')[0]);
            setExpectedDate('');
            setNotes('');
            setItems([]);
        }
    }, [isOpen, editingOrder]);

    const handleSupplierChange = (id: string) => {
        setSupplierId(id);
        const supplier = suppliers.find(s => s.id === id);
        setSupplierName(supplier?.name || '');
    };

    const handleAddItem = () => {
        setItems([...items, {
            id: crypto.randomUUID(),
            raw_material_id: '',
            raw_material_name: '',
            quantity: 0,
            unit_price: 0,
            unit: '',
            purchase_unit_id: '',
            notes: '',
        }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const handleItemChange = (id: string, field: keyof LocalItem, value: any) => {
        setItems(items.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, [field]: value };

            if (field === 'raw_material_id') {
                const mat = activeMaterials.find(m => m.id === value);
                if (mat) {
                    updated.raw_material_name = mat.name;
                    // Auto-seleccionar la unidad: purchase_unit > base_unit
                    const defaultUnitId = mat.purchase_unit_id || mat.base_unit_id;
                    const defaultUnit = unitsOfMeasure.find(u => u.id === defaultUnitId);
                    updated.purchase_unit_id = defaultUnitId || '';
                    updated.unit = defaultUnit?.symbol || 'und';
                }
            }

            if (field === 'purchase_unit_id') {
                const selectedUnit = unitsOfMeasure.find(u => u.id === value);
                updated.unit = selectedUnit?.symbol || 'und';
            }

            return updated;
        }));
    };

    const totalValue = useMemo(() => items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0), [items]);

    const handleSave = async () => {
        if (items.length === 0) { alert('Debes agregar al menos un ítem.'); return; }
        const invalidItems = items.filter(i => !i.raw_material_id || i.quantity <= 0 || i.unit_price <= 0);
        if (invalidItems.length > 0) { alert('Cada ítem debe tener materia prima, cantidad > 0 y precio > 0.'); return; }

        setIsSaving(true);
        try {
            const orderData = {
                supplier_id: supplierId || null,
                supplier_name: supplierName || null,
                date,
                expected_date: expectedDate || null,
                notes: notes || null,
                status: 'borrador' as const,
                number: '',
                company_id: '',
            };

            const itemsData = items.map(i => ({
                raw_material_id: i.raw_material_id || null,
                raw_material_name: i.raw_material_name,
                quantity: i.quantity,
                unit_price: i.unit_price,
                unit: i.unit,
                notes: i.purchase_unit_id || null, // Guardar unit_id en notes como fallback robusto
                purchase_order_id: '',
                company_id: '',
            }));

            if (editingOrder) {
                await updatePurchaseOrder(editingOrder.id, {
                    supplier_id: supplierId || null,
                    supplier_name: supplierName || null,
                    date,
                    expected_date: expectedDate || null,
                    notes: notes || null,
                });
            } else {
                await addPurchaseOrder(orderData, itemsData);
            }
            onClose();
        } catch (err: any) {
            alert(err.message || 'Error al guardar la orden');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 pt-[5vh] overflow-y-auto">
            <div className={`w-full max-w-3xl ${colors.bgSurface} ${radius['2xl']} ${shadows['2xl']} animate-in fade-in zoom-in duration-200 overflow-hidden`}>
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className={`${typography.sectionTitle} flex items-center gap-2`}>
                            <ShoppingCart size={20} className="text-slate-500" />
                            {editingOrder ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
                        </h3>
                        {editingOrder && (
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                Editando: <span className="text-slate-700 font-bold font-mono">{editingOrder.number}</span>
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Section 1: Header Fields */}
                    <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Datos de la Orden</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Proveedor</label>
                                <select
                                    value={supplierId}
                                    onChange={(e) => handleSupplierChange(e.target.value)}
                                    className={`w-full h-11 px-4 ${radius.xl} bg-slate-50 border ${colors.borderStandard} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm text-slate-700`}
                                >
                                    <option value="">Sin proveedor</option>
                                    {activeSuppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className={`w-full h-11 px-4 ${radius.xl} bg-slate-50 border ${colors.borderStandard} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm text-slate-700`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha Esperada</label>
                                <input
                                    type="date"
                                    value={expectedDate}
                                    onChange={(e) => setExpectedDate(e.target.value)}
                                    className={`w-full h-11 px-4 ${radius.xl} bg-slate-50 border ${colors.borderStandard} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm text-slate-700`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Notas internas..."
                                    rows={2}
                                    className={`w-full px-4 py-2.5 ${radius.xl} bg-slate-50 border ${colors.borderStandard} focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm text-slate-700 resize-none`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Items */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Ítems de la Orden</h4>
                            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={handleAddItem}>
                                AGREGAR ÍTEM
                            </Button>
                        </div>

                        {items.length === 0 ? (
                            <div className={`text-center p-10 ${radius.xl} border border-dashed ${colors.borderStandard} bg-slate-50/50`}>
                                <Package size={32} className="text-slate-200 mx-auto mb-3" />
                                <p className="text-sm text-slate-400">Agrega al menos un ítem para crear la orden.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {items.map((item, index) => {
                                    const compatibleUnits = getCompatibleUnits(item.raw_material_id);
                                    const selectedUnit = unitsOfMeasure.find(u => u.id === item.purchase_unit_id);

                                    return (
                                        <div key={item.id} className={`p-4 ${colors.bgSurface} ${radius.xl} border ${colors.borderSubtle} relative group`}>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-[10px] font-black text-slate-500 bg-slate-100 size-6 rounded-full flex items-center justify-center">
                                                    {index + 1}
                                                </span>
                                                <span className="text-xs font-bold text-slate-400 uppercase flex-1">
                                                    {item.raw_material_name || 'Nuevo Ítem'}
                                                    {item.unit && <span className="ml-2 text-[10px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{item.unit.toUpperCase()}</span>}
                                                </span>
                                                <button
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                {/* Materia Prima */}
                                                <div className="col-span-2 md:col-span-1">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Materia Prima</label>
                                                    <select
                                                        value={item.raw_material_id}
                                                        onChange={(e) => handleItemChange(item.id, 'raw_material_id', e.target.value)}
                                                        className={`w-full h-9 px-3 rounded-lg bg-slate-50 border ${colors.borderStandard} text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {activeMaterials.map(m => (
                                                            <option key={m.id} value={m.id}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Unidad de Compra */}
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unidad</label>
                                                    <select
                                                        value={item.purchase_unit_id}
                                                        onChange={(e) => handleItemChange(item.id, 'purchase_unit_id', e.target.value)}
                                                        disabled={compatibleUnits.length === 0}
                                                        className={`w-full h-9 px-3 rounded-lg bg-slate-50 border ${colors.borderStandard} text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${compatibleUnits.length === 0 ? 'opacity-50' : ''}`}
                                                    >
                                                        {compatibleUnits.length === 0 ? (
                                                            <option value="">{item.unit || '—'}</option>
                                                        ) : (
                                                            compatibleUnits.map(u => (
                                                                <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                                                            ))
                                                        )}
                                                    </select>
                                                </div>

                                                {/* Cantidad */}
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                        Cant. {selectedUnit && <span className="text-slate-500">({selectedUnit.symbol})</span>}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="any"
                                                        value={item.quantity || ''}
                                                        onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                        onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                                                        placeholder="0"
                                                        className={`w-full h-9 px-3 rounded-lg bg-slate-50 border ${colors.borderStandard} text-sm tabular-nums outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                                                    />
                                                </div>

                                                {/* Precio Unitario */}
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                        P.U. {selectedUnit && <span className="text-slate-500">(/{selectedUnit.symbol})</span>}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="any"
                                                        value={item.unit_price || ''}
                                                        onChange={(e) => handleItemChange(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                        onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                                                        placeholder="0"
                                                        className={`w-full h-9 px-3 rounded-lg bg-slate-50 border ${colors.borderStandard} text-sm tabular-nums outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                                                    />
                                                </div>

                                                {/* Subtotal */}
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Subtotal</label>
                                                    <div className="h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 flex items-center text-sm font-bold text-slate-700 tabular-nums">
                                                        ${(item.quantity * item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Section 3: Summary */}
                    {items.length > 0 && (
                        <div className={`p-4 ${radius.xl} bg-slate-50 border border-slate-200 flex items-center justify-between`}>
                            <span className="text-sm font-bold text-slate-800 uppercase">Total de la Orden</span>
                            <span className="text-xl font-black text-slate-800 tabular-nums">
                                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                        CANCELAR
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={isSaving}
                        icon={<Save size={18} />}
                    >
                        {editingOrder ? 'GUARDAR CAMBIOS' : 'CREAR ORDEN'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PurchaseOrderModal;
