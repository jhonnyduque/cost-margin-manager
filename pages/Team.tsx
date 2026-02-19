import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { LimitIndicator } from '../components/LimitIndicator';
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
            const { error } = await supabase.functions.invoke('beto-manage-team', {
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
            const { error } = await supabase.functions.invoke('beto-manage-team', {
                body: {
                    action: 'update',
                    target_user_id: editingMember.user_id,
                    full_name: editName,
                    role: isManager ? editRole : undefined,
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
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
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
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${m.is_active ? 'bg-gray-50 text-gray-700 border-gray-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                        {m.role.toUpperCase()} {!m.is_active && '(ARCHIVADO)'}
                    </span>
                )
            },
            {
                key: 'joined_at',
                label: 'Unido',
                type: 'date',
                render: (m) => <span className="text-gray-500 text-xs font-medium">{new Date(m.joined_at).toLocaleDateString()}</span>
            },
            {
                key: 'last_sign_in_at',
                label: 'Último Acceso',
                type: 'date',
                render: (m) => <span className="text-gray-400 text-xs">{m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleDateString() : 'Nunca'}</span>
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
        <div className="space-y-8 animate-in fade-in duration-700">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Equipo</h1>
                    <p className="text-gray-500 mt-1 font-medium">Gestión de acceso para {currentCompany?.name}</p>
                </div>

                <div className="relative group">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        disabled={isAtLimit}
                        className={`
                            flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg
                            ${isAtLimit
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 active:scale-95'}
                        `}
                    >
                        <UserPlus size={20} />
                        <span>Crear Miembro</span>
                    </button>
                    {isAtLimit && (
                        <div className="absolute bottom-full right-0 mb-3 w-64 p-4 bg-gray-900 text-white text-xs rounded-2xl shadow-2xl z-50 hidden group-hover:block animate-in fade-in slide-in-from-bottom-2">
                            Límite alcanzado. Actualiza tu plan para invitar más personas.
                        </div>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-6">
                    {statusMessage && (
                        <div className={`p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500 border ${statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${statusMessage.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                {statusMessage.type === 'success' ? '✓' : '!'}
                            </div>
                            <p className="font-bold text-sm tracking-tight">{statusMessage.text}</p>
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
                    <LimitIndicator manualData={{ currentUsers: currentUsersCount, maxUsers, percentageUsed }} />

                    {upgradeRecommended && (
                        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                            <h3 className="font-black text-xl mb-3 relative z-10">Upgrade to Pro</h3>
                            <p className="text-indigo-100 text-sm mb-6 leading-relaxed relative z-10 font-medium">
                                Desbloquea usuarios ilimitados y análisis avanzado de márgenes.
                            </p>
                            <button className="w-full bg-white text-indigo-700 font-bold py-4 rounded-2xl hover:bg-indigo-50 transition-all shadow-xl active:scale-95 relative z-10">
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
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                        <input name="full_name" type="text" placeholder="Ej: Juan Pérez" className="w-full px-5 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all" value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rol</label>
                        <select name="role" className="w-full px-5 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all" value={newUserRole} onChange={(e: any) => setNewUserRole(e.target.value)}>
                            <option value="manager">Manager</option>
                            <option value="operator">Operador</option>
                            <option value="viewer">Lector</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                        <input name="email" type="email" placeholder="colaborador@empresa.com" className="w-full px-5 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contraseña</label>
                        <input name="password" type="password" placeholder="••••••••" className="w-full px-5 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} required />
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
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                        <input type="text" className="w-full px-5 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rol</label>
                        <select className={`w-full px-5 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all ${!isManager ? 'opacity-50 cursor-not-allowed' : ''}`} value={editRole} onChange={(e) => setEditRole(e.target.value)} disabled={!isManager}>
                            <option value="manager">Manager</option>
                            <option value="operator">Operador</option>
                            <option value="viewer">Lector</option>
                        </select>
                        {!isManager && <p className="text-[10px] text-orange-600 font-bold ml-1">Solo Managers pueden cambiar roles.</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nueva Contraseña (Opcional)</label>
                        <input type="password" placeholder="Dejar en blanco para no cambiar" className="w-full px-5 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
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
