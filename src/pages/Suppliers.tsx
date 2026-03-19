import React, { useState, useMemo } from 'react';
import {
    Search, Plus, Building2, Phone, Mail, MapPin,
    ChevronDown, ChevronUp, Printer, CreditCard, Clock,
    Package, AlertCircle, Edit2, Archive, Ban, CheckCircle2,
    FileText, Link2,
} from 'lucide-react';
import { useStore } from '../store';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Supplier } from '@/types';
import SupplierModal from '@/components/suppliers/SupplierModal';
import SupplierMaterialsModal from '@/components/suppliers/SupplierMaterialsModal';

const statusConfig = {
    activo: { label: 'Activo', variant: 'success' as const },
    inactivo: { label: 'Inactivo', variant: 'neutral' as const },
    bloqueado: { label: 'Bloqueado', variant: 'danger' as const },
};

export default function Suppliers() {
    const { suppliers, supplierMaterials, rawMaterials, archiveSupplier } = useStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'inactivo' | 'bloqueado'>('all');
    const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [materialsModalSupplier, setMaterialsModalSupplier] = useState<Supplier | null>(null);

    const stats = useMemo(() => ({
        active: suppliers.filter(s => s.status === 'activo').length,
        withMaterials: new Set(supplierMaterials.map(sm => sm.supplier_id)).size,
        withCredit: suppliers.filter(s => (s.payment_terms_days || 0) > 0).length,
    }), [suppliers, supplierMaterials]);

    const filteredSuppliers = useMemo(() => suppliers.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase())) || (s.tax_id && s.tax_id.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchesSearch && matchesStatus;
    }), [suppliers, searchTerm, statusFilter]);

    const handleEdit = (supplier: Supplier) => { setEditingSupplier(supplier); setModalOpen(true); };
    const handleNewSupplier = () => { setEditingSupplier(null); setModalOpen(true); };

    const exportToCSV = () => {
        if (filteredSuppliers.length === 0) return;
        const escape = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const headers = ['Proveedor', 'ID Fiscal', 'Email', 'Telefono', 'Direccion', 'Plazo Pago', 'Materias Vinculadas', 'Cantidad Materias', 'Estado', 'Notas'];
        const rows = filteredSuppliers.map(s => {
            const linked = rawMaterials.filter(rm => supplierMaterials.some(sm => sm.supplier_id === s.id && sm.raw_material_id === rm.id));
            return [s.name || '', s.tax_id || '', s.email || '', s.phone || '', s.address || '', (s.payment_terms_days || 0) > 0 ? `${s.payment_terms_days} días` : 'Contado', linked.map(m => m.name).join(', '), linked.length, s.status || '', s.notes || ''];
        });
        const csv = [headers.map(escape).join(';'), ...rows.map(r => r.map(escape).join(';'))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `proveedores-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
    };

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Proveedores"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Proveedores</span></>}
                    metadata={[
                        <span key="1" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)' }}><Building2 size={14} style={{ color: 'var(--text-muted)' }} />{stats.active} activos</span>,
                        <span key="2" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)' }}><Package size={14} style={{ color: 'var(--text-muted)' }} />{stats.withMaterials} con materiales</span>,
                        <span key="3" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)' }}><CreditCard size={14} style={{ color: 'var(--text-muted)' }} />{stats.withCredit} con crédito</span>,
                    ]}
                    actions={<>
                        <Button variant="secondary" icon={<Printer size={16} />} onClick={exportToCSV}>EXPORTAR</Button>
                        <Button variant="primary" onClick={handleNewSupplier} icon={<Plus size={16} />}>NUEVO PROVEEDOR</Button>
                    </>}
                />

                <div style={{ marginTop: 'var(--space-32)', borderTop: 'var(--border-default)', paddingTop: 'var(--space-32)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 14rem', gap: 'var(--space-12)', alignItems: 'center' }}>
                        <div style={{ position: 'relative', minWidth: 0 }}>
                            <Search size={18} style={{ position: 'absolute', left: 'var(--space-16)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="text" placeholder="Buscar por nombre, email o identificación..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input" style={{ paddingLeft: 'var(--space-48)', width: '100%' }} />
                        </div>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="input" style={{ width: '100%' }}>
                            <option value="all">Todos los estados</option>
                            <option value="activo">Activos</option>
                            <option value="inactivo">Inactivos</option>
                            <option value="bloqueado">Bloqueados</option>
                        </select>
                    </div>
                </div>
            </SectionBlock>

            <Card style={{ marginTop: 'var(--space-24)', padding: 0, overflow: 'hidden' }}>
                {filteredSuppliers.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--space-48)' }}>
                        <div className="empty-state-icon"><Building2 size={40} /></div>
                        <h3 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 700, color: 'var(--text-primary)' }}>Sin proveedores registrados</h3>
                        <p className="text-small text-muted" style={{ maxWidth: '28rem' }}>
                            {searchTerm ? 'Prueba con otros términos.' : 'Registra tu primer proveedor para gestionar tus compras.'}
                        </p>
                        {!searchTerm && <Button variant="primary" style={{ marginTop: 'var(--space-24)' }} onClick={handleNewSupplier} icon={<Plus size={18} />}>AGREGAR PROVEEDOR</Button>}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Proveedor</th>
                                    <th>Contacto</th>
                                    <th>Dirección</th>
                                    <th>Plazo Pago</th>
                                    <th>Mat. Vinculadas</th>
                                    <th>Estado</th>
                                    <th className="align-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSuppliers.map(supplier => {
                                    const isExpanded = expandedSupplierId === supplier.id;
                                    const linkedMaterials = rawMaterials.filter(rm => supplierMaterials.some(sm => sm.supplier_id === supplier.id && sm.raw_material_id === rm.id));
                                    const status = statusConfig[supplier.status] || statusConfig.inactivo;

                                    return (
                                        <React.Fragment key={supplier.id}>
                                            <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedSupplierId(isExpanded ? null : supplier.id)}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                                                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-muted)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, border: 'var(--border-default)', flexShrink: 0 }}>
                                                            {supplier.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{supplier.name}</p>
                                                            <p className="font-mono text-small text-muted" style={{ fontWeight: 700 }}>{supplier.tax_id || 'Sin ID fiscal'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                                        {supplier.email && <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}><Mail size={12} style={{ color: 'var(--text-muted)' }} /><span className="text-small text-secondary">{supplier.email}</span></div>}
                                                        {supplier.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}><Phone size={12} style={{ color: 'var(--text-muted)' }} /><span className="text-small text-secondary">{supplier.phone}</span></div>}
                                                        {!supplier.email && !supplier.phone && <span className="text-small text-muted">Sin contacto</span>}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                                                        <MapPin size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                                                        <span className="text-small text-secondary" style={{ display: 'inline-block', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{supplier.address || '—'}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {(supplier.payment_terms_days || 0) > 0 ? (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                                                            <Clock size={12} />
                                                            <span className="text-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>{supplier.payment_terms_days} días</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contado</span>
                                                    )}
                                                </td>
                                                <td><Badge variant={linkedMaterials.length > 0 ? 'info' : 'neutral'}>{linkedMaterials.length} MATS</Badge></td>
                                                <td><Badge variant={status.variant}>{status.label}</Badge></td>
                                                <td className="align-right">
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                                        <div style={{ padding: 'var(--space-8)', borderRadius: 'var(--radius-md)', background: isExpanded ? 'var(--surface-muted)' : 'transparent', color: isExpanded ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr style={{ background: 'var(--surface-page)' }}>
                                                    <td colSpan={7} style={{ padding: 0, borderTop: 'var(--border-default)' }}>
                                                        <div style={{ padding: 'var(--space-32)' }}>
                                                            {/* Action buttons */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', marginBottom: 'var(--space-24)', flexWrap: 'wrap' }}>
                                                                <Button variant="secondary" size="sm" icon={<Edit2 size={14} />} onClick={e => { e.stopPropagation(); handleEdit(supplier); }}>EDITAR</Button>
                                                                <Button variant="secondary" size="sm" icon={<Link2 size={14} />} onClick={e => { e.stopPropagation(); setMaterialsModalSupplier(supplier); }}>VINCULAR MATERIAS</Button>
                                                                {supplier.status === 'activo' && <Button variant="ghost" size="sm" icon={<Archive size={14} />} onClick={e => { e.stopPropagation(); archiveSupplier(supplier.id, 'inactivo'); }}>DESACTIVAR</Button>}
                                                                {supplier.status === 'inactivo' && <Button variant="ghost" size="sm" icon={<CheckCircle2 size={14} />} onClick={e => { e.stopPropagation(); archiveSupplier(supplier.id, 'activo'); }}>ACTIVAR</Button>}
                                                                {supplier.status !== 'bloqueado' && <Button variant="ghost" size="sm" icon={<Ban size={14} />} onClick={e => { e.stopPropagation(); archiveSupplier(supplier.id, 'bloqueado'); }}>BLOQUEAR</Button>}
                                                            </div>

                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-24)' }}>
                                                                {/* Notas */}
                                                                <div className="inset-card">
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
                                                                        <FileText size={14} style={{ color: 'var(--text-muted)' }} />
                                                                        <p className="text-small text-muted" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notas Internas</p>
                                                                    </div>
                                                                    <p className="text-small text-secondary">{supplier.notes || 'Sin notas adicionales para este proveedor.'}</p>
                                                                </div>

                                                                {/* Materias */}
                                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', marginBottom: 'var(--space-12)' }}>
                                                                        <Package size={14} style={{ color: 'var(--text-muted)' }} />
                                                                        <p className="text-small text-muted" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Materias Primas Vinculadas</p>
                                                                    </div>
                                                                    {linkedMaterials.length === 0 ? (
                                                                        <div className="inset-card">
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                                                                                <AlertCircle size={14} style={{ color: 'var(--text-muted)' }} />
                                                                                <p className="text-small text-muted">Sin materias vinculadas actualmente.</p>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)' }}>
                                                                            {linkedMaterials.map(m => (
                                                                                <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-8) var(--space-12)', background: 'var(--surface-card)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                                                    <span style={{ width: '0.375rem', height: '0.375rem', borderRadius: '999px', background: 'var(--text-muted)' }} />
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

            <SupplierModal isOpen={modalOpen} onClose={() => setModalOpen(false)} editingSupplier={editingSupplier} />
            {materialsModalSupplier && <SupplierMaterialsModal isOpen={!!materialsModalSupplier} onClose={() => setMaterialsModalSupplier(null)} supplier={materialsModalSupplier} />}
        </PageContainer>
    );
}