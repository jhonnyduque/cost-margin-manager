import React, { useEffect } from 'react';
import { EntityConfig, EntityField } from './types';

interface EntityDetailProps<T> {
    config: EntityConfig<T>;
    item: T | null;
    isOpen: boolean;
    onClose: () => void;
}

export function EntityDetail<T>({ config, item, isOpen, onClose }: EntityDetailProps<T>) {
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

    if (!isOpen || !item) return null;

    // Filtrar acción "Detalles" — redundante dentro del panel
    const relevantActions = config.actions.filter(a => a.id !== 'detail');

    const renderField = (field: EntityField<T>) =>
        field.render ? field.render(item) : String((item as any)[field.key] || '---');

    const field0 = config.fields[0]; // Usuario (principal)
    const field1 = config.fields[1]; // Rol / Empresa (secundario en fila 1)
    const restFields = config.fields.slice(2); // Fechas y resto

    return (
        <div className="fixed inset-0 z-[110] overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="absolute inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-w-md sm:pl-10">
                <div className="animate-in slide-in-from-bottom sm:slide-in-from-right flex h-full flex-col bg-white shadow-2xl transition duration-300 ease-in-out sm:duration-500">

                    {/* ── Header ─────────────────────────────────────────── */}
                    <div className="bg-indigo-600 px-5 py-4 sm:px-6 sm:py-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold leading-6 text-white">
                                Detalles de {config.name}
                            </h2>
                            <button
                                type="button"
                                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center"
                                onClick={onClose}
                            >
                                <span className="sr-only">Cerrar panel</span>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* ── Content ─────────────────────────────────────────── */}
                    <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        <div className="space-y-5">

                            {/* ── Fila 1: campo secundario (Rol) + iconos de acción ── */}
                            {field1 && (
                                <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                                    <div>
                                        <dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                            {field1.label}
                                        </dt>
                                        <dd className="text-sm font-medium text-gray-900">
                                            {renderField(field1)}
                                        </dd>
                                    </div>

                                    {/* Iconos de acción — sin texto */}
                                    <div className="flex gap-2">
                                        {relevantActions.map(action => (
                                            <button
                                                key={action.id}
                                                onClick={() => { action.onClick(item); onClose(); }}
                                                title={action.label}
                                                className={`flex size-10 items-center justify-center rounded-xl bg-gray-50 transition-colors hover:bg-gray-100 min-w-[40px] min-h-[40px] ${action.color || 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                {action.icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Fila 2: campo principal (Usuario) — ancho completo ── */}
                            {field0 && (
                                <div className="border-b border-gray-100 pb-5">
                                    <dt className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                        {field0.label}
                                    </dt>
                                    <dd className="text-sm font-medium text-gray-900">
                                        {renderField(field0)}
                                    </dd>
                                </div>
                            )}

                            {/* ── Fila 3+: campos restantes en 2 columnas ── */}
                            {restFields.length > 0 && (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                                    {restFields.map((field, idx) => (
                                        <div key={idx} className="border-b border-gray-100 pb-4">
                                            <dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                                {field.label}
                                            </dt>
                                            <dd className="text-sm font-medium text-gray-900">
                                                {renderField(field)}
                                            </dd>
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}