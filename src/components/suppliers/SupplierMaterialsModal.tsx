import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Package, CheckCircle2, Link2 } from 'lucide-react';
import { useStore } from '../../store';
import { Supplier } from '../../types';
import { colors, radius, spacing, typography } from '@/design/design-tokens';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface SupplierMaterialsModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplier: Supplier;
}

const SupplierMaterialsModal: React.FC<SupplierMaterialsModalProps> = ({ isOpen, onClose, supplier }) => {
    const { rawMaterials, supplierMaterials, syncSupplierMaterials, unitsOfMeasure } = useStore();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Cargar relaciones actuales al abrir
    useEffect(() => {
        if (isOpen && supplier) {
            const currentLinks = supplierMaterials
                .filter(sm => sm.supplier_id === supplier.id)
                .map(sm => sm.raw_material_id);
            setSelectedIds(currentLinks);
            setSearchTerm('');
        }
    }, [isOpen, supplier.id, supplierMaterials]);

    const filteredMaterials = useMemo(() => {
        return rawMaterials.filter(m => 
            !m.deleted_at && 
            m.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [rawMaterials, searchTerm]);

    const toggleMaterial = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await syncSupplierMaterials(supplier.id, selectedIds);
            onClose();
        } catch (error: any) {
            alert(error.message || 'Error al sincronizar materiales');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <Card className="max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className={`p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50`}>
                    <div>
                        <h3 className={`${typography.sectionTitle} flex items-center gap-2`}>
                            <Link2 size={20} className="text-indigo-500" />
                            Vincular Materias Primas
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-1">Proveedor: <span className="text-indigo-600 font-bold">{supplier.name}</span></p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={24} />
                    </button>
                </div>

                {/* Search & Counter */}
                <div className="p-4 border-b border-slate-50 space-y-3">
                    <div className="relative group">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar materia prima..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {selectedIds.length} seleccionadas
                        </span>
                        {selectedIds.length > 0 && (
                            <button 
                                onClick={() => setSelectedIds([])}
                                className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase"
                            >
                                Limpiar todo
                            </button>
                        )}
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto max-h-[50vh] divide-y divide-slate-100">
                    {filteredMaterials.length === 0 ? (
                        <div className="p-12 text-center">
                            <Package size={32} className="text-slate-200 mx-auto mb-3" />
                            <p className="text-sm text-slate-400">Sin materias que coincidan</p>
                        </div>
                    ) : (
                        filteredMaterials.map((material) => {
                            const isSelected = selectedIds.includes(material.id);
                            const baseUnit = unitsOfMeasure.find(u => u.id === material.base_unit_id);
                            
                            return (
                                <div 
                                    key={material.id}
                                    onClick={() => toggleMaterial(material.id)}
                                    className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                                >
                                    <div className={`size-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                        {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                    </div>
                                    <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold border border-slate-200">
                                        {material.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                            {material.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium uppercase">
                                            {baseUnit?.name || 'Unidad'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
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
                        icon={<CheckCircle2 size={18} />}
                    >
                        GUARDAR VÍNCULOS
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default SupplierMaterialsModal;
