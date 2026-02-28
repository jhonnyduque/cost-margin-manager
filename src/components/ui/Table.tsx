import React from 'react';

interface BaseTableProps {
    children: React.ReactNode;
    className?: string;
}

export const TableContainer: React.FC<BaseTableProps> = ({ children, className = '' }) => (
    <div className={`w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
        <table className="w-full border-collapse text-left table-fixed min-w-[800px]">
            {children}
        </table>
    </div>
);

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <thead className="sticky top-0 z-10 border-b border-gray-200 bg-white text-xs font-semibold uppercase tracking-wider text-gray-400 backdrop-blur-sm">
        <tr>{children}</tr>
    </thead>
);

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <tbody className="divide-y divide-gray-50">
        {children}
    </tbody>
);

export const TableRow: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className = '' }) => (
    <tr
        onClick={onClick}
        className={`group bg-white transition-all hover:bg-amber-50/30 ${onClick ? "cursor-pointer " : ""}${className}`}
    >
        {children}
    </tr>
);

export const TableHead: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <th className={`px-4 py-3 truncate ${className}`}>
        {children}
    </th>
);

export const TableCell: React.FC<{ children: React.ReactNode; className?: string; colSpan?: number }> = ({ children, className = '', colSpan }) => (
    <td
        className={`px-4 py-3 truncate ${className}`}
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
