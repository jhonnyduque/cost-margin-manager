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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] p-0 md:p-4">
            <div className="bg-white rounded-t-[2.5rem] md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 flex justify-between items-center text-white">
                    <div>
                        <h3 className="font-bold text-xl">{title}</h3>
                        {isEdit && <p className="text-indigo-100 text-xs mt-0.5 opacity-80 font-medium">Modificando registro existente</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
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
                    className="p-8 space-y-6"
                >
                    {children}

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[1.5] py-3 px-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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
