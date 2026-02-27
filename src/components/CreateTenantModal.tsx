import React, { useState } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { CURRENCIES, CurrencyCode } from '@/hooks/useCurrency';

interface CreateTenantModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// 🔧 Catálogo canónico de planes con sus límites
const PLAN_SEAT_LIMITS: Record<string, number> = {
    demo: 3,
    starter: 4,
    growth: 10,
    scale: 25,
    enterprise: 999
};

export const CreateTenantModal: React.FC<CreateTenantModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 🔧 seat_limit inicial basado en el plan por defecto
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        admin_email: '',
        seat_limit: PLAN_SEAT_LIMITS['starter'],
        initial_plan: 'starter',
        currency: 'USD' as CurrencyCode
    });

    // ✅ useEffect ELIMINADO - handleChange es la única fuente de verdad

    if (!isOpen) return null;

    // 🔧 CORREGIDO: Auto-generación inteligente del slug + auto-sync de seat_limit
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        setFormData(prev => {
            const updates = { ...prev, [name]: value };

            // Auto-generar slug SOLO si:
            // 1. El campo cambiado es 'name'
            // 2. Y el slug está vacío O el slug actual coincide con el name anterior (fue auto-generado)
            if (name === 'name') {
                const newSlug = value.toLowerCase()
                    .replace(/[^a-z0-9]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '');

                // Verificar si el slug actual fue auto-generado (coincide con el name anterior)
                const oldSlug = prev.name.toLowerCase()
                    .replace(/[^a-z0-9]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '');

                // Actualizar slug si está vacío O si fue auto-generado previamente
                if (!prev.slug || prev.slug === oldSlug) {
                    updates.slug = newSlug;
                }
            }

            // 🔧 Auto-sync seat_limit cuando cambia el plan (ÚNICA FUENTE)
            if (name === 'initial_plan') {
                updates.seat_limit = PLAN_SEAT_LIMITS[value] || 5;
            }

            return updates;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.functions.invoke('beto-create-company', {
                body: {
                    company_name: formData.name,
                    company_slug: formData.slug,
                    admin_email: formData.admin_email,
                    seat_limit: formData.seat_limit,
                    initial_plan: formData.initial_plan,
                    currency: formData.currency
                }
            });

            if (error) throw error;
            if (data && data.error) throw new Error(data.error);

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Provisioning error:', err);
            setError(err.message || 'Failed to create environment.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h2 className="text-lg font-semibold text-slate-800">Provision New Environment</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Environment Name</label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Acme Corp"
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Unique Slug</label>
                            <input
                                type="text"
                                name="slug"
                                required
                                value={formData.slug}
                                onChange={handleChange}
                                placeholder="acme-corp"
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 font-mono"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Admin Email</label>
                            <input
                                type="email"
                                name="admin_email"
                                required
                                value={formData.admin_email}
                                onChange={handleChange}
                                placeholder="admin@acme.com"
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Initial Plan</label>
                            <select
                                name="initial_plan"
                                value={formData.initial_plan}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="demo">Demo (3 users)</option>
                                <option value="starter">Starter (4 users)</option>
                                <option value="growth">Growth (10 users)</option>
                                <option value="scale">Scale (25 users)</option>
                                <option value="enterprise">Enterprise (999 users)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Moneda</label>
                            <select
                                name="currency"
                                value={formData.currency}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                {CURRENCIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Seat Limit</label>
                            <input
                                type="number"
                                name="seat_limit"
                                required
                                min="1"
                                value={formData.seat_limit}
                                readOnly
                                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-50 text-slate-600 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Auto-ajustado según el plan
                            </p>
                        </div>
                    </div>

                    {/* Hint visual del plan seleccionado */}
                    <div className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-700 border border-indigo-100">
                        <strong>Plan seleccionado:</strong> {formData.initial_plan.charAt(0).toUpperCase() + formData.initial_plan.slice(1)}
                        {' '}• <strong>Límite:</strong> {formData.seat_limit} usuarios
                    </div>

                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Provision Environment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};