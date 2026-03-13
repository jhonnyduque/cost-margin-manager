import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Factory, Search, PackageCheck, AlertTriangle, CheckCircle2, Package, ArrowRight, Settings2, Play, CheckCircle } from 'lucide-react';
import { useStore, calculateProductCost, calculateProductStock } from '../store';
import { analyzeBatchProduction } from '@/features/production/productionFlow';
import { useCurrency } from '@/hooks/useCurrency';
import { PageContainer, SectionBlock, CardGrid } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors, typography, radius, shadows, spacing } from '@/design/design-tokens';
import { Product, ProductionOrder, ProductionStatus } from '@/types';

interface ProductionModalState {
  isOpen: boolean;
  productId: string;
  productName: string;
  quantity: number;
  targetPrice: number;
}

interface MissingStockModalState {
  isOpen: boolean;
  productId: string;
  quantity: number;
  targetPrice: number;
  productName: string;
  missingItems: Array<{
    materialName: string;
    missingQuantity: number;
    unit: string;
    totalDebt: number;
  }>;
  maxCoveredProduction: number;
}

const ALLOWED_ROLES = ['super_admin', 'admin', 'owner', 'manager'];

const Production: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUserRole,
    products,
    productMovements,
    rawMaterials,
    batches,
    unitsOfMeasure,
    consumeStockBatch,
    transitionProductionOrder,
    productionOrders,
  } = useStore();
  const { formatCurrency } = useCurrency();

  const canProduce = ALLOWED_ROLES.includes((currentUserRole as string) || '');
  const [searchParams] = useSearchParams();
  const preselectedProductId = searchParams.get('productId');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [sessionLots, setSessionLots] = useState(0);
  const [productionModal, setProductionModal] = useState<ProductionModalState>({
    isOpen: false,
    productId: '',
    productName: '',
    quantity: 1,
    targetPrice: 0,
  });

  // Handle auto-opening modal if productId is provided in URL
  useEffect(() => {
    if (preselectedProductId && products.length > 0) {
      const product = products.find(p => p.id === preselectedProductId);
      if (product) {
        const unitCost = calculateProductCost(product, batches, rawMaterials, unitsOfMeasure);
        setProductionModal({
          isOpen: true,
          productId: product.id,
          productName: product.name,
          quantity: 1,
          targetPrice: product.price || unitCost,
        });
      }
    }
  }, [preselectedProductId, products, batches, rawMaterials, unitsOfMeasure]);
  const [missingStockModal, setMissingStockModal] = useState<MissingStockModalState>({
    isOpen: false,
    productId: '',
    quantity: 1,
    targetPrice: 0,
    productName: '',
    missingItems: [],
    maxCoveredProduction: 0,
  });
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; productName: string; quantity: number; cost: number } | null>(null);

  const activeProducts = useMemo(
    () => products.filter((product) => (product.status || 'activa') === 'activa' && (product.materials || []).length > 0),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return activeProducts;
    return activeProducts.filter((product) =>
      product.name.toLowerCase().includes(query) ||
      product.reference.toLowerCase().includes(query)
    );
  }, [activeProducts, searchTerm]);

  const productionCards = useMemo(() => {
    return filteredProducts.map((product) => {
      const unitCost = calculateProductCost(product, batches, rawMaterials, unitsOfMeasure);
      const stock = calculateProductStock(product.id, productMovements);
      const preview = analyzeBatchProduction({
        product,
        quantity: 1,
        batches,
        rawMaterials,
        unitsOfMeasure,
      });

      return {
        product,
        unitCost,
        stock,
        hasCoverage: preview.missingItems.length === 0,
        maxCoveredProduction: preview.maxCoveredProduction,
      };
    });
  }, [filteredProducts, batches, rawMaterials, unitsOfMeasure, productMovements]);

  const { activeOrders, completedOrders, metrics } = useMemo(() => {
    const active = productionOrders.filter(o => ['planned', 'preparation', 'processing'].includes(o.status));
    const completed = productionOrders.filter(o => ['finished', 'cancelled'].includes(o.status));
    
    return {
      activeOrders: active,
      completedOrders: completed,
      metrics: {
        planned: active.filter(o => o.status === 'planned').length,
        preparation: active.filter(o => o.status === 'preparation').length,
        processing: active.filter(o => o.status === 'processing').length,
        finishedToday: completed.filter(o => o.status === 'finished' && new Date(o.completed_at || o.created_at).toDateString() === new Date().toDateString()).length
      }
    };
  }, [productionOrders]);

  const currentProduct = useMemo(
    () => products.find((product) => product.id === productionModal.productId) || null,
    [products, productionModal.productId]
  );

  const productionPreview = useMemo(() => {
    if (!productionModal.isOpen || !currentProduct) return null;
    return analyzeBatchProduction({
      product: currentProduct,
      quantity: Math.max(1, productionModal.quantity),
      batches,
      rawMaterials,
      unitsOfMeasure,
    });
  }, [productionModal.isOpen, productionModal.quantity, currentProduct, batches, rawMaterials, unitsOfMeasure]);

  const openProductionModal = (product: Product, unitCost: number) => {
    setProductionModal({
      isOpen: true,
      productId: product.id,
      productName: product.name,
      quantity: 1,
      targetPrice: product.price || unitCost,
    });
  };

  const closeProductionModal = () => {
    setProductionModal({ isOpen: false, productId: '', productName: '', quantity: 1, targetPrice: 0 });
  };

  const closeMissingStockModal = () => {
    setMissingStockModal({
      isOpen: false,
      productId: '',
      quantity: 1,
      targetPrice: 0,
      productName: '',
      missingItems: [],
      maxCoveredProduction: 0,
    });
  };

  const handleConfirmBatchProductionWithStatus = async (status: ProductionStatus = 'finished') => {
    const product = products.find((item) => item.id === productionModal.productId);
    if (!product || productionModal.quantity <= 0) return;

    const analysis = analyzeBatchProduction({
      product,
      quantity: productionModal.quantity,
      batches,
      rawMaterials,
      unitsOfMeasure,
    });

    if (status === 'finished' && analysis.missingItems.length > 0) {
      setMissingStockModal({
        isOpen: true,
        productId: product.id,
        quantity: productionModal.quantity,
        targetPrice: productionModal.targetPrice,
        productName: product.name,
        missingItems: analysis.missingItems,
        maxCoveredProduction: analysis.maxCoveredProduction,
      });
      closeProductionModal();
      return;
    }

    try {
      await consumeStockBatch(product.id, productionModal.quantity, productionModal.targetPrice, status);
      
      if (status === 'finished') {
        setSessionLots((current) => current + 1);
        setSuccessModal({
          isOpen: true,
          productName: product.name,
          quantity: productionModal.quantity,
          cost: analysis.totalCostForBatch,
        });
      }
      closeProductionModal();
    } catch (error: any) {
      alert(`Error registrando producción: ${error?.message || 'Error desconocido'}`);
    }
  };

  const handleConfirmDebtProduction = async () => {
    try {
      await consumeStockBatch(missingStockModal.productId, missingStockModal.quantity, missingStockModal.targetPrice);
      const product = products.find((item) => item.id === missingStockModal.productId);
      const totalCost = product
        ? calculateProductCost(product, batches, rawMaterials, unitsOfMeasure) * missingStockModal.quantity
        : 0;
      setSessionLots((current) => current + 1);
      setSuccessModal({
        isOpen: true,
        productName: missingStockModal.productName,
        quantity: missingStockModal.quantity,
        cost: totalCost,
      });
      closeMissingStockModal();
    } catch (error: any) {
      alert(`Error registrando producción con deuda: ${error?.message || 'Error desconocido'}`);
    }
  };

  const handleTransition = async (orderId: string, status: ProductionStatus) => {
    try {
      await transitionProductionOrder(orderId, status);
    } catch (error: any) {
      alert(`Error en transición: ${error.message}`);
    }
  };

  const renderStatusBadge = (order: ProductionOrder) => {
    switch (order.status) {
      case 'planned':
        return <Badge variant="secondary">🔬 Planeación</Badge>;
      case 'preparation':
        return <Badge variant="warning">🧪 Preparación</Badge>;
      case 'processing':
        return <Badge variant="warning">⚙️ Procesamiento</Badge>;
      case 'finished':
        return <Badge variant="success">✅ Finalizado</Badge>;
      case 'cancelled':
        return <Badge variant="danger">🚫 Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{order.status}</Badge>;
    }
  };

  const renderOrderActions = (order: ProductionOrder) => {
    if (order.status === 'finished' || order.status === 'cancelled') {
       return (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/productos/detalle/${order.product_id}`)}>
          Auditar
        </Button>
       );
    }

    return (
      <div className="flex items-center gap-1">
        {order.status === 'planned' && (
          <Button variant="secondary" size="sm" onClick={() => handleTransition(order.id, 'preparation')} icon={<Settings2 size={14} />}>
            Iniciar Preparación
          </Button>
        )}
        {(order.status === 'planned' || order.status === 'preparation') && (
          <Button variant="secondary" size="sm" onClick={() => handleTransition(order.id, 'processing')} icon={<Play size={14} />}>
            A Procesamiento
          </Button>
        )}
        {(order.status === 'planned' || order.status === 'preparation' || order.status === 'processing') && (
          <Button variant="primary" size="sm" onClick={() => handleTransition(order.id, 'finished')} icon={<CheckCircle size={14} />}>
            Finalizar
          </Button>
        )}
      </div>
    );
  };

  return (
    <PageContainer>
      <SectionBlock>
        <UniversalPageHeader
          title="Producción"
          breadcrumbs={
            <>
              <span>BETO OS</span>
              <span>/</span>
              <span className={colors.textPrimary}>Producción</span>
            </>
          }
          metadata={[
            <span key="1">Gestión operativa agnóstica de lotes y procesos</span>,
            <span key="2">{activeProducts.length} productos producibles</span>,
            <span key="3">{sessionLots} lotes procesados en esta sesión</span>,
          ]}
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate('/productos')} icon={<Package />}>
              VER CATÁLOGO
            </Button>
          }
        />

        <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto producible..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 ${typography.text.body} transition-all focus:bg-white focus:ring-2 focus:ring-slate-300`}
            />
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              Lote con cobertura completa
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
              <span className="size-2 rounded-full bg-amber-500" />
              Requiere deuda de inventario
            </span>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock>
        {productionCards.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="No hay productos listos para producción"
            description="Crea productos con receta o ajusta la búsqueda para comenzar a producir lotes desde esta vista."
            action={{ label: 'Ir a productos', onClick: () => navigate('/productos') }}
          />
        ) : (
          <div className={`table-container ${radius.xl} border ${colors.borderStandard} overflow-hidden ${shadows.sm}`}>
            <table className="w-full text-left border-collapse">
              <thead className={`${colors.bgMain} border-b ${colors.borderStandard}`}>
                <tr>
                  <th className={`px-6 py-3 ${typography.uiLabel} ${colors.textSecondary} w-[30%]`}>Producto</th>
                  <th className={`px-6 py-3 ${typography.uiLabel} ${colors.textSecondary} w-[15%] text-right`}>Stock Actual</th>
                  <th className={`px-6 py-3 ${typography.uiLabel} ${colors.textSecondary} w-[20%] text-right`}>Costo Est.</th>
                  <th className={`px-6 py-3 ${typography.uiLabel} ${colors.textSecondary} w-[20%] text-center`}>Cobertura</th>
                  <th className={`px-6 py-3 ${typography.uiLabel} ${colors.textSecondary} w-[15%] text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {productionCards.map(({ product, unitCost, stock, hasCoverage, maxCoveredProduction }) => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`${typography.text.body} font-bold text-slate-900`}>{product.name}</span>
                        <span className={`${typography.text.caption} text-slate-500`}>{product.reference || 'Sin ref'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`${typography.text.body} font-bold ${stock > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                        {stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`${typography.text.body} font-bold text-slate-900`}>
                        {formatCurrency(unitCost)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant={hasCoverage ? 'success' : 'warning'}>
                          {hasCoverage ? 'Listo' : 'Parcial'}
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Hasta {maxCoveredProduction} ud.
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!canProduce}
                        onClick={() => openProductionModal(product, unitCost)}
                        icon={<PackageCheck size={16} />}
                      >
                        Producir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionBlock>

      <SectionBlock>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">🔬 En Planeación</p>
            <p className="text-2xl font-black text-slate-900 mt-2">{metrics.planned}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">🧪 En Preparación</p>
            <p className="text-2xl font-black text-slate-900 mt-2">{metrics.preparation}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">⚙️ En Procesamiento</p>
            <p className="text-2xl font-black text-slate-900 mt-2">{metrics.processing}</p>
          </div>
          <div className="bg-white border border-emerald-100 bg-emerald-50/20 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">✅ Finalizados Hoy</p>
            <p className="text-2xl font-black text-emerald-700 mt-2">{metrics.finishedToday}</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className={`${typography.text.section} text-slate-900`}>Panel de Órdenes</h2>
            <p className={`${typography.text.caption} text-slate-500 mt-1`}>Gestiona el flujo de trabajo desde la planeación hasta el producto final.</p>
          </div>
          
          <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
            <button 
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Activas ({activeOrders.length})
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Historial ({completedOrders.length})
            </button>
          </div>
        </div>

        {(activeTab === 'active' ? activeOrders : completedOrders).length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
            <p className="text-slate-500">
              {activeTab === 'active' ? 'No hay órdenes en proceso.' : 'No hay registros históricos.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className={`px-6 py-4 ${typography.text.caption} font-bold uppercase tracking-wider text-slate-500`}>ID / Fecha</th>
                    <th className={`px-6 py-4 ${typography.text.caption} font-bold uppercase tracking-wider text-slate-500`}>Producto</th>
                    <th className={`px-6 py-4 ${typography.text.caption} font-bold uppercase tracking-wider text-slate-500`}>Cantidad</th>
                    <th className={`px-6 py-4 ${typography.text.caption} font-bold uppercase tracking-wider text-slate-500`}>Costo Est.</th>
                    <th className={`px-6 py-4 ${typography.text.caption} font-bold uppercase tracking-wider text-slate-500`}>Estado</th>
                    <th className={`px-6 py-4 ${typography.text.caption} font-bold uppercase tracking-wider text-slate-500`}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(activeTab === 'active' ? activeOrders : completedOrders).map((order) => {
                    const product = products.find(p => p.id === order.product_id);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-xs font-mono text-slate-400">#{order.id.slice(0, 8)}</p>
                          <p className="text-sm font-medium text-slate-900">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                              <Package size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{product?.name || 'Producto desconocido'}</p>
                              <p className="text-xs text-slate-500">{product?.reference || 'Sin ref'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-slate-900">{order.quantity}</p>
                          <p className="text-xs text-slate-500">unidades</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(order.total_cost || 0)}</p>
                          <p className="text-xs text-slate-500">{order.unit_cost ? `${formatCurrency(order.unit_cost)} / ud` : 'Pendiente'}</p>
                        </td>
                        <td className="px-6 py-4">
                          {renderStatusBadge(order)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {renderOrderActions(order)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionBlock>

      {(productionModal.isOpen || missingStockModal.isOpen || (successModal && successModal.isOpen)) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
          {productionModal.isOpen && currentProduct && productionPreview && (
            <Card className="w-full max-w-xl border border-slate-200 bg-white p-0 overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`${typography.text.caption} font-bold uppercase tracking-[0.12em] text-slate-400`}>Nuevo lote</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-900">{productionModal.productName}</h3>
                  </div>
                  <button className="text-slate-400 transition-colors hover:text-slate-600" onClick={closeProductionModal} aria-label="Cerrar">
                    ×
                  </button>
                </div>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Cantidad a fabricar"
                    type="number"
                    min={1}
                    value={productionModal.quantity}
                    onChange={(event) => setProductionModal((current) => ({
                      ...current,
                      quantity: Math.max(1, Number(event.target.value) || 1),
                    }))}
                  />
                  <Input
                    label="Precio objetivo por unidad"
                    type="number"
                    min={0}
                    value={productionModal.targetPrice}
                    onChange={(event) => setProductionModal((current) => ({
                      ...current,
                      targetPrice: Math.max(0, Number(event.target.value) || 0),
                    }))}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className={`${typography.text.caption} font-bold uppercase tracking-[0.12em] text-slate-400`}>Costo estimado del lote</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(productionPreview.totalCostForBatch)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className={`${typography.text.caption} font-bold uppercase tracking-[0.12em] text-slate-400`}>Cobertura actual</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{productionPreview.maxCoveredProduction} lotes</p>
                  </div>
                </div>

                {productionPreview.missingItems.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-700">Este lote requiere deuda de inventario</p>
                    <p className="mt-1 text-sm text-amber-700/80">
                      Se detectaron faltantes en {productionPreview.missingItems.length} insumo{productionPreview.missingItems.length === 1 ? '' : 's'}.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={closeProductionModal}>Cancelar</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => handleConfirmBatchProductionWithStatus('planned')}>
                    Planificar
                  </Button>
                  <Button variant="primary" onClick={() => handleConfirmBatchProductionWithStatus('finished')} icon={<CheckCircle2 />}>
                    Confirmar ahora
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {missingStockModal.isOpen && (
            <Card className="w-full max-w-2xl border border-red-200 bg-white p-0 overflow-hidden">
              <div className="border-b border-red-100 bg-red-50/70 px-6 py-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 text-red-600" size={22} />
                  <div>
                    <p className={`${typography.text.caption} font-bold uppercase tracking-[0.12em] text-red-500`}>Cobertura insuficiente</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-900">{missingStockModal.productName}</h3>
                  </div>
                </div>
              </div>

              <div className="space-y-5 px-6 py-6">
                <p className="text-sm leading-relaxed text-slate-600">
                  No hay stock suficiente para producir este lote completo. Puedes cancelar o continuar registrando deuda de inventario.
                </p>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className={`${typography.text.caption} font-bold uppercase tracking-[0.12em] text-slate-400`}>Cobertura disponible</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{missingStockModal.maxCoveredProduction} lotes completos</p>
                </div>

                <div className="space-y-3">
                  {missingStockModal.missingItems.map((item) => (
                    <div key={item.materialName} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.materialName}</p>
                        <p className="text-sm text-slate-500">Faltan {item.missingQuantity.toFixed(2)} {item.unit}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.totalDebt)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={closeMissingStockModal}>Cancelar</Button>
                <Button variant="danger" onClick={handleConfirmDebtProduction} icon={<ArrowRight />}>
                  Aceptar y generar deuda
                </Button>
              </div>
            </Card>
          )}

          {successModal && successModal.isOpen && (
            <Card className="w-full max-w-md border border-slate-200 bg-white p-0 overflow-hidden text-center">
              <div className="px-6 py-8">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={26} />
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-slate-900">Producción registrada</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {successModal.quantity} lote{successModal.quantity === 1 ? '' : 's'} de <span className="font-semibold text-slate-700">{successModal.productName}</span> se agregaron al inventario.
                </p>
                <p className="mt-4 text-sm font-semibold text-slate-900">Costo estimado: {formatCurrency(successModal.cost)}</p>
              </div>
              <div className="border-t border-slate-100 px-6 py-5">
                <Button fullWidth onClick={() => setSuccessModal(null)}>Entendido</Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
};

export default Production;
