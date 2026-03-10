import React, { useState, useEffect } from 'react';
import {
    X, Save, Building2, Mail, Phone, MapPin, Hash,
    CreditCard, FileText, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useStore } from '../../store';
import { Supplier } from '../../types';
import { colors, radius, spacing, shadows, typography } from '@/design/design-tokens';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

interface SupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingSupplier?: Supplier | null;
}

const SupplierModal: React.FC<SupplierModalProps> = ({ isOpen, onClose, editingSupplier }) => {
    const { addSupplier, updateSupplier } = useStore();

    const [formData, setFormData] = useState<Partial<Supplier>>({
        name: '',
        tax_id: '',
        status: 'activo',
        email: '',
        phone: '',
        address: '',
        payment_terms_days: 0,
        notes: ''
    });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (editingSupplier) {
            setFormData({ ...editingSupplier });
        } else {
            setFormData({
                name: '',
                tax_id: '',
                status: 'activo',
                email: '',
                phone: '',
                address: '',
                payment_terms_days: 0,
                notes: ''
            });
        }
    }, [editingSupplier, isOpen]);

    const handleSave = async () => {
        if (!formData.name?.trim()) {
            alert('El nombre es obligatorio');
            return;
        }

        setIsSaving(true);
        try {
            if (editingSupplier) {
                await updateSupplier(editingSupplier.id, formData);
            } else {
                await addSupplier({
                    ...formData as Omit<Supplier, 'id' | 'created_at' | 'updated_at'>
                });
            }
            onClose();
        } catch (error: any) {
            alert(error.message || 'Error al guardar el proveedor');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
                {/* Header */}
                <div className={`flex items-center justify-between ${spacing.pxLg} ${spacing.pyMd} border-b border-slate-100 bg-slate-50/50`}>
                    <h3 className={`${typography.sectionTitle} flex items-center gap-2`}>
                        <Building2 size={20} className="text-indigo-500" />
                        {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={24} />
                    </button>
                </div>

                <div className={`${spacing.pLg} space-y-6 max-h-[70vh] overflow-y-auto`}>
                    {/* Sección 1: Identificación */}
                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Identificación</p>
                        <div>
                            <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Razón Social o Nombre *</label>
                            <Input
                                placeholder="Ej: Aceros Industriales S.A."
                                className="font-bold h-11"
                                value={formData.name || ''}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>RUT o Tax ID</label>
                                <Input
                                    placeholder="Ej: 76.123.456-K"
                                    icon={<Hash size={16} />}
                                    value={formData.tax_id || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, tax_id: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Estado</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                                    className={`w-full h-11 px-4 border border-slate-200 rounded-xl ${typography.text.body} focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-white`}
                                >
                                    <option value="activo">Activo</option>
                                    <option value="inactivo">Inactivo</option>
                                    <option value="bloqueado">Bloqueado</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Sección 2: Contacto */}
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Contacto</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Correo Electrónico</label>
                                <Input
                                    placeholder="contacto@proveedor.com"
                                    type="email"
                                    icon={<Mail size={16} />}
                                    value={formData.email || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Teléfono</label>
                                <Input
                                    placeholder="+56 9..."
                                    icon={<Phone size={16} />}
                                    value={formData.phone || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Dirección Completa</label>
                            <Input
                                placeholder="Calle Industrial 123, Bodega 4..."
                                icon={<MapPin size={16} />}
                                value={formData.address || ''}
                                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Sección 3: Condiciones comerciales */}
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Condiciones Comerciales</p>
                        <div>
                            <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Plazo de pago (días)</label>
                            <Input
                                type="number"
                                placeholder="Ej: 30"
                                icon={<CreditCard size={16} />}
                                value={formData.payment_terms_days?.toString() || ''}
                                onChange={e => setFormData(prev => ({ ...prev, payment_terms_days: parseInt(e.target.value) || 0 }))}
                            />
                        </div>
                        <div>
                            <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Notas</label>
                            <textarea
                                rows={3}
                                className={`w-full p-3 rounded-xl border border-slate-200 bg-slate-50 ${typography.text.body} focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none resize-none transition-all`}
                                placeholder="Condiciones especiales, horarios de entrega, etc."
                                value={formData.notes || ''}
                                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`${spacing.pxLg} ${spacing.pyLg} bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3`}>
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                        CANCELAR
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={isSaving}
                        icon={<CheckCircle2 size={18} />}
                    >
                        {editingSupplier ? 'GUARDAR CAMBIOS' : 'CREAR PROVEEDOR'}
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default SupplierModal;
