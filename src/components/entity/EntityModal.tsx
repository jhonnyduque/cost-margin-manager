import React from 'react';
import { EntityConfig } from './types';

interface EntityModalProps<T> {
    config: EntityConfig<T>;
    item?: T | null; // If present, it's Edit mode
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<T>) => void;
    children: React.ReactNode; // The actual form fields (defined per entity)
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
    if (!isOpen) return null;

    const isEdit = !!item;
    const title = isEdit ? `Editar ${config.name}` : `Crear ${config.name}`;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-4">
            <div className="animate-in slide-in-from-bottom md:zoom-in-95 w-full max-w-md overflow-hidden rounded-t-[2.5rem] bg-white shadow-2xl duration-300 md:rounded-3xl">
                <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 text-white">
                    <div>
                        <h3 className="text-xl font-bold">{title}</h3>
                        {isEdit && <p className="mt-0.5 text-xs font-medium text-indigo-100 opacity-80">Modificando registro existente</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                    >
                        ✕
                    </button>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const data = Object.fromEntries(formData.entries());
                        onSubmit(data as any);
                    }}
                    className="space-y-6 p-8"
                >
                    {children}

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-2xl border border-transparent px-4 py-3 font-bold text-gray-500 transition-all hover:border-gray-100 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[1.5] rounded-2xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                    <span>Procesando...</span>
                                </div>
                            ) : (
                                isEdit ? 'Guardar Cambios' : `Crear ${config.name}`
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
