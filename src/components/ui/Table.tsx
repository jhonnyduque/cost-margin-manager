import React from 'react';

// Table consume clases CSS de global.css exclusivamente.
// No usar clases Tailwind directas ni valores hardcodeados aquí.

interface BaseTableProps {
    children: React.ReactNode;
    className?: string;
}

export const TableContainer: React.FC<BaseTableProps> = ({ children, className = '' }) => (
    <div className={`table-wrapper ${className}`.trim()}
        style={{ overflowX: 'auto' }}
    >
        <table className="table">
            {children}
        </table>
    </div>
);

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <thead>
        <tr>{children}</tr>
    </thead>
);

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <tbody>{children}</tbody>
);

export const TableRow: React.FC<{
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
}> = ({ children, onClick, className = '' }) => (
    <tr
        onClick={onClick}
        className={className}
        style={onClick ? { cursor: 'pointer' } : undefined}
    >
        {children}
    </tr>
);

export const TableHead: React.FC<{
    children: React.ReactNode;
    className?: string;
}> = ({ children, className = '' }) => (
    <th className={className}>
        {children}
    </th>
);

export const TableCell: React.FC<{
    children: React.ReactNode;
    className?: string;
    colSpan?: number;
}> = ({ children, className = '', colSpan }) => (
    <td className={className} colSpan={colSpan}>
        {children}
    </td>
);

export const Table = {
    Root: TableContainer,
    Header: TableHeader,
    Body: TableBody,
    Row: TableRow,
    Head: TableHead,
    Cell: TableCell,
};