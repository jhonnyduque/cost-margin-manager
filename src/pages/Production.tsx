import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Factory, Search, PackageCheck, AlertTriangle, CheckCircle2,
  Package, ArrowRight, Settings2, Play, CheckCircle, Printer,
} from 'lucide-react';
import { useStore, calculateProductCost, calculateProductStock } from '../store';
import { analyzeBatchProduction } from '@/features/production/productionFlow';
import { useCurrency } from '@/hooks/useCurrency';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Product, ProductionOrder, ProductionStatus } from '@/types';

interface ProductionModalState {
  isOpen: boolean; productId: string; productName: string;
  quantity: number; targetPrice: number;
}

interface MissingStockModalState {
  isOpen: boolean; productId: string; quantity: number; targetPrice: number;
  productName: string;
  missingItems: Array<{ materialName: string; missingQuantity: number; unit: string; totalDebt: number }>;
  maxCoveredProduction: number;
}

const ALLOWED_ROLES = ['super_admin', 'admin', 'owner', 'manager'];

const Production: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUserRole, products, productMovements, rawMaterials,
    batches, unitsOfMeasure, consumeStockBatch,
    transitionProductionOrder, productionOrders,
  } = useStore();
  const { formatCurrency } = useCurrency();

  const canProduce = ALLOWED_ROLES.includes((currentUserRole as string) || '');
  const [searchParams] = useSearchParams();
  const preselectedProductId = searchParams.get('productId');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [sessionLots, setSessionLots] = useState(0);
  const [productionModal, setProductionModal] = useState<ProductionModalState>({ isOpen: false, productId: '', productName: '', quantity: 1, targetPrice: 0 });
  const [missingStockModal, setMissingStockModal] = useState<MissingStockModalState>({ isOpen: false, productId: '', quantity: 1, targetPrice: 0, productName: '', missingItems: [], maxCoveredProduction: 0 });
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; productName: string; quantity: number; cost: number } | null>(null);

  const printDate = useMemo(() => new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()), []);

  useEffect(() => {
    if (preselectedProductId && products.length > 0) {
      const product = products.find(p => p.id === preselectedProductId);
      if (product) {
        const unitCost = calculateProductCost(product, batches, rawMaterials, unitsOfMeasure);
        setProductionModal({ isOpen: true, productId: product.id, productName: product.name, quantity: 1, targetPrice: product.price || unitCost });
      }
    }
  }, [preselectedProductId, products, batches, rawMaterials, unitsOfMeasure]);

  const activeProducts = useMemo(() => products.filter(p => (p.status || 'activa') === 'activa' && (p.materials || []).length > 0), [products]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return activeProducts;
    return activeProducts.filter(p => p.name.toLowerCase().includes(query) || p.reference.toLowerCase().includes(query));
  }, [activeProducts, searchTerm]);

  const productionCards = useMemo(() => filteredProducts.map(product => {
    const unitCost = calculateProductCost(product, batches, rawMaterials, unitsOfMeasure);
    const stock = calculateProductStock(product.id, productMovements);
    const preview = analyzeBatchProduction({ product, quantity: 1, batches, rawMaterials, unitsOfMeasure });
    return { product, unitCost, stock, hasCoverage: preview.missingItems.length === 0, maxCoveredProduction: preview.maxCoveredProduction };
  }), [filteredProducts, batches, rawMaterials, unitsOfMeasure, productMovements]);

  const { activeOrders, completedOrders, metrics } = useMemo(() => {
    const active = productionOrders.filter(o => ['planned', 'preparation', 'processing'].includes(o.status));
    const completed = productionOrders.filter(o => ['finished', 'cancelled'].includes(o.status));
    return {
      activeOrders: active, completedOrders: completed,
      metrics: {
        planned: active.filter(o => o.status === 'planned').length,
        preparation: active.filter(o => o.status === 'preparation').length,
        processing: active.filter(o => o.status === 'processing').length,
        finishedToday: completed.filter(o => o.status === 'finished' && new Date(o.completed_at || o.created_at).toDateString() === new Date().toDateString()).length,
      },
    };
  }, [productionOrders]);

  const currentProduct = useMemo(() => products.find(p => p.id === productionModal.productId) || null, [products, productionModal.productId]);
  const productionPreview = useMemo(() => {
    if (!productionModal.isOpen || !currentProduct) return null;
    return analyzeBatchProduction({ product: currentProduct, quantity: Math.max(1, productionModal.quantity), batches, rawMaterials, unitsOfMeasure });
  }, [productionModal.isOpen, productionModal.quantity, currentProduct, batches, rawMaterials, unitsOfMeasure]);

  const openProductionModal = (product: Product, unitCost: number) => setProductionModal({ isOpen: true, productId: product.id, productName: product.name, quantity: 1, targetPrice: product.price || unitCost });
  const closeProductionModal = () => setProductionModal({ isOpen: false, productId: '', productName: '', quantity: 1, targetPrice: 0 });
  const closeMissingStockModal = () => setMissingStockModal({ isOpen: false, productId: '', quantity: 1, targetPrice: 0, productName: '', missingItems: [], maxCoveredProduction: 0 });

  const handleConfirmBatchProductionWithStatus = async (status: ProductionStatus = 'finished') => {
    const product = products.find(item => item.id === productionModal.productId);
    if (!product || productionModal.quantity <= 0) return;
    const analysis = analyzeBatchProduction({ product, quantity: productionModal.quantity, batches, rawMaterials, unitsOfMeasure });
    if (status === 'finished' && analysis.missingItems.length > 0) {
      setMissingStockModal({ isOpen: true, productId: product.id, quantity: productionModal.quantity, targetPrice: productionModal.targetPrice, productName: product.name, missingItems: analysis.missingItems, maxCoveredProduction: analysis.maxCoveredProduction });
      closeProductionModal(); return;
    }
    try {
      await consumeStockBatch(product.id, productionModal.quantity, productionModal.targetPrice, status);
      if (status === 'finished') { setSessionLots(c => c + 1); setSuccessModal({ isOpen: true, productName: product.name, quantity: productionModal.quantity, cost: analysis.totalCostForBatch }); }
      closeProductionModal();
    } catch (error: any) { alert(`Error registrando producción: ${error?.message || 'Error desconocido'}`); }
  };

  const handleConfirmDebtProduction = async () => {
    try {
      await consumeStockBatch(missingStockModal.productId, missingStockModal.quantity, missingStockModal.targetPrice);
      const product = products.find(item => item.id === missingStockModal.productId);
      const totalCost = product ? calculateProductCost(product, batches, rawMaterials, unitsOfMeasure) * missingStockModal.quantity : 0;
      setSessionLots(c => c + 1);
      setSuccessModal({ isOpen: true, productName: missingStockModal.productName, quantity: missingStockModal.quantity, cost: totalCost });
      closeMissingStockModal();
    } catch (error: any) { alert(`Error registrando producción con deuda: ${error?.message || 'Error desconocido'}`); }
  };

  const handleTransition = async (orderId: string, status: ProductionStatus) => {
    try { await transitionProductionOrder(orderId, status); }
    catch (error: any) { alert(`Error en transición: ${error.message}`); }
  };

  const renderStatusBadge = (order: ProductionOrder) => {
    switch (order.status) {
      case 'planned': return <Badge variant="neutral">🔬 Planeación</Badge>;
      case 'preparation': return <Badge variant="warning">🧪 Preparación</Badge>;
      case 'processing': return <Badge variant="warning">⚙️ Procesamiento</Badge>;
      case 'finished': return <Badge variant="success">✅ Finalizado</Badge>;
      case 'cancelled': return <Badge variant="danger">🚫 Cancelado</Badge>;
      default: return <Badge variant="neutral">{order.status}</Badge>;
    }
  };

  const renderOrderActions = (order: ProductionOrder) => {
    if (order.status === 'finished' || order.status === 'cancelled') {
      return <Button variant="ghost" size="sm" onClick={() => navigate(`/productos/detalle/${order.product_id}`)}>Auditar</Button>;
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        {order.status === 'planned' && <Button variant="secondary" size="sm" onClick={() => handleTransition(order.id, 'preparation')} icon={<Settings2 size={14} />}>Iniciar Preparación</Button>}
        {(order.status === 'planned' || order.status === 'preparation') && <Button variant="secondary" size="sm" onClick={() => handleTransition(order.id, 'processing')} icon={<Play size={14} />}>A Procesamiento</Button>}
        {(['planned', 'preparation', 'processing'] as ProductionStatus[]).includes(order.status) && <Button variant="primary" size="sm" onClick={() => handleTransition(order.id, 'finished')} icon={<CheckCircle size={14} />}>Finalizar</Button>}
      </div>
    );
  };

  const displayOrders = activeTab === 'active' ? activeOrders : completedOrders;

  return (
    <PageContainer>
      <style>{`
        .print-only { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 1.5cm; }
          body * { visibility: hidden !important; }
          #print-header, #print-header *, #print-area, #print-area * { visibility: visible !important; }
          #print-header { display: flex !important; position: absolute; top: 0; left: 0; width: 100%; padding: 1.2cm 1.5cm 0.5cm; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; background: #fff; z-index: 2; box-sizing: border-box; }
          #print-area { position: absolute; top: 3.2cm; left: 0; width: 100%; padding: 0 1.5cm; box-sizing: border-box; }
          .no-print, .modal-overlay, .cards-mobile { display: none !important; }
          .table-responsive-wrap { display: block !important; }
          table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed; font-size: 11px; }
          thead { display: table-header-group; }
          thead tr { border-bottom: 2px solid #000; }
          thead th { padding: 6px 8px; font-weight: 700; text-transform: uppercase; color: #000 !important; }
          tbody td { padding: 5px 8px; border-bottom: 1px solid #ddd; color: #000 !important; background: #fff !important; }
          tbody tr { page-break-inside: avoid; break-inside: avoid; }
          .card, .inset-card, .metric-card { box-shadow: none !important; border-color: #ddd !important; background: #fff !important; }
          .badge { border: 1px solid #000 !important; background: #fff !important; color: #000 !important; }
        }
      `}</style>

      {/* Print header */}
      <div id="print-header" className="print-only" aria-hidden="true">
        <div>
          <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999', marginBottom: '4px' }}>BETO OS — Producción</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#000', lineHeight: 1 }}>Reporte de Producción</div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{activeProducts.length} productos producibles · {sessionLots} lotes procesados en sesión</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999', marginBottom: '4px' }}>Fecha de emisión</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#000' }}>{printDate}</div>
        </div>
      </div>

      {/* Page header */}
      <SectionBlock>
        <UniversalPageHeader
          title="Producción"
          breadcrumbs={<><span>BETO OS</span><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Producción</span></>}
          metadata={[
            <span key="1">Gestión operativa agnóstica de lotes y procesos</span>,
            <span key="2">{activeProducts.length} productos producibles</span>,
            <span key="3">{sessionLots} lotes procesados en esta sesión</span>,
          ]}
          actions={<Button variant="secondary" size="sm" onClick={() => navigate('/productos')} icon={<Package size={16} />}>VER CATÁLOGO</Button>}
        />

        <div className="no-print" style={{ marginTop: 'var(--space-32)', borderTop: 'var(--border-default)', paddingTop: 'var(--space-32)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 'var(--space-12)' }}>
            <div style={{ position: 'relative', minWidth: 0 }}>
              <Search size={18} style={{ position: 'absolute', left: 'var(--space-16)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Buscar producto para producción..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input" style={{ paddingLeft: 'var(--space-48)', width: '100%' }} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => window.print()} title="Imprimir" icon={<Printer size={18} />} style={{ flexShrink: 0 }} />
          </div>
        </div>
      </SectionBlock>

      {/* Main content */}
      <div id="print-area" style={{ marginTop: 'var(--space-32)' }}>
        <SectionBlock>
          {productionCards.length === 0 ? (
            <EmptyState icon={Factory} title="No hay productos listos para producción" description="Crea productos con receta o ajusta la búsqueda para comenzar." action={{ label: 'Ir a productos', onClick: () => navigate('/productos') }} />
          ) : (
            <>
              {/* ── MOBILE: cards ── */}
              <div className="cards-mobile">
                {productionCards.map(({ product, unitCost, stock, hasCoverage, maxCoveredProduction }) => (
                  <div key={product.id} className="card-mobile-row">
                    <div className="card-mobile-row-header">
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</p>
                        <p style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-muted)' }}>{product.reference || 'Sin ref'}</p>
                      </div>
                      <Badge variant={hasCoverage ? 'success' : 'warning'}>{hasCoverage ? 'Listo' : 'Parcial'}</Badge>
                    </div>
                    <div className="card-mobile-row-meta">
                      <div>
                        <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Stock</p>
                        <p style={{ fontWeight: 700, color: stock > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{stock} ud.</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Costo Est.</p>
                        <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(unitCost)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Cobertura</p>
                        <p style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-muted)' }}>Hasta {maxCoveredProduction} ud.</p>
                      </div>
                    </div>
                    {canProduce && (
                      <div className="card-mobile-row-actions">
                        <Button variant="primary" size="sm" onClick={() => openProductionModal(product, unitCost)} icon={<PackageCheck size={16} />} style={{ width: '100%', justifyContent: 'center' }}>
                          Producir
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ── DESKTOP: tabla ── */}
              <div className="table-responsive-wrap" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>Producto</th>
                      <th style={{ textAlign: 'right' }}>Stock Actual</th>
                      <th style={{ textAlign: 'right' }}>Costo Est.</th>
                      <th style={{ textAlign: 'center' }}>Cobertura</th>
                      <th className="no-print" style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionCards.map(({ product, unitCost, stock, hasCoverage, maxCoveredProduction }) => (
                      <tr key={product.id}>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{product.name}</span>
                          <span className="text-small text-muted">{product.reference || 'Sin ref'}</span>
                        </td>
                        <td className="align-right"><span style={{ fontWeight: 700, color: stock > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{stock}</span></td>
                        <td className="align-right" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(unitCost)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', cursor: 'help' }} title={hasCoverage ? 'Cobertura completa.' : 'Requiere deuda de inventario.'}>
                            <Badge variant={hasCoverage ? 'success' : 'warning'}>{hasCoverage ? 'Listo' : 'Parcial'}</Badge>
                            <span className="text-small text-muted">Hasta {maxCoveredProduction} ud.</span>
                          </div>
                        </td>
                        <td className="no-print" style={{ textAlign: 'right' }}>
                          <Button variant="primary" size="sm" disabled={!canProduce} onClick={() => openProductionModal(product, unitCost)} icon={<PackageCheck size={16} />}>Producir</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SectionBlock>

        {/* Panel de órdenes */}
        <SectionBlock>
          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-12)', marginBottom: 'var(--space-32)' }} className="grid-responsive-metrics">
            <style>{`@media (min-width: 48rem) { .grid-responsive-metrics { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }`}</style>
            {[
              { label: '🔬 En Planeación', value: metrics.planned, color: 'var(--text-muted)' },
              { label: '🧪 En Preparación', value: metrics.preparation, color: 'var(--text-muted)' },
              { label: '⚙️ En Procesamiento', value: metrics.processing, color: 'var(--text-muted)' },
              { label: '✅ Finalizados Hoy', value: metrics.finishedToday, color: 'var(--state-success)' },
            ].map(m => (
              <div key={m.label} className="metric-card">
                <div className="metric-label" style={{ color: m.color }}>{m.label}</div>
                <div className="metric-value" style={{ fontSize: 'var(--text-h2-size)' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Header órdenes */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-24)', flexWrap: 'wrap', gap: 'var(--space-16)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Panel de Órdenes</h2>
              <p className="text-small text-muted" style={{ marginTop: 'var(--space-4)' }}>Gestiona el flujo desde la planeación hasta el producto final.</p>
            </div>
            <div className="no-print" style={{ display: 'flex', background: 'var(--surface-muted)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
              <button onClick={() => setActiveTab('active')} className={activeTab === 'active' ? 'tab is-active' : 'tab'}>Activas ({activeOrders.length})</button>
              <button onClick={() => setActiveTab('history')} className={activeTab === 'history' ? 'tab is-active' : 'tab'}>Historial ({completedOrders.length})</button>
            </div>
          </div>

          {displayOrders.length === 0 ? (
            <div className="empty-state" style={{ border: '2px dashed var(--border-color-default)', borderRadius: 'var(--radius-xl)' }}>
              <p className="text-muted">{activeTab === 'active' ? 'No hay órdenes en proceso.' : 'No hay registros históricos.'}</p>
            </div>
          ) : (
            <>
              {/* ── MOBILE: cards de órdenes ── */}
              <div className="cards-mobile">
                {displayOrders.map(order => {
                  const product = products.find(p => p.id === order.product_id);
                  return (
                    <div key={order.id} className="card-mobile-row">
                      <div className="card-mobile-row-header">
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product?.name || 'Producto desconocido'}</p>
                          <p style={{ fontSize: 'var(--text-small-size)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>#{order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        {renderStatusBadge(order)}
                      </div>
                      <div className="card-mobile-row-meta">
                        <div>
                          <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Cantidad</p>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{order.quantity} ud.</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Costo</p>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(order.total_cost || 0)}</p>
                        </div>
                      </div>
                      <div className="card-mobile-row-actions">
                        {renderOrderActions(order)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DESKTOP: tabla de órdenes ── */}
              <div className="table-responsive-wrap" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID / Fecha</th>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Costo Est.</th>
                      <th>Estado</th>
                      <th className="no-print">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayOrders.map(order => {
                      const product = products.find(p => p.id === order.product_id);
                      return (
                        <tr key={order.id}>
                          <td>
                            <p className="font-mono text-small text-muted">#{order.id.slice(0, 8)}</p>
                            <p style={{ fontSize: 'var(--text-small-size)', fontWeight: 500 }}>{new Date(order.created_at).toLocaleDateString()}</p>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                              <span style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}><Package size={16} /></span>
                              <div>
                                <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{product?.name || 'Producto desconocido'}</p>
                                <p className="text-small text-muted">{product?.reference || 'Sin ref'}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{order.quantity}</p>
                            <p className="text-small text-muted">unidades</p>
                          </td>
                          <td>
                            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(order.total_cost || 0)}</p>
                            <p className="text-small text-muted">{order.unit_cost ? `${formatCurrency(order.unit_cost)} / ud` : 'Pendiente'}</p>
                          </td>
                          <td>{renderStatusBadge(order)}</td>
                          <td className="no-print">{renderOrderActions(order)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SectionBlock>
      </div>

      {/* Modales */}
      {(productionModal.isOpen || missingStockModal.isOpen || (successModal && successModal.isOpen)) && (
        <div className="modal-overlay">

          {/* Modal producción */}
          {productionModal.isOpen && currentProduct && productionPreview && (
            <Card style={{ width: '100%', maxWidth: '36rem', padding: 0, overflow: 'hidden' }}>
              <div style={{ borderBottom: 'var(--border-default)', padding: 'var(--space-24)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-16)' }}>
                  <div>
                    <p className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Nuevo lote</p>
                    <h3 style={{ marginTop: 'var(--space-8)', fontSize: 'var(--text-h2-size)', fontWeight: 600 }}>{productionModal.productName}</h3>
                  </div>
                  <button className="btn-ghost btn-sm" onClick={closeProductionModal} aria-label="Cerrar">×</button>
                </div>
              </div>
              <div style={{ padding: 'var(--space-24)', display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-16)' }}>
                  <Input label="Cantidad a fabricar" type="number" min={1} value={productionModal.quantity} onChange={e => setProductionModal(c => ({ ...c, quantity: Math.max(1, Number(e.target.value) || 1) }))} />
                  <Input label="Precio objetivo por unidad" type="number" min={0} value={productionModal.targetPrice} onChange={e => setProductionModal(c => ({ ...c, targetPrice: Math.max(0, Number(e.target.value) || 0) }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-16)' }}>
                  <div className="inset-card">
                    <p className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Costo estimado</p>
                    <p style={{ marginTop: 'var(--space-8)', fontSize: 'var(--text-h2-size)', fontWeight: 600 }}>{formatCurrency(productionPreview.totalCostForBatch)}</p>
                  </div>
                  <div className="inset-card">
                    <p className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cobertura actual</p>
                    <p style={{ marginTop: 'var(--space-8)', fontSize: 'var(--text-h2-size)', fontWeight: 600 }}>{productionPreview.maxCoveredProduction} lotes</p>
                  </div>
                </div>
                {productionPreview.missingItems.length > 0 && (
                  <div className="alert alert-warning">
                    <strong>Este lote requiere deuda de inventario.</strong> Se detectaron faltantes en {productionPreview.missingItems.length} insumo{productionPreview.missingItems.length === 1 ? '' : 's'}.
                  </div>
                )}
              </div>
              <div className="modal-actions" style={{ borderTop: 'var(--border-default)', padding: 'var(--space-24)' }}>
                <Button variant="ghost" onClick={closeProductionModal}>Cancelar</Button>
                <Button variant="secondary" onClick={() => handleConfirmBatchProductionWithStatus('planned')}>Planificar</Button>
                <Button variant="primary" onClick={() => handleConfirmBatchProductionWithStatus('finished')} icon={<CheckCircle2 />}>Confirmar ahora</Button>
              </div>
            </Card>
          )}

          {/* Modal stock insuficiente */}
          {missingStockModal.isOpen && (
            <Card style={{ width: '100%', maxWidth: '40rem', maxHeight: '90vh', padding: 0, overflow: 'hidden', borderColor: 'var(--surface-danger-soft)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ borderBottom: 'var(--border-default)', background: 'var(--surface-danger-soft)', padding: 'var(--space-24)', flexShrink: 0, position: 'sticky', top: 0, zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-12)' }}>
                  <AlertTriangle style={{ color: 'var(--state-danger)', marginTop: 2, flexShrink: 0 }} size={20} />
                  <div>
                    <p className="text-small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--state-danger)' }}>Cobertura insuficiente</p>
                    <h3 style={{ marginTop: 'var(--space-8)', fontSize: 'var(--text-h2-size)', fontWeight: 600 }}>{missingStockModal.productName}</h3>
                  </div>
                </div>
              </div>
              <div style={{ padding: 'var(--space-24)', display: 'flex', flexDirection: 'column', gap: 'var(--space-16)', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <p className="text-body" style={{ color: 'var(--text-secondary)' }}>No hay stock suficiente para este lote completo. Puedes cancelar o continuar registrando deuda.</p>
                <div className="inset-card">
                  <p className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Cobertura disponible</p>
                  <p style={{ fontSize: 'var(--text-h2-size)', fontWeight: 600, marginTop: 'var(--space-4)' }}>{missingStockModal.maxCoveredProduction} lotes completos</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                  {missingStockModal.missingItems.map(item => (
                    <div key={item.materialName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 'var(--radius-lg)', border: 'var(--border-default)', padding: 'var(--space-12) var(--space-16)' }}>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.materialName}</p>
                        <p className="text-small text-muted">Faltan {item.missingQuantity.toFixed(2)} {item.unit}</p>
                      </div>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(item.totalDebt)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-actions" style={{ borderTop: 'var(--border-default)', padding: 'var(--space-24)', flexShrink: 0 }}>
                <Button variant="ghost" onClick={closeMissingStockModal}>Cancelar</Button>
                <Button variant="danger" onClick={handleConfirmDebtProduction} icon={<ArrowRight />}>Aceptar y generar deuda</Button>
              </div>
            </Card>
          )}

          {/* Modal éxito */}
          {successModal && successModal.isOpen && (
            <Card style={{ width: '100%', maxWidth: '28rem', padding: 0, overflow: 'hidden', textAlign: 'center' }}>
              <div style={{ padding: 'var(--space-48) var(--space-24) var(--space-24)' }}>
                <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: 'var(--surface-success-soft)', color: 'var(--state-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-16)' }}><CheckCircle2 size={24} /></div>
                <h3 style={{ fontSize: 'var(--text-h2-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Producción registrada</h3>
                <p className="text-body" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-8)' }}>
                  {successModal.quantity} lote{successModal.quantity === 1 ? '' : 's'} de <strong>{successModal.productName}</strong> se agregaron al inventario.
                </p>
                <p style={{ marginTop: 'var(--space-16)', fontWeight: 600, color: 'var(--text-primary)' }}>Costo estimado: {formatCurrency(successModal.cost)}</p>
              </div>
              <div style={{ borderTop: 'var(--border-default)', padding: 'var(--space-24)' }}>
                <Button style={{ width: '100%' }} onClick={() => setSuccessModal(null)}>Entendido</Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
};

export default Production;