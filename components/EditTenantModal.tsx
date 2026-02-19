import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import {
    X,
    Save,
    Building2,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Select } from '@/src/components/ui/Select';
import { Card } from '@/src/components/ui/Card';
import { tokens } from '@/src/design/design-tokens';

interface EditTenantModalProps {
    company: any;
    onClose: () => void;
    onUpdate: () => void;
}

const EditTenantModal: React.FC<EditTenantModalProps> = ({ company, onClose, onUpdate }) => {
    const [name, setName] = useState(company.name);
    const [slug, setSlug] = useState(company.slug);
    const [status, setStatus] = useState(company.subscription_status);
    const [tier, setTier] = useState(company.subscription_tier);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const { error: updateError } = await supabase
                .from('companies')
                .update({
                    name,
                    slug: slug.toLowerCase(),
                    subscription_status: status,
                    subscription_tier: tier,
                    updated_at: new Date().toISOString()
                })
                .eq('id', company.id);

            if (updateError) throw updateError;

            onUpdate();
            onClose();
        } catch (err: any) {
            console.error('Error updating company:', err);
            setError(err.message || 'Error al actualizar la empresa.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{
                backgroundColor: 'rgba(15, 23, 42, 0.4)', // Slate-900 with opacity
                backdropFilter: 'blur(4px)'
            }}
        >
            <Card
                className="w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200"
                style={{
                    boxShadow: tokens.shadow.elevated,
                    padding: 0 // Reset padding for custom header/body split
                }}
            >
                <header
                    style={{
                        padding: tokens.spacing.lg,
                        borderBottom: `1px solid ${tokens.colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'between',
                        backgroundColor: tokens.colors.bg
                    }}
                    className="flex justify-between items-center"
                >
                    <div className="flex items-center gap-3">
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                backgroundColor: tokens.colors.brand,
                                borderRadius: tokens.radius.md,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: tokens.colors.surface
                            }}
                        >
                            <Building2 size={20} />
                        </div>
                        <div>
                            <h2
                                style={{
                                    fontSize: tokens.typography.titleMd.fontSize,
                                    fontWeight: tokens.typography.titleMd.fontWeight,
                                    color: tokens.colors.text.primary
                                }}
                            >
                                Editar Tenant
                            </h2>
                            <p style={{ ...tokens.typography.caption, fontSize: '0.75rem' }}>
                                {company.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            color: tokens.colors.text.secondary,
                            padding: tokens.spacing.xs,
                            borderRadius: tokens.radius.full
                        }}
                        className="hover:bg-gray-100 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} style={{ padding: tokens.spacing.lg }}>
                    {error && (
                        <div
                            style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: `1px solid ${tokens.colors.error}`,
                                padding: tokens.spacing.md,
                                borderRadius: tokens.radius.md,
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing.sm,
                                marginBottom: tokens.spacing.lg
                            }}
                        >
                            <AlertCircle size={18} color={tokens.colors.error} />
                            <span style={{ fontSize: tokens.typography.caption.fontSize, fontWeight: 700, color: '#DC2626' }}>
                                {error}
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <Input
                            label="Nombre Comercial"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                        <Input
                            label="Slug / ID Único"
                            value={slug}
                            onChange={e => setSlug(e.target.value)}
                            required
                        />
                        <Select
                            label="Estado del Servicio"
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                        >
                            <option value="trialing">Trialing</option>
                            <option value="active">Active</option>
                            <option value="past_due">Past Due</option>
                            <option value="suspended">Suspended</option>
                            <option value="canceled">Canceled</option>
                        </Select>
                        <Select
                            label="Nivel de Suscripción"
                            value={tier}
                            onChange={e => setTier(e.target.value)}
                        >
                            <option value="starter">Starter</option>
                            <option value="professional">Professional</option>
                            <option value="enterprise">Enterprise</option>
                            <option value="premium">Premium (Legacy)</option>
                        </Select>
                    </div>

                    <div
                        className="flex justify-end gap-3 pt-6"
                        style={{ borderTop: `1px solid ${tokens.colors.border}` }}
                    >
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isSubmitting}
                            icon={<Save size={16} />}
                        >
                            Guardar Cambios
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default EditTenantModal;
