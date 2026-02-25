import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { UserPlus, Trash2, Shield, Mail, Building2, Search, Printer } from 'lucide-react';
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

    // Search & selection state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Callback to sync selection from EntityList
    const handleSelectionChange = React.useCallback((ids: string[]) => {
        setSelectedIds(ids);
    }, []);

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

    // Smart search: filters by company name, member name, or email
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
                className: 'min-w-[180px] flex-1',
                render: (m) => (
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600 flex-shrink-0">
                            {m.email?.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-gray-900 truncate">{m.full_name || 'Sin nombre'}</div>
                            <div className="text-xs text-gray-500 truncate">{m.email}</div>
                        </div>
                    </div>
                )
            },
            ...(isSuperAdmin ? [{
                key: 'company_name' as keyof TeamMember,
                label: 'Empresa',
                type: 'text' as const,
                className: 'w-40 hidden md:table-cell',
                render: (m: TeamMember) => (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 truncate">
                        <Building2 size={11} />
                        {m.company_name || m.company_id}
                    </span>
                )
            }] : []),
            {
                key: 'role',
                label: 'Rol',
                type: 'badge',
                className: 'w-32',
                render: (m) => (
                    <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold truncate ${m.is_active ? 'border-gray-100 bg-gray-50 text-gray-700' : 'border-orange-100 bg-orange-50 text-orange-700'}`}>
                        {m.role.toUpperCase()} {!m.is_active && '(ARCHIVADO)'}
                    </span>
                )
            },
            {
                key: 'joined_at',
                label: 'Unido',
                type: 'date',
                className: 'w-28 hidden md:table-cell',
                render: (m) => <span className="text-xs font-medium text-gray-500 truncate">{new Date(m.joined_at).toLocaleDateString()}</span>
            },
            {
                key: 'last_sign_in_at',
                label: 'Último Acceso',
                type: 'date',
                className: 'w-32 hidden lg:table-cell',
                render: (m) => <span className="text-xs text-gray-400 truncate">{m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleDateString() : 'Nunca'}</span>
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
        <div className="animate-in fade-in space-y-6 lg:space-y-8 duration-700">
            {/* ✅ RESPONSIVE HEADER */}
            <header className="space-y-4">
                {/* Title row */}
                <div>
                    <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-gray-900">Equipo</h1>
                    <p className="mt-1 text-sm lg:text-base font-medium text-gray-500">
                        {isSuperAdmin
                            ? `Todos los usuarios de la plataforma · ${filteredMembers.length} miembros`
                            : `Gestión de acceso para ${currentCompany?.name}`}
                    </p>
                </div>

                {/* Toolbar: Search + Actions — always one line */}
                <div className="flex items-center gap-2">
                    {/* Search input */}
                    <div className="relative flex-1 min-w-0">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar empresa, nombre, email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-xl bg-white pl-9 pr-3 py-2.5 text-sm text-gray-700 ring-1 ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                        />
                    </div>

                    {/* Print button */}
                    <button
                        onClick={() => window.print()}
                        title="Imprimir listado"
                        className="flex items-center justify-center h-10 w-10 rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 hover:text-gray-700 transition-all flex-shrink-0"
                    >
                        <Printer size={18} />
                    </button>

                    {/* Bulk delete button — visible when items selected */}
                    {selectedIds.length > 0 && (
                        <button
                            onClick={() => handleBulkAction('Eliminar', selectedIds)}
                            title={`Eliminar ${selectedIds.length} seleccionados`}
                            className="flex items-center justify-center h-10 w-10 rounded-xl bg-red-50 text-red-500 ring-1 ring-red-200 hover:bg-red-100 hover:text-red-700 transition-all flex-shrink-0"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}

                    {/* Create button */}
                    <div className="group relative flex-shrink-0">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            disabled={isAtLimit}
                            title="Crear miembro"
                            className={`
                                flex items-center justify-center gap-2 font-bold transition-all active:scale-95
                                rounded-xl sm:rounded-2xl
                                h-10 w-10 sm:h-10 sm:w-auto sm:px-4
                                ${isAtLimit
                                    ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700'}
                            `}
                        >
                            <UserPlus size={18} />
                            <span className="hidden sm:inline text-sm">Crear</span>
                        </button>
                        {isAtLimit && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-full right-0 z-50 mb-3 hidden w-64 rounded-2xl bg-gray-900 p-4 text-xs text-white shadow-2xl group-hover:block">
                                Límite alcanzado. Actualiza tu plan para invitar más personas.
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-4">
                <div className="space-y-6 lg:col-span-3">
                    {statusMessage && (
                        <div className={`animate-in slide-in-from-top-4 flex items-center gap-4 rounded-2xl border p-4 duration-500 ${statusMessage.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
                            <div className={`flex size-10 items-center justify-center rounded-full font-bold flex-shrink-0 ${statusMessage.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>
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
                        onSelectionChange={handleSelectionChange}
                    />
                </div>

                {/* Sidebar - hidden on mobile, visible on desktop */}
                <aside className="hidden lg:block space-y-8">
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
// ✅ Comprobbación de que todo está bien
