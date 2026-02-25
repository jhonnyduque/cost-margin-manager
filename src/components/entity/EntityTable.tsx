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

export function EntityTable<T extends Record<string, any>>({
    config,
    items,
    selectionProps,
}: EntityTableProps<T>) {

    const visibleFields = config.fields.filter(f => !f.hidden);

    return (
        <div className="hidden md:block">

            {/* CARD STYLE — igual que Facturación */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

                <div className="w-full overflow-x-hidden">

                    <table className="w-full border-collapse text-left table-auto">

                        {/* HEADER */}
                        <thead className="bg-gray-50/70 text-xs font-semibold uppercase tracking-wider text-gray-400">
                            <tr className="border-b border-gray-200">

                                {selectionProps && (
                                    <th className="w-12 px-5 py-4">
                                        <input
                                            type="checkbox"
                                            checked={
                                                selectionProps.selectedIds.length === items.length &&
                                                items.length > 0
                                            }
                                            onChange={selectionProps.onSelectAll}
                                            className="size-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </th>
                                )}

                                {visibleFields.map((field, idx) => (
                                    <th key={idx} className="px-6 py-4">
                                        {field.label}
                                    </th>
                                ))}

                                {/* 👇 ACCIONES SIEMPRE */}
                                <th className="w-32 px-6 py-4 text-right">
                                    Acciones
                                </th>

                            </tr>
                        </thead>

                        {/* BODY */}
                        <tbody className="divide-y divide-gray-100">

                            {items.map(item => {

                                const id = String(item[config.rowIdKey]);
                                const isSelected =
                                    selectionProps?.selectedIds.includes(id) || false;

                                return (
                                    <tr
                                        key={id}
                                        className={`
                      group
                      bg-white
                      transition-colors
                      hover:bg-gray-50/70
                      ${isSelected ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : ''}
                    `}
                                    >

                                        {selectionProps && (
                                            <td className="w-12 px-5 py-4 align-middle">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => selectionProps.onSelect(id)}
                                                    className="size-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </td>
                                        )}

                                        {visibleFields.map((field, idx) => (
                                            <td key={idx} className="px-6 py-4 align-middle">

                                                {field.render
                                                    ? field.render(item)
                                                    : item[field.key]}

                                            </td>
                                        ))}

                                        {/* ✅ ACCIONES RESTAURADAS */}
                                        <td className="w-32 px-6 py-4 text-right align-middle">

                                            <div className="
                        flex
                        justify-end
                        gap-2
                        opacity-70
                        transition-opacity
                        group-hover:opacity-100
                      ">

                                                {config.actions.map(action =>
                                                    (!action.isVisible || action.isVisible(item)) && (

                                                        <button
                                                            key={action.id}
                                                            onClick={() => action.onClick(item)}
                                                            title={action.label}
                                                            className={`
                                rounded-xl
                                p-2
                                transition-all
                                ${action.color ||
                                                                'border border-transparent bg-gray-50 text-gray-400 hover:border-gray-200 hover:bg-white hover:text-gray-700'}
                              `}
                                                        >
                                                            {action.icon}
                                                        </button>

                                                    )
                                                )}

                                            </div>

                                        </td>

                                    </tr>
                                );
                            })}

                            {/* EMPTY STATE */}
                            {items.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={visibleFields.length + (selectionProps ? 2 : 1)}
                                        className="px-6 py-12 text-center text-sm text-gray-400"
                                    >
                                        No hay registros para mostrar.
                                    </td>
                                </tr>
                            )}

                        </tbody>
                    </table>

                </div>
            </div>
        </div>
    );
}