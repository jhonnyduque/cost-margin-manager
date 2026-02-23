import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { UserPlus, Trash2, Shield, Mail, Building2 } from 'lucide-react';
import { EntityList } from '../components/entity/EntityList';
import { EntityModal } from '../components/entity/EntityModal';
import { EntityDetail } from '../components/entity/EntityDetail';
import { EntityConfig } from '../components/entity/types';

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

export default function Team() {
    const { user, currentCompany, userRole, isLoading: authLoading } = useAuth();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [maxUsers, setMaxUsers] = useState(3);
    const [loading, setLoading] = useState(true);

    // Filtro por empresa (solo SuperAdmin)
    const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');

    // Create form state
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserFullName, setNewUserFullName] = useState('');
    const [newUserRole, setNewUserRole] = useState<'manager' | 'operator' | 'viewer'>('operator');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Edit form state
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [editPassword, setEditPassword] = useState('');

    // UI state
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const isSuperAdmin = user != null && !currentCompany;
    const isManager = userRole === 'manager' || userRole === 'owner';
    const canEdit = isManager || isSuperAdmin;
    const currentUsersCount = members.length;
    const isAtLimit = !isSuperAdmin && currentUsersCount >= maxUsers;
    const percentageUsed = Math.min(100, (currentUsersCount / maxUsers) * 100);
    const upgradeRecommended = !isSuperAdmin && percentageUsed >= 80;

    // Lista de empresas únicas para el dropdown (solo SuperAdmin)
    const companyOptions = useMemo(() => {
        if (!isSuperAdmin) return [];
        const map = new Map<string, string>();
        members.forEach(m => {
            if (m.company_id) {
                map.set(m.company_id, m.company_name || m.company_id);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [members, isSuperAdmin]);

    // Miembros filtrados según el dropdown
    const filteredMembers = useMemo(() => {
        if (!isSuperAdmin || selectedCompanyFilter === 'all') return members;
        return members.filter(m => m.company_id === selectedCompanyFilter);
    }, [members, isSuperAdmin, selectedCompanyFilter]);

    // 🔧 FIX: Disparar cuando hay user, sin requerir currentCompany (SuperAdmin no lo tiene)
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
                console.log('[Team] Seat limit loaded:', data.seat_limit);
            }
        } catch (err) {
            console.error('[Team] Error fetching seat_limit:', err);
            setMaxUsers(3);
        }
    };

    const fetchMembers = async () => {
        console.log('[Team] Fetching members. SuperAdmin:', isSuperAdmin, '| Company:', currentCompany?.id);
        try {
            setLoading(true);

            if (isSuperAdmin) {
                // SuperAdmin: traer todos los miembros con nombre de empresa
                const { data, error } = await supabase
                    .from('team_members_view')
                    .select('*, companies(name)')
                    .order('joined_at', { ascending: true });

                if (error) throw error;

                const mapped = (data || []).map((m: any) => ({
                    ...m,
                    company_name: m.companies?.name || null,
                }));
                setMembers(mapped);
            } else {
                // Usuario normal: solo su empresa
                const { data, error } = await supabase
                    .from('team_members_view')
                    .select('*')
                    .eq('company_id', currentCompany?.id)
                    .order('joined_at', { ascending: true });

                if (error) throw error;
                setMembers(data || []);
            }
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

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('La solicitud tardó demasiado. Verifica que las Edge Functions estén desplegadas.')), 15000);
            });

            const invokePromise = supabase.functions.invoke('beto-manage-team', {
                body: {
                    action: 'create',
                    email: newUserEmail,
                    full_name: newUserFullName,
                    role: newUserRole,
                    password: newUserPassword,
                    company_id: currentCompany?.id
                }
            });

            const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as any;

            if (error) {
                if (error.code === 'not_found' || error.status === 404) {
                    throw new Error('La función del sistema no está desplegada. Ejecuta "supabase functions deploy beto-manage-team".');
                }
                throw error;
            }

            setStatusMessage({ type: 'success', text: `Usuario ${newUserEmail} creado con éxito.` });
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
            const isRoleChanged = canEdit && editRole !== editingMember.role;

            const { error } = await (isSelfUpdate
                ? supabase.functions.invoke('beto-update-profile', {
                    body: { full_name: editName, password: editPassword || undefined }
                })
                : supabase.functions.invoke('beto-manage-team', {
                    body: {
                        action: 'update',
                        target_user_id: editingMember.user_id,
                        full_name: canEdit ? editName : undefined,
                        role: isRoleChanged ? editRole : undefined,
                        password: editPassword || undefined,
                        company_id: editingMember.company_id || currentCompany?.id
                    }
                })
            );

            if (error) {
                if (isSelfUpdate && (error.code === 'not_found' || error.status === 404)) {
                    throw new Error('Función beto-update-profile no desplegada. Ejecuta: supabase functions deploy beto-update-profile');
                }
                throw error;
            }

            setEditingMember(null);
            setEditPassword('');
            fetchMembers();
            setStatusMessage({ type: 'success', text: 'Miembro actualizado con éxito.' });
        } catch (error: any) {
            setStatusMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este miembro?')) return;
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

    const handleBulkAction = async (action: string, ids: string[]) => {
        if (action === 'Archivar') await executeBulk('bulk_archive', ids);
        else if (action === 'Eliminar') await executeBulk('bulk_delete', ids);
    };

    const executeBulk = async (action: string, ids: string[]) => {
        if (!confirm(`¿Estás seguro de que deseas ejecutar esta acción en ${ids.length} usuarios?`)) return;
        try {
            setLoading(true);
            const { error } = await supabase.functions.invoke('beto-manage-team', {
                body: { action, user_ids: ids, company_id: currentCompany?.id }
            });
            if (error) throw error;
            setStatusMessage({ type: 'success', text: 'Acción masiva completada.' });
            fetchMembers();
        } catch (error: any) {
            setStatusMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const teamConfig: EntityConfig<TeamMember> = {
        name: 'Miembro',
        pluralName: 'Equipo',
        rowIdKey: 'user_id',
        fields: [
            {
                key: 'full_name',
                label: 'Usuario',
                type: 'text',
                render: (m) => (
                    <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">
                            {m.email?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-bold text-gray-900">{m.full_name || 'Sin nombre'}</div>
                            <div className="text-xs text-gray-500">{m.email}</div>
                        </div>
                    </div>
                )
            },
            // Columna Empresa — solo visible para SuperAdmin
            ...(isSuperAdmin ? [{
                key: 'company_name' as keyof TeamMember,
                label: 'Empresa',
                type: 'text' as const,
                render: (m: TeamMember) => (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600">
                        <Building2 size={11} />
                        {m.company_name || m.company_id}
                    </span>
                )
            }] : []),
            {
                key: 'role',
                label: 'Rol',
                type: 'badge',
                render: (m) => (
                    <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold ${m.is_active ? 'border-gray-100 bg-gray-50 text-gray-700' : 'border-orange-100 bg-orange-50 text-orange-700'}`}>
                        {m.role.toUpperCase()} {!m.is_active && '(ARCHIVADO)'}
                    </span>
                )
            },
            {
                key: 'joined_at',
                label: 'Unido',
                type: 'date',
                render: (m) => <span className="text-xs font-medium text-gray-500">{new Date(m.joined_at).toLocaleDateString()}</span>
            },
            {
                key: 'last_sign_in_at',
                label: 'Último Acceso',
                type: 'date',
                render: (m) => <span className="text-xs text-gray-400">{m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleDateString() : 'Nunca'}</span>
            }
        ],
        actions: [
            {
                id: 'detail',
                label: 'Detalles',
                icon: <Mail size={18} />,
                onClick: (m) => setSelectedMember(m)
            },
            {
                id: 'edit',
                label: 'Editar',
                icon: <Shield size={18} />,
                onClick: (m) => {
                    setEditingMember(m);
                    setEditName(m.full_name || '');
                    setEditRole(m.role);
                }
            },
            {
                id: 'delete',
                label: 'Eliminar',
                icon: <Trash2 size={18} />,
                color: 'text-red-500 hover:bg-red-50 hover:border-red-100',
                onClick: (m) => handleDeleteUser(m.user_id)
            }
        ],
        bulkActions: [
            { label: 'Archivar', onClick: (ids) => handleBulkAction('Archivar', ids) },
            { label: 'Eliminar', onClick: (ids) => handleBulkAction('Eliminar', ids), variant: 'danger' }
        ]
    };

    return (
        <div className="animate-in fade-in space-y-8 duration-700">
            <header className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900">Equipo</h1>
                    <p className="mt-1 font-medium text-gray-500">
                        {isSuperAdmin
                            ? `Todos los usuarios de la plataforma · ${filteredMembers.length} miembros`
                            : `Gestión de acceso para ${currentCompany?.name}`}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Dropdown filtro empresa — solo SuperAdmin */}
                    {isSuperAdmin && (
                        <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-gray-400" />
                            <select
                                value={selectedCompanyFilter}
                                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                                className="rounded-2xl border-none bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-gray-200 transition-all focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">Todas las empresas</option>
                                {companyOptions.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="group relative">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            disabled={isAtLimit}
                            className={`
                                flex items-center gap-2 rounded-2xl px-6 py-3 font-bold shadow-lg transition-all
                                ${isAtLimit
                                    ? 'cursor-not-allowed bg-gray-100 text-gray-400 shadow-none'
                                    : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700 active:scale-95'}
                            `}
                        >
                            <UserPlus size={20} />
                            <span>Crear Miembro</span>
                        </button>
                        {isAtLimit && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-full right-0 z-50 mb-3 hidden w-64 rounded-2xl bg-gray-900 p-4 text-xs text-white shadow-2xl group-hover:block">
                                Límite alcanzado. Actualiza tu plan para invitar más personas.
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
                <div className="space-y-6 lg:col-span-3">
                    {statusMessage && (
                        <div className={`animate-in slide-in-from-top-4 flex items-center gap-4 rounded-2xl border p-4 duration-500 ${statusMessage.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
                            <div className={`flex size-10 items-center justify-center rounded-full font-bold ${statusMessage.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                {statusMessage.type === 'success' ? '✓' : '!'}
                            </div>
                            <p className="text-sm font-bold tracking-tight">{statusMessage.text}</p>
                            <button onClick={() => setStatusMessage(null)} className="ml-auto p-2 opacity-50 hover:opacity-100">✕</button>
                        </div>
                    )}

                    <EntityList
                        config={teamConfig}
                        items={filteredMembers}
                        loading={loading}
                    />
                </div>

                <aside className="space-y-8">
                    {upgradeRecommended && (
                        <div className="group relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-8 text-white shadow-2xl">
                            <div className="absolute right-0 top-0 -mr-4 -mt-4 size-24 rounded-full bg-white/10 blur-2xl transition-transform duration-700 group-hover:scale-150" />
                            <h3 className="relative z-10 mb-3 text-xl font-black">Upgrade to Pro</h3>
                            <p className="relative z-10 mb-6 text-sm font-medium leading-relaxed text-indigo-100">
                                Desbloquea usuarios ilimitados y análisis avanzado de márgenes.
                            </p>
                            <button className="relative z-10 w-full rounded-2xl bg-white py-4 font-bold text-indigo-700 shadow-xl transition-all hover:bg-indigo-50 active:scale-95">
                                Ver Planes
                            </button>
                        </div>
                    )}
                </aside>
            </div>

            {/* CREATE MODAL */}
            <EntityModal
                config={teamConfig}
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateUser}
                loading={loading}
            >
                <div className="grid grid-cols-1 gap-5">
                    <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre Completo</label>
                        <input name="full_name" type="text" placeholder="Ej: Juan Pérez" className="w-full rounded-2xl border-none bg-gray-50 px-5 py-3 transition-all focus:ring-2 focus:ring-indigo-500" value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Rol</label>
                        <select name="role" className="w-full rounded-2xl border-none bg-gray-50 px-5 py-3 transition-all focus:ring-2 focus:ring-indigo-500" value={newUserRole} onChange={(e: any) => setNewUserRole(e.target.value)}>
                            <option value="manager">Manager</option>
                            <option value="operator">Operador</option>
                            <option value="viewer">Lector</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Email</label>
                        <input name="email" type="email" placeholder="colaborador@empresa.com" className="w-full rounded-2xl border-none bg-gray-50 px-5 py-3 transition-all focus:ring-2 focus:ring-indigo-500" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Contraseña</label>
                        <input name="password" type="password" placeholder="••••••••" className="w-full rounded-2xl border-none bg-gray-50 px-5 py-3 transition-all focus:ring-2 focus:ring-indigo-500" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} required />
                    </div>
                </div>
            </EntityModal>

            {/* EDIT MODAL */}
            <EntityModal
                config={teamConfig}
                item={editingMember}
                isOpen={!!editingMember}
                onClose={() => setEditingMember(null)}
                onSubmit={handleUpdateMember}
                loading={loading}
            >
                <div className="grid grid-cols-1 gap-5">
                    <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre Completo</label>
                        <input
                            type="text"
                            className={`w-full rounded-2xl border-none bg-gray-50 px-5 py-3 transition-all focus:ring-2 focus:ring-indigo-500 ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={!canEdit}
                            required
                        />
                        {!canEdit && <p className="ml-1 text-[10px] font-bold text-orange-600">Solo Managers pueden editar nombres.</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Rol</label>
                        <select
                            className={`w-full rounded-2xl border-none bg-gray-50 px-5 py-3 transition-all focus:ring-2 focus:ring-indigo-500 ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            disabled={!canEdit}
                        >
                            <option value="manager">Manager</option>
                            <option value="operator">Operador</option>
                            <option value="viewer">Lector</option>
                        </select>
                        {!canEdit && <p className="ml-1 text-[10px] font-bold text-orange-600">Solo Managers pueden cambiar roles.</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Nueva Contraseña (Opcional)</label>
                        <input type="password" placeholder="Dejar en blanco para no cambiar" className="w-full rounded-2xl border-none bg-gray-50 px-5 py-3 transition-all focus:ring-2 focus:ring-indigo-500" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
                    </div>
                </div>
            </EntityModal>

            {/* DETAIL SIDE-OVER */}
            <EntityDetail
                config={teamConfig}
                item={selectedMember}
                isOpen={!!selectedMember}
                onClose={() => setSelectedMember(null)}
            />
        </div>
    );
}