import React from 'react';
import { EntityConfig } from './types';

interface EntityDetailProps<T> {
    config: EntityConfig<T>;
    item: T | null;
    isOpen: boolean;
    onClose: () => void;
}

export function EntityDetail<T>({ config, item, isOpen, onClose }: EntityDetailProps<T>) {
    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-[110] overflow-hidden">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
                <div className="animate-in slide-in-from-right w-screen max-w-md transition duration-500 ease-in-out sm:duration-700">
                    <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-2xl">
                        <div className="bg-indigo-600 px-6 py-8">
                            <div className="flex items-start justify-between">
                                <h2 className="text-xl font-bold leading-6 text-white">
                                    Detalles de {config.name}
                                </h2>
                                <div className="ml-3 flex h-7 items-center">
                                    <button
                                        type="button"
                                        className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus:outline-none"
                                        onClick={onClose}
                                    >
                                        <span className="sr-only">Cerrar panel</span>
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4">
                                {/* Header info - first field */}
                                <div className="text-sm text-indigo-100 opacity-80">
                                    {String((item as any)[config.fields[0].key])}
                                </div>
                            </div>
                        </div>

                        <div className="relative flex-1 px-6 py-8">
                            <div className="space-y-8">
                                {config.fields.map((field, idx) => (
                                    <div key={idx} className="border-b border-gray-50 pb-4">
                                        <dt className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                                            {field.label}
                                        </dt>
                                        <dd className="text-sm font-medium text-gray-900">
                                            {field.render ? field.render(item) : String((item as any)[field.key] || '---')}
                                        </dd>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-12">
                                <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Acciones Disponibles</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {config.actions.map(action => (
                                        <button
                                            key={action.id}
                                            onClick={() => {
                                                action.onClick(item);
                                                onClose();
                                            }}
                                            className="flex items-center justify-center gap-2 rounded-2xl border border-transparent bg-gray-50 px-4 py-3 text-gray-600 transition-colors hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600"
                                        >
                                            {action.icon}
                                            <span className="text-sm font-bold">{action.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
