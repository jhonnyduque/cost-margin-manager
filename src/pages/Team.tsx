import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { UserPlus, Trash2, Shield, Mail } from 'lucide-react';
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
}

export default function Team() {
    const { currentCompany, userRole, isLoading: authLoading } = useAuth();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [maxUsers, setMaxUsers] = useState(3);
    const [loading, setLoading] = useState(true);

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

    const isManager = userRole === 'manager' || userRole === 'owner';
    const currentUsersCount = members.length;
    const isAtLimit = currentUsersCount >= maxUsers;
    const percentageUsed = Math.min(100, (currentUsersCount / maxUsers) * 100);
    const upgradeRecommended = percentageUsed >= 80;

    useEffect(() => {
        if (!authLoading && currentCompany) {
            fetchMembers();
            fetchMaxUsers();
        }
    }, [authLoading, currentCompany?.id, currentCompany?.subscription_tier]);

    const fetchMaxUsers = async () => {
        if (!currentCompany) return;
        try {
            const { data, error } = await supabase
                .from('subscription_plans')
                .select('max_users')
                .eq('slug', currentCompany.subscription_tier)
                .single();
            if (!error && data) setMaxUsers(data.max_users);
        } catch (err) {
            console.error('Error fetching max users:', err);
        }
    };

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('team_members_view')
                .select('*')
                .eq('company_id', currentCompany?.id)
                .order('joined_at', { ascending: true });

            if (error) throw error;
            setMembers(data || []);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async () => {
        if (isAtLimit) return;
        try {
            setLoading(true);
            console.log('Invoking beto-manage-team...');

            // Create a promise that rejects after 15 seconds
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
                console.error('Edge Function Error:', error);
                // Handle specific 404 (Function not found)
                if (error.code === 'not_found' || error.status === 404) {
                    throw new Error('La función del sistema no está desplegada. Ejecuta "supabase functions deploy beto-manage-team".');
                }
                throw error;
            }

            console.log('User created:', data);
            setStatusMessage({ type: 'success', text: `Usuario ${newUserEmail} creado con éxito.` });
            setNewUserEmail('');
            setNewUserFullName('');
            setNewUserPassword('');
            setShowCreateModal(false);
            fetchMembers();
        } catch (error: any) {
            console.error('Creation Error:', error);
            setStatusMessage({ type: 'error', text: error.message || 'Error al crear el usuario.' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateMember = async () => {
        if (!editingMember) return;
        try {
            setLoading(true);
            const isRoleChanged = isManager && editRole !== editingMember.role;

            const { error } = await supabase.functions.invoke('beto-manage-team', {
                body: {
                    action: 'update',
                    target_user_id: editingMember.user_id,
                    full_name: isManager ? editName : undefined,
                    role: isRoleChanged ? editRole : undefined,
                    password: editPassword || undefined,
                    company_id: currentCompany?.id
                }
            });

            if (error) throw error;
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
            const { error } = await supabase.functions.invoke('beto-manage-team', {
                body: {
                    action: 'delete',
                    target_user_id: userId,
                    company_id: currentCompany?.id
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
        if (action === 'Archivar') {
            await executeBulk('bulk_archive', ids);
        } else if (action === 'Eliminar') {
            await executeBulk('bulk_delete', ids);
        }
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
                    <p className="mt-1 font-medium text-gray-500">Gestión de acceso para {currentCompany?.name}</p>
                </div>

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
                        items={members}
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
                            className={`w-full rounded-2xl border-none bg-gray-50 px-5 py-3 transition-all focus:ring-2 focus:ring-indigo-500 ${!isManager ? 'cursor-not-allowed opacity-50' : ''}`}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={!isManager}
                            required
                        />
                        {!isManager && <p className="ml-1 text-[10px] font-bold text-orange-600">Solo Managers pueden editar nombres.</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Rol</label>
                        <select className={`w-full rounded-2xl border-none bg-gray-50 px-5 py-3 transition-all focus:ring-2 focus:ring-indigo-500 ${!isManager ? 'cursor-not-allowed opacity-50' : ''}`} value={editRole} onChange={(e) => setEditRole(e.target.value)} disabled={!isManager}>
                            <option value="manager">Manager</option>
                            <option value="operator">Operador</option>
                            <option value="viewer">Lector</option>
                        </select>
                        {!isManager && <p className="ml-1 text-[10px] font-bold text-orange-600">Solo Managers pueden cambiar roles.</p>}
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
