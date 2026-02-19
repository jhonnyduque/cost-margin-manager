import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { LimitIndicator } from '../components/LimitIndicator';
import { UserPlus, Trash2, Shield, Mail } from 'lucide-react';

export default function Team() {
    const { currentCompany } = useAuth();
    const { isAtLimit, upgradeRecommended } = usePlanLimits(); // Hook de Fase 3
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [showInviteForm, setShowInviteForm] = useState(false);

    useEffect(() => {
        if (currentCompany) {
            fetchMembers();
        }
    }, [currentCompany]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('company_members')
                .select(`
          id,
          role,
          is_active,
          users ( email, full_name, last_sign_in_at )
        `)
                .eq('company_id', currentCompany?.id);

            if (error) throw error;
            setMembers(data || []);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isAtLimit) return; // Frontend enforcement preventivo

        // Aquí iría la lógica real de invitación (usualmente via Edge Function o tabla invitations)
        alert(`Simulación: Invitación enviada a ${inviteEmail}`);
        setInviteEmail('');
        setShowInviteForm(false);
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
                        onClick={() => setShowInviteForm(!showInviteForm)}
                        disabled={isAtLimit}
                        className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${isAtLimit
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}
            `}
                    >
                        <UserPlus size={18} />
                        Invitar Miembro
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

                    {showInviteForm && (
                        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                            <form onSubmit={handleInvite} className="flex gap-3">
                                <input
                                    type="email"
                                    placeholder="colaborador@empresa.com"
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    required
                                />
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    Enviar
                                </button>
                            </form>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Usuario</th>
                                    <th className="px-6 py-4">Rol</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={4} className="p-6 text-center text-gray-400">Cargando equipo...</td></tr>
                                ) : members.map((member) => (
                                    <tr key={member.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                                                    {member.users?.email?.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{member.users?.full_name || 'Sin nombre'}</div>
                                                    <div className="text-sm text-gray-500">{member.users?.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                <Shield size={10} />
                                                {member.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {member.is_active ? (
                                                <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full">Activo</span>
                                            ) : (
                                                <span className="text-gray-400 text-xs bg-gray-100 px-2 py-1 rounded-full">Inactivo</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-gray-400 hover:text-red-500 transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SIDEBAR DERECHO: LIMITS AWARENESS */}
                <div className="space-y-6">
                    <LimitIndicator />

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
        </div>
    );
}
