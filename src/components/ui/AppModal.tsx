import React, { useEffect, ReactNode } from 'react';
import { X, Pencil, Plus, AlertTriangle, Settings } from 'lucide-react';
import { Button } from './Button';

// AppModal consume clases CSS de global.css exclusivamente.
// El sistema de tiers se preserva — controla comportamiento UX, no estilos inventados.
// Colores de tier se expresan con variables CSS de global.css.
//
// ─── Decision Tier System (UX Plan v1.2) ──────────────────────────────────────
// T2 — Táctico:     Modal estándar. Ctrl+G guarda. Confirm si dirty.
// T3 — Estratégico: Modal con badge de impacto. Confirm siempre.
// T4 — Estructural: Modal amplio. Sin Escape en pasos avanzados.

export type ModalTier = 2 | 3 | 4;
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AppModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: () => void | Promise<void>;
    title: string;
    description?: string;
    children: ReactNode;
    tier?: ModalTier;
    isDirty?: boolean;
    loading?: boolean;
    size?: ModalSize;
    icon?: ReactNode;
    saveLabel?: string;
    cancelLabel?: string;
    footer?: ReactNode;
    hideFooter?: boolean;
}

// Ancho máximo por tamaño usando variables CSS de contenedores
const sizeStyle: Record<ModalSize, React.CSSProperties> = {
    sm: { maxWidth: '24rem' },
    md: { maxWidth: '32rem' },
    lg: { maxWidth: '42rem' },
    xl: { maxWidth: '64rem' },
};

// Opacidad del overlay por tier
const tierOverlayOpacity: Record<ModalTier, string> = {
    2: 'rgba(15, 23, 42, 0.40)',
    3: 'rgba(15, 23, 42, 0.60)',
    4: 'rgba(15, 23, 42, 0.80)',
};

// Ícono por defecto por tier
const tierDefaultIcons: Record<ModalTier, ReactNode> = {
    2: <Plus size={16} />,
    3: <AlertTriangle size={16} />,
    4: <Settings size={16} />,
};

// Color del ícono de header por tier — usando variables CSS del sistema
const tierIconStyle: Record<ModalTier, React.CSSProperties> = {
    2: { background: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
    3: { background: 'var(--color-warning-soft)', color: 'var(--color-warning)' },
    4: { background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' },
};

// Badge de tier T3+
const tierBadgeStyle: Record<ModalTier, React.CSSProperties> = {
    2: {},
    3: { background: 'var(--color-warning-soft)', color: 'var(--color-warning)' },
    4: { background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' },
};

// Variante del botón Guardar por tier
const tierSaveVariant: Record<ModalTier, 'primary' | 'secondary' | 'danger' | 'ghost'> = {
    2: 'primary',
    3: 'primary',
    4: 'secondary',
};

export function AppModal({
    isOpen,
    onClose,
    onSave,
    title,
    description,
    children,
    tier = 2,
    isDirty = false,
    loading = false,
    size = 'md',
    icon,
    saveLabel = 'Guardar',
    cancelLabel = 'Cancelar',
    footer,
    hideFooter = false,
}: AppModalProps) {
    const resolvedIcon = icon ?? tierDefaultIcons[tier];

    // Bloquear scroll del body
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Atajos de teclado
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'g') {
                e.preventDefault();
                if (onSave && !loading) onSave();
            }
            if (e.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onSave, loading, isDirty]);

    if (!isOpen) return null;

    const handleClose = () => {
        if (isDirty && tier >= 2) {
            if (!window.confirm('Hay cambios sin guardar. ¿Descartar y cerrar?')) return;
        }
        onClose();
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) handleClose();
    };

    return (
        <div
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-16)',
                background: tierOverlayOpacity[tier],
                backdropFilter: 'blur(4px)',
            }}
        >
            {/* Panel del modal */}
            <div
                className="modal-card"
                style={{
                    ...sizeStyle[size],
                    width: '100%',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,           // padding lo manejan header/body/footer
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-12)',
                    padding: 'var(--space-16) var(--space-24)',
                    borderBottom: 'var(--border-default)',
                    flexShrink: 0,
                }}>
                    {/* Ícono de tier */}
                    <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '2.25rem',
                        height: '2.25rem',
                        borderRadius: 'var(--radius-lg)',
                        flexShrink: 0,
                        ...tierIconStyle[tier],
                    }}>
                        {resolvedIcon}
                    </span>

                    {/* Título y descripción */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{
                            margin: 0,
                            fontSize: 'var(--text-h3-size)',
                            fontWeight: 'var(--text-h3-weight)' as any,
                            color: 'var(--color-neutral-900)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {title}
                        </h4>
                        {description && (
                            <p className="text-small text-muted" style={{ marginTop: 'var(--space-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Badge de tier T3+ */}
                    {tier >= 3 && (
                        <span className="badge" style={tierBadgeStyle[tier]}>
                            {tier === 3 ? 'Alto Impacto' : 'Sistema'}
                        </span>
                    )}

                    {/* Botón cerrar */}
                    <button
                        onClick={handleClose}
                        aria-label="Cerrar"
                        className="btn-ghost btn-sm"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '2.25rem',
                            height: '2.25rem',
                            flexShrink: 0,
                            padding: 0,
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body scrollable */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 'var(--space-24)',
                }}>
                    {children}
                </div>

                {/* Footer */}
                {!hideFooter && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-12)',
                        padding: 'var(--space-16) var(--space-24)',
                        borderTop: 'var(--border-default)',
                        background: 'var(--color-neutral-0)',
                        flexShrink: 0,
                    }}>
                        {footer ?? (
                            <>
                                <Button
                                    variant="secondary"
                                    onClick={handleClose}
                                    style={{ flex: 1 }}
                                >
                                    {cancelLabel}
                                </Button>
                                {onSave && (
                                    <Button
                                        variant={tierSaveVariant[tier]}
                                        onClick={() => onSave()}
                                        isLoading={loading}
                                        style={{ flex: 1.5 }}
                                    >
                                        {!loading && (
                                            tier === 2 ? <Pencil size={14} /> :
                                                tier === 3 ? <AlertTriangle size={14} /> :
                                                    <Settings size={14} />
                                        )}
                                        {saveLabel}
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}