import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, PlayCircle, Archive, Trash2, Package, CheckCircle2, Copy, Layers, History, MoreVertical, Printer } from 'lucide-react';
import { useStore, calculateProductCost, getFifoBreakdown, calculateProductStock } from '../store';
import { supabase } from '../services/supabase';
import { calculateFinancialMetrics } from '../core/financialMetricsEngine';
import { useCurrency } from '@/hooks/useCurrency';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
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

    // ── ESTADOS DEL MENÚ KEBAB Y PRODUCCIÓN ──
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const toggleButtonRef = useRef<HTMLButtonElement>(null);


    const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
    const canEdit = allowedRoles.includes((currentUserRole as string) || '');
    const canCreate = allowedRoles.includes((currentUserRole as string) || '');

    const product = products.find(p => p.id === id);

    // 🟢 HOOKS FIX: useEffect movido ANTES del early return.
    // React Rules of Hooks: todos los hooks deben llamarse siempre,
    // en el mismo orden, sin importar condiciones ni early returns.
    React.useEffect(() => {
        async function resolveCreator() {
            if (!product?.created_by) {
                setCreatorName('Desconocido');
                return;
            }
            try {
                const { data } = await supabase
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


    // ── LÓGICA DEL MENÚ Y CLICK OUTSIDE ──
    useEffect(() => {
        if (!isMenuOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (toggleButtonRef.current && toggleButtonRef.current.contains(target)) return;
            if (menuRef.current && !menuRef.current.contains(target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isMenuOpen]);

    const handleDuplicate = () => {
        setIsMenuOpen(false);
        if (product) {
            navigate('/productos/nuevo', { state: { duplicateFrom: product } });
        }
    };

    const handleDiscontinue = async () => {
        if (!product) return;
        setIsMenuOpen(false);
        const nextStatus = product.status === 'activa' ? 'inactiva' : 'activa';
        if (!confirm(`¿${product.status === 'activa' ? 'Discontinuar' : 'Activar'} este producto?`)) return;
        try {
            await useStore.getState().discontinueProduct(product.id, nextStatus as 'activa' | 'inactiva');
        } catch (e: any) { alert(e.message); }
    };

    if (!product) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                <Package className="w-16 h-16 text-slate-300 mb-4" />
                <h2 className={`${typography.sectionTitle} mb-2`}>Producto no encontrado</h2>
                <p className={`${typography.body} text-slate-500 mb-6`}>El producto que buscas no existe o fue eliminado.</p>
                <Button variant="primary" onClick={() => navigate('/productos')}>Volver al Catálogo</Button>
            </div>
        );
    }

    // Calculate Metrics
    const cost = calculateProductCost(product, batches, rawMaterials, unitsOfMeasure);
    const targetMarginDecimal = (product.target_margin || 30) / 100;
    const metrics = calculateFinancialMetrics(cost, product.price || 0, targetMarginDecimal);

    // Calculate Stock
    const relevantMovements = productMovements.filter(m => m.product_id === product.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const currentStock = calculateProductStock(product.id, productMovements);


    return (
        <div className={`space-y-6 ${colors.bgMain} min-h-screen pb-12`}>
            {/* Header Actions */}
            <div className={`flex items-center justify-between mb-4 ${spacing.pMd} sm:${spacing.pxLg} py-3 ${colors.bgSurface} border-b ${colors.borderStandard} ${shadows.sm}`}>
                <button
                    onClick={() => navigate('/productos')}
                    className={`flex items-center gap-2 ${typography.uiLabel} ${colors.textSecondary} hover:${colors.textPrimary} transition-colors`}
                >
                    <ArrowLeft size={16} /> Volver al catálogo
                </button>
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <Button
                            variant="secondary"
                            onClick={() => navigate(`/productos/editar/${product.id}`)}
                            icon={<Edit2 size={16} />}
                            className="hidden sm:flex"
                        >
                            Editar Producto
                        </Button>
                    )}
                </div>
            </div>

            <div className={`max-w-7xl mx-auto w-full ${spacing.pxMd} sm:${spacing.pxLg} space-y-6`}>
                <PageHeader
                    title={product.name}
                    description={product.reference ? `Ref: ${product.reference}` : 'Sin referencia'}
                    actions={
                        <div className="relative">
                            <Button
                                ref={toggleButtonRef}
                                variant="primary"
                                icon={<MoreVertical size={18} />}
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                            >
                                Acciones
                            </Button>

                            {isMenuOpen && (
                                <div ref={menuRef} className={`absolute right-0 mt-2 w-56 ${radius.xl} border ${colors.borderStandard} ${colors.bgSurface} ${shadows.xl} py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}>
                                    <button
                                        className={`flex w-full items-center gap-2 ${spacing.pxMd} py-2 ${typography.uiLabel} font-bold ${colors.statusSuccess} hover:${colors.bgSuccess} transition-colors`}
                                        onClick={() => { setIsMenuOpen(false); navigate(`/produccion?productId=${product.id}`); }}
                                    >
                                        <PlayCircle size={16} /> Producir
                                    </button>
                                    <div className={`border-t ${colors.borderSubtle} my-1`} />
                                    {canEdit && (
                                        <button
                                            className={`flex w-full items-center gap-2 ${spacing.pxMd} py-2 ${typography.uiLabel} font-medium ${colors.textSecondary} hover:${colors.bgMain} transition-colors`}
                                            onClick={() => { setIsMenuOpen(false); navigate(`/productos/editar/${product.id}`); }}
                                        >
                                            <Edit2 size={16} className={colors.textMuted} /> Editar
                                        </button>
                                    )}
                                    {canCreate && (
                                        <button
                                            className={`flex w-full items-center gap-2 ${spacing.pxMd} py-2 ${typography.uiLabel} font-medium ${colors.textSecondary} hover:${colors.bgMain} transition-colors`}
                                            onClick={handleDuplicate}
                                        >
                                            <Copy size={16} className={colors.textMuted} /> Duplicar
                                        </button>
                                    )}
                                    <button
                                        className={`flex w-full items-center gap-2 ${spacing.pxMd} py-2 ${typography.uiLabel} font-medium ${colors.textSecondary} hover:${colors.bgMain} transition-colors`}
                                        onClick={() => { setIsMenuOpen(false); window.print(); }}
                                    >
                                        <Printer size={16} className={colors.textMuted} /> Imprimir
                                    </button>
                                    <div className={`border-t ${colors.borderSubtle} my-1`} />
                                    <button
                                        className={`flex w-full items-center gap-2 ${spacing.pxMd} py-2 ${typography.uiLabel} font-medium ${product.status === 'activa' ? colors.statusDanger : colors.statusSuccess} hover:${colors.bgMain} transition-colors`}
                                        onClick={handleDiscontinue}
                                    >
                                        <Archive size={16} className={product.status === 'activa' ? 'text-slate-400' : 'text-slate-600'} />
                                        {product.status === 'activa' ? 'Discontinuar' : 'Activar'}
                                    </button>
                                </div>
                            )}
                        </div>
                    }
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: Stats & Status */}
                    <div className="space-y-6 md:col-span-1">
                        <Card className={`${spacing.pLg} ${radius.xl} ${shadows.sm} border ${colors.borderStandard} ${colors.bgSurface}`}>
                            <h3 className={`${typography.uiLabel} ${colors.textSecondary} mb-6`}>Resumen Financiero</h3>
                            <div className="space-y-5">
                                <div className={`flex justify-between items-baseline border-b ${colors.borderSubtle} pb-2`}>
                                    <span className={`${typography.body} ${colors.textSecondary} font-medium`}>Precio de Venta</span>
                                    <span className={`${typography.body} font-bold ${colors.textPrimary}`}>{formatCurrency(product.price)}</span>
                                </div>
                                <div className={`flex justify-between items-baseline border-b ${colors.borderSubtle} pb-2`}>
                                    <span className={`${typography.body} ${colors.textSecondary} font-medium`}>Costo de Prod.</span>
                                    <span className={`${typography.body} font-bold ${colors.textPrimary} tabular-nums`}>{formatCurrency(cost)}</span>
                                </div>
                                <div className={`flex justify-between items-center py-2 border-b ${colors.borderSubtle}`}>
                                    <span className={`${typography.body} ${colors.textSecondary} font-medium`}>Margen Real</span>
                                    <Badge variant={metrics.realMargin >= targetMarginDecimal ? 'success' : 'warning'} className="text-sm px-2">
                                        {(metrics.realMargin * 100).toFixed(1)}%
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className={`${typography.body} ${colors.textSecondary} font-medium`}>Stock Disponible</span>
                                    <span className={`${typography.body} font-bold ${currentStock > 0 ? colors.statusSuccess : colors.statusDanger}`}>
                                        {currentStock} und.
                                    </span>
                                </div>
                            </div>
                        </Card>

                        <Card className={`${spacing.pLg} ${radius.xl} ${shadows.sm} border ${colors.borderStandard} ${colors.bgSurface}`}>
                            <h3 className={`${typography.uiLabel} ${colors.textSecondary} mb-5`}>Información Base</h3>
                            <div className="space-y-4">
                                <div>
                                    <span className={`block ${typography.caption} font-bold uppercase ${colors.textMuted} mb-1`}>Estado</span>
                                    <Badge variant={product.status === 'activa' ? 'success' : 'secondary'}>
                                        {product.status === 'activa' ? 'Activo' : 'Discontinuado'}
                                    </Badge>
                                </div>
                                <div>
                                    <span className={`block ${typography.caption} font-bold uppercase ${colors.textMuted} mb-1`}>Margen Objetivo</span>
                                    <span className={`${typography.body} font-bold ${colors.textPrimary}`}>{(product.target_margin || 30).toFixed(1)}%</span>
                                </div>
                                <div className={`pt-4 border-t ${colors.borderSubtle}`}>
                                    <span className={`block ${typography.caption} font-bold uppercase ${colors.textMuted} mb-1`}>Creado Por</span>
                                    <span className={`${typography.body} font-medium ${colors.textPrimary}`}>{creatorName}</span>
                                    <span className={`block ${typography.caption} ${colors.textSecondary} mt-1`}>
                                        el {new Date(product.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Right Column: BOM & Kardex */}
                    <div className="md:col-span-2 space-y-6">
                        {/* BILL OF MATERIALS (BOM) & FIFO AUDIT */}
                        <Card className={`${spacing.pLg} ${radius.xl} ${shadows.sm} border ${colors.borderStandard} ${colors.bgSurface}`}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex flex-col">
                                    <h3 className={`${typography.sectionTitle} ${colors.textPrimary} flex items-center gap-2`}>
                                        <Layers size={18} className="text-slate-500" /> Composición & Auditoría FIFO
                                    </h3>
                                    <p className={`${typography.caption} ${colors.textSecondary}`}>Desglose técnico de insumos y costos actuales por lotes.</p>
                                </div>
                                <Badge variant="secondary" className={colors.bgMain}>{product.materials?.length || 0} componentes</Badge>
                            </div>

                            <div className={`overflow-x-auto border ${colors.borderStandard} ${radius.lg}`}>
                                <table className="w-full text-left">
                                    <thead className={`${colors.bgMain} border-b ${colors.borderStandard}`}>
                                        <tr>
                                            <th className={`px-4 py-3 ${typography.uiLabel} ${colors.textSecondary}`}>Insumo</th>
                                            <th className={`px-4 py-3 ${typography.uiLabel} ${colors.textSecondary} text-right`}>Consumo</th>
                                            <th className={`px-4 py-3 ${typography.uiLabel} ${colors.textSecondary} text-right`}>Costo Prom.</th>
                                            <th className={`px-4 py-3 ${typography.uiLabel} ${colors.textSecondary} text-right`}>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${colors.borderSubtle}`}>
                                        {(product.materials || []).map((pm, idx) => {
                                            const material = rawMaterials.find(m => m.id === pm.material_id);
                                            const breakdown = getFifoBreakdown(pm.material_id, pm.quantity, pm.consumption_unit, batches, rawMaterials, unitsOfMeasure);
                                            const subtotal = breakdown.reduce((acc, b) => acc + b.subtotal, 0);
                                            const avgCost = pm.quantity > 0 ? subtotal / pm.quantity : 0;

                                            return (
                                                <tr key={idx} className={`hover:${colors.bgMain} transition-colors`}>
                                                    <td className="px-4 py-3">
                                                        <div className={`${typography.body} font-medium ${colors.textPrimary}`}>{material?.name || 'Insumo desconocido'}</div>
                                                        <div className={`${typography.caption} ${colors.textMuted}`}>{material?.provider || 'Sin prov.'}</div>
                                                    </td>
                                                    <td className={`px-4 py-3 text-right ${typography.body} ${colors.textPrimary} tabular-nums`}>
                                                        {pm.quantity} {pm.consumption_unit}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right ${typography.body} ${colors.textSecondary} tabular-nums`}>
                                                        {formatCurrency(avgCost)}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right ${typography.body} font-bold ${colors.textPrimary} tabular-nums`}>
                                                        {formatCurrency(subtotal)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className={`${colors.bgMain} border-t ${colors.borderStandard}`}>
                                        <tr>
                                            <td colSpan={3} className={`px-4 py-4 ${typography.body} font-bold ${colors.textPrimary}`}>Costo Total de Producción (FIFO)</td>
                                            <td className={`px-4 py-4 text-right ${typography.sectionTitle} ${colors.textPrimary}`}>{formatCurrency(cost)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </Card>

                        {/* KARDEX DE MOVIMIENTOS */}
                        <Card className={`${spacing.pLg} ${radius.xl} ${shadows.sm} border ${colors.borderStandard} ${colors.bgSurface}`}>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className={`${typography.sectionTitle} ${colors.textPrimary} flex items-center gap-2`}>
                                    <History size={18} className="text-slate-500" /> Kardex de Movimientos
                                </h3>
                                <Badge variant="secondary" className={colors.bgMain}>{relevantMovements.length} registros</Badge>
                            </div>

                            {relevantMovements.length === 0 ? (
                                <div className={`flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed ${colors.borderStandard} ${radius.lg}`}>
                                    <Archive className={`w-12 h-12 ${colors.textMuted} mb-3`} />
                                    <p className={`${typography.body} font-medium ${colors.textSecondary}`}>No hay movimientos registrados para este producto.</p>
                                    <p className={`${typography.caption} ${colors.textMuted} mt-1`}>Acá aparecerá el inventario cuando produzcas o vendas.</p>
                                </div>
                            ) : (
                                <div className={`overflow-x-auto border ${colors.borderStandard} ${radius.lg}`}>
                                    <table className="w-full text-left">
                                        <thead className={`${colors.bgMain} border-b ${colors.borderStandard}`}>
                                            <tr>
                                                <th className={`px-4 py-3 ${typography.uiLabel} ${colors.textSecondary}`}>Fecha</th>
                                                <th className={`px-4 py-3 ${typography.uiLabel} ${colors.textSecondary}`}>Tipo</th>
                                                <th className={`px-4 py-3 ${typography.uiLabel} ${colors.textSecondary}`}>Referencia</th>
                                                <th className={`px-4 py-3 ${typography.uiLabel} ${colors.textSecondary} text-right`}>Cantidad</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${colors.borderSubtle}`}>
                                            {relevantMovements.map(mov => (
                                                <tr key={mov.id} className={`hover:${colors.bgMain} transition-colors`}>
                                                    <td className={`px-4 py-3 ${typography.bodySm} ${colors.textSecondary} tabular-nums`}>
                                                        {new Date(mov.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center px-2 py-0.5 ${radius.sm} text-[10px] font-bold uppercase tracking-widest
                                                            ${mov.type === 'ingreso_produccion' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                                                                mov.type === 'salida_venta' ? 'bg-slate-50 text-slate-600 border border-slate-200' :
                                                                    mov.type === 'ajuste' && mov.quantity > 0 ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                                                                        mov.type === 'ajuste' && mov.quantity < 0 ? 'bg-slate-50 text-slate-500 border border-slate-200' :
                                                                            'bg-slate-100 text-slate-600 border border-slate-200'}`}
                                                        >
                                                            {mov.type === 'ingreso_produccion' ? 'Producción' :
                                                                mov.type === 'salida_venta' ? 'Venta' : 'Ajuste'}
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-3 ${typography.body} font-medium ${colors.textPrimary} truncate`} title={mov.reference || '---'}>
                                                        {mov.reference || '---'}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right ${typography.body} font-bold tabular-nums`}>
                                                        <span className={mov.quantity > 0 ? colors.statusSuccess : colors.statusDanger}>
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

        </div>
    );
};

export default ProductDetail;