import React, { useEffect } from 'react';
import { EntityConfig } from './types';
import { Pencil, Plus } from 'lucide-react';

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
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="animate-in slide-in-from-bottom md:zoom-in-95 w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl duration-300 md:rounded-2xl max-h-[90vh] flex flex-col">
                {/* Header - clean white style */}
                <div className="flex items-center gap-3 px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex-shrink-0">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 flex-shrink-0">
                        {isEdit ? <Pencil size={18} /> : <Plus size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                        {isEdit && (
                            <p className="text-xs text-slate-400">Modificando registro existente</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors min-w-[36px] min-h-[36px]"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Form - scrollable */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const data = Object.fromEntries(formData.entries());
                        onSubmit(data as any);
                    }}
                    className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 space-y-5"
                >
                    {children}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition-all hover:bg-slate-50 active:scale-[0.98]"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[1.5] flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
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