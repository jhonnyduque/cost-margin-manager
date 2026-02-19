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
            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/80 backdrop-blur-sm text-gray-500 text-xs uppercase font-bold sticky top-0 z-10">
                    <tr>
                        {selectionProps && (
                            <th className="px-6 py-4 w-10">
                                <input
                                    type="checkbox"
                                    checked={selectionProps.selectedIds.length === items.length && items.length > 0}
                                    onChange={selectionProps.onSelectAll}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                            </th>
                        )}
                        {config.fields.filter(f => !f.hidden).map((field, idx) => (
                            <th key={idx} className="px-6 py-4">
                                {field.label}
                            </th>
                        ))}
                        <th className="px-6 py-4 text-right">Acciones</th>
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
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => selectionProps.onSelect(id)}
                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </td>
                                )}
                                {config.fields.filter(f => !f.hidden).map((field, idx) => (
                                    <td key={idx} className="px-6 py-4">
                                        {field.render ? field.render(item) : (item as any)[field.key]}
                                    </td>
                                ))}
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                        {config.actions.map(action => (
                                            (!action.isVisible || action.isVisible(item)) && (
                                                <button
                                                    key={action.id}
                                                    onClick={() => action.onClick(item)}
                                                    className={`p-1.5 rounded-lg transition-colors ${action.color || 'bg-gray-50 hover:bg-white text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-200'}`}
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
