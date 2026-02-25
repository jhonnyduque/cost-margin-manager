import React from 'react';
import { EntityConfig } from './types';
import { Building2 } from 'lucide-react';

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
        <>
            {/* ✅ VERSIÓN MÓVIL - Exactamente como la captura */}
            <div className="md:hidden space-y-3">
                {items.map((item) => {
                    const id = String(item[config.rowIdKey]);
                    const isSelected = selectionProps?.selectedIds.includes(id) || false;

                    return (
                        <div
                            key={id}
                            className={`rounded-xl border p-4 transition-all ${isSelected ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200 bg-white'}`}
                        >
                            {/* Header: Checkbox + Acciones */}
                            <div className="mb-3 flex items-center justify-between">
                                {selectionProps && (
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => selectionProps.onSelect(id)}
                                        className="size-5 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                )}
                                <div className="flex gap-1.5">
                                    {config.actions.slice(0, 3).map((action, idx) => {
                                        // Reemplazar el primer icono (Mail) por Building2
                                        const iconToRender = idx === 0 ? <Building2 size={16} /> : action.icon;

                                        return (
                                            (!action.isVisible || action.isVisible(item)) && (
                                                <button
                                                    key={action.id}
                                                    onClick={() => action.onClick(item)}
                                                    className={`rounded-lg p-2 transition-colors ${action.color || 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                                                >
                                                    {iconToRender}
                                                </button>
                                            )
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Contenido principal */}
                            <div className="space-y-2">
                                {/* Línea 1: Avatar + Nombre + Email */}
                                <div className="flex items-start gap-3">
                                    {config.fields[0]?.render && (
                                        <div className="flex-shrink-0">
                                            {config.fields[0].render(item)}
                                        </div>
                                    )}

                                    {/* Rol a la derecha */}
                                    {config.fields.find(f => f.label === 'Rol')?.render && (
                                        <div className="ml-auto">
                                            {config.fields.find(f => f.label === 'Rol')?.render(item)}
                                        </div>
                                    )}
                                </div>

                                {/* Línea 2: Empresa */}
                                {config.fields.find(f => f.label === 'Empresa')?.render && (
                                    <div className="pt-1">
                                        {config.fields.find(f => f.label === 'Empresa')?.render(item)}
                                    </div>
                                )}

                                {/* Línea 3: Fechas compactas */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pt-2 border-t border-gray-100">
                                    {config.fields.filter(f => f.type === 'date').map((field, idx) => (
                                        <div key={idx} className="flex flex-col">
                                            <span className="text-[10px] font-semibold uppercase text-gray-400">
                                                {field.label}
                                            </span>
                                            <span className="font-medium text-gray-700">
                                                {field.render ? field.render(item) : (item as any)[field.key]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ✅ VERSIÓN ESCRITORIO - Tabla normal */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-left table-fixed">
                    <thead className="sticky top-0 z-10 border-b border-gray-200 bg-white text-xs font-semibold uppercase tracking-wider text-gray-400 backdrop-blur-sm">
                        <tr>
                            {selectionProps && (
                                <th className="w-10 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selectionProps.selectedIds.length === items.length && items.length > 0}
                                        onChange={selectionProps.onSelectAll}
                                        className="size-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </th>
                            )}
                            {config.fields.filter(f => !f.hidden).map((field, idx) => (
                                <th key={idx} className="px-4 py-3 truncate">
                                    {field.label}
                                </th>
                            ))}
                            <th className="w-32 px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {items.map((item) => {
                            const id = String(item[config.rowIdKey]);
                            const isSelected = selectionProps?.selectedIds.includes(id) || false;

                            return (
                                <tr
                                    key={id}
                                    className={`group bg-white transition-all hover:bg-amber-50/30 ${isSelected ? 'bg-indigo-50/50' : ''}`}
                                >
                                    {selectionProps && (
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => selectionProps.onSelect(id)}
                                                className="size-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </td>
                                    )}
                                    {config.fields.filter(f => !f.hidden).map((field, idx) => (
                                        <td key={idx} className="px-4 py-3 truncate">
                                            {field.render ? field.render(item) : (item as any)[field.key]}
                                        </td>
                                    ))}
                                    <td className="w-32 px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
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
        </>
    );
}