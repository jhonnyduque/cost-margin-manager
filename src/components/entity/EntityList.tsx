import React from 'react';
import { EntityConfig } from './types';
import { EntityTable } from './EntityTable';

interface EntityListProps<T> {
    config: EntityConfig<T>;
    items: T[];
    loading?: boolean;
    emptyMessage?: string;
    onSelectionChange?: (selectedIds: string[]) => void;
}

export function EntityList<T>({
    config,
    items,
    loading = false,
    emptyMessage = 'No hay registros',
    onSelectionChange
}: EntityListProps<T>) {
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

    const handleSelect = (id: string) => {
        const newSelected = selectedIds.includes(id)
            ? selectedIds.filter(sid => sid !== id)
            : [...selectedIds, id];
        setSelectedIds(newSelected);
        onSelectionChange?.(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedIds.length === items.length) {
            setSelectedIds([]);
            onSelectionChange?.([]);
        } else {
            const allIds = items.map(item => String(item[config.rowIdKey]));
            setSelectedIds(allIds);
            onSelectionChange?.(allIds);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500 size-10" />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                {emptyMessage}
            </div>
        );
    }

    return (
        <EntityTable
            config={config}
            items={items}
            selectionProps={{
                selectedIds,
                onSelect: handleSelect,
                onSelectAll: handleSelectAll
            }}
        />
    );
}