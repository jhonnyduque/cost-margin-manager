import React, { useState, useMemo } from 'react';
import {
    Search, Plus, Building2, Phone, Mail, MapPin,
    ChevronDown, ChevronUp, Filter, Printer,
    CreditCard, Clock, Package, AlertCircle, Edit2, Archive, Ban,
    CheckCircle2, FileText, Link2
} from 'lucide-react';
import { useStore } from '../store';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Supplier } from '@/types';
import SupplierModal from '@/components/suppliers/SupplierModal';
import SupplierMaterialsModal from '@/components/suppliers/SupplierMaterialsModal';

const statusConfig = {
    activo: { label: 'Activo', class: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    inactivo: { label: 'Inactivo', class: 'text-slate-600 bg-slate-50 border-slate-200' },
    bloqueado: { label: 'Bloqueado', class: 'text-red-700 bg-red-50 border-red-200' },
};

export default function Suppliers() {
    const { suppliers, supplierMaterials, rawMaterials, archiveSupplier } = useStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'inactivo' | 'bloqueado'>('all');
    const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [materialsModalSupplier, setMaterialsModalSupplier] = useState<Supplier | null>(null);

    const stats = useMemo(() => {
        const active = suppliers.filter(s => s.status === 'activo').length;
        const withMaterials = new Set(supplierMaterials.map(sm => sm.supplier_id)).size;
        const withCredit = suppliers.filter(s => (s.payment_terms_days || 0) > 0).length;
        return { active, withMaterials, withCredit };
    }, [suppliers, supplierMaterials]);

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => {
            const matchesSearch =
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (s.tax_id && s.tax_id.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [suppliers, searchTerm, statusFilter]);

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setModalOpen(true);
    };

    const handleNewSupplier = () => {
        setEditingSupplier(null);
        setModalOpen(true);
    };

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Proveedores"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Proveedores</span>
                        </>
                    }
                    metadata={[
                        <span key="1" className="flex items-center gap-1">
                            <Building2 size={14} className="text-emerald-500" />
                            {stats.active} activos
                        </span>,
                        <span key="2" className="flex items-center gap-1">
                            <Package size={14} className="text-indigo-500" />
                            {stats.withMaterials} con materiales
                        </span>,
                        <span key="3" className="flex items-center gap-1">
                            <CreditCard size={14} className="text-amber-500" />
                            {stats.withCredit} con crédito
                        </span>
                    ]}
                    actions={
                        <div className="flex items-center gap-3">
                            <Button variant="secondary" icon={<Printer size={16} />} className="hidden sm:flex">
                                EXPORTAR
                            </Button>
                            <Button variant="primary" onClick={handleNewSupplier} icon={<Plus size={16} />}>
                                NUEVO PROVEEDOR
                            </Button>
                        </div>
                    }
                />

                <div className="flex flex-col sm:flex-row items-center gap-4 mt-8">
                    <div className="relative flex-1 group w-full">
                        <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${colors.textMuted} group-focus-within:text-indigo-500 transition-colors`} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, email o identificación..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full h-11 pl-11 pr-4 bg-white border border-slate-200 rounded-xl ${typography.text.body} transition-all focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none`}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter size={16} className="text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className={`h-11 px-4 bg-white border border-slate-200 rounded-xl ${typography.text.body} focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none min-w-[140px] appearance-none`}
                        >
                            <option value="all">Todos los estados</option>
                            <option value="activo">Activos</option>
                            <option value="inactivo">Inactivos</option>
                            <option value="bloqueado">Bloqueados</option>
                        </select>
                    </div>
                </div>
            </SectionBlock>

            <Card noPadding className="mt-6 overflow-hidden border-slate-200 shadow-sm">
                {filteredSuppliers.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="h-20 w-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Building2 size={40} />
                        </div>
                        <h3 className={`${typography.sectionTitle} text-slate-900 mb-2`}>Sin proveedores registrados</h3>
                        <p className="text-slate-500 text-sm max-w-sm mx-auto">
                            {searchTerm ? 'Prueba con otros términos de búsqueda.' : 'Inicia registrando tu primer proveedor para gestionar tus compras.'}
                        </p>
                        {!searchTerm && (
                            <Button variant="primary" className="mt-6" onClick={handleNewSupplier} icon={<Plus size={18} />}>
                                AGREGAR PROVEEDOR
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className={`bg-slate-50/80 border-b border-slate-100 ${typography.text.caption} text-slate-500 font-bold uppercase`}>
                                    <th className="px-6 py-4">Proveedor</th>
                                    <th className="px-6 py-4">Contacto</th>
                                    <th className="px-6 py-4">Dirección</th>
                                    <th className="px-6 py-4">Plazo Pago</th>
                                    <th className="px-6 py-4">Mat. Vinculadas</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredSuppliers.map((supplier) => {
                                    const isExpanded = expandedSupplierId === supplier.id;
                                    const linkedMaterials = rawMaterials.filter(rm =>
                                        supplierMaterials.some(sm => sm.supplier_id === supplier.id && sm.raw_material_id === rm.id)
                                    );
                                    const status = statusConfig[supplier.status] || statusConfig.inactivo;

                                    return (
                                        <React.Fragment key={supplier.id}>
                                            <tr
                                                className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                                                onClick={() => setExpandedSupplierId(isExpanded ? null : supplier.id)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold border border-slate-200 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                            {supplier.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className={`${typography.text.body} font-black ${colors.textPrimary}`}>{supplier.name}</p>
                                                            <p className={`${typography.text.micro} text-slate-400 font-mono`}>{supplier.tax_id || 'Sin ID fiscal'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        {supplier.email && (
                                                            <div className="flex items-center gap-1.5">
                                                                <Mail size={12} className="text-slate-300" />
                                                                <span className={typography.text.caption}>{supplier.email}</span>
                                                            </div>
                                                        )}
                                                        {supplier.phone && (
                                                            <div className="flex items-center gap-1.5">
                                                                <Phone size={12} className="text-slate-300" />
                                                                <span className={typography.text.caption}>{supplier.phone}</span>
                                                            </div>
                                                        )}
                                                        {!supplier.email && !supplier.phone && (
                                                            <span className="text-xs text-slate-300">Sin contacto</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5 text-slate-500">
                                                        <MapPin size={12} className="flex-shrink-0" />
                                                        <span className={`${typography.text.caption} truncate max-w-[150px]`}>{supplier.address || '—'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {(supplier.payment_terms_days || 0) > 0 ? (
                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 w-fit">
                                                            <Clock size={12} />
                                                            <span className="text-[10px] font-black uppercase text-amber-700">{supplier.payment_terms_days} DÍAS</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Contado</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={linkedMaterials.length > 0 ? 'info' : 'neutral'}>
                                                        {linkedMaterials.length} MATS
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${status.class}`}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end">
                                                        <div className={`p-2 rounded-lg ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 group-hover:text-slate-500'}`}>
                                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan={7} className="p-0 border-b border-indigo-100">
                                                        <div className="px-8 py-6 animate-in slide-in-from-top-2 duration-200">
                                                            <div className="flex items-center gap-3 mb-6">
                                                                <Button variant="secondary" size="sm" icon={<Edit2 size={14} />} onClick={(e) => { e.stopPropagation(); handleEdit(supplier); }}>
                                                                    EDITAR
                                                                </Button>
                                                                <Button
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    icon={<Link2 size={14} />}
                                                                    onClick={(e) => { e.stopPropagation(); setMaterialsModalSupplier(supplier); }}
                                                                >
                                                                    VINCULAR MATERIAS
                                                                </Button>
                                                                {supplier.status === 'activo' && (
                                                                    <Button variant="ghost" size="sm" icon={<Archive size={14} />} onClick={(e) => { e.stopPropagation(); archiveSupplier(supplier.id, 'inactivo'); }}>
                                                                        DESACTIVAR
                                                                    </Button>
                                                                )}
                                                                {supplier.status === 'inactivo' && (
                                                                    <Button variant="ghost" size="sm" icon={<CheckCircle2 size={14} />} onClick={(e) => { e.stopPropagation(); archiveSupplier(supplier.id, 'activo'); }}>
                                                                        ACTIVAR
                                                                    </Button>
                                                                )}
                                                                {supplier.status !== 'bloqueado' && (
                                                                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" icon={<Ban size={14} />} onClick={(e) => { e.stopPropagation(); archiveSupplier(supplier.id, 'bloqueado'); }}>
                                                                        BLOQUEAR
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <FileText size={14} className="text-slate-400" />
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notas Internas</p>
                                                                    </div>
                                                                    <p className="text-sm text-slate-600 leading-relaxed">
                                                                        {supplier.notes || 'Sin notas adicionales para este proveedor.'}
                                                                    </p>
                                                                </div>

                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <Package size={14} className="text-slate-400" />
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                            Materias Primas Vinculadas
                                                                        </p>
                                                                    </div>
                                                                    {linkedMaterials.length === 0 ? (
                                                                        <div className="flex items-center gap-2 p-4 bg-white rounded-xl border border-slate-100 border-dashed">
                                                                            <AlertCircle size={14} className="text-slate-300" />
                                                                            <p className="text-sm text-slate-400">Sin materias vinculadas actualmente.</p>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {linkedMaterials.map(m => (
                                                                                <span key={m.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 shadow-sm">
                                                                                    <div className="size-1.5 rounded-full bg-indigo-400" />
                                                                                    {m.name}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
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
            </Card>

            <SupplierModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                editingSupplier={editingSupplier}
            />

            {materialsModalSupplier && (
                <SupplierMaterialsModal
                    isOpen={!!materialsModalSupplier}
                    onClose={() => setMaterialsModalSupplier(null)}
                    supplier={materialsModalSupplier}
                />
            )}
        </PageContainer>
    );
}