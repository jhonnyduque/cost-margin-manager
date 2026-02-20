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
            <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-12 text-center font-medium text-gray-400">
                <div className="mb-4 flex justify-center">
                    <div className="size-10 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
                </div>
                {loadingMessage}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-16 text-center text-gray-400">
                <div className="mb-4 text-4xl opacity-20">📭</div>
                <h3 className="mb-1 font-bold text-gray-900">Vacio</h3>
                <p className="text-sm">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {/* BULK ACTION BAR - STANDARD (Fase UI Governance) */}
            {selectedIds.length > 0 && (
                <div className="animate-in slide-in-from-bottom-6 md:slide-in-from-top-2 fixed inset-x-6 bottom-6 z-[60] flex items-center justify-between gap-4 rounded-2xl border-b border-indigo-100 bg-indigo-600 p-4 text-white shadow-2xl md:absolute md:inset-x-0 md:bottom-auto md:top-0 md:justify-start md:rounded-none md:bg-indigo-50 md:p-3 md:text-indigo-700 md:shadow-none">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">
                            {selectedIds.length} <span className="hidden sm:inline">seleccionados</span>
                        </span>
                    </div>
                    <div className="mx-2 hidden h-4 w-px bg-indigo-200 md:block" />
                    <div className="ml-auto flex items-center gap-4 md:ml-0">
                        {config.bulkActions?.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    action.onClick(selectedIds);
                                    if (onBulkAction) onBulkAction(action.label, selectedIds);
                                }}
                                className={`text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-80 ${action.variant === 'danger' ? 'text-red-200 md:text-red-600' : ''
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
            <div className="block divide-y divide-gray-100 md:hidden">
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
                                        className={`rounded-xl border border-gray-200 bg-white p-2 shadow-sm transition-transform active:scale-95 ${action.color || 'text-gray-400'}`}
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
