import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { LimitIndicator } from '../components/LimitIndicator';
import { UserPlus, Trash2, Shield, Mail } from 'lucide-react';

export default function Team() {
    const { currentCompany, userRole, isLoading: authLoading } = useAuth();
    const [members, setMembers] = useState<any[]>([]);
    const [maxUsers, setMaxUsers] = useState(3); // Default safety
    const [loading, setLoading] = useState(true);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserFullName, setNewUserFullName] = useState('');
    const [newUserRole, setNewUserRole] = useState<'manager' | 'operator' | 'viewer'>('operator');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [editingMember, setEditingMember] = useState<any | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [editPassword, setEditPassword] = useState('');

    const isManager = userRole === 'manager' || userRole === 'owner';

    const currentUsersCount = members.length;
    const isAtLimit = currentUsersCount >= maxUsers;
    const percentageUsed = Math.min(100, (currentUsersCount / maxUsers) * 100);
    const upgradeRecommended = percentageUsed >= 80;

    useEffect(() => {
        if (!authLoading && currentCompany) {
            console.log('ACTIVE COMPANY:', currentCompany.id);
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
            console.log('FETCHING FROM CANONICAL VIEW...');
            const { data, error } = await supabase
                .from('team_members_view')
                .select('*')
                .eq('company_id', currentCompany?.id)
                .order('joined_at', { ascending: true });

            if (error) throw error;
            console.log('TEAM DATA:', data);
            setMembers(data || []);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isAtLimit) return;

        try {
            setLoading(true);
            setStatusMessage(null);

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

            setStatusMessage({
                type: 'success',
                text: `Usuario ${newUserEmail} creado con éxito.`
            });

            setNewUserEmail('');
            setNewUserFullName('');
            setNewUserPassword('');
            setShowCreateForm(false);
            fetchMembers();
        } catch (error: any) {
            console.error('Error creating user:', error);
            setStatusMessage({
                type: 'error',
                text: error.message || 'Error al crear el usuario.'
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === members.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(members.map(m => m.user_id));
        }
    };

    const handleBulkAction = async (action: 'bulk_archive' | 'bulk_delete' | 'print') => {
        if (action === 'print') {
            window.print();
            return;
        }

        if (!confirm(`¿Estás seguro de que deseas ejecutar esta acción masiva en ${selectedIds.length} usuarios?`)) return;

        try {
            setLoading(true);
            const { error } = await supabase.functions.invoke('beto-manage-team', {
                body: {
                    action,
                    user_ids: selectedIds,
                    company_id: currentCompany?.id
                }
            });

            if (error) throw error;

            setStatusMessage({ type: 'success', text: 'Acción masiva completada con éxito.' });
            setSelectedIds([]);
            fetchMembers();
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

    const handleUpdateMember = async (e: React.FormEvent) => {
        e.preventDefault();
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
            console.error(error);
            setStatusMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const startEditing = (member: any) => {
        setEditingMember(member);
        setEditName(member.full_name || '');
        setEditRole(member.role || '');
        setEditPassword('');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
                    <p className="text-gray-500 mt-1">Gestiona el acceso a tu organización {currentCompany?.name}</p>
                </div>

                {/* BLOQUEO PREVENTIVO DE ACCIÓN (Fase 3 Req) */}
                <div className="relative group">
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        disabled={isAtLimit}
                        className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${isAtLimit
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}
            `}
                    >
                        <UserPlus size={18} />
                        Crear Usuario
                    </button>

                    {/* Tooltip contextual si lÃ­mite alcanzado */}
                    {isAtLimit && (
                        <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-gray-800 text-white text-xs rounded shadow-lg z-50 hidden group-hover:block">
                            Límite de usuarios alcanzado. Actualiza tu plan para invitar más personas.
                        </div>
                    )}
                </div>
            </header>

            {/* COMPONENTE AWARENESS (Fase 3 Req) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">

                    {statusMessage && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-500 ${statusMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statusMessage.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'
                                }`}>
                                {statusMessage.type === 'success' ? '✓' : '!'}
                            </div>
                            <p className="font-bold text-sm">{statusMessage.text}</p>
                            <button
                                onClick={() => setStatusMessage(null)}
                                className="ml-auto text-current opacity-50 hover:opacity-100"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {showCreateForm && (
                        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm space-y-4">
                            <h3 className="font-bold text-gray-900 text-sm">Nuevo Miembro del Equipo</h3>
                            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Juan Pérez"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={newUserFullName}
                                        onChange={(e) => setNewUserFullName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Rol</label>
                                    <select
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        value={newUserRole}
                                        onChange={(e: any) => setNewUserRole(e.target.value)}
                                    >
                                        <option value="manager">Manager</option>
                                        <option value="operator">Operador</option>
                                        <option value="viewer">Lector</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email</label>
                                    <input
                                        type="email"
                                        placeholder="colaborador@empresa.com"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={newUserEmail}
                                        onChange={(e) => setNewUserEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Contraseña Temporal</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={newUserPassword}
                                        onChange={(e) => setNewUserPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateForm(false)}
                                        className="px-4 py-2 text-gray-500 font-medium hover:text-gray-700"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md shadow-blue-100"
                                    >
                                        Crear Usuario
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {selectedIds.length > 0 && (
                            <div className="bg-indigo-50 p-3 flex items-center gap-4 border-b border-indigo-100 animate-in slide-in-from-top-2">
                                <span className="text-sm font-bold text-indigo-700 ml-2">
                                    {selectedIds.length} seleccionados
                                </span>
                                <div className="h-4 w-px bg-indigo-200 mx-2" />
                                <button onClick={() => handleBulkAction('bulk_archive')} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider">Archivar</button>
                                <button onClick={() => handleBulkAction('bulk_delete')} className="text-xs font-bold text-red-600 hover:text-red-800 uppercase tracking-wider">Eliminar</button>
                                <button onClick={() => handleBulkAction('print')} className="text-xs font-bold text-gray-600 hover:text-gray-800 uppercase tracking-wider">Imprimir</button>
                            </div>
                        )}
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-4 w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === members.length && members.length > 0}
                                            onChange={toggleSelectAll}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </th>
                                    <th className="px-6 py-4">Usuario</th>
                                    <th className="px-6 py-4">Rol</th>
                                    <th className="px-6 py-4">Unido el</th>
                                    <th className="px-6 py-4">Último Acceso</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={5} className="p-6 text-center text-gray-400">Cargando equipo...</td></tr>
                                ) : members.map((member) => (
                                    <tr key={member.id} className={`hover:bg-gray-50/50 transition-colors ${selectedIds.includes(member.user_id) ? 'bg-indigo-50/30' : ''}`}>
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(member.user_id)}
                                                onChange={() => toggleSelect(member.user_id)}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                                                    {member.email?.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{member.full_name || 'Sin nombre'}</div>
                                                    <div className="text-sm text-gray-500">{member.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${member.is_active ? 'bg-gray-100 text-gray-800 border-gray-200' : 'bg-orange-50 text-orange-700 border-orange-100'
                                                }`}>
                                                <Shield size={10} />
                                                {member.role} {!member.is_active && '(Archivado)'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(member.joined_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {member.last_sign_in_at
                                                ? new Date(member.last_sign_in_at).toLocaleString()
                                                : 'Nunca'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 text-gray-400">
                                                {/* Edit action placeholder */}
                                                <button
                                                    onClick={() => startEditing(member)}
                                                    className="hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50"
                                                    title="Editar"
                                                >
                                                    <Shield size={18} />
                                                </button>
                                                <button onClick={() => handleDeleteUser(member.user_id)} className="hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50" title="Eliminar">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SIDEBAR DERECHO: LIMITS AWARENESS */}
                <div className="space-y-6">
                    <LimitIndicator
                        manualData={{
                            currentUsers: currentUsersCount,
                            maxUsers: maxUsers,
                            percentageUsed
                        }}
                    />

                    {upgradeRecommended && (
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-white shadow-lg">
                            <h3 className="font-bold text-lg mb-2">🚀 Upgrade to Pro</h3>
                            <p className="text-indigo-100 text-sm mb-4">
                                Desbloquea usuarios ilimitados, análisis avanzado de márgenes y soporte prioritario.
                            </p>
                            <button className="w-full bg-white text-indigo-700 font-bold py-2 rounded-lg hover:bg-gray-50 transition-colors">
                                Ver Planes
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DE EDICIÓN */}
            {editingMember && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-white font-bold">Editar Miembro</h3>
                            <button onClick={() => setEditingMember(null)} className="text-white/80 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleUpdateMember} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Nombre Completo</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Rol</label>
                                <select
                                    className={`w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white outline-none ${!isManager ? 'bg-gray-50 cursor-not-allowed opacity-75' : ''}`}
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value)}
                                    disabled={!isManager}
                                >
                                    <option value="manager">Manager</option>
                                    <option value="operator">Operador</option>
                                    <option value="viewer">Lector</option>
                                </select>
                                {!isManager && <p className="text-[10px] text-orange-600 font-medium">Solo Managers pueden cambiar roles.</p>}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Nueva Contraseña (Opcional)</label>
                                <input
                                    type="password"
                                    placeholder="Dejar en blanco para no cambiar"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditingMember(null)}
                                    className="flex-1 py-2 text-gray-500 font-medium hover:bg-gray-50 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
