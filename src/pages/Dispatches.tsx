import React, { useState } from 'react';
import {
    Plus, Search, Filter, FileText, CheckCircle2,
    XCircle, Clock, Eye, Edit, Trash2, Printer, Ban,
} from 'lucide-react';
import { useStore } from '../store';
import { Dispatch } from '../types';
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
        const matchesSearch = d.number.toLowerCase().includes(searchTerm.toLowerCase()) || (d.client_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'todos' || d.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const handleNew = () => { setSelectedDispatch(null); setIsModalOpen(true); };
    const handleEdit = (dispatch: Dispatch) => { if (dispatch.status !== 'borrador') return; setSelectedDispatch(dispatch); setIsModalOpen(true); };
    const handleView = (dispatch: Dispatch) => { setViewingDispatch(dispatch); setIsDetailOpen(true); };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'confirmado': return <span className="badge badge-success"><CheckCircle2 size={11} /> Confirmado</span>;
            case 'anulado': return <span className="badge badge-neutral"><XCircle size={11} /> Anulado</span>;
            case 'borrador': return <span className="badge badge-neutral"><Clock size={11} /> Borrador</span>;
            default: return null;
        }
    };

    const totalValue = dispatches.reduce((acc, d) => acc + (d.status === 'confirmado' ? d.total_value : 0), 0);

    const handleConfirm = async (dispatch: Dispatch) => {
        if (window.confirm('¿Confirmar este despacho? Se descontará stock.')) {
            try { await confirmDispatch(dispatch.id); } catch (err: any) { alert(err.message); }
        }
    };

    const handleDelete = async (dispatch: Dispatch) => {
        if (window.confirm('¿Eliminar este borrador?')) await deleteDispatch(dispatch.id);
    };

    const handleCancel = async (dispatch: Dispatch) => {
        if (window.confirm('¿Anular este despacho? El stock se devolverá.')) await cancelDispatch(dispatch.id);
    };

    return (
        <PageContainer>
            <SectionBlock>
                <UniversalPageHeader
                    title="Despachos"
                    breadcrumbs={<><span>BETO OS</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Registro de Stock</span></>}
                    metadata={[
                        <span key="1">Registro formal de salidas de stock</span>,
                        <span key="2">{dispatches.length} despachos registrados</span>,
                    ]}
                    actions={<Button variant="primary" icon={<Plus size={16} />} onClick={handleNew}>NUEVO DESPACHO</Button>}
                />

                {/* Stats — 2 cols mobile, 4 cols desktop */}
                <div className="grid-responsive-metrics-4" style={{ marginTop: 'var(--space-32)', marginBottom: 'var(--space-24)' }}>
                    <style>{`@media (min-width: 48rem) { .grid-responsive-metrics-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }`}</style>
                    {[
                        { label: 'Total Despachos', value: dispatches.length },
                        { label: 'Borradores', value: dispatches.filter(d => d.status === 'borrador').length },
                        { label: 'Confirmados', value: dispatches.filter(d => d.status === 'confirmado').length },
                        { label: 'Valor Total', value: `$${totalValue.toLocaleString()}` },
                    ].map(stat => (
                        <div key={stat.label} className="metric-card">
                            <div className="metric-label">{stat.label}</div>
                            <div className="metric-value" style={{ fontSize: 'var(--text-h2-size)' }}>{stat.value}</div>
                        </div>
                    ))}
                </div>
                <style>{`.grid-responsive-metrics-4 { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-16); }`}</style>

                {/* Controls */}
                <div className="card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-16)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', flex: 1, flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '12rem', maxWidth: '20rem' }}>
                            <Search style={{ position: 'absolute', left: 'var(--space-12)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                            <input type="text" placeholder="Buscar por número o cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input" style={{ paddingLeft: 'var(--space-32)' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-muted)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', overflowX: 'auto' }}>
                            {(['todos', 'borrador', 'confirmado', 'anulado'] as const).map(status => (
                                <button key={status} onClick={() => setFilterStatus(status)} className={filterStatus === status ? 'tab is-active' : 'tab'} style={{ minHeight: '2rem', padding: '0 var(--space-12)', fontSize: 'var(--text-small-size)', whiteSpace: 'nowrap' }}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button className="btn btn-secondary btn-sm"><Filter size={16} /></button>
                </div>
            </SectionBlock>

            <SectionBlock>
                {filteredDispatches.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon" style={{ width: '5rem', height: '5rem', borderRadius: '50%' }}><FileText size={40} /></div>
                        <h4>No se encontraron despachos</h4>
                        <p>{searchTerm ? 'Prueba ajustando los términos de búsqueda.' : 'Aún no has registrado ningún despacho.'}</p>
                        {!searchTerm && <Button variant="primary" icon={<Plus size={18} />} onClick={handleNew}>REGISTRAR PRIMER DESPACHO</Button>}
                    </div>
                ) : (
                    <>
                        {/* ── MOBILE: cards ── */}
                        <div className="cards-mobile">
                            {filteredDispatches.map(dispatch => (
                                <div key={dispatch.id} className="card-mobile-row">
                                    <div className="card-mobile-row-header">
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{dispatch.number}</p>
                                            <p style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-muted)' }}>
                                                {format(new Date(dispatch.date), 'dd MMM yyyy · HH:mm', { locale: es })}
                                            </p>
                                        </div>
                                        {getStatusBadge(dispatch.status)}
                                    </div>
                                    <div className="card-mobile-row-meta">
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Cliente</p>
                                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dispatch.client_name || 'Sin Cliente'}</p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Items</p>
                                            <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dispatch.items?.length || 0}</p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total</p>
                                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>${dispatch.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                    <div className="card-mobile-row-actions">
                                        {dispatch.status === 'borrador' ? (
                                            <>
                                                <Button variant="secondary" size="sm" onClick={() => handleEdit(dispatch)} icon={<Edit size={14} />}>Editar</Button>
                                                <Button variant="primary" size="sm" onClick={() => handleConfirm(dispatch)} icon={<CheckCircle2 size={14} />}>Confirmar</Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(dispatch)} icon={<Trash2 size={14} />} />
                                            </>
                                        ) : (
                                            <>
                                                <Button variant="secondary" size="sm" onClick={() => handleView(dispatch)} icon={<Eye size={14} />}>Ver detalle</Button>
                                                {dispatch.status === 'confirmado' && <Button variant="ghost" size="sm" onClick={() => handleCancel(dispatch)} icon={<Ban size={14} />}>Anular</Button>}
                                                <Button variant="ghost" size="sm" onClick={() => handleView(dispatch)} icon={<Printer size={14} />} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── DESKTOP: tabla ── */}
                        <div className="table-responsive-wrap" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', overflow: 'hidden' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Número</th>
                                        <th>Fecha</th>
                                        <th>Cliente</th>
                                        <th style={{ textAlign: 'center' }}>Items</th>
                                        <th style={{ textAlign: 'right' }}>Total</th>
                                        <th>Estado</th>
                                        <th style={{ textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDispatches.map(dispatch => (
                                        <tr key={dispatch.id}>
                                            <td><span className="font-mono text-small" style={{ fontWeight: 700 }}>{dispatch.number}</span></td>
                                            <td>
                                                <div className="text-small" style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{format(new Date(dispatch.date), 'dd MMM yyyy', { locale: es })}</div>
                                                <div className="text-small text-muted">{format(new Date(dispatch.date), 'HH:mm', { locale: es })}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dispatch.client_name || 'Sin Cliente'}</div>
                                                {dispatch.notes && <div className="text-small text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{dispatch.notes}</div>}
                                            </td>
                                            <td style={{ textAlign: 'center' }}><span className="text-small tabular" style={{ fontWeight: 700 }}>{dispatch.items?.length || 0}</span></td>
                                            <td className="align-right">${dispatch.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td>{getStatusBadge(dispatch.status)}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-4)' }}>
                                                    {dispatch.status === 'borrador' ? (
                                                        <>
                                                            <button onClick={() => handleEdit(dispatch)} className="btn-ghost btn-sm" title="Editar"><Edit size={16} /></button>
                                                            <button onClick={() => handleConfirm(dispatch)} className="btn-ghost btn-sm" title="Confirmar"><CheckCircle2 size={16} /></button>
                                                            <button onClick={() => handleDelete(dispatch)} className="btn-ghost btn-sm" title="Eliminar"><Trash2 size={16} /></button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleView(dispatch)} className="btn-ghost btn-sm" title="Ver Detalle"><Eye size={16} /></button>
                                                            {dispatch.status === 'confirmado' && <button onClick={() => handleCancel(dispatch)} className="btn-ghost btn-sm" title="Anular"><Ban size={16} /></button>}
                                                            <button onClick={() => handleView(dispatch)} className="btn-ghost btn-sm" title="Imprimir"><Printer size={16} /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </SectionBlock>

            {isModalOpen && <DispatchModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} editingDispatch={selectedDispatch} />}
            {isDetailOpen && viewingDispatch && <DispatchDetail isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} dispatch={viewingDispatch} />}
        </PageContainer>
    );
};

export default Dispatches;