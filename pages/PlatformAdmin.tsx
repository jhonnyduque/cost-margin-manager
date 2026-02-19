import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { tokens } from '../src/design/design-tokens';
import {
    Plus,
    Building2,
    Search,
    ArrowRight,
    Globe,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ShieldCheck
} from 'lucide-react';
import { PageHeader } from '../src/components/ui/PageHeader';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { StatCard } from '../src/components/ui/StatCard';
import { Input } from '../src/components/ui/Input';
import { Badge } from '../src/components/ui/Badge';
import { EmptyState } from '../src/components/ui/EmptyState';
import EditTenantModal from '../components/EditTenantModal';

export default function PlatformAdmin() {
    const { enterCompanyAsFounder } = useAuth();
    const [companies, setCompanies] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [editingCompany, setEditingCompany] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form states
    const [companyName, setCompanyName] = useState('');
    const [companySlug, setCompanySlug] = useState('');
    const [adminEmail, setAdminEmail] = useState('');

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            setLoading(true);
            const [companiesRes, metricsRes] = await Promise.all([
                supabase
                    .from('companies')
                    .select('*')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('platform_metrics')
                    .select('*')
                    .single()
            ]);

            if (companiesRes.error) throw companiesRes.error;
            if (metricsRes.error) throw metricsRes.error;

            setCompanies(companiesRes.data || []);
            setMetrics(metricsRes.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleProvision = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            const { data, error } = await supabase.functions.invoke('beto-create-company', {
                body: {
                    company_name: companyName,
                    company_slug: companySlug.toLowerCase(),
                    admin_email: adminEmail
                }
            });

            if (error) throw error;

            setStatusMessage({
                type: 'success',
                text: `Tenant provisionado con éxito: ${adminEmail}.`
            });

            setCompanyName('');
            setCompanySlug('');
            setAdminEmail('');
            setShowForm(false);
            fetchCompanies();
        } catch (err: any) {
            console.error('Provisioning error:', err);
            setStatusMessage({
                type: 'error',
                text: err.message || 'Error al provisionar el tenant.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen" style={{ backgroundColor: tokens.colors.bg, padding: tokens.spacing.xl }}>
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <PageHeader
                    title="Control Maestro BETO"
                    description="Gestión global de tenants y provisión de servicios."
                    actions={
                        <Button
                            icon={<Plus size={20} />}
                            onClick={() => setShowForm(!showForm)}
                        >
                            Provisionar Tenant
                        </Button>
                    }
                />

                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        title="Total Tenants"
                        value={metrics?.total_tenants || 0}
                        icon={Building2}
                    />
                    <StatCard
                        title="Activos"
                        value={metrics?.active_tenants || 0}
                        icon={CheckCircle2}
                    />
                    <StatCard
                        title="Suspendidos"
                        value={metrics?.suspended_tenants || 0}
                        icon={AlertCircle}
                    />
                    <StatCard
                        title="MRR Estimado"
                        value={`$${metrics?.mrr_estimate || 0}`}
                        icon={Globe}
                    />
                </div>

                {/* Status Messages */}
                {statusMessage && (
                    <div
                        style={{
                            padding: tokens.spacing.md,
                            borderRadius: tokens.radius.md,
                            backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${statusMessage.type === 'success' ? tokens.colors.success : tokens.colors.error}`,
                            color: statusMessage.type === 'success' ? '#059669' : '#DC2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing.sm
                        }}
                    >
                        {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                        <span style={{ fontWeight: 500 }}>{statusMessage.text}</span>
                    </div>
                )}

                {/* Provision Form */}
                {showForm && (
                    <Card className="animate-in slide-in-from-top-4 fade-in duration-300">
                        <div className="mb-6 flex items-center gap-2">
                            <Building2 size={24} style={{ color: tokens.colors.brand }} />
                            <h2 style={{ ...tokens.typography.titleMd, margin: 0 }}>Detalle de Provisión</h2>
                        </div>

                        <form onSubmit={handleProvision} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Input
                                label="Nombre Comercial"
                                placeholder="Ej: Manufactura Norte"
                                value={companyName}
                                onChange={e => setCompanyName(e.target.value)}
                                required
                            />
                            <Input
                                label="ID / Slug único"
                                placeholder="ej-slug-empresa"
                                value={companySlug}
                                onChange={e => setCompanySlug(e.target.value)}
                                required
                            />
                            <Input
                                label="Email del Administrador"
                                placeholder="admin@empresa.com"
                                type="email"
                                value={adminEmail}
                                onChange={e => setAdminEmail(e.target.value)}
                                required
                            />

                            <div className="md:col-span-3 flex justify-end gap-3 pt-4 border-t" style={{ borderColor: tokens.colors.border }}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowForm(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    isLoading={isSubmitting}
                                    icon={<ArrowRight size={16} />}
                                >
                                    Ejecutar Provisión
                                </Button>
                            </div>
                        </form>
                    </Card>
                )}

                {/* Tenants List */}
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h2 style={{ ...tokens.typography.titleMd, margin: 0 }}>
                            Tenants Activos
                            <span style={{ color: tokens.colors.text.muted, marginLeft: tokens.spacing.sm }}>
                                {companies.length}
                            </span>
                        </h2>
                        <div className="w-full sm:w-auto sm:min-w-[300px]">
                            <Input
                                placeholder="Buscar empresa..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-slate-400" size={32} />
                        </div>
                    ) : filteredCompanies.length === 0 ? (
                        <div className="py-12">
                            <EmptyState
                                title="No se encontraron empresas"
                                description={searchTerm ? `No hay resultados para "${searchTerm}"` : "No hay empresas registradas aún."}
                                icon={Building2}
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredCompanies.map(company => (
                                <Card key={company.id} className="group hover:shadow-lg transition-all duration-300 flex flex-col justify-between h-full">
                                    <div>
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                                    style={{ backgroundColor: tokens.colors.bg }}
                                                >
                                                    <Building2 size={20} style={{ color: tokens.colors.text.secondary }} />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h3 className="truncate" style={{ ...tokens.typography.body, fontWeight: 600 }}>{company.name}</h3>
                                                    <p className="truncate" style={{ ...tokens.typography.caption }}>{company.slug}</p>
                                                </div>
                                            </div>
                                            <Badge
                                                variant={company.subscription_status === 'active' ? 'success' : 'warning'}
                                                className="shrink-0"
                                            >
                                                {company.subscription_status || 'unknown'}
                                            </Badge>
                                        </div>

                                        <div className="space-y-3 mb-6">
                                            <div className="flex justify-between text-sm">
                                                <span style={{ color: tokens.colors.text.secondary }}>Plan</span>
                                                <Badge variant="neutral">{company.subscription_tier || 'Free'}</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-4 border-t mt-auto" style={{ borderColor: tokens.colors.border }}>
                                        <Button
                                            variant="primary"
                                            className="w-full"
                                            onClick={() => enterCompanyAsFounder(company.id)}
                                            icon={<ArrowRight size={14} />}
                                            style={{ height: '32px', fontSize: '0.75rem' }}
                                        >
                                            Entrar
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {editingCompany && (
                <EditTenantModal
                    company={editingCompany}
                    onClose={() => setEditingCompany(null)}
                    onUpdate={() => {
                        fetchCompanies();
                        setStatusMessage({ type: 'success', text: 'Empresa actualizada correctamente.' });
                    }}
                />
            )}
        </div>
    );
}
