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
                <div className="w-screen max-w-md transform transition ease-in-out duration-500 sm:duration-700 animate-in slide-in-from-right">
                    <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-2xl">
                        <div className="bg-indigo-600 px-6 py-8">
                            <div className="flex items-start justify-between">
                                <h2 className="text-xl font-bold leading-6 text-white">
                                    Detalles de {config.name}
                                </h2>
                                <div className="ml-3 flex h-7 items-center">
                                    <button
                                        type="button"
                                        className="rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none p-2"
                                        onClick={onClose}
                                    >
                                        <span className="sr-only">Cerrar panel</span>
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4">
                                {/* Header info - first field */}
                                <div className="text-indigo-100 text-sm opacity-80">
                                    {String((item as any)[config.fields[0].key])}
                                </div>
                            </div>
                        </div>

                        <div className="relative flex-1 px-6 py-8">
                            <div className="space-y-8">
                                {config.fields.map((field, idx) => (
                                    <div key={idx} className="border-b border-gray-50 pb-4">
                                        <dt className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                                            {field.label}
                                        </dt>
                                        <dd className="text-sm text-gray-900 font-medium">
                                            {field.render ? field.render(item) : String((item as any)[field.key] || '---')}
                                        </dd>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-12">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Acciones Disponibles</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {config.actions.map(action => (
                                        <button
                                            key={action.id}
                                            onClick={() => {
                                                action.onClick(item);
                                                onClose();
                                            }}
                                            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-gray-600 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-transparent hover:border-indigo-100"
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
