import React, { useState, useMemo } from 'react';
import { Plus, Users, Search, Edit2, Archive, Trash2, X, CheckCircle2, UserPlus, Mail, Phone, MapPin, Hash, FileText } from 'lucide-react';
import { useStore } from '../store';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
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

    // UI Local State
    const [modal, setModal] = useState<{
        isOpen: boolean;
        editingId: string | null;
        formData: Partial<Client>;
    }>({
        isOpen: false,
        editingId: null,
        formData: {
            name: '',
            email: '',
            phone: '',
            address: '',
            tax_id: '',
            notes: '',
            status: 'activo'
        }
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
            setModal({
                isOpen: true,
                editingId: client.id,
                formData: { ...client }
            });
        } else {
            setModal({
                isOpen: true,
                editingId: null,
                formData: {
                    name: '',
                    email: '',
                    phone: '',
                    address: '',
                    tax_id: '',
                    notes: '',
                    status: 'activo'
                }
            });
        }
    };

    const handleSave = async () => {
        if (!modal.formData.name?.trim()) {
            alert('El nombre es obligatorio');
            return;
        }

        setIsSaving(true);
        try {
            if (modal.editingId) {
                await updateClient(modal.formData as Client);
            } else {
                await addClient({
                    ...modal.formData,
                    id: crypto.randomUUID(),
                    created_at: new Date().toISOString(),
                } as Client);
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
            try {
                await deleteClient(id);
            } catch (error: any) {
                alert(error.message);
            }
        }
    };

    const toggleStatus = async (client: Client) => {
        try {
            if (client.status === 'activo') {
                await archiveClient(client.id);
            } else {
                await updateClient({ ...client, status: 'activo' });
            }
        } catch (error: any) {
            alert(error.message);
        }
    };

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Clientes"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Gestión de Clientes</span>
                        </>
                    }
                    metadata={[
                        <span key="1">{clients.length} clientes registrados</span>
                    ]}
                    actions={
                        <Button variant="primary" onClick={() => openModal()} icon={<UserPlus size={16} />}>
                            NUEVO CLIENTE
                        </Button>
                    }
                />

                <div className="relative mt-8 no-print">
                    <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${colors.textMuted}`} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email o identificación..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.text.body} transition-all focus:ring-2 focus:ring-slate-400 focus:bg-white`}
                    />
                </div>
            </SectionBlock>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {filteredClients.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="h-20 w-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Users size={40} />
                        </div>
                        <h3 className={`${typography.sectionTitle} text-slate-900 mb-2`}>No se encontraron clientes</h3>
                        <p className="text-slate-500 text-sm max-w-sm mx-auto">
                            {searchTerm ? 'Prueba con otros términos de búsqueda.' : 'Comienza registrando tu primer cliente para gestionar sus despachos.'}
                        </p>
                        {!searchTerm && (
                            <Button variant="primary" className="mt-6" onClick={() => openModal()} icon={<Plus size={18} />}>
                                REGISTRAR CLIENTE
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead className={`bg-slate-50 ${typography.text.caption} text-slate-500 font-bold uppercase border-b border-slate-100`}>
                                <tr>
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Contacto</th>
                                    <th className="px-6 py-4">Identificación (Tax ID)</th>
                                    <th className="px-6 py-4 text-center">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredClients.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className={`${typography.text.body} font-black ${colors.textPrimary} group-hover:text-slate-700 transition-colors`}>{c.name}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <MapPin size={12} className="text-slate-400" />
                                                <span className={`${typography.text.caption} text-slate-500 truncate max-w-[200px]`}>{c.address || 'Sin dirección'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    <Mail size={12} className="text-slate-400" />
                                                    <span className={typography.text.caption}>{c.email || '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Phone size={12} className="text-slate-400" />
                                                    <span className={typography.text.caption}>{c.phone || '—'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm text-slate-600">
                                            {c.tax_id || '—'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant={c.status === 'activo' ? 'success' : 'neutral'} className="capitalize">
                                                {c.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openModal(c)}
                                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                    title="Editar cliente"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(c)}
                                                    className={`p-2 ${c.status === 'activo' ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'} rounded-lg transition-all`}
                                                    title={c.status === 'activo' ? 'Archivar' : 'Reactivar'}
                                                >
                                                    <Archive size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(c.id, c.name)}
                                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                    title="Eliminar permanentemente"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Cliente */}
            {modal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className={`flex items-center justify-between ${spacing.pxLg} ${spacing.pyMd} border-b border-slate-100`}>
                            <h3 className={`${typography.sectionTitle} flex items-center gap-2`}>
                                {modal.editingId ? <Edit2 size={20} className="text-indigo-500" /> : <UserPlus size={20} className="text-indigo-500" />}
                                {modal.editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h3>
                            <button onClick={() => setModal(prev => ({ ...prev, isOpen: false }))} className="text-slate-400 hover:text-slate-600 p-1">
                                <X size={24} />
                            </button>
                        </div>

                        <div className={`${spacing.pLg} space-y-5`}>
                            <div>
                                <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Nombre Completo / Razón Social *</label>
                                <Input
                                    placeholder="Ej: Distribuidora Los Andes"
                                    className="font-bold h-11"
                                    value={modal.formData.name || ''}
                                    onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, name: e.target.value } }))}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Identificación (Tax ID)</label>
                                    <Input
                                        placeholder="Ej: 900.123-1"
                                        icon={<Hash size={16} />}
                                        value={modal.formData.tax_id || ''}
                                        onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, tax_id: e.target.value } }))}
                                    />
                                </div>
                                <div>
                                    <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Teléfono</label>
                                    <Input
                                        placeholder="+57 300..."
                                        icon={<Phone size={16} />}
                                        value={modal.formData.phone || ''}
                                        onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, phone: e.target.value } }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Correo Electrónico</label>
                                <Input
                                    placeholder="cliente@ejemplo.com"
                                    type="email"
                                    icon={<Mail size={16} />}
                                    value={modal.formData.email || ''}
                                    onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, email: e.target.value } }))}
                                />
                            </div>

                            <div>
                                <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Dirección Física</label>
                                <Input
                                    placeholder="Calle 123 #45-67..."
                                    icon={<MapPin size={16} />}
                                    value={modal.formData.address || ''}
                                    onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, address: e.target.value } }))}
                                />
                            </div>

                            <div>
                                <label className={`${typography.text.caption} font-bold text-slate-500 uppercase mb-1.5 block`}>Notas Adicionales</label>
                                <textarea
                                    className={`w-full p-3 rounded-xl border border-slate-200 bg-slate-50 ${typography.text.body} focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none min-h-[80px]`}
                                    placeholder="Detalles sobre entregas, condiciones comerciales..."
                                    value={modal.formData.notes || ''}
                                    onChange={e => setModal(prev => ({ ...prev, formData: { ...prev.formData, notes: e.target.value } }))}
                                />
                            </div>
                        </div>

                        <div className={`${spacing.pLg} bg-slate-50 border-t border-slate-100 flex items-center justify-between rounded-b-2xl`}>
                            <div className="flex items-center gap-2">
                                <span className={typography.text.caption}>Estado:</span>
                                <button
                                    onClick={() => setModal(prev => ({ ...prev, formData: { ...prev.formData, status: prev.formData.status === 'activo' ? 'inactivo' : 'activo' } }))}
                                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${modal.formData.status === 'activo' ? 'text-slate-800 border-slate-300' : 'text-slate-400 border-slate-200'}`}
                                >
                                    {modal.formData.status === 'activo' ? 'ACTIVO' : 'INACTIVO'}
                                </button>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="ghost" onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}>
                                    CANCELAR
                                </Button>
                                <Button variant="primary" onClick={handleSave} isLoading={isSaving} icon={<CheckCircle2 size={18} />}>
                                    {modal.editingId ? 'GUARDAR CAMBIOS' : 'CREAR CLIENTE'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </PageContainer>
    );
};

export default Clients;
