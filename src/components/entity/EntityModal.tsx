import React, { useEffect } from 'react';
import { EntityConfig } from './types';
import { Pencil, Plus } from 'lucide-react';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';

interface EntityModalProps<T> {
    config: EntityConfig<T>;
    item?: T | null;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<T>) => void;
    children: React.ReactNode;
    loading?: boolean;
}

export function EntityModal<T>({
    config,
    item,
    isOpen,
    onClose,
    onSubmit,
    children,
    loading
}: EntityModalProps<T>) {
    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Prevent body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const isEdit = !!item;
    const title = isEdit ? `Editar ${config.name}` : `Crear ${config.name}`;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`animate-in zoom-in-95 w-full max-w-md overflow-hidden ${radius.xl} ${colors.bgSurface} ${shadows.xl} duration-300 max-h-[85vh] flex flex-col`}>
                {/* Header - compact */}
                <div className={`flex items-center gap-3 ${spacing.pxLg} py-3 sm:py-4 border-b ${colors.borderSubtle} flex-shrink-0`}>
                    <div className={`flex size-9 items-center justify-center ${radius.xl} ${colors.bgBrandSubtle} text-indigo-600 flex-shrink-0`}>
                        {isEdit ? <Pencil size={16} /> : <Plus size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className={`${typography.cardTitle} ${colors.textPrimary}`}>{title}</h3>
                        {isEdit && (
                            <p className={`${typography.caption} ${colors.textSecondary}`}>Modificando registro existente</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className={`flex size-9 items-center justify-center ${radius.md} ${colors.textSecondary} hover:${colors.bgMain} hover:${colors.textPrimary} transition-colors min-w-[36px] min-h-[36px]`}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Form - scrollable body with sticky actions */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const data = Object.fromEntries(formData.entries());
                        onSubmit(data as any);
                    }}
                    className="flex flex-col flex-1 overflow-hidden"
                >
                    {/* Scrollable fields */}
                    <div className={`flex-1 overflow-y-auto ${spacing.pxLg} py-4 sm:py-5 ${spacing.sm}`}>
                        {children}
                    </div>

                    {/* Sticky actions at bottom */}
                    <div className={`flex items-center gap-3 ${spacing.pxLg} py-3 sm:py-4 border-t ${colors.borderSubtle} ${colors.bgSurface} flex-shrink-0`}>
                        <button
                            type="button"
                            onClick={onClose}
                            className={`flex-1 ${radius.xl} px-4 py-2.5 ${typography.bodySm} font-bold ${colors.textSecondary} transition-all hover:${colors.bgMain} active:scale-[0.98]`}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-[1.5] flex items-center justify-center gap-2 ${radius.xl} ${colors.bgBrand} px-4 py-2.5 ${typography.bodySm} font-bold text-white ${shadows.md} shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50`}
                        >
                            {loading ? (
                                <>
                                    <div className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                    <span>Procesando...</span>
                                </>
                            ) : (
                                <>
                                    {isEdit ? <Pencil size={14} /> : <Plus size={14} />}
                                    <span>{isEdit ? 'Guardar Cambios' : `Crear ${config.name}`}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}