import React, { useState, useMemo } from 'react';
import {
    Search, Plus, ShoppingCart, ChevronDown, ChevronUp, Filter,
    Clock, CheckCircle2, XCircle, Package, AlertCircle,
    Edit2, Ban, FileText, Truck
} from 'lucide-react';
import { useStore } from '../store';
import { PurchaseOrder } from '../types';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Button } from '@/components/ui/Button';
import PurchaseOrderModal from '@/components/purchases/PurchaseOrderModal';
import ReceiveOrderModal from '@/components/purchases/ReceiveOrderModal';

const statusConfig = {
    borrador: { label: 'Borrador', icon: Clock, class: 'text-slate-700 bg-slate-100 border-slate-200' },
    confirmada: { label: 'Confirmada', icon: CheckCircle2, class: 'text-blue-700 bg-blue-50 border-blue-200' },
    recibida: { label: 'Recibida', icon: Package, class: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    anulada: { label: 'Anulada', icon: XCircle, class: 'text-rose-700 bg-rose-50 border-rose-200' },
};

const Purchases: React.FC = () => {
    const { purchaseOrders, suppliers, confirmPurchaseOrder, cancelPurchaseOrder } = useStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'borrador' | 'confirmada' | 'recibida' | 'anulada'>('todos');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
    const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
    const [receiveModalOpen, setReceiveModalOpen] = useState(false);

    const stats = useMemo(() => {
        const drafts = purchaseOrders.filter(o => o.status === 'borrador').length;
        const confirmed = purchaseOrders.filter(o => o.status === 'confirmada').length;
        const received = purchaseOrders.filter(o => o.status === 'recibida').length;
        const totalValue = purchaseOrders
            .filter(o => o.status !== 'anulada')
            .reduce((sum, o) => sum + o.total_value, 0);
        return { drafts, confirmed, received, totalValue };
    }, [purchaseOrders]);

    const filteredOrders = useMemo(() => {
        return purchaseOrders.filter(o => {
            const matchesSearch =
                o.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (o.supplier_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'todos' || o.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [purchaseOrders, searchTerm, filterStatus]);

    const handleNew = () => {
        setEditingOrder(null);
        setModalOpen(true);
    };

    const handleEdit = (order: PurchaseOrder) => {
        if (order.status !== 'borrador') return;
        setEditingOrder(order);
        setModalOpen(true);
    };

    const handleConfirm = async (id: string) => {
        if (window.confirm('¿Confirmar esta orden de compra? La orden quedará aprobada y lista para recibir.')) {
            try {
                await confirmPurchaseOrder(id);
            } catch (err: any) {
                alert(err.message);
            }
        }
    };

    const handleCancel = async (id: string) => {
        if (window.confirm('¿Anular esta orden de compra? Esta acción no se puede deshacer.')) {
            try {
                await cancelPurchaseOrder(id);
            } catch (err: any) {
                alert(err.message);
            }
        }
    };

    const handleReceive = (order: PurchaseOrder) => {
        setReceivingOrder(order);
        setReceiveModalOpen(true);
    };

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Órdenes de Compra"
                    breadcrumbs={
                        <>
                            <span>BETO OS</span>
                            <span>/</span>
                            <span className={colors.textPrimary}>Compras</span>
                        </>
                    }
                    metadata={[
                        <span key="1">Gestión de órdenes de compra a proveedores</span>,
                        <span key="2">{purchaseOrders.length} órdenes registradas</span>
                    ]}
                    actions={
                        <Button
                            variant="primary"
                            icon={<Plus size={16} />}
                            onClick={handleNew}
                        >
                            NUEVA ORDEN
                        </Button>
                    }
                />

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8 mb-6">
                    <div className={`p-4 ${colors.bgSurface} ${radius.xl} border ${colors.borderStandard} ${shadows.sm}`}>
                        <p className={`${typography.uiLabel} ${colors.textMuted}`}>Borradores</p>
                        <p className="text-2xl font-bold text-slate-600">{stats.drafts}</p>
                    </div>
                    <div className={`p-4 ${colors.bgSurface} ${radius.xl} border ${colors.borderStandard} ${shadows.sm}`}>
                        <p className={`${typography.uiLabel} ${colors.textMuted}`}>Confirmadas</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>
                    </div>
                    <div className={`p-4 ${colors.bgSurface} ${radius.xl} border ${colors.borderStandard} ${shadows.sm}`}>
                        <p className={`${typography.uiLabel} ${colors.textMuted}`}>Recibidas</p>
                        <p className="text-2xl font-bold text-emerald-600">{stats.received}</p>
                    </div>
                    <div className={`p-4 ${colors.bgSurface} ${radius.xl} border ${colors.borderStandard} ${shadows.sm}`}>
                        <p className={`${typography.uiLabel} ${colors.textMuted}`}>Valor Total</p>
                        <p className="text-2xl font-bold text-slate-800 tabular-nums">
                            ${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                {/* Controls Bar */}
                <div className={`mb-6 p-4 ${colors.bgSurface} ${radius['2xl']} border ${colors.borderStandard} ${shadows.sm} flex flex-col md:flex-row gap-4 justify-between items-center`}>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative w-full md:w-80">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.textMuted}`} size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por número o proveedor..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full h-11 pl-11 pr-4 rounded-xl bg-slate-50 border ${colors.borderStandard} focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-slate-700`}
                            />
                        </div>
                        <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl">
                            {(['todos', 'borrador', 'confirmada', 'recibida', 'anulada'] as const).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filterStatus === status ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                {filteredOrders.length === 0 ? (
                    <div className={`mt-4 text-center p-20 ${colors.bgSurface} ${radius['3xl']} border border-dashed ${colors.borderStandard}`}>
                        <div className={`w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border ${colors.borderSubtle}`}>
                            <ShoppingCart className="text-slate-300" size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">No se encontraron órdenes</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-8">
                            {searchTerm ? 'Prueba ajustando los términos de búsqueda o los filtros.' : 'Aún no has registrado ninguna orden de compra. Crea una nueva para gestionar tus adquisiciones.'}
                        </p>
                        {!searchTerm && (
                            <Button variant="primary" icon={<Plus size={18} />} onClick={handleNew}>
                                CREAR PRIMERA ORDEN
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
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted}`}>Proveedor</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted}`}>Fecha</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted}`}>F. Esperada</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted} text-center`}>Items</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted} text-right`}>Total</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted}`}>Estado</th>
                                        <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${colors.textMuted} text-center`}></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredOrders.map((order) => {
                                        const isExpanded = expandedOrderId === order.id;
                                        const sc = statusConfig[order.status];
                                        const StatusIcon = sc.icon;

                                        return (
                                            <React.Fragment key={order.id}>
                                                <tr
                                                    className="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                                                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                                >
                                                    <td className="px-6 py-4">
                                                        <span className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                                            {order.number}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-bold text-slate-800">
                                                            {order.supplier_name || 'Sin Proveedor'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-medium text-slate-700">{order.date}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm text-slate-500">{order.expected_date || '—'}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-2 py-1 ${radius.md} bg-slate-100 text-slate-600 text-xs font-bold`}>
                                                            {order.items?.length || 0}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="text-sm font-bold text-slate-900 tabular-nums">
                                                            ${order.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${radius.pill} text-xs font-semibold border ${sc.class}`}>
                                                            <StatusIcon size={12} /> {sc.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {isExpanded
                                                            ? <ChevronUp size={18} className="text-slate-400 inline" />
                                                            : <ChevronDown size={18} className="text-slate-400 inline" />}
                                                    </td>
                                                </tr>

                                                {/* Expanded Panel */}
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={8} className="bg-slate-50/70 px-6 py-5 border-t border-slate-100">
                                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                                {/* Items List */}
                                                                <div className="lg:col-span-2">
                                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Detalle de Ítems</h4>
                                                                    {order.items && order.items.length > 0 ? (
                                                                        <div className={`${colors.bgSurface} ${radius.xl} border ${colors.borderSubtle} overflow-hidden`}>
                                                                            <table className="w-full text-sm">
                                                                                <thead>
                                                                                    <tr className="bg-slate-50 border-b border-slate-100">
                                                                                        <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">Material</th>
                                                                                        <th className="px-4 py-2 text-right text-xs font-bold text-slate-400 uppercase">Cant.</th>
                                                                                        <th className="px-4 py-2 text-right text-xs font-bold text-slate-400 uppercase">P. Unit.</th>
                                                                                        <th className="px-4 py-2 text-right text-xs font-bold text-slate-400 uppercase">Subtotal</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-50">
                                                                                    {order.items.map(item => (
                                                                                        <tr key={item.id}>
                                                                                            <td className="px-4 py-2 font-medium text-slate-700">{item.raw_material_name}</td>
                                                                                            <td className="px-4 py-2 text-right tabular-nums text-slate-600">{item.quantity} {item.unit}</td>
                                                                                            <td className="px-4 py-2 text-right tabular-nums text-slate-600">${item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                                            <td className="px-4 py-2 text-right tabular-nums font-bold text-slate-800">${item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-sm text-slate-400">Sin ítems registrados</p>
                                                                    )}
                                                                </div>

                                                                {/* Actions & Notes */}
                                                                <div className="space-y-4">
                                                                    <div>
                                                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Acciones</h4>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {order.status === 'borrador' && (
                                                                                <>
                                                                                    <Button variant="secondary" size="sm" icon={<Edit2 size={14} />} onClick={(e) => { e.stopPropagation(); handleEdit(order); }}>
                                                                                        EDITAR
                                                                                    </Button>
                                                                                    <Button variant="primary" size="sm" icon={<CheckCircle2 size={14} />} onClick={(e) => { e.stopPropagation(); handleConfirm(order.id); }}>
                                                                                        CONFIRMAR
                                                                                    </Button>
                                                                                    <Button variant="ghost" size="sm" icon={<Ban size={14} />} onClick={(e) => { e.stopPropagation(); handleCancel(order.id); }}>
                                                                                        ANULAR
                                                                                    </Button>
                                                                                </>
                                                                            )}
                                                                            {order.status === 'confirmada' && (
                                                                                <>
                                                                                    <Button variant="primary" size="sm" icon={<Truck size={14} />} onClick={(e) => { e.stopPropagation(); handleReceive(order); }}>
                                                                                        RECIBIR
                                                                                    </Button>
                                                                                    <Button variant="ghost" size="sm" icon={<Ban size={14} />} onClick={(e) => { e.stopPropagation(); handleCancel(order.id); }}>
                                                                                        ANULAR
                                                                                    </Button>
                                                                                </>
                                                                            )}
                                                                            {(order.status === 'recibida' || order.status === 'anulada') && (
                                                                                <p className="text-xs text-slate-400 italic">Sin acciones disponibles</p>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {order.notes && (
                                                                        <div>
                                                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Notas</h4>
                                                                            <p className="text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-100">{order.notes}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </SectionBlock>

            {/* Modals */}
            <PurchaseOrderModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                editingOrder={editingOrder}
            />

            <ReceiveOrderModal
                isOpen={receiveModalOpen}
                onClose={() => { setReceiveModalOpen(false); setReceivingOrder(null); }}
                order={receivingOrder}
            />
        </PageContainer>
    );
};

export default Purchases;
