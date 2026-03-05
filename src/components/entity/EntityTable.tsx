import React from 'react';
import { EntityConfig } from './types';
import { Building2 } from 'lucide-react';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';

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
            {/* ✅ MÓVIL - Layout Opción B */}
            <div className="md:hidden space-y-3">
                {items.map((item) => {
                    const id = String(item[config.rowIdKey]);
                    const isSelected = selectionProps?.selectedIds.includes(id) || false;

                    return (
                        <div
                            key={id}
                            className={`${radius.xl} border ${spacing.pLg} transition-all ${isSelected ? `${colors.borderBrand} ${colors.bgBrandSubtle}/30` : `${colors.borderStandard} ${colors.bgSurface}`}`}
                        >
                            {/* Header: Checkbox + Acciones */}
                            <div className={`flex items-center justify-between ${spacing.sm}`}>
                                {selectionProps && (
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => selectionProps.onSelect(id)}
                                        className={`size-5 cursor-pointer ${radius.sm} border-gray-300 text-indigo-600 focus:ring-indigo-500`}
                                    />
                                )}
                                <div className="flex gap-1.5">
                                    {config.actions.slice(0, 3).map((action, idx) => {
                                        const iconToRender = (idx === 0 && action.label === 'Detalles')
                                            ? <Building2 size={16} />
                                            : action.icon;

                                        return (
                                            (!action.isVisible || action.isVisible(item)) && (
                                                <button
                                                    key={action.id}
                                                    onClick={() => action.onClick(item)}
                                                    className={`${radius.lg} p-2 transition-colors ${action.color || `${colors.bgMain} ${colors.textSecondary} hover:bg-slate-100`}`}
                                                >
                                                    {iconToRender}
                                                </button>
                                            )
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Contenido principal */}
                            <div className="space-y-3">
                                {/* Línea 1: Avatar/Icono + Nombre + Badge */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        {config.fields[0]?.render && (
                                            <div className="flex-shrink-0">
                                                {config.fields[0].render(item)}
                                            </div>
                                        )}
                                    </div>

                                    {config.fields.find(f => f.type === 'badge')?.render && (
                                        <div className="flex-shrink-0">
                                            {config.fields.find(f => f.type === 'badge')?.render(item)}
                                        </div>
                                    )}
                                </div>

                                {/* Línea 2: Campos adicionales */}
                                {config.fields.filter(f =>
                                    f.key !== config.fields[0]?.key &&
                                    f.type !== 'badge' &&
                                    f.type !== 'date'
                                ).map((field, idx) => (
                                    <div key={idx}>
                                        {field.render ? field.render(item) : (item as any)[field.key]}
                                    </div>
                                ))}

                                {/* Línea 3: Fechas */}
                                {config.fields.filter(f => f.type === 'date').length > 0 && (
                                    <div className={`flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t ${colors.borderSubtle}`}>
                                        {config.fields.filter(f => f.type === 'date').map((dateField, idx) => (
                                            <div key={idx} className="flex flex-col">
                                                <span className={`${typography.text.caption} font-semibold uppercase ${colors.textMuted}`}>
                                                    {dateField.label}
                                                </span>
                                                <span className={`${typography.text.caption} font-medium ${colors.textSecondary}`}>
                                                    {dateField.render ? dateField.render(item) : (item as any)[dateField.key]}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ✅ ESCRITORIO - Tabla normal */}
            <div className="hidden md:block overflow-x-auto">
                <div className={`${colors.bgSurface} ${radius.xl} ${shadows.sm} border ${colors.borderStandard} overflow-hidden`}>
                    <table className="w-full border-collapse text-left table-fixed">
                        <thead className={`sticky top-0 z-10 border-b ${colors.borderStandard} ${colors.bgMain}/80 ${typography.uiLabel} font-semibold uppercase tracking-wider ${colors.textSecondary} backdrop-blur-sm`}>
                            <tr>
                                {selectionProps && (
                                    <th className="w-[5%] px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectionProps.selectedIds.length === items.length && items.length > 0}
                                            onChange={selectionProps.onSelectAll}
                                            className={`size-4 cursor-pointer ${radius.sm} border-gray-300 text-indigo-600 focus:ring-indigo-500`}
                                            title="Seleccionar Todos"
                                        />
                                    </th>
                                )}
                                {config.fields.filter(f => !f.hidden).map((field, idx) => (
                                    <th key={idx} className={`${spacing.pxLg} py-3 truncate`} title={field.label}>
                                        {field.label}
                                    </th>
                                ))}
                                <th className="w-[10%] min-w-[120px] ${spacing.pxLg} py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${colors.borderSubtle}`}>
                            {items.map((item) => {
                                const id = String(item[config.rowIdKey]);
                                const isSelected = selectionProps?.selectedIds.includes(id) || false;

                                return (
                                    <tr
                                        key={id}
                                        className={`group transition-all hover:${colors.bgMain} ${isSelected ? `${colors.bgBrandSubtle}/50` : colors.bgSurface}`}
                                    >
                                        {selectionProps && (
                                            <td className={`${spacing.pxLg} py-3`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => selectionProps.onSelect(id)}
                                                    className={`size-4 cursor-pointer ${radius.sm} border-gray-300 text-indigo-600 focus:ring-indigo-500`}
                                                />
                                            </td>
                                        )}
                                        {config.fields.filter(f => !f.hidden).map((field, idx) => {
                                            const rawValue = (item as any)[field.key];
                                            const displayValue = field.render ? field.render(item) : rawValue;
                                            // Extraer texto plano si es posible para el title tooltip
                                            const titleText = typeof rawValue === 'string' || typeof rawValue === 'number' ? String(rawValue) : undefined;

                                            return (
                                                <td key={idx} className="px-4 py-4 truncate" title={titleText}>
                                                    {displayValue}
                                                </td>
                                            );
                                        })}
                                        <td className={`w-[10%] min-w-[120px] ${spacing.pxLg} py-3 text-right`}>
                                            <div className="flex justify-end gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
                                                {config.actions.map(action => (
                                                    (!action.isVisible || action.isVisible(item)) && (
                                                        <button
                                                            key={action.id}
                                                            onClick={() => action.onClick(item)}
                                                            className={`${radius.lg} p-1.5 transition-colors ${action.color || `border border-transparent ${colors.bgMain} ${colors.textSecondary} hover:${colors.borderStandard} hover:${colors.bgSurface} hover:${colors.textPrimary}`}`}
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
            </div>
        </>
    );
}