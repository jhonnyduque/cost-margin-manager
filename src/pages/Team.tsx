import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { UserPlus, Trash2, Shield, Building2, Search, Printer, Users } from 'lucide-react';
import { colors, typography, spacing, shadows } from '@/design/design-tokens';
import { EntityList } from '../components/entity/EntityList';
import { Button } from '@/components/ui/Button';
import { AppModal } from '../components/ui/AppModal';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { MetricCard } from '@/components/platform/MetricCard';

interface TeamMember {
    id: string;
    user_id: string;
    full_name: string | null;
    email: string;
    role: string;
    is_active: boolean;
    joined_at: string;
    last_sign_in_at: string | null;
    company_id: string;
    company_name?: string | null;
}

const ROLE_VARIANT: Record<string, "neutral" | "warning" | "error" | "info" | "success"> = {
    'manager': 'info',
    'operator': 'neutral',
    'viewer': 'neutral',
    'super_admin': 'warning'
};

export default function Team() {
    const { user, session, currentCompany, userRole, isLoading: authLoading } = useAuth();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [maxUsers, setMaxUsers] = useState(3);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserFullName, setNewUserFullName] = useState('');
    const [newUserRole, setNewUserRole] = useState<'manager' | 'operator' | 'viewer'>('operator');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [editPassword, setEditPassword] = useState('');

    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const isSuperAdmin = user != null && !currentCompany;
    const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
    const canCreate = allowedRoles.includes(userRole || '') || isSuperAdmin;
    const canEdit = allowedRoles.includes(userRole || '') || isSuperAdmin;
    const canDelete = allowedRoles.includes(userRole || '') || isSuperAdmin;
    const currentUsersCount = members.length;
    const isAtLimit = !isSuperAdmin && currentUsersCount >= maxUsers;
    const percentageUsed = Math.min(100, (currentUsersCount / maxUsers) * 100);

    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return members;
        const q = searchQuery.toLowerCase().trim();
        return members.filter(m =>
            (m.full_name && m.full_name.toLowerCase().includes(q)) ||
            m.email.toLowerCase().includes(q) ||
            (m.company_name && m.company_name.toLowerCase().includes(q)) ||
            m.role.toLowerCase().includes(q)
        );
    }, [members, searchQuery]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchMembers();
            if (currentCompany) fetchMaxUsers();
        }
    }, [authLoading, user?.id, currentCompany?.id]);

    const fetchMaxUsers = async () => {
        if (!currentCompany) return;
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('seat_limit')
                .eq('id', currentCompany.id)
                .single();

            if (error) throw error;
            if (data?.seat_limit) {
                setMaxUsers(data.seat_limit);
            }
        } catch (err) {
            console.error('[Team] Error fetching seat_limit:', err);
            setMaxUsers(3);
        }
    };

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .rpc('get_team_members', isSuperAdmin ? {} : { p_company_id: currentCompany?.id })
                .order('joined_at', { ascending: true });

            if (error) throw error;
            setMembers(data || []);
        } catch (error) {
            console.error('Error fetching members:', error);
            setMembers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async () => {
        if (isAtLimit) return;
        try {
            setLoading(true);
            const { data, error } = await supabase.functions.invoke('beto-manage-team', {
                body: {
                    action: 'create',
                    email: newUserEmail,
                    full_name: newUserFullName,
                    role: newUserRole,
                    password: newUserPassword,
                    company_id: currentCompany?.id
                }
            });

            if (error) throw error;

            setStatusMessage({ type: 'success', text: `Usuario ${newUserEmail} invitado con éxito.` });
            setNewUserEmail('');
            setNewUserFullName('');
            setNewUserPassword('');
            setShowCreateModal(false);
            fetchMembers();
        } catch (error: any) {
            setStatusMessage({ type: 'error', text: error.message || 'Error al crear el usuario.' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateMember = async () => {
        if (!editingMember) return;
        try {
            setLoading(true);
            const isSelfUpdate = editingMember.user_id === user?.id;
            const { error } = await (isSelfUpdate
                ? supabase.functions.invoke('beto-update-profile', {
                    body: { full_name: editName, password: editPassword || undefined }
                })
                : supabase.functions.invoke('beto-manage-team', {
                    body: {
                        action: 'update',
                        target_user_id: editingMember.user_id,
                        full_name: canEdit ? editName : undefined,
                        role: canEdit ? editRole : undefined,
                        password: editPassword || undefined,
                        company_id: editingMember.company_id || currentCompany?.id
                    }
                })
            );

            if (error) throw error;

            setEditingMember(null);
            setEditPassword('');
            fetchMembers();
            setStatusMessage({ type: 'success', text: 'Miembro actualizado correctamente.' });
        } catch (error: any) {
            setStatusMessage({ type: 'error', text: error.message || 'Error al actualizar' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('¿Archivar este miembro del sistema?')) return;
        try {
            setLoading(true);
            const member = members.find(m => m.user_id === userId);
            const { error } = await supabase.functions.invoke('beto-manage-team', {
                body: {
                    action: 'delete',
                    target_user_id: userId,
                    company_id: member?.company_id || currentCompany?.id
                }
            });
            if (error) throw error;
            fetchMembers();
        } catch (error: any) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const teamConfig = {
        name: 'Miembro',
        pluralName: 'Equipo',
        rowIdKey: 'user_id',
        fields: [
            {
                key: 'full_name',
                label: 'Usuario',
                render: (m: TeamMember) => (
                    <div className="flex items-center gap-3">
                        <div className={`flex size-10 items-center justify-center rounded-xl ${colors.bgBrandSubtle} ${colors.brand} font-black uppercase text-xs border border-indigo-100 shadow-sm`}>
                            {m.email?.substring(0, 2)}
                        </div>
                        <div>
                            <div className={`${typography.text.body} font-black ${colors.textPrimary}`}>{m.full_name || 'PENDIENTE'}</div>
                            <div className={`${typography.text.caption} ${colors.textMuted}`}>{m.email}</div>
                        </div>
                    </div>
                )
            },
            {
                key: 'role',
                label: 'Jerarquía',
                render: (m: TeamMember) => (
                    <Badge variant={ROLE_VARIANT[m.role] || 'neutral'}>
                        {m.role.toUpperCase()}
                    </Badge>
                )
            },
            {
                key: 'status',
                label: 'Estado',
                render: (m: TeamMember) => (
                    <div className="flex items-center gap-2">
                        <div className={`size-2 rounded-full ${m.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className={`${typography.text.caption} ${colors.textSecondary} font-bold`}>
                            {m.is_active ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                    </div>
                )
            }
        ],
        actions: [
            { id: 'edit', label: 'Editar', icon: <Shield size={18} />, onClick: (m: any) => { setEditingMember(m); setEditName(m.full_name || ''); setEditRole(m.role); } },
            { id: 'delete', label: 'Eliminar', icon: <Trash2 size={18} />, color: 'text-red-500', onClick: (m: any) => handleDeleteUser(m.user_id) }
        ]
    };

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Control de Equipo"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Equipo</span>
                        </>
                    }
                    metadata={[
                        <span key="1">Gestión de Seats & Jerarquías</span>,
                        <span key="2">{currentUsersCount} usuarios activos</span>
                    ]}
                    rightContent={
                        !isSuperAdmin ? (
                            <div className="md:w-64 -mt-2">
                                <MetricCard
                                    title="OCUPACIÓN DE ASIENTOS"
                                    value={`${currentUsersCount} / ${maxUsers}`}
                                    visualType="gauge"
                                    progressValue={percentageUsed}
                                    variant={isAtLimit ? 'error' : percentageUsed > 80 ? 'warning' : 'success'}
                                />
                            </div>
                        ) : undefined
                    }
                    actions={
                        <>
                            <Button variant="secondary" size="sm" onClick={() => window.print()} icon={<Printer size={16} />}>
                                IMPRIMIR
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setShowCreateModal(true)}
                                disabled={isAtLimit}
                                isLoading={loading}
                                icon={<UserPlus size={16} />}
                            >
                                INVITAR MIEMBRO
                            </Button>
                        </>
                    }
                />

                <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-slate-100 mb-6">
                    <div className="relative w-full md:max-w-md">
                        <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${colors.textMuted}`} />
                        <input
                            type="text"
                            placeholder="Buscar miembro o rol..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.text.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white`}
                        />
                    </div>
                </div>

                {statusMessage && (
                    <Card className={statusMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}>
                        <div className="flex items-center gap-3">
                            <div className={`p-1 rounded-full ${statusMessage.type === 'success' ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                                {statusMessage.type === 'success' ? '✓' : '!'}
                            </div>
                            <p className={`${typography.text.body} font-bold ${statusMessage.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
                                {statusMessage.text}
                            </p>
                            <button onClick={() => setStatusMessage(null)} className="ml-auto opacity-40 hover:opacity-100">✕</button>
                        </div>
                    </Card>
                )}

                <Card noPadding className="overflow-hidden">
                    <EntityList
                        config={teamConfig as any}
                        items={filteredMembers}
                        loading={loading}
                        onSelectionChange={setSelectedIds}
                    />
                </Card>
            </SectionBlock>

            <AppModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSave={handleCreateUser}
                title="Invitar al Equipo"
                tier={2}
                saveLabel="Enviar Invitación"
                loading={loading}
            >
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <label className={`${typography.text.caption} font-black ${colors.textSecondary} uppercase px-1`}>Nombre Completo</label>
                        <input type="text" className="w-full h-11 px-4 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} placeholder="Ej. Alex Smith" />
                    </div>
                    <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <label className={`${typography.text.caption} font-black ${colors.textSecondary} uppercase px-1`}>Rol Sugerido</label>
                        <select className="w-full h-11 px-4 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 capitalize" value={newUserRole} onChange={(e: any) => setNewUserRole(e.target.value)}>
                            <option value="manager">Manager (Admin)</option>
                            <option value="operator">Operador (Escritura)</option>
                            <option value="viewer">Lector (Solo Consulta)</option>
                        </select>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                        <label className={`${typography.text.caption} font-black ${colors.textSecondary} uppercase px-1`}>Correo Corporativo</label>
                        <input type="email" className="w-full h-11 px-4 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="alex@empresa.com" />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                        <label className={`${typography.text.caption} font-black ${colors.textSecondary} uppercase px-1`}>Contraseña Temporal</label>
                        <input type="password" title="Mínimo 6 caracteres" className="w-full h-11 px-4 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                    </div>
                </div>
            </AppModal>

            {editingMember && (
                <AppModal
                    isOpen={true}
                    onClose={() => setEditingMember(null)}
                    onSave={handleUpdateMember}
                    title="Configurar Perfil"
                    tier={2}
                    saveLabel="Aplicar Cambios"
                    loading={loading}
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 col-span-2 md:col-span-1">
                            <label className={`${typography.text.caption} font-black ${colors.textSecondary} uppercase px-1`}>Nombre</label>
                            <input type="text" className="w-full h-11 px-4 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5 col-span-2 md:col-span-1">
                            <label className={`${typography.text.caption} font-black ${colors.textSecondary} uppercase px-1`}>Rol de Sistema</label>
                            <select className="w-full h-11 px-4 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" value={editRole} onChange={(e) => setEditRole(e.target.value)} disabled={editingMember.user_id === user?.id}>
                                <option value="manager">Manager</option>
                                <option value="operator">Operador</option>
                                <option value="viewer">Lector</option>
                            </select>
                        </div>
                        <div className="space-y-1.5 col-span-2">
                            <label className={`${typography.text.caption} font-black ${colors.textSecondary} uppercase px-1`}>Nueva Contraseña (Opcional)</label>
                            <input type="password" placeholder="••••••••" className="w-full h-11 px-4 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
                        </div>
                    </div>
                </AppModal>
            )}
        </PageContainer>
    );
}
