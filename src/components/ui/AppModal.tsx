import React, { useEffect, useRef, ReactNode } from 'react';
import { X, Pencil, Plus, AlertTriangle, Settings } from 'lucide-react';

// ─── Decision Tier System (UX Plan v1.2) ─────────────────────────────────────
// T1 — Micro:       No modal. Feedback inline. (filtros, toggles)
// T2 — Táctico:     Modal estándar. Ctrl+G guarda. Confirm si dirty.
// T3 — Estratégico: Modal con badge de impacto. Confirm siempre.
// T4 — Estructural: Modal amplio. Sin Escape en pasos avanzados. (futuro: wizard)

export type ModalTier = 2 | 3 | 4;
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AppModalProps {
    // — Core —
    isOpen: boolean;
    onClose: () => void;
    onSave?: () => void | Promise<void>;
    title: string;
    description?: string;
    children: ReactNode;

    // — Tier & Behavior —
    tier?: ModalTier;           // default: 2
    isDirty?: boolean;          // activa "¿Descartar cambios?" en T2+
    loading?: boolean;

    // — Visual —
    size?: ModalSize;           // default: 'md'
    icon?: ReactNode;           // ícono en el header (auto según tier si no se pasa)
    saveLabel?: string;         // default: 'Guardar'
    cancelLabel?: string;       // default: 'Cancelar'

    // — Footer custom —
    footer?: ReactNode;         // reemplaza el footer por defecto
    hideFooter?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl',
};

const tierOverlayClasses: Record<ModalTier, string> = {
    2: 'bg-black/40',
    3: 'bg-black/60',
    4: 'bg-black/80',
};

const tierDefaultIcons: Record<ModalTier, ReactNode> = {
    2: <Plus size={16} />,
    3: <AlertTriangle size={16} />,
    4: <Settings size={16} />,
};

const tierIconBg: Record<ModalTier, string> = {
    2: 'bg-indigo-50 text-indigo-600',
    3: 'bg-amber-50 text-amber-600',
    4: 'bg-slate-100 text-slate-600',
};

const tierSaveBg: Record<ModalTier, string> = {
    2: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100',
    3: 'bg-amber-600 hover:bg-amber-700 shadow-amber-100',
    4: 'bg-slate-800 hover:bg-slate-900 shadow-slate-100',
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

    // — Prevent body scroll ────────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // — Keyboard shortcuts ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+G → Guardar
            if (e.ctrlKey && e.key === 'g') {
                e.preventDefault();
                if (onSave && !loading) onSave();
            }
            // Escape → Cerrar (T4 podría bloquearlo, aquí lo dejamos libre)
            if (e.key === 'Escape') {
                handleClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onSave, loading, isDirty]);

    if (!isOpen) return null;

    // — Close con confirm si hay cambios sin guardar ───────────────────────────
    const handleClose = () => {
        if (isDirty && tier >= 2) {
            if (!window.confirm('Hay cambios sin guardar. ¿Descartar y cerrar?')) return;
        }
        onClose();
    };

    // — Backdrop click ─────────────────────────────────────────────────────────
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) handleClose();
    };

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 ${tierOverlayClasses[tier]} backdrop-blur-sm`}
            onClick={handleBackdropClick}
        >
            {/* Modal panel */}
            <div
                className={`
          animate-in zoom-in-95 duration-200
          w-full ${sizeClasses[size]}
          flex flex-col overflow-hidden
          rounded-2xl bg-white shadow-2xl
          max-h-[90vh]
        `}
            >
                {/* ── Header ──────────────────────────────────────────────────────── */}
                <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
                    <div className={`flex size-9 flex-shrink-0 items-center justify-center rounded-xl ${tierIconBg[tier]}`}>
                        {resolvedIcon}
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-bold text-slate-900">{title}</h3>
                        {description && (
                            <p className="truncate text-xs text-slate-400">{description}</p>
                        )}
                    </div>

                    {/* Tier badge — solo T3+ */}
                    {tier >= 3 && (
                        <span className={`hidden sm:inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider
              ${tier === 3 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                            {tier === 3 ? 'Alto Impacto' : 'Sistema'}
                        </span>
                    )}

                    <button
                        onClick={handleClose}
                        aria-label="Cerrar"
                        className="flex size-9 min-h-[36px] min-w-[36px] flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Scrollable body ─────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                    {children}
                </div>

                {/* ── Footer sticky ───────────────────────────────────────────────── */}
                {!hideFooter && (
                    <div className="flex flex-shrink-0 items-center gap-3 border-t border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
                        {footer ? footer : (
                            <>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition-all hover:bg-slate-50 active:scale-[0.98]"
                                >
                                    {cancelLabel}
                                </button>

                                {onSave && (
                                    <button
                                        type="button"
                                        onClick={() => onSave()}
                                        disabled={loading}
                                        className={`flex flex-[1.5] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${tierSaveBg[tier]}`}
                                    >
                                        {loading ? (
                                            <>
                                                <div className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                                <span>Procesando...</span>
                                            </>
                                        ) : (
                                            <>
                                                {tier === 2 ? <Pencil size={14} /> : tier === 3 ? <AlertTriangle size={14} /> : <Settings size={14} />}
                                                <span className="hidden sm:inline">{saveLabel}</span>
                                                <span className="sm:hidden">OK</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
