import React, { useState, useMemo } from 'react';
import {
    Search, Plus, ShoppingCart, ChevronDown, ChevronUp,
    Clock, CheckCircle2, XCircle, Package, Edit2, Ban, Truck, Printer,
} from 'lucide-react';
import { useStore } from '../store';
import { PurchaseOrder } from '../types';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import PurchaseOrderModal from '@/components/purchases/PurchaseOrderModal';
import ReceiveOrderModal from '@/components/purchases/ReceiveOrderModal';

const statusConfig = {
    borrador: { label: 'Borrador', icon: Clock, variant: 'neutral' as const },
    confirmada: { label: 'Confirmada', icon: CheckCircle2, variant: 'warning' as const },
    recibida: { label: 'Recibida', icon: Package, variant: 'success' as const },
    anulada: { label: 'Anulada', icon: XCircle, variant: 'danger' as const },
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
        const totalValue = purchaseOrders.filter(o => o.status !== 'anulada').reduce((sum, o) => sum + o.total_value, 0);
        return { drafts, confirmed, received, totalValue };
    }, [purchaseOrders]);

    const filteredOrders = useMemo(() => purchaseOrders.filter(o => {
        const matchesSearch = o.number.toLowerCase().includes(searchTerm.toLowerCase()) || (o.supplier_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'todos' || o.status === filterStatus;
        return matchesSearch && matchesStatus;
    }), [purchaseOrders, searchTerm, filterStatus]);

    const handleNew = () => { setEditingOrder(null); setModalOpen(true); };
    const handleEdit = (order: PurchaseOrder) => { if (order.status !== 'borrador') return; setEditingOrder(order); setModalOpen(true); };
    const handleReceive = (order: PurchaseOrder) => { setReceivingOrder(order); setReceiveModalOpen(true); };
    const handlePrint = () => window.print();

    const handleConfirm = async (id: string) => {
        if (window.confirm('¿Confirmar esta orden de compra?')) {
            try { await confirmPurchaseOrder(id); } catch (err: any) { alert(err.message); }
        }
    };

    const handleCancel = async (id: string) => {
        if (window.confirm('¿Anular esta orden de compra? Esta acción no se puede deshacer.')) {
            try { await cancelPurchaseOrder(id); } catch (err: any) { alert(err.message); }
        }
    };

    const fmt = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const statCards = [
        { label: 'Borradores', value: stats.drafts, color: 'var(--text-secondary)' },
        { label: 'Confirmadas', value: stats.confirmed, color: 'var(--text-primary)' },
        { label: 'Recibidas', value: stats.received, color: 'var(--text-primary)' },
        { label: 'Valor Total', value: `$${fmt(stats.totalValue)}`, color: 'var(--text-primary)', mono: true },
    ];

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Órdenes de Compra"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Compras</span></>}
                    metadata={[
                        <span key="1">Gestión de órdenes de compra a proveedores</span>,
                        <span key="2">{purchaseOrders.length} órdenes registradas</span>,
                    ]}
                    actions={<Button variant="primary" icon={<Plus size={16} />} onClick={handleNew}>NUEVA ORDEN</Button>}
                />

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-16)', marginTop: 'var(--space-32)', marginBottom: 'var(--space-24)' }}>
                    {statCards.map(s => (
                        <div key={s.label} className="card" style={{ padding: 'var(--space-16)' }}>
                            <p className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</p>
                            <p className={s.mono ? 'tabular' : ''} style={{ marginTop: 'var(--space-8)', fontSize: 'var(--text-h2-size)', fontWeight: 700, color: s.color }}>{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div style={{ marginTop: 'var(--space-32)', borderTop: 'var(--border-default)', paddingTop: 'var(--space-32)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 14rem auto', gap: 'var(--space-12)', alignItems: 'center' }}>
                        <div style={{ position: 'relative', minWidth: 0 }}>
                            <Search size={18} style={{ position: 'absolute', left: 'var(--space-16)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="text" placeholder="Buscar por número o proveedor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input" style={{ paddingLeft: 'var(--space-48)', width: '100%' }} />
                        </div>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="input" style={{ width: '100%' }}>
                            <option value="todos">Todos</option>
                            <option value="borrador">Borrador</option>
                            <option value="confirmada">Confirmada</option>
                            <option value="recibida">Recibida</option>
                            <option value="anulada">Anulada</option>
                        </select>
                        <Button variant="ghost" size="sm" onClick={handlePrint} title="Imprimir" icon={<Printer size={18} />} style={{ flexShrink: 0 }} />
                    </div>
                </div>
            </SectionBlock>

            <SectionBlock>
                {filteredOrders.length === 0 ? (
                    <div className="empty-state" style={{ border: '2px dashed var(--border-color-default)', borderRadius: 'var(--radius-xl)', marginTop: 'var(--space-16)' }}>
                        <div className="empty-state-icon"><ShoppingCart size={32} /></div>
                        <h3 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 700, color: 'var(--text-primary)' }}>No se encontraron órdenes</h3>
                        <p className="text-small text-muted" style={{ maxWidth: '28rem' }}>
                            {searchTerm ? 'Prueba ajustando los términos de búsqueda.' : 'Aún no has registrado ninguna orden de compra.'}
                        </p>
                        {!searchTerm && <Button variant="primary" icon={<Plus size={18} />} onClick={handleNew}>CREAR PRIMERA ORDEN</Button>}
                    </div>
                ) : (
                    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Número</th>
                                        <th>Proveedor</th>
                                        <th>Fecha</th>
                                        <th>F. Esperada</th>
                                        <th style={{ textAlign: 'center' }}>Items</th>
                                        <th className="align-right">Total</th>
                                        <th>Estado</th>
                                        <th style={{ textAlign: 'center' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOrders.map(order => {
                                        const isExpanded = expandedOrderId === order.id;
                                        const sc = statusConfig[order.status];
                                        const StatusIcon = sc.icon;
                                        return (
                                            <React.Fragment key={order.id}>
                                                <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                                                    <td><span className="font-mono text-small" style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{order.number}</span></td>
                                                    <td><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{order.supplier_name || 'Sin Proveedor'}</span></td>
                                                    <td><span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{order.date}</span></td>
                                                    <td className="text-small text-muted">{order.expected_date || '—'}</td>
                                                    <td className="align-right tabular" style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{order.items?.length || 0}</td>
                                                    <td className="align-right tabular" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${fmt(order.total_value)}</td>
                                                    <td>
                                                        <Badge variant={sc.variant}>
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                                                <StatusIcon size={12} /> {sc.label}
                                                            </span>
                                                        </Badge>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {isExpanded ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={8} style={{ background: 'var(--surface-page)', padding: 'var(--space-24)', borderTop: 'var(--border-default)' }}>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 'var(--space-24)' }}>
                                                                {/* Items */}
                                                                <div>
                                                                    <h4 className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-12)' }}>Detalle de Ítems</h4>
                                                                    {order.items && order.items.length > 0 ? (
                                                                        <div className="inset-card" style={{ padding: 0, overflow: 'hidden' }}>
                                                                            <table className="table">
                                                                                <thead><tr><th>Material</th><th className="align-right">Cant.</th><th className="align-right">P. Unit.</th><th className="align-right">Subtotal</th></tr></thead>
                                                                                <tbody>
                                                                                    {order.items.map(item => (
                                                                                        <tr key={item.id}>
                                                                                            <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{item.raw_material_name}</td>
                                                                                            <td className="align-right tabular">{item.quantity} {item.unit}</td>
                                                                                            <td className="align-right tabular">${item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                                            <td className="align-right tabular" style={{ fontWeight: 700 }}>${item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="inset-card"><p className="text-small text-muted">Sin ítems registrados</p></div>
                                                                    )}
                                                                </div>

                                                                {/* Actions & Notes */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                                                                    <div>
                                                                        <h4 className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-12)' }}>Acciones</h4>
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)' }}>
                                                                            {order.status === 'borrador' && (<>
                                                                                <Button variant="secondary" size="sm" icon={<Edit2 size={14} />} onClick={e => { e.stopPropagation(); handleEdit(order); }}>EDITAR</Button>
                                                                                <Button variant="primary" size="sm" icon={<CheckCircle2 size={14} />} onClick={e => { e.stopPropagation(); handleConfirm(order.id); }}>CONFIRMAR</Button>
                                                                                <Button variant="ghost" size="sm" icon={<Ban size={14} />} onClick={e => { e.stopPropagation(); handleCancel(order.id); }}>ANULAR</Button>
                                                                            </>)}
                                                                            {order.status === 'confirmada' && (<>
                                                                                <Button variant="primary" size="sm" icon={<Truck size={14} />} onClick={e => { e.stopPropagation(); handleReceive(order); }}>RECIBIR</Button>
                                                                                <Button variant="ghost" size="sm" icon={<Ban size={14} />} onClick={e => { e.stopPropagation(); handleCancel(order.id); }}>ANULAR</Button>
                                                                            </>)}
                                                                            {(order.status === 'recibida' || order.status === 'anulada') && <p className="text-small text-muted">Sin acciones disponibles</p>}
                                                                        </div>
                                                                    </div>
                                                                    {order.notes && (
                                                                        <div>
                                                                            <h4 className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-8)' }}>Notas</h4>
                                                                            <div className="inset-card"><p className="text-small text-secondary">{order.notes}</p></div>
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

            <PurchaseOrderModal isOpen={modalOpen} onClose={() => setModalOpen(false)} editingOrder={editingOrder} />
            <ReceiveOrderModal isOpen={receiveModalOpen} onClose={() => { setReceiveModalOpen(false); setReceivingOrder(null); }} order={receivingOrder} />
        </PageContainer>
    );
};

export default Purchases;