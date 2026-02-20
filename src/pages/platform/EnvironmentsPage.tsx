import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Layers, Archive, Shield, ExternalLink } from 'lucide-react';
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
            // Super Admin sees ALL environments
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .order('created_at', { ascending: false });

            if (data) setCompanies(data);
        } else {
            // Regular user sees their own
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Environments</h1>
                    <p className="text-slate-500">Manage your deployed instances and subscriptions.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={16} />
                    New Environment
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                <Search className="ml-2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Search environments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 border-none bg-transparent placeholder-slate-400 focus:ring-0 text-sm"
                />
            </div>

            {/* Table */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
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
