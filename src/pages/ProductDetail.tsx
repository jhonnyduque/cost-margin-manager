import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, PlayCircle, Archive, Trash2, Package, CheckCircle2, Copy } from 'lucide-react';
import { useStore, calculateProductCost } from '../store';
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
    const {
        products,
        productMovements,
        rawMaterials,
        batches,
        currentCompanyId,
        currentUserRole
    } = useStore();
    const { formatCurrency } = useCurrency();
    const [creatorName, setCreatorName] = useState<string>('Cargando...');

    const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
    const canEdit = allowedRoles.includes((currentUserRole as string) || '');
    const canCreate = allowedRoles.includes((currentUserRole as string) || '');

    const product = products.find(p => p.id === id);

    if (!product) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                <Package className="w-16 h-16 text-slate-300 mb-4" />
                <h2 className="text-display text-text-primary mb-2">Producto no encontrado</h2>
                <p className="text-body text-text-secondary mb-6">El producto que buscas no existe o fue eliminado.</p>
                <Button variant="primary" onClick={() => navigate('/productos')}>Volver al Catálogo</Button>
            </div>
        );
    }

    // Calculate Metrics
    const cost = calculateProductCost(product, batches, rawMaterials);
    const metrics = calculateFinancialMetrics(cost, product.price, product.target_margin || 0.3);

    // Calculate Stock
    const relevantMovements = productMovements.filter(m => m.product_id === product.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const currentStock = relevantMovements.reduce((acc, mov) => {
        if (mov.type === 'ingreso_produccion') return acc + mov.quantity;
        if (mov.type === 'salida_venta') return acc - mov.quantity;
        if (mov.type === 'ajuste') return acc + mov.quantity;
        return acc;
    }, 0);

    // Intentar resolver el nombre del creador a partir de su ID
    React.useEffect(() => {
        async function resolveCreator() {
            if (!product?.created_by) {
                setCreatorName('Desconocido');
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('full_name, email')
                    .eq('id', product.created_by)
                    .single();

                if (data) {
                    setCreatorName(data.full_name || data.email || 'Usuario');
                } else {
                    setCreatorName('Usuario Desconocido');
                }
            } catch (err) {
                setCreatorName('Desconocido');
            }
        }
        resolveCreator();
    }, [product?.created_by]);

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={() => navigate('/productos')}
                    className="flex items-center gap-2 text-label font-bold text-text-secondary hover:text-brand transition-colors"
                >
                    <ArrowLeft size={16} /> Volver al catálogo
                </button>
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <Button
                            variant="secondary"
                            onClick={() => navigate(`/productos/editar/${product.id}`)}
                            icon={<Edit2 size={16} />}
                        >
                            Editar Producto
                        </Button>
                    )}
                </div>
            </div>

            <PageHeader
                title={product.name}
                description={product.reference ? `Ref: ${product.reference}` : 'Sin referencia'}
                actions={
                    <Button variant="primary" icon={<PlayCircle size={18} />}>
                        Producir
                    </Button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Stats & Status */}
                <div className="space-y-6 md:col-span-1">
                    <Card className="p-6">
                        <h3 className="text-label text-text-secondary uppercase mb-6 font-bold tracking-widest">Resumen Financiero</h3>
                        <div className="space-y-5">
                            <div className="flex justify-between items-baseline border-b border-border/50 pb-2">
                                <span className="text-body text-text-secondary font-medium">Precio de Venta</span>
                                <span className="text-xl font-extrabold text-brand tabular-nums">{formatCurrency(product.price)}</span>
                            </div>
                            <div className="flex justify-between items-baseline border-b border-border/50 pb-2">
                                <span className="text-body text-text-secondary font-medium">Costo de Prod.</span>
                                <span className="text-lg font-bold text-text-primary tabular-nums">{formatCurrency(cost)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border/50">
                                <span className="text-body text-text-secondary font-medium">Margen Real</span>
                                <Badge variant={metrics.realMargin >= (product.target_margin || 0.3) ? 'success' : 'warning'} className="text-sm px-2">
                                    {(metrics.realMargin * 100).toFixed(1)}%
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-body text-text-secondary font-medium">Stock Disponible</span>
                                <span className={`text-lg font-bold tabular-nums ${currentStock > 0 ? 'text-emerald-600' : 'text-error'}`}>
                                    {currentStock} und.
                                </span>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h3 className="text-label text-text-secondary uppercase mb-5 font-bold tracking-widest">Información Base</h3>
                        <div className="space-y-4">
                            <div>
                                <span className="block text-label text-text-secondary uppercase mb-1">Estado</span>
                                <Badge variant={product.status === 'activa' ? 'success' : 'secondary'}>
                                    {product.status === 'activa' ? 'Activo' : 'Discontinuado'}
                                </Badge>
                            </div>
                            <div>
                                <span className="block text-label text-text-secondary uppercase mb-1">Margen Objetivo</span>
                                <span className="text-body font-bold text-text-primary">{(product.target_margin * 100).toFixed(1)}%</span>
                            </div>
                            <div className="pt-4 border-t border-border/50">
                                <span className="block text-label text-text-secondary uppercase mb-1">Creado Por</span>
                                <span className="text-body font-medium text-text-primary">{creatorName}</span>
                                <span className="block text-xs text-text-muted mt-1">
                                    el {new Date(product.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Right Column: Kardex */}
                <div className="md:col-span-2">
                    <Card className="p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-body font-bold text-text-primary">Kardex de Movimientos</h3>
                            <Badge variant="secondary" className="bg-bg-page">{relevantMovements.length} registros</Badge>
                        </div>

                        {relevantMovements.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-md">
                                <Archive className="w-12 h-12 text-slate-300 mb-3" />
                                <p className="text-body font-medium text-text-secondary">No hay movimientos registrados para este producto.</p>
                                <p className="text-sm text-text-muted mt-1">Acá aparecerá el inventario cuando produzcas o vendas.</p>
                            </div>
                        ) : (
                            <div className="table-container flex-1 bg-bg-card">
                                <table className="w-full text-left table-fixed min-w-[500px]">
                                    <thead className="table-header">
                                        <tr>
                                            <th className="table-header-cell w-[20%]">Fecha</th>
                                            <th className="table-header-cell w-[20%]">Tipo</th>
                                            <th className="table-header-cell w-[35%]">Referencia</th>
                                            <th className="table-header-cell w-[25%] text-right border-l border-border/50">Cantidad</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50 bg-bg-card">
                                        {relevantMovements.map(mov => (
                                            <tr key={mov.id} className="table-row">
                                                <td className="px-4 py-3 text-sm text-text-secondary tabular-nums border-l-4 border-transparent">
                                                    {new Date(mov.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide
                            ${mov.type === 'ingreso_produccion' ? 'bg-emerald-50 text-emerald-700' :
                                                            mov.type === 'salida_venta' ? 'bg-indigo-50 text-indigo-700' :
                                                                mov.type === 'ajuste' && mov.quantity > 0 ? 'bg-emerald-50 text-emerald-700' :
                                                                    mov.type === 'ajuste' && mov.quantity < 0 ? 'bg-red-50 text-red-700' :
                                                                        'bg-slate-100 text-slate-600'}`}
                                                    >
                                                        {mov.type === 'ingreso_produccion' ? 'Producción' :
                                                            mov.type === 'salida_venta' ? 'Venta' : 'Ajuste'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-body font-medium text-text-primary truncate" title={mov.reference || '---'}>
                                                    {mov.reference || '---'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-lg font-extrabold tabular-nums border-l border-border/50">
                                                    <span className={mov.quantity > 0 ? 'text-emerald-600' : 'text-error'}>
                                                        {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                                                    </span>
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
    );
};

export default ProductDetail;
