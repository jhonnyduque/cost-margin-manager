import React, { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { Company } from '@/types';
import { Activity, Server, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function PlatformAdmin() {
    const { user } = useAuth();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        // Stats fetch
        const { data } = await supabase.from('companies').select('id, seat_count, subscription_status');
        if (data) setCompanies(data);
        setLoading(false);
    };

    if (!user?.is_super_admin) {
        return <div className="p-8 text-center text-red-500">Access Denied: Restricted to Platform Founder.</div>;
    }

    const totalStats = {
        environments: companies.length,
        users: companies.reduce((acc, c) => acc + (c.seat_count || 0), 0),
        active: companies.filter(c => c.subscription_status === 'active').length,
        warnings: companies.filter(c => !['active', 'trialing'].includes(c.subscription_status || '')).length
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Control Center</h1>
                <p className="text-slate-500">System health and operations overview.</p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total Environments</p>
                            <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '-' : totalStats.environments}</p>
                        </div>
                        <div className="rounded-full bg-blue-50 p-3 text-blue-600">
                            <Server size={24} />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Global Active Users</p>
                            <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '-' : totalStats.users}</p>
                        </div>
                        <div className="rounded-full bg-emerald-50 p-3 text-emerald-600">
                            <Users size={24} />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">System Load</p>
                            <p className="mt-2 text-3xl font-bold text-slate-900">Healthy</p>
                        </div>
                        <div className="rounded-full bg-indigo-50 p-3 text-indigo-600">
                            <Activity size={24} />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Alerts</p>
                            <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '-' : totalStats.warnings}</p>
                        </div>
                        <div className="rounded-full bg-amber-50 p-3 text-amber-600">
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Placeholder for Analytics */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center text-slate-400 border-dashed">
                <p>Advanced Analytics Modules Loading...</p>
            </div>
        </div>
    );
}
