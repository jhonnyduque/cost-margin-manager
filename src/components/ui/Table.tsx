import React from 'react';
import { typography } from '@/design/typography';

interface BaseTableProps {
    children: React.ReactNode;
    className?: string;
}

export const TableContainer: React.FC<BaseTableProps> = ({ children, className = '' }) => (
    <div className={`rounded-[24px] border border-slate-100 bg-white shadow-sm overflow-hidden overflow-x-auto ${className}`}>
        <table className="w-full text-left table-auto border-collapse">
            {children}
        </table>
    </div>
);

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <thead className="bg-slate-50 border-b border-slate-100">
        <tr>{children}</tr>
    </thead>
);

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <tbody className="divide-y divide-slate-50 bg-white">
        {children}
    </tbody>
);

export const TableRow: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className = '' }) => (
    <tr
        onClick={onClick}
        className={`group transition-colors ${onClick ? "cursor-pointer hover:bg-slate-50/50" : ""} ${className}`}
    >
        {children}
    </tr>
);

export const TableHead: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <th className={`px-4 py-3.5 ${typography.uiLabel} text-slate-500 text-left font-bold ${className}`}>
        {children}
    </th>
);

export const TableCell: React.FC<{ children: React.ReactNode; className?: string; colSpan?: number }> = ({ children, className = '', colSpan }) => (
    <td
        className={`px-4 py-4 ${typography.body} text-slate-700 ${className}`}
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