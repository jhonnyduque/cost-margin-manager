import React, { useState } from 'react';
import {
    Plus, Search, Filter, FileText, CheckCircle2,
    XCircle, Clock, MoreVertical, Eye, Edit,
    Trash2, Printer, Ban, ChevronRight
} from 'lucide-react';
import { useStore } from '../store';
import { Dispatch } from '../types';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import DispatchModal from '@/components/dispatches/DispatchModal';
import DispatchDetail from '@/components/dispatches/DispatchDetail';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Button } from '@/components/ui/Button';

const Dispatches: React.FC = () => {
    const { dispatches, confirmDispatch, cancelDispatch, deleteDispatch } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'borrador' | 'confirmado' | 'anulado'>('todos');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [viewingDispatch, setViewingDispatch] = useState<Dispatch | null>(null);

    const filteredDispatches = dispatches.filter(d => {
        const matchesSearch =
            d.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.client_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'todos' || d.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const handleNew = () => {
        setSelectedDispatch(null);
        setIsModalOpen(true);
    };

    const handleEdit = (dispatch: Dispatch) => {
        if (dispatch.status !== 'borrador') return;
        setSelectedDispatch(dispatch);
        setIsModalOpen(true);
    };

    const handleView = (dispatch: Dispatch) => {
        setViewingDispatch(dispatch);
        setIsDetailOpen(true);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'confirmado':
                return (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <CheckCircle2 size={12} /> Confirmado
                    </span>
                );
            case 'anulado':
                return (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                        <XCircle size={12} /> Anulado
                    </span>
                );
            case 'borrador':
                return (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <Clock size={12} /> Borrador
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Despachos"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Registro de Stock</span>
                        </>
                    }
                    metadata={[
                        <span key="1">Registro formal de salidas de stock</span>,
                        <span key="2">{dispatches.length} despachos registrados</span>
                    ]}
                    actions={
                        <Button
                            variant="primary"
                            icon={<Plus size={16} />}
                            onClick={handleNew}
                        >
                            NUEVO DESPACHO
                        </Button>
                    }
                />

                {/* Dashboard / Stats Summary - Subtle */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8 mb-6">
                    <div className={`p-4 ${colors.bgSurface} ${radius.xl} border ${colors.borderStandard} ${shadows.sm}`}>
                        <p className={`${typography.uiLabel} ${colors.textMuted}`}>Total Despachos</p>
                        <p className="text-2xl font-bold text-slate-800">{dispatches.length}</p>
                    </div>
                    <div className={`p-4 ${colors.bgSurface} ${radius.xl} border ${colors.borderStandard} ${shadows.sm}`}>
                        <p className={`${typography.uiLabel} ${colors.textMuted}`}>Borradores</p>
                        <p className="text-2xl font-bold text-slate-800">{dispatches.filter(d => d.status === 'borrador').length}</p>
                    </div>
                    <div className={`p-4 ${colors.bgSurface} ${radius.xl} border ${colors.borderStandard} ${shadows.sm}`}>
                        <p className={`${typography.uiLabel} ${colors.textMuted}`}>Confirmados</p>
                        <p className="text-2xl font-bold text-slate-800">{dispatches.filter(d => d.status === 'confirmado').length}</p>
                    </div>
                    <div className={`p-4 ${colors.bgSurface} ${radius.xl} border ${colors.borderStandard} ${shadows.sm}`}>
                        <p className={`${typography.uiLabel} ${colors.textMuted}`}>Valor Total</p>
                        <p className="text-2xl font-bold text-slate-800">
                            ${dispatches.reduce((acc, d) => acc + (d.status === 'confirmado' ? d.total_value : 0), 0).toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Controls Bar */}
                <div className={`mb-6 p-4 ${colors.bgSurface} ${radius['2xl']} border ${colors.borderStandard} ${shadows.sm} flex flex-col md:flex-row gap-4 justify-between items-center`}>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        {/* Search */}
                        <div className="relative w-full md:w-80">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.textMuted}`} size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por número o cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`
                                    w-full h-11 pl-11 pr-4 rounded-xl
                                    bg-slate-50 border ${colors.borderStandard}
                                    focus:bg-white focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400
                                    transition-all outline-none text-slate-700
                                `}
                            />
                        </div>

                        {/* Filter Tabs */}
                        <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl">
                            {(['todos', 'borrador', 'confirmado', 'anulado'] as const).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`
                                        px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                                        ${filterStatus === status
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'}
                                    `}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className={`p-2 ${radius.lg} hover:bg-slate-100 ${colors.textMuted} transition-colors border ${colors.borderSubtle}`}>
                            <Filter size={20} />
                        </button>
                    </div>
                </div>
            </SectionBlock>

            <SectionBlock>
                {/* Table or Empty State */}
                {filteredDispatches.length === 0 ? (
                    <div className={`mt-4 text-center p-20 ${colors.bgSurface} ${radius['3xl']} border border-dashed ${colors.borderStandard}`}>
                        <div className={`w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border ${colors.borderSubtle}`}>
                            <FileText className="text-slate-300" size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">No se encontraron despachos</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-8">
                            {searchTerm ? 'Prueba ajustando los términos de búsqueda o los filtros.' : 'Aún no has registrado ningún despacho. Crea uno nuevo para gestionar tus entregas.'}
                        </p>
                        {!searchTerm && (
                            <Button
                                variant="primary"
                                icon={<Plus size={18} />}
                                onClick={handleNew}
                            >
                                REGISTRAR PRIMER DESPACHO
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className={`${colors.bgSurface} ${radius['2xl']} border ${colors.borderStandard} ${shadows.md} overflow-hidden`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className={`border-b ${colors.borderStandard} bg-slate-50/50`}>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted}`}>Número</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted}`}>Fecha</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted}`}>Cliente</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted} text-center`}>Items</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted} text-right`}>Total</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted}`}>Estado</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted} text-right`}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredDispatches.map((dispatch) => (
                                        <tr key={dispatch.id} className="group hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-mono text-sm font-bold text-slate-700">
                                                    {dispatch.number}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-slate-700">
                                                    {format(new Date(dispatch.date), 'dd MMM yyyy', { locale: es })}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {format(new Date(dispatch.date), 'HH:mm', { locale: es })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-slate-800">
                                                    {dispatch.client_name || 'Sin Cliente'}
                                                </div>
                                                {dispatch.notes && (
                                                    <div className="text-xs text-slate-400 truncate max-w-[200px]" title={dispatch.notes}>
                                                        {dispatch.notes}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-bold text-slate-600 tabular-nums">
                                                    {dispatch.items?.length || 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-sm font-bold text-slate-900">
                                                    ${dispatch.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(dispatch.status)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {dispatch.status === 'borrador' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(dispatch)}
                                                                className={`p-2 ${radius.lg} text-slate-600 hover:bg-slate-100 transition-colors`}
                                                                title="Editar borrador"
                                                            >
                                                                <Edit size={18} />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (window.confirm('¿Deseas confirmar este despacho? Esta acción descontará stock del sistema.')) {
                                                                        try {
                                                                            await confirmDispatch(dispatch.id);
                                                                        } catch (err: any) {
                                                                            alert(err.message);
                                                                        }
                                                                    }
                                                                }}
                                                                className={`p-2 ${radius.lg} text-slate-600 hover:bg-slate-100 transition-colors`}
                                                                title="Confirmar Despacho"
                                                            >
                                                                <CheckCircle2 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (window.confirm('¿Seguro que deseas eliminar este borrador?')) {
                                                                        await deleteDispatch(dispatch.id);
                                                                    }
                                                                }}
                                                                className={`p-2 ${radius.lg} text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors`}
                                                                title="Eliminar borrador"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleView(dispatch)}
                                                                className={`p-2 ${radius.lg} text-slate-600 hover:bg-slate-100 transition-colors`}
                                                                title="Ver Detalle"
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                            {dispatch.status === 'confirmado' && (
                                                                <button
                                                                    onClick={async () => {
                                                                        if (window.confirm('¿Seguro que deseas ANULAR este despacho? El stock se devolverá al almacén.')) {
                                                                            await cancelDispatch(dispatch.id);
                                                                        }
                                                                    }}
                                                                    className={`p-2 ${radius.lg} text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors`}
                                                                    title="Anular Despacho"
                                                                >
                                                                    <Ban size={18} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleView(dispatch)}
                                                                className={`p-2 ${radius.lg} text-slate-600 hover:bg-slate-50 transition-colors`}
                                                                title="Imprimir"
                                                            >
                                                                <Printer size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </SectionBlock>

            {/* Modals */}
            {isModalOpen && (
                <DispatchModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    editingDispatch={selectedDispatch}
                />
            )}

            {isDetailOpen && viewingDispatch && (
                <DispatchDetail
                    isOpen={isDetailOpen}
                    onClose={() => setIsDetailOpen(false)}
                    dispatch={viewingDispatch}
                />
            )}
        </PageContainer>
    );
};

export default Dispatches;
