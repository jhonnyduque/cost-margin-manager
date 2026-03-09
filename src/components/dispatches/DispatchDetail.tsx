import React, { useRef } from 'react';
import {
    X, Printer, Download, Mail, Share2,
    CheckCircle2, AlertTriangle, User, MapPin,
    Calendar, Hash, FileText
} from 'lucide-react';
import { Dispatch } from '../../types';
import { colors, radius, shadows, spacing, typography } from '@/design/design-tokens';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DispatchDetailProps {
    isOpen: boolean;
    onClose: () => void;
    dispatch: Dispatch;
}

const DispatchDetail: React.FC<DispatchDetailProps> = ({ isOpen, onClose, dispatch }) => {
    const printRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static print:z-auto">
            <div className={`bg-white ${radius['3xl']} w-full max-w-4xl max-h-[95vh] flex flex-col ${shadows.xl} overflow-hidden border border-slate-200 print:shadow-none print:border-none print:max-h-none print:static`}>

                {/* Modal Header - Hidden on Print */}
                <div className={`p-6 border-b ${colors.borderSubtle} flex items-center justify-between bg-white print:hidden`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 ${radius.lg} bg-slate-100 text-slate-600`}>
                            <FileText size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Vista Previa de Documento</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                        >
                            <Printer size={18} /> Imprimir / PDF
                        </button>
                        <button
                            onClick={onClose}
                            className={`p-2 hover:bg-slate-100 ${radius.full} text-slate-400 hover:text-slate-600 transition-all ml-2`}
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Printable Content */}
                <div
                    ref={printRef}
                    className="flex-1 overflow-y-auto p-12 print:p-0 print:overflow-visible bg-white"
                >
                    {/* Styles for print */}
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @media print {
                            @page { size: portrait; margin: 1cm; }
                            body { -webkit-print-color-adjust: exact; }
                            .print-hidden { display: none !important; }
                        }
                    `}} />

                    {/* Document Header */}
                    <div className="flex justify-between items-start mb-12">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-black text-xl">B</span>
                                </div>
                                <span className="text-2xl font-black tracking-tight text-slate-800">BETO OS</span>
                            </div>
                            <p className="text-sm text-slate-500 font-medium">Software de Gestión Industrial</p>
                        </div>
                        <div className="text-right">
                            <h1 className="text-3xl font-black text-slate-900 mb-1">NOTA DE ENTREGA</h1>
                            <div className="flex flex-col items-end gap-1">
                                <span className="text-lg font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                    {dispatch.number}
                                </span>
                                <div className="flex items-center gap-2 text-sm text-slate-500 font-bold mt-2">
                                    <Calendar size={14} />
                                    {format(new Date(dispatch.date), "dd 'de' MMMM, yyyy", { locale: es })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Client & Info Grid */}
                    <div className="grid grid-cols-2 gap-12 mb-12">
                        <div className={`p-6 ${radius['2xl']} bg-slate-50/50 border border-slate-100`}>
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <User size={14} className="text-indigo-500" /> Cliente / Destinatario
                            </h3>
                            <div className="space-y-2">
                                <p className="text-xl font-bold text-slate-800">{dispatch.client_name || 'Sin Cliente Registrado'}</p>
                                <div className="flex items-start gap-2 text-sm text-slate-500">
                                    <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                                    <p>Dirección no especificada en el sistema.</p>
                                </div>
                            </div>
                        </div>

                        <div className={`p-6 ${radius['2xl']} bg-slate-50/50 border border-slate-100`}>
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Hash size={14} className="text-indigo-500" /> Detalles del Documento
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 font-medium">Estado del Despacho:</span>
                                    <span className={`font-bold px-2 py-0.5 rounded ${dispatch.status === 'confirmado' ? 'text-emerald-700 bg-emerald-100' :
                                            dispatch.status === 'anulado' ? 'text-rose-700 bg-rose-100' : 'text-blue-700 bg-blue-100'
                                        }`}>
                                        {dispatch.status.toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 font-medium">Fecha de Emisión:</span>
                                    <span className="text-slate-700 font-bold">{format(new Date(dispatch.date), 'dd/MM/yyyy')}</span>
                                </div>
                                {dispatch.confirmed_at && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 font-medium">Fecha Confirmación:</span>
                                        <span className="text-slate-700 font-bold">{format(new Date(dispatch.confirmed_at), 'dd/MM/yyyy HH:mm')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-12">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-800">
                                    <th className="py-4 text-xs font-black uppercase tracking-widest text-slate-900">Descripción del Producto</th>
                                    <th className="py-4 text-xs font-black uppercase tracking-widest text-slate-900 text-center">Cant.</th>
                                    <th className="py-4 text-xs font-black uppercase tracking-widest text-slate-900 text-right">Precio Unit.</th>
                                    <th className="py-4 text-xs font-black uppercase tracking-widest text-slate-900 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {dispatch.items?.map((item) => (
                                    <tr key={item.id}>
                                        <td className="py-4">
                                            <p className="text-sm font-bold text-slate-800">{item.product_name || 'Producto Desconocido'}</p>
                                            <p className="text-[11px] text-slate-500 italic">{item.notes || ''}</p>
                                        </td>
                                        <td className="py-4 text-center">
                                            <span className="text-sm font-bold text-slate-700">{item.quantity}</span>
                                        </td>
                                        <td className="py-4 text-right">
                                            <span className="text-sm text-slate-600">${item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td className="py-4 text-right text-sm font-bold text-slate-900">
                                            ${item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-slate-100">
                                    <td colSpan={2} className="py-6"></td>
                                    <td className="py-6 text-right">
                                        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Total Documento</span>
                                    </td>
                                    <td className="py-6 text-right">
                                        <span className="text-2xl font-black text-slate-900">${dispatch.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Footer / Notes */}
                    <div className="grid grid-cols-2 gap-12 pt-12 border-t border-slate-100">
                        <div>
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Notas / Términos</h4>
                            <p className="text-sm text-slate-600 leading-relaxed italic">
                                {dispatch.notes || "Esta nota de entrega certifica el despacho de la mercancía descrita en el presente documento."}
                            </p>
                        </div>
                        <div className="flex flex-col items-center justify-end text-center">
                            <div className="w-48 border-b-2 border-slate-200 mb-2"></div>
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Recibido Conforme</span>
                            <span className="text-xs text-slate-400 mt-1">Firma / Sello / Fecha</span>
                        </div>
                    </div>

                    {/* Audit Info - Bottom of page */}
                    <div className="mt-24 text-[10px] text-slate-300 text-center flex items-center justify-center gap-4">
                        <span>Generado por BETO OS</span>
                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                        <span>{new Date().toLocaleString()}</span>
                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                        <span>Página 1 de 1</span>
                    </div>

                    {/* Confirmation Checkmark - Only on confirmado */}
                    {dispatch.status === 'confirmado' && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
                            <CheckCircle2 size={400} />
                        </div>
                    )}
                </div>

                {/* Print Hint - Desktop only */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center print:hidden">
                    <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
                        <AlertTriangle size={14} className="text-amber-500" />
                        Tip: Al imprimir, desactiva "Cabeceras y pies de página" en las opciones del navegador para un diseño más limpio.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DispatchDetail;
