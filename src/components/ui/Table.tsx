import React from 'react';
import { tokens } from '../../design/design-tokens';

interface BaseTableProps {
    children: React.ReactNode;
    className?: string; // For layout (margin, width)
}

// Compositional approach for flexibility
export const TableContainer: React.FC<BaseTableProps> = ({ children, className = '' }) => (
    <div
        className={`w-full overflow-x-auto ${className}`}
        style={{
            borderRadius: tokens.radius.lg,
            border: `1px solid ${tokens.colors.border}`,
            backgroundColor: tokens.colors.surface,
            boxShadow: tokens.shadow.subtle,
        }}
    >
        <table className="w-full border-collapse text-left">
            {children}
        </table>
    </div>
);

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <thead style={{ backgroundColor: tokens.colors.bg }}>
        <tr>{children}</tr>
    </thead>
);

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <tbody className="divide-y divide-gray-200">
        {children}
    </tbody>
);

export const TableRow: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className = '' }) => (
    <tr
        onClick={onClick}
        className={`${onClick ? "cursor-pointer transition-colors hover:bg-gray-50 " : ""}${className}`}
    >
        {children}
    </tr>
);

export const TableHead: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <th
        style={{
            padding: tokens.spacing.md,
            fontSize: tokens.typography.caption.fontSize,
            fontWeight: 600,
            color: tokens.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: `1px solid ${tokens.colors.border}`,
        }}
        className={className}
    >
        {children}
    </th>
);

export const TableCell: React.FC<{ children: React.ReactNode; className?: string; colSpan?: number }> = ({ children, className = '', colSpan }) => (
    <td
        style={{
            padding: tokens.spacing.md,
            fontSize: tokens.typography.body.fontSize,
            color: tokens.colors.text.primary,
        }}
        className={className}
        colSpan={colSpan}
    >
        {children}
    </td>
);

// Default export as a namespace or object for convenience if preferred, 
// but individual exports allow better tree shaking and clearer imports.
export const Table = {
    Root: TableContainer,
    Header: TableHeader,
    Body: TableBody,
    Row: TableRow,
    Head: TableHead,
    Cell: TableCell,
};
