import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    CreditCard,
    ArrowUpRight,
    RotateCcw,
    MoreHorizontal,
    CheckCircle2,
    XCircle,
    Clock,
    ExternalLink
} from 'lucide-react';
import { BillingEvent } from '@/services/adminStatsService';
import { typography } from '@/design/typography';

interface BillingEventTableProps {
    events: BillingEvent[];
}

export function BillingEventTable({ events }: BillingEventTableProps) {
    const getStatusStyle = (status: BillingEvent['status']) => {
        switch (status) {
            case 'success': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'failed': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'refunded': return 'bg-slate-50 text-slate-500 border-slate-100';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    const getStatusLabel = (status: BillingEvent['status']) => {
        switch (status) {
            case 'success': return 'Éxito';
            case 'failed': return 'Fallido';
            case 'pending': return 'Pendiente';
            case 'refunded': return 'Reembolsado';
            default: return status;
        }
    };

    const getStatusIcon = (status: BillingEvent['status']) => {
        switch (status) {
            case 'success': return <CheckCircle2 size={14} />;
            case 'failed': return <XCircle size={14} />;
            case 'pending': return <Clock size={14} />;
            case 'refunded': return <RotateCcw size={14} />;
            default: return <Clock size={14} />;
        }
    };

    return (
        <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-50 p-6">
                <div>
                    <h3 className={`${typography.uiLabel} text-slate-900 uppercase tracking-tight`}>Feed Operativo de Facturación</h3>
                    <p className={`${typography.caption} text-slate-500`}>Eventos de facturación y cambios de suscripción en tiempo real.</p>
                </div>
                <button className={`rounded-xl border border-slate-200 px-4 py-2 ${typography.uiLabel} text-slate-600 hover:bg-slate-50 transition-colors`}>
                    Ver toda la actividad
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50/50">
                            <th className={`px-6 py-4 text-left ${typography.uiLabel} text-slate-500 uppercase tracking-widest`}>Fecha</th>
                            <th className={`px-6 py-4 text-left ${typography.uiLabel} text-slate-500 uppercase tracking-widest`}>Empresa</th>
                            <th className={`px-6 py-4 text-left ${typography.uiLabel} text-slate-500 uppercase tracking-widest`}>Evento</th>
                            <th className={`px-6 py-4 text-left ${typography.uiLabel} text-slate-500 uppercase tracking-widest`}>Monto</th>
                            <th className={`px-6 py-4 text-left ${typography.uiLabel} text-slate-500 uppercase tracking-widest`}>Estado</th>
                            <th className={`px-6 py-4 text-right ${typography.uiLabel} text-slate-500 uppercase tracking-widest`}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {events.length === 0 ? (
                            <tr>
                                <td colSpan={6} className={`px-6 py-12 text-center ${typography.bodySm} font-bold text-slate-500`}>
                                    No se encontraron eventos recientes.
                                </td>
                            </tr>
                        ) : (
                            events.map((event) => (
                                <tr key={event.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className={`${typography.uiLabel} text-slate-900`}>{format(new Date(event.created_at), 'MMM dd, HH:mm', { locale: es })}</span>
                                            <span className={`${typography.caption} text-slate-500 font-medium`}>#{event.id.slice(0, 8)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className={`h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 ${typography.uiLabel}`}>
                                                {event.company_name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className={`${typography.uiLabel} text-slate-700`}>{event.company_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`${typography.uiLabel} text-slate-600 uppercase tracking-tight`}>{event.event_type}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`${typography.uiLabel} text-slate-900`}>${event.amount.toLocaleString()}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${typography.uiLabel} uppercase tracking-tight ${getStatusStyle(event.status)}`}>
                                            {getStatusIcon(event.status)}
                                            {getStatusLabel(event.status)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {event.status === 'failed' && (
                                                <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Reintentar Pago">
                                                    <RotateCcw size={14} />
                                                </button>
                                            )}
                                            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Ver Detalle">
                                                <ExternalLink size={14} />
                                            </button>
                                            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                                                <MoreHorizontal size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
