import React, { useEffect } from 'react';
import { EntityConfig } from './types';

interface EntityDetailProps<T> {
    config: EntityConfig<T>;
    item: T | null;
    isOpen: boolean;
    onClose: () => void;
}

export function EntityDetail<T>({ config, item, isOpen, onClose }: EntityDetailProps<T>) {
    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Prevent body scroll when open on mobile
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-[110] overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Panel — full screen on mobile, slide-over on desktop */}
            <div className="absolute inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-w-md sm:pl-10">
                <div className="animate-in slide-in-from-bottom sm:slide-in-from-right flex h-full flex-col bg-white shadow-2xl transition duration-300 ease-in-out sm:duration-500">
                    {/* Header */}
                    <div className="bg-indigo-600 px-4 py-6 sm:px-6 sm:py-8">
                        <div className="flex items-start justify-between">
                            <h2 className="text-lg sm:text-xl font-bold leading-6 text-white">
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
                        <div className="mt-3 sm:mt-4">
                            <div className="text-sm text-indigo-100 opacity-80">
                                {String((item as any)[config.fields[0].key])}
                            </div>
                        </div>
                    </div>

                    {/* Content — scrollable */}
                    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
                        <div className="space-y-6 sm:space-y-8">
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

                        <div className="mt-8 sm:mt-12">
                            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Acciones Disponibles</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {config.actions.map(action => (
                                    <button
                                        key={action.id}
                                        onClick={() => {
                                            action.onClick(item);
                                            onClose();
                                        }}
                                        className="flex items-center justify-center gap-2 rounded-2xl border border-transparent bg-gray-50 px-4 py-3 text-gray-600 transition-colors hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600 min-h-[44px] active:scale-95"
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
    );
}