import React from 'react';

interface BaseTableProps {
    children: React.ReactNode;
    className?: string;
}

export const TableContainer: React.FC<BaseTableProps> = ({ children, className = '' }) => (
    <div className={`w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
        <table className="w-full border-collapse text-left table-auto min-w-full">
            {children}
        </table>
    </div>
);

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <thead className="sticky top-0 z-10 border-b border-gray-200 bg-white text-xs font-semibold uppercase tracking-wider text-gray-500 backdrop-blur-sm">
        <tr>{children}</tr>
    </thead>
);

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <tbody className="divide-y divide-gray-100">
        {children}
    </tbody>
);

export const TableRow: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className = '' }) => (
    <tr
        onClick={onClick}
        className={`group border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors ${onClick ? "cursor-pointer " : ""}${className}`}
    >
        {children}
    </tr>
);

export const TableHead: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <th className={`px-6 py-3.5 font-semibold text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 ${className}`}>
        {children}
    </th>
);

export const TableCell: React.FC<{ children: React.ReactNode; className?: string; colSpan?: number }> = ({ children, className = '', colSpan }) => (
    <td
        className={`px-6 py-4 text-sm ${className}`}
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