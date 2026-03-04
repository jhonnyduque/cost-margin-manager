import React from 'react';

interface BaseTableProps {
    children: React.ReactNode;
    className?: string;
}

export const TableContainer: React.FC<BaseTableProps> = ({ children, className = '' }) => (
    <div className={`table-container bg-bg-card rounded-md shadow-subtle border border-border overflow-hidden overflow-x-auto ${className}`}>
        <table className="w-full text-left table-auto">
            {children}
        </table>
    </div>
);

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <thead className="table-header sticky top-0 z-10">
        <tr>{children}</tr>
    </thead>
);

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <tbody className="divide-y divide-border/50">
        {children}
    </tbody>
);

export const TableRow: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className = '' }) => (
    <tr
        onClick={onClick}
        className={`table-row ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
        {children}
    </tr>
);

export const TableHead: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <th className={`table-header-cell ${className}`}>
        {children}
    </th>
);

export const TableCell: React.FC<{ children: React.ReactNode; className?: string; colSpan?: number }> = ({ children, className = '', colSpan }) => (
    <td
        className={`table-cell text-body font-medium text-text-primary ${className}`}
        colSpan={colSpan}
    >
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