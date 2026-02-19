import React, { useState } from 'react';
import { EntityConfig } from './types';
import { EntityTable } from './EntityTable';
import { EntityCard } from './EntityCard';

interface EntityListProps<T> {
    config: EntityConfig<T>;
    items: T[];
    loading?: boolean;
    loadingMessage?: string;
    emptyMessage?: string;
    onBulkAction?: (actionId: string, ids: string[]) => void;
}

export function EntityList<T>({
    config,
    items,
    loading,
    loadingMessage = 'Cargando datos...',
    emptyMessage = `No hay ${config.pluralName.toLowerCase()} en este momento.`,
    onBulkAction
}: EntityListProps<T>) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === items.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(items.map(m => String(m[config.rowIdKey])));
        }
    };

    if (loading) {
        return (
            <div className="p-12 text-center text-gray-400 animate-pulse font-medium bg-white rounded-2xl border border-gray-100">
                <div className="flex justify-center mb-4">
                    <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                </div>
                {loadingMessage}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="p-16 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="text-4xl mb-4 opacity-20">📭</div>
                <h3 className="text-gray-900 font-bold mb-1">Vacio</h3>
                <p className="text-sm">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
            {/* BULK ACTION BAR - STANDARD (Fase UI Governance) */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-6 left-6 right-6 md:absolute md:top-0 md:bottom-auto md:left-0 md:right-0 bg-indigo-600 md:bg-indigo-50 p-4 md:p-3 flex items-center justify-between md:justify-start gap-4 border-b border-indigo-100 animate-in slide-in-from-bottom-6 md:slide-in-from-top-2 z-[60] rounded-2xl md:rounded-none shadow-2xl md:shadow-none text-white md:text-indigo-700">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">
                            {selectedIds.length} <span className="hidden sm:inline">seleccionados</span>
                        </span>
                    </div>
                    <div className="hidden md:block h-4 w-px bg-indigo-200 mx-2" />
                    <div className="flex items-center gap-4 ml-auto md:ml-0">
                        {config.bulkActions?.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    action.onClick(selectedIds);
                                    if (onBulkAction) onBulkAction(action.label, selectedIds);
                                }}
                                className={`text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity ${action.variant === 'danger' ? 'text-red-200 md:text-red-600' : ''
                                    }`}
                            >
                                {action.label}
                            </button>
                        ))}
                        {/* Default print action if needed or just handle via config */}
                    </div>
                </div>
            )}

            {/* MOBILE CARDS VIEW */}
            <div className="block md:hidden divide-y divide-gray-100">
                {items.map((item) => {
                    const id = String(item[config.rowIdKey]);
                    const isSelected = selectedIds.includes(id);
                    return (
                        <EntityCard<T>
                            key={id}
                            config={config}
                            item={item}
                            isSelected={isSelected}
                            onToggle={() => toggleSelect(id)}
                            actions={config.actions.map(action => (
                                (!action.isVisible || action.isVisible(item)) && (
                                    <button
                                        key={action.id}
                                        onClick={() => action.onClick(item)}
                                        className={`p-2 bg-white border border-gray-200 rounded-xl shadow-sm active:scale-95 transition-transform ${action.color || 'text-gray-400'}`}
                                    >
                                        {action.icon}
                                    </button>
                                )
                            ))}
                        />
                    );
                })}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <EntityTable<T>
                config={config}
                items={items}
                selectionProps={{
                    selectedIds,
                    onSelect: toggleSelect,
                    onSelectAll: toggleSelectAll
                }}
            />
        </div>
    );
}
