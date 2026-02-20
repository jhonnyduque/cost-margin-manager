import React from 'react';
import { EntityConfig } from './types';

interface EntityCardProps<T> {
    config: EntityConfig<T>;
    item: T;
    actions: React.ReactNode;
    isSelected: boolean;
    onToggle: () => void;
    key?: string | number;
}

export function EntityCard<T>({ config, item, actions, isSelected, onToggle }: EntityCardProps<T>) {
    // We assume the first 2-3 fields are the "header" of the card
    const headerFields = config.fields.filter(f => !f.hidden).slice(0, 2);
    const detailFields = config.fields.filter(f => !f.hidden).slice(2);

    return (
        <div className={`flex flex-col gap-3 p-4 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggle}
                        className="size-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                        {headerFields.map((field, idx) => (
                            <div key={idx} className={idx === 0 ? "font-bold text-gray-900" : "text-xs text-gray-500"}>
                                {field.render ? field.render(item) : (item as any)[field.key]}
                            </div>
                        ))}
                    </div>
                </div>
                {/* Status or secondary info (first field of detail if any) */}
                {detailFields.length > 0 && (
                    <div className="flex flex-col items-end gap-1">
                        {detailFields[0].render ? detailFields[0].render(item) : (
                            <span className="text-[10px] font-bold uppercase text-gray-400">
                                {(item as any)[detailFields[0].key]}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                <div className="space-y-1">
                    {detailFields.slice(1, 3).map((field, idx) => (
                        <div key={idx} className="text-[10px] text-gray-400">
                            <span className="font-medium opacity-60">{field.label}:</span> {field.render ? field.render(item) : (item as any)[field.key]}
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    {actions}
                </div>
            </div>
        </div>
    );
}
