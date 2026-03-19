import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, PlayCircle, Archive, Package, CheckCircle2, Copy, Layers, History, MoreVertical, Printer } from 'lucide-react';
import { useStore, calculateProductCost, getFifoBreakdown, calculateProductStock } from '../store';
import { supabase } from '../services/supabase';
import { calculateFinancialMetrics } from '../core/financialMetricsEngine';
import { useCurrency } from '@/hooks/useCurrency';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { translateError } from '@/utils/errorHandler';

const ProductDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { products, productMovements, rawMaterials, batches, currentCompanyId, currentUserRole, unitsOfMeasure } = useStore();
    const { formatCurrency } = useCurrency();
    const [creatorName, setCreatorName] = useState<string>('Cargando...');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const toggleButtonRef = useRef<HTMLButtonElement>(null);

    const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
    const canEdit = allowedRoles.includes((currentUserRole as string) || '');
    const canCreate = allowedRoles.includes((currentUserRole as string) || '');

    const product = products.find(p => p.id === id);

    React.useEffect(() => {
        async function resolveCreator() {
            if (!product?.created_by) { setCreatorName('Desconocido'); return; }
            try {
                const { data } = await supabase.from('users').select('full_name, email').eq('id', product.created_by).single();
                setCreatorName(data ? (data.full_name || data.email || 'Usuario') : 'Usuario Desconocido');
            } catch { setCreatorName('Desconocido'); }
        }
        resolveCreator();
    }, [product?.created_by]);

    useEffect(() => {
        if (!isMenuOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (toggleButtonRef.current && toggleButtonRef.current.contains(target)) return;
            if (menuRef.current && !menuRef.current.contains(target)) setIsMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isMenuOpen]);

    const handleDuplicate = () => {
        setIsMenuOpen(false);
        if (product) navigate('/productos/nuevo', { state: { duplicateFrom: product } });
    };

    const handleDiscontinue = async () => {
        if (!product) return;
        setIsMenuOpen(false);
        const nextStatus = product.status === 'activa' ? 'inactiva' : 'activa';
        if (!confirm(`¿${product.status === 'activa' ? 'Discontinuar' : 'Activar'} este producto?`)) return;
        try { await useStore.getState().discontinueProduct(product.id, nextStatus as 'activa' | 'inactiva'); }
        catch (e: any) { alert(e.message); }
    };

    if (!product) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-48)', textAlign: 'center', minHeight: '60vh' }}>
                <Package style={{ width: '4rem', height: '4rem', color: 'var(--text-muted)', marginBottom: 'var(--space-16)' }} />
                <h2 style={{ fontSize: 'var(--text-h2-size)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-8)' }}>Producto no encontrado</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-24)' }}>El producto que buscas no existe o fue eliminado.</p>
                <Button variant="primary" onClick={() => navigate('/productos')}>Volver al Catálogo</Button>
            </div>
        );
    }

    const cost = calculateProductCost(product, batches, rawMaterials, unitsOfMeasure);
    const targetMarginDecimal = (product.target_margin || 30) / 100;
    const metrics = calculateFinancialMetrics(cost, product.price || 0, targetMarginDecimal);
    const relevantMovements = productMovements.filter(m => m.product_id === product.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const currentStock = calculateProductStock(product.id, productMovements);

    // Dropdown menu styles
    const menuStyle: React.CSSProperties = {
        position: 'absolute', right: 0, top: 'calc(100% + var(--space-8))',
        width: '14rem', background: 'var(--surface-card)',
        border: 'var(--border-default)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)', paddingTop: 'var(--space-4)',
        paddingBottom: 'var(--space-4)', zIndex: 50,
    };
    const menuBtnBase: React.CSSProperties = {
        display: 'flex', width: '100%', alignItems: 'center',
        gap: 'var(--space-8)', padding: 'var(--space-8) var(--space-16)',
        fontSize: 'var(--text-small-size)', fontWeight: 500,
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--text-secondary)', transition: 'background var(--transition-fast)',
        textAlign: 'left',
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--surface-page)', paddingBottom: 'var(--space-48)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-12) var(--space-24)', background: 'var(--surface-card)', borderBottom: 'var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                <button onClick={() => navigate('/productos')}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', fontSize: 'var(--text-small-size)', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color var(--transition-fast)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                    <ArrowLeft size={16} /> Volver al catálogo
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                    {canEdit && (
                        <Button variant="secondary" onClick={() => navigate(`/productos/editar/${product.id}`)} icon={<Edit2 size={16} />}>
                            Editar Producto
                        </Button>
                    )}
                </div>
            </div>

            <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto', padding: 'var(--space-32) var(--space-24)' }}>
                <PageHeader
                    title={product.name}
                    description={product.reference ? `Ref: ${product.reference}` : 'Sin referencia'}
                    actions={
                        <div style={{ position: 'relative' }}>
                            <Button ref={toggleButtonRef} variant="primary" icon={<MoreVertical size={18} />} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                                Acciones
                            </Button>
                            {isMenuOpen && (
                                <div ref={menuRef} style={menuStyle}>
                                    <button style={{ ...menuBtnBase, color: 'var(--state-success)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-success-soft)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        onClick={() => { setIsMenuOpen(false); navigate(`/produccion?productId=${product.id}`); }}>
                                        <PlayCircle size={16} /> Producir
                                    </button>
                                    <div style={{ borderTop: 'var(--border-default)', margin: 'var(--space-4) 0' }} />
                                    {canEdit && (
                                        <button style={menuBtnBase}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            onClick={() => { setIsMenuOpen(false); navigate(`/productos/editar/${product.id}`); }}>
                                            <Edit2 size={16} style={{ color: 'var(--text-muted)' }} /> Editar
                                        </button>
                                    )}
                                    {canCreate && (
                                        <button style={menuBtnBase}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            onClick={handleDuplicate}>
                                            <Copy size={16} style={{ color: 'var(--text-muted)' }} /> Duplicar
                                        </button>
                                    )}
                                    <button style={menuBtnBase}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        onClick={() => { setIsMenuOpen(false); window.print(); }}>
                                        <Printer size={16} style={{ color: 'var(--text-muted)' }} /> Imprimir
                                    </button>
                                    <div style={{ borderTop: 'var(--border-default)', margin: 'var(--space-4) 0' }} />
                                    <button
                                        style={{ ...menuBtnBase, color: product.status === 'activa' ? 'var(--state-danger)' : 'var(--state-success)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        onClick={handleDiscontinue}>
                                        <Archive size={16} style={{ color: 'var(--text-muted)' }} />
                                        {product.status === 'activa' ? 'Discontinuar' : 'Activar'}
                                    </button>
                                </div>
                            )}
                        </div>
                    }
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-24)', marginTop: 'var(--space-24)' }}>

                    {/* Left column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
                        <Card>
                            <h3 className="text-small text-muted" style={{ fontWeight: 700, marginBottom: 'var(--space-24)' }}>Resumen Financiero</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                                {[
                                    { label: 'Precio de Venta', value: formatCurrency(product.price) },
                                    { label: 'Costo de Prod.', value: formatCurrency(cost) },
                                ].map(row => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: 'var(--border-default)', paddingBottom: 'var(--space-8)' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)' }}>{row.label}</span>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-default)', paddingBottom: 'var(--space-8)' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)' }}>Margen Real</span>
                                    <Badge variant={metrics.realMargin >= targetMarginDecimal ? 'success' : 'warning'}>
                                        {(metrics.realMargin * 100).toFixed(1)}%
                                    </Badge>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)' }}>Stock Disponible</span>
                                    <span style={{ fontWeight: 700, color: currentStock > 0 ? 'var(--state-success)' : 'var(--state-danger)' }}>
                                        {currentStock} und.
                                    </span>
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <h3 className="text-small text-muted" style={{ fontWeight: 700, marginBottom: 'var(--space-20)' }}>Información Base</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                                <div>
                                    <span className="text-small text-muted" style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', marginBottom: 'var(--space-4)' }}>Estado</span>
                                    <Badge variant={product.status === 'activa' ? 'success' : 'neutral'}>
                                        {product.status === 'activa' ? 'Activo' : 'Discontinuado'}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="text-small text-muted" style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', marginBottom: 'var(--space-4)' }}>Margen Objetivo</span>
                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{(product.target_margin || 30).toFixed(1)}%</span>
                                </div>
                                <div style={{ borderTop: 'var(--border-default)', paddingTop: 'var(--space-16)' }}>
                                    <span className="text-small text-muted" style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', marginBottom: 'var(--space-4)' }}>Creado Por</span>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{creatorName}</span>
                                    <span className="text-small text-muted" style={{ display: 'block', marginTop: 'var(--space-4)' }}>
                                        el {new Date(product.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Right column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>

                        {/* BOM */}
                        <Card>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-24)' }}>
                                <div>
                                    <h3 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                                        <Layers size={18} style={{ color: 'var(--text-muted)' }} /> Composición & Auditoría FIFO
                                    </h3>
                                    <p className="text-small text-muted">Desglose técnico de insumos y costos actuales por lotes.</p>
                                </div>
                                <Badge variant="neutral">{product.materials?.length || 0} componentes</Badge>
                            </div>
                            <div style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Insumo</th>
                                            <th className="align-right">Consumo</th>
                                            <th className="align-right">Costo Prom.</th>
                                            <th className="align-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(product.materials || []).map((pm, idx) => {
                                            const material = rawMaterials.find(m => m.id === pm.material_id);
                                            const breakdown = getFifoBreakdown(pm.material_id, pm.quantity, pm.consumption_unit, batches, rawMaterials, unitsOfMeasure);
                                            const subtotal = breakdown.reduce((acc, b) => acc + b.subtotal, 0);
                                            const avgCost = pm.quantity > 0 ? subtotal / pm.quantity : 0;
                                            return (
                                                <tr key={idx}>
                                                    <td>
                                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{material?.name || 'Insumo desconocido'}</div>
                                                        <div className="text-small text-muted">{material?.provider || 'Sin prov.'}</div>
                                                    </td>
                                                    <td className="align-right tabular">{pm.quantity} {pm.consumption_unit}</td>
                                                    <td className="align-right tabular" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(avgCost)}</td>
                                                    <td className="align-right tabular" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(subtotal)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot style={{ background: 'var(--surface-muted)', borderTop: 'var(--border-default)' }}>
                                        <tr>
                                            <td colSpan={3} style={{ padding: 'var(--space-16)', fontWeight: 700, color: 'var(--text-primary)' }}>Costo Total de Producción (FIFO)</td>
                                            <td className="align-right tabular" style={{ padding: 'var(--space-16)', fontSize: 'var(--text-h3-size)', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(cost)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </Card>

                        {/* Kardex */}
                        <Card>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-24)' }}>
                                <h3 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                                    <History size={18} style={{ color: 'var(--text-muted)' }} /> Kardex de Movimientos
                                </h3>
                                <Badge variant="neutral">{relevantMovements.length} registros</Badge>
                            </div>

                            {relevantMovements.length === 0 ? (
                                <div className="empty-state" style={{ border: '2px dashed var(--border-color-default)', borderRadius: 'var(--radius-lg)' }}>
                                    <div className="empty-state-icon"><Archive size={24} /></div>
                                    <p style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>No hay movimientos registrados para este producto.</p>
                                    <p className="text-small text-muted">Acá aparecerá el inventario cuando produzcas o vendas.</p>
                                </div>
                            ) : (
                                <div style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Tipo</th>
                                                <th>Referencia</th>
                                                <th className="align-right">Cantidad</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {relevantMovements.map(mov => (
                                                <tr key={mov.id}>
                                                    <td className="text-small tabular">{new Date(mov.created_at).toLocaleDateString()}</td>
                                                    <td>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center',
                                                            padding: '2px var(--space-8)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            fontSize: '10px', fontWeight: 700,
                                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                                            background: 'var(--surface-muted)',
                                                            color: 'var(--text-secondary)',
                                                            border: 'var(--border-default)',
                                                        }}>
                                                            {mov.type === 'ingreso_produccion' ? 'Producción' : mov.type === 'salida_venta' ? 'Venta' : 'Ajuste'}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mov.reference || '---'}>
                                                        {mov.reference || '---'}
                                                    </td>
                                                    <td className="align-right tabular" style={{ fontWeight: 700, color: mov.quantity > 0 ? 'var(--state-success)' : 'var(--state-danger)' }}>
                                                        {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetail;