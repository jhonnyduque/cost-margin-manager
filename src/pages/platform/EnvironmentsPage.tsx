import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Layers, ExternalLink, ChevronRight, Users, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { Company } from '@/types';
import { CreateTenantModal } from '../../components/CreateTenantModal';
import EditTenantModal from '../../components/EditTenantModal';

export const EnvironmentsPage: React.FC = () => {
    const { user, userCompanies, refreshAuth, enterCompanyAsFounder } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        fetchEnvironments();
    }, [user]);

    const fetchEnvironments = async () => {
        setLoading(true);
        if (user?.is_super_admin) {
            const { data } = await supabase
                .from('companies')
                .select('*')
                .order('created_at', { ascending: false });

            if (data) setCompanies(data);
        } else {
            setCompanies(userCompanies);
        }
        setLoading(false);
    };

    const navigate = useNavigate();

    const handleAccess = async (companyId: string) => {
        if (user?.is_super_admin) {
            await enterCompanyAsFounder(companyId);
            navigate('/dashboard');
        }
    };

    const handleEdit = (company: Company) => {
        setSelectedCompany(company);
        setIsEditModalOpen(true);
    };

    const handleCreateSuccess = () => {
        setIsCreateModalOpen(false);
        fetchEnvironments();
        refreshAuth();
    };

    const handleEditSuccess = () => {
        setIsEditModalOpen(false);
        setSelectedCompany(null);
        fetchEnvironments();
    };

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const statusConfig: Record<string, { color: string; dot: string }> = {
        active: { color: 'text-emerald-700 bg-emerald-50', dot: 'bg-emerald-500' },
        trialing: { color: 'text-blue-700 bg-blue-50', dot: 'bg-blue-500' },
        canceled: { color: 'text-red-700 bg-red-50', dot: 'bg-red-500' },
        past_due: { color: 'text-orange-700 bg-orange-50', dot: 'bg-orange-500' },
    };

    return (
        <div className="space-y-5 lg:space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl lg:text-2xl font-bold text-slate-900 tracking-tight">Environments</h1>
                <p className="text-sm text-slate-500">Manage your deployed instances and subscriptions.</p>
            </div>

            {/* Toolbar: Search + Create */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search environments..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl bg-white pl-9 pr-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    />
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all h-10 w-10 sm:w-auto sm:px-4 flex-shrink-0"
                >
                    <Plus size={18} />
                    <span className="hidden sm:inline text-sm">New Environment</span>
                </button>
            </div>

            {/* ========== MOBILE: Cards ========== */}
            <div className="space-y-3 md:hidden">
                {loading ? (
                    <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center text-slate-400">
                        <div className="mb-3 flex justify-center">
                            <div className="size-8 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
                        </div>
                        Loading environments...
                    </div>
                ) : filteredCompanies.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                        <Layers size={48} className="mx-auto mb-3 text-slate-300" />
                        <p className="font-medium text-slate-500">No environments found.</p>
                    </div>
                ) : (
                    filteredCompanies.map((company) => {
                        const status = statusConfig[company.subscription_status] || statusConfig.active;
                        const seatPercent = Math.min(100, ((company.seat_count || 0) / (company.seat_limit || 1)) * 100);
                        const seatBarColor = seatPercent > 85 ? 'bg-orange-500' : 'bg-indigo-500';

                        return (
                            <div
                                key={company.id}
                                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                            >
                                {/* Top row: icon + name + status */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 flex-shrink-0">
                                            <Layers size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-900 truncate">{company.name}</h3>
                                            <p className="text-xs text-slate-400 font-mono truncate">{company.slug}</p>
                                        </div>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold flex-shrink-0 ${status.color}`}>
                                        <span className={`size-1.5 rounded-full ${status.dot}`} />
                                        {company.subscription_status || 'Unknown'}
                                    </span>
                                </div>

                                {/* Info row: plan + seats */}
                                <div className="mt-3 ml-[52px] flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <Zap size={12} className="text-indigo-500" />
                                        <span className="text-xs font-medium text-slate-600 capitalize">
                                            {company.stripe_price_id ? 'Professional' : (company.subscription_tier || 'Demo')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users size={12} className="text-slate-400" />
                                        <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${seatBarColor}`}
                                                style={{ width: `${seatPercent}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-slate-500">{company.seat_count || 0}/{company.seat_limit || 1}</span>
                                    </div>
                                </div>

                                {/* Action row */}
                                <div className="mt-3 ml-[52px] flex items-center gap-2">
                                    <button
                                        onClick={() => handleAccess(company.id)}
                                        className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100 active:scale-95 transition-all min-h-[32px]"
                                    >
                                        <ExternalLink size={13} />
                                        Acceder
                                    </button>
                                    <button
                                        onClick={() => handleEdit(company)}
                                        className="flex items-center justify-center rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 transition-all min-h-[32px]"
                                    >
                                        <MoreHorizontal size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ========== DESKTOP: Table ========== */}
            <div className="hidden md:block rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Environment Name</th>
                                <th className="px-6 py-4">Plan</th>
                                <th className="px-6 py-4">Usage (Seats)</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">Loading environments...</td>
                                </tr>
                            ) : filteredCompanies.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No environments found.</td>
                                </tr>
                            ) : (
                                filteredCompanies.map((company) => (
                                    <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                                    <Layers size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-900">{company.name}</div>
                                                    <div className="text-xs text-slate-400 font-mono">{company.slug}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="capitalize">{company.stripe_price_id ? 'Professional' : (company.subscription_tier || 'Demo')}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500 rounded-full"
                                                        style={{ width: `${Math.min(100, ((company.seat_count || 0) / (company.seat_limit || 1)) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-500">{company.seat_count || 0}/{company.seat_limit || 1}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${company.subscription_status === 'active' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                                                    company.subscription_status === 'trialing' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                                                        'bg-yellow-50 text-yellow-700 ring-yellow-600/20'
                                                }`}>
                                                {company.subscription_status || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleAccess(company.id)}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-md"
                                                    title="Access Environment"
                                                >
                                                    <ExternalLink size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(company)}
                                                    className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-md"
                                                    title="Settings"
                                                >
                                                    <MoreHorizontal size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateTenantModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={handleCreateSuccess}
            />

            {selectedCompany && (
                <EditTenantModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    company={selectedCompany}
                    onSuccess={handleEditSuccess}
                />
            )}
        </div>
    );
};