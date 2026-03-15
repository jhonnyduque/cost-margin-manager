import React, { useState, useMemo } from 'react';
import { Plus, Users, Search, Edit2, Archive, Trash2, X, CheckCircle2, UserPlus, Mail, Phone, MapPin, Hash } from 'lucide-react';
import { useStore } from '../store';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Client } from '@/types';

const Clients: React.FC = () => {
    const { clients, addClient, updateClient, deleteClient, archiveClient } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [modal, setModal] = useState<{
        isOpen: boolean;
        editingId: string | null;
        formData: Partial<Client>;
    }>({
        isOpen: false,
        editingId: null,
        formData: { name: '', email: '', phone: '', address: '', tax_id: '', notes: '', status: 'activo' }
    });

    const filteredClients = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return clients;
        return clients.filter(c =>
            c.name.toLowerCase().includes(term) ||
            (c.email && c.email.toLowerCase().includes(term)) ||
            (c.tax_id && c.tax_id.toLowerCase().includes(term))
        );
    }, [clients, searchTerm]);

    const openModal = (client?: Client) => {
        if (client) {
            setModal({ isOpen: true, editingId: client.id, formData: { ...client } });
        } else {
            setModal({ isOpen: true, editingId: null, formData: { name: '', email: '', phone: '', address: '', tax_id: '', notes: '', status: 'activo' } });
        }
    };

    const handleSave = async () => {
        if (!modal.formData.name?.trim()) { alert('El nombre es obligatorio'); return; }
        setIsSaving(true);
        try {
            if (modal.editingId) {
                await updateClient(modal.formData as Client);
            } else {
                await addClient({ ...modal.formData, id: crypto.randomUUID(), created_at: new Date().toISOString() } as Client);
            }
            setModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`¿Estás seguro de eliminar a "${name}"? Esta acción no se puede deshacer.`)) {
            try { await deleteClient(id); } catch (error: any) { alert(error.message); }
        }
    };

    const toggleStatus = async (client: Client) => {
        try {
            if (client.status === 'activo') { await archiveClient(client.id); }
            else { await updateClient({ ...client, status: 'activo' }); }
        } catch (error: any) { alert(error.message); }
    };

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Clientes"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span style={{ color: 'var(--color-neutral-900)', fontWeight: 600 }}>Gestión de Clientes</span></>}
                    metadata={[<span key="1">{clients.length} clientes registrados</span>]}
                    actions={<Button variant="primary" onClick={() => openModal()} icon={<UserPlus size={16} />}>NUEVO CLIENTE</Button>}
                />

                <div className="relative mt-8" style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: 'var(--space-16)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-neutral-400)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email o identificación..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input"
                        style={{ paddingLeft: 'var(--space-48)' }}
                    />
                </div>
            </SectionBlock>

            <div style={{ background: 'var(--color-neutral-0)', borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', overflow: 'hidden', marginTop: 'var(--space-8)' }}>
                {filteredClients.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon" style={{ width: '5rem', height: '5rem', borderRadius: '50%' }}>
                            <Users size={40} />
                        </div>
                        <h4>No se encontraron clientes</h4>
                        <p>{searchTerm ? 'Prueba con otros términos de búsqueda.' : 'Comienza registrando tu primer cliente.'}</p>
                        {!searchTerm && (
                            <Button variant="primary" style={{ marginTop: 'var(--space-16)' }} onClick={() => openModal()} icon={<Plus size={18} />}>
                                REGISTRAR CLIENTE
                            </Button>
                        )}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>Contacto</th>
                                    <th>Identificación (Tax ID)</th>
                                    <th style={{ textAlign: 'center' }}>Estado</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.map(c => (
                                    <tr key={c.id} className="group">
                                        <td>
                                            <p style={{ fontWeight: 800, color: 'var(--color-neutral-900)' }}>{c.name}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                                                <MapPin size={12} style={{ color: 'var(--color-neutral-400)' }} />
                                                <span className="text-small text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{c.address || 'Sin dirección'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                                    <Mail size={12} style={{ color: 'var(--color-neutral-400)' }} />
                                                    <span className="text-small">{c.email || '—'}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                                    <Phone size={12} style={{ color: 'var(--color-neutral-400)' }} />
                                                    <span className="text-small">{c.phone || '—'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="font-mono text-small" style={{ color: 'var(--color-neutral-700)' }}>
                                            {c.tax_id || '—'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <Badge variant={c.status === 'activo' ? 'success' : 'neutral'}>
                                                {c.status}
                                            </Badge>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-8)' }}>
                                                <button onClick={() => openModal(c)} className="btn-ghost btn-sm" title="Editar cliente"><Edit2 size={16} /></button>
                                                <button onClick={() => toggleStatus(c)} className="btn-ghost btn-sm" title={c.status === 'activo' ? 'Archivar' : 'Reactivar'}><Archive size={16} /></button>
                                                <button onClick={() => handleDelete(c.id, c.name)} className="btn-ghost btn-sm" title="Eliminar"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal.isOpen && (
                <div className="modal-overlay">
                    <Card className="w-full" style={{ maxWidth: '32rem' }}>
                        <Card.Header>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                                {modal.editingId ? <Edit2 size={18} style={{ color: 'var(--color-primary)' }} /> : <UserPlus size={18} style={{ color: 'var(--color-primary)' }} />}
                                {modal.editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h3>
                            <button onClick={() => setModal(prev => ({ ...prev, isOpen: false }))} className="btn-ghost btn-sm"><X size={20} /></button>
                        </Card.Header>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                            <Input label="Nombre Completo / Razón Social *" placeholder="Ej: Distribuidora Los Andes"
                                value={modal.formData.name || ''} onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, name: e.target.value } }))} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-16)' }}>
                                <Input label="Identificación (Tax ID)" placeholder="Ej: 900.123-1"
                                    value={modal.formData.tax_id || ''} onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, tax_id: e.target.value } }))} />
                                <Input label="Teléfono" placeholder="+57 300..."
                                    value={modal.formData.phone || ''} onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, phone: e.target.value } }))} />
                            </div>
                            <Input label="Correo Electrónico" type="email" placeholder="cliente@ejemplo.com"
                                value={modal.formData.email || ''} onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, email: e.target.value } }))} />
                            <Input label="Dirección Física" placeholder="Calle 123 #45-67..."
                                value={modal.formData.address || ''} onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, address: e.target.value } }))} />
                            <div className="field">
                                <label className="field-label">Notas Adicionales</label>
                                <textarea className="input textarea" placeholder="Detalles sobre entregas, condiciones comerciales..."
                                    value={modal.formData.notes || ''} onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, notes: e.target.value } }))} />
                            </div>
                        </div>

                        <Card.Footer>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                                    <span className="text-small">Estado:</span>
                                    <button
                                        onClick={() => setModal(prev => ({ ...prev, formData: { ...prev.formData, status: prev.formData.status === 'activo' ? 'inactivo' : 'activo' } }))}
                                        className={`badge ${modal.formData.status === 'activo' ? 'badge-success' : 'badge-neutral'}`}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {modal.formData.status === 'activo' ? 'ACTIVO' : 'INACTIVO'}
                                    </button>
                                </div>
                                <div className="modal-actions">
                                    <Button variant="ghost" onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}>CANCELAR</Button>
                                    <Button variant="primary" onClick={handleSave} isLoading={isSaving} icon={<CheckCircle2 size={16} />}>
                                        {modal.editingId ? 'GUARDAR CAMBIOS' : 'CREAR CLIENTE'}
                                    </Button>
                                </div>
                            </div>
                        </Card.Footer>
                    </Card>
                </div>
            )}
        </PageContainer>
    );
};

export default Clients;