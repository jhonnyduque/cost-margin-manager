import { ReactNode } from 'react';

export type EntityFieldType = 'text' | 'email' | 'password' | 'select' | 'date' | 'badge';

export interface EntityField<T> {
    key: keyof T;
    label: string;
    type: EntityFieldType;
    options?: { label: string; value: any }[]; // For select type
    render?: (item: T) => ReactNode; // Custom display
    required?: boolean;
    editable?: boolean;
    hidden?: boolean; // Hide from table but show in detail/modal
}

export interface EntityAction<T> {
    id: string;
    label: string;
    icon: ReactNode;
    color?: string;
    onClick: (item: T) => void;
    isVisible?: (item: T) => boolean;
}

export interface EntityConfig<T> {
    name: string;
    pluralName: string;
    rowIdKey: keyof T;
    fields: EntityField<T>[];
    actions: EntityAction<T>[];
    bulkActions?: {
        label: string;
        onClick: (ids: string[]) => void;
        variant?: 'primary' | 'danger' | 'ghost';
    }[];
}
