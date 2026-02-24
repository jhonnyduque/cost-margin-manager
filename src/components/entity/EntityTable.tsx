import React from 'react';
import { EntityConfig } from './types';

interface EntityTableProps<T> {
    config: EntityConfig<T>;
    items: T[];
    selectionProps?: {
        selectedIds: string[];
        onSelect: (id: string) => void;
        onSelectAll: () => void;
    };
}

export function EntityTable<T>({ config, items, selectionProps }: EntityTableProps<T>) {
    return (
        <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-gray-50/80 text-xs font-bold uppercase text-gray-500 backdrop-blur-sm">
                    <tr>
                        {selectionProps && (
                            <th className="w-10 px-3 py-3">
                                <input
                                    type="checkbox"
                                    checked={selectionProps.selectedIds.length === items.length && items.length > 0}
                                    onChange={selectionProps.onSelectAll}
                                    className="size-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </th>
                        )}
                        {config.fields.filter(f => !f.hidden).map((field, idx) => (
                            <th key={idx} className="px-4 py-3">
                                {field.label}
                            </th>
                        ))}
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {items.map((item) => {
                        const id = String(item[config.rowIdKey]);
                        const isSelected = selectionProps?.selectedIds.includes(id) || false;

                        return (
                            <tr
                                key={id}
                                className={`group transition-all hover:bg-gray-50/80 ${isSelected ? 'bg-indigo-50/40' : ''}`}
                            >
                                {selectionProps && (
                                    <td className="px-3 py-3">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => selectionProps.onSelect(id)}
                                            className="size-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </td>
                                )}
                                {config.fields.filter(f => !f.hidden).map((field, idx) => (
                                    <td key={idx} className="px-4 py-3">
                                        {field.render ? field.render(item) : (item as any)[field.key]}
                                    </td>
                                ))}
                                <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2 opacity-60 transition-opacity group-hover:opacity-100">
                                        {config.actions.map(action => (
                                            (!action.isVisible || action.isVisible(item)) && (
                                                <button
                                                    key={action.id}
                                                    onClick={() => action.onClick(item)}
                                                    className={`rounded-lg p-1.5 transition-colors ${action.color || 'border border-transparent bg-gray-50 text-gray-400 hover:border-gray-200 hover:bg-white hover:text-gray-600'}`}
                                                    title={action.label}
                                                >
                                                    {action.icon}
                                                </button>
                                            )
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}