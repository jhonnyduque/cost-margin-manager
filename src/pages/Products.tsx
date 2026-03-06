import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2, Search, PlayCircle, Info, Layers, TrendingUp, CheckCircle2, X, ChevronRight, AlertTriangle, RotateCcw, Ruler, History, Copy, Package, PackageSearch, Printer, Archive, MoreVertical } from 'lucide-react';
import { useStore, calculateProductCost, calculateFifoCost, getFifoBreakdown, hasProductGeneratedActiveDebt } from '../store';
import { calculateFinancialMetrics } from '@/core/financialMetricsEngine';
import { Product, Unit, RawMaterial, MaterialBatch } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { useCurrency } from '@/hooks/useCurrency';
import { translateError } from '@/utils/errorHandler';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';

const Products: React.FC = () => {
  const navigate = useNavigate();
  const { currentCompanyId, currentUserRole, products, productMovements, rawMaterials, batches, movements, addProduct, deleteProduct, discontinueProduct, updateProduct, consumeStock, consumeStockBatch } = useStore();
  const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
  const canCreate = allowedRoles.includes((currentUserRole as string) || '');
  const canEdit = allowedRoles.includes((currentUserRole as string) || '');
  const canDelete = allowedRoles.includes((currentUserRole as string) || '');
  const { formatCurrency, currencySymbol } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'activa' | 'inactiva' | 'todos'>('activa');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuState, setMenuState] = useState<{ productId: string; rect: DOMRect } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [productionModal, setProductionModal] = useState<{ isOpen: boolean; productId: string; quantity: number; cost: number; targetPrice: number; productName: string }>({ isOpen: false, productId: '', quantity: 1, cost: 0, targetPrice: 0, productName: '' });
  const [missingStockModal, setMissingStockModal] = useState<{ isOpen: boolean; productId: string; missingItems: any[]; quantity: number; targetPrice: number; maxCoveredProduction: number; fullBreakdown: any[]; showFullBreakdown: boolean }>({ isOpen: false, productId: '', missingItems: [], quantity: 1, targetPrice: 0, maxCoveredProduction: 0, fullBreakdown: [], showFullBreakdown: false });
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; productName: string; cost: number; quantity: number } | null>(null);

  const handleConfirmBatchProduction = () => {
    const { productId, quantity, targetPrice } = productionModal;
    const product = products.find(p => p.id === productId);
    if (!product || quantity <= 0) return;

    const missingItems: any[] = [];
    const fullBreakdown: any[] = [];
    let totalCostForBatch = 0;
    let maxCoveredProduction = quantity;

    product.materials?.forEach(pm => {
      let qtyPerUnit = pm.quantity;
      if (pm.mode === 'pieces' && pm.pieces) {
        const latestBatch = batches.filter(b => b.material_id === pm.material_id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const width = latestBatch?.width || 140;
        const totalAreaCm2 = pm.pieces.reduce((acc: number, p: any) => acc + (p.length * p.width), 0);
        qtyPerUnit = (totalAreaCm2 / width) / 100;
      }

      const availableMaterialStock = batches.filter(b => b.material_id === pm.material_id).reduce((acc, b) => acc + b.remaining_quantity, 0);
      let possibleUnits = qtyPerUnit > 0 ? Math.floor(availableMaterialStock / qtyPerUnit) : quantity;
      if (possibleUnits < maxCoveredProduction) {
        maxCoveredProduction = Math.max(0, possibleUnits);
      }

      let effectiveQty = qtyPerUnit * quantity;

      const breakdown = getFifoBreakdown(pm.material_id, effectiveQty, pm.consumption_unit, batches, rawMaterials);
      const totalMissing = breakdown.filter(b => b.is_missing).reduce((acc, b) => acc + b.quantity_used_in_target_unit, 0);

      breakdown.forEach(b => { totalCostForBatch += b.subtotal; });

      if (totalMissing > 0) {
        const material = rawMaterials.find(m => m.id === pm.material_id);
        const lastBatchCost = batches.filter(b => b.material_id === pm.material_id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.unit_cost || 0;

        missingItems.push({
          materialName: material?.name || 'Insumo desconocido',
          missingQuantity: totalMissing,
          unit: pm.consumption_unit,
          unitCost: lastBatchCost,
          totalDebt: lastBatchCost * totalMissing
        });
      }

      const material = rawMaterials.find(m => m.id === pm.material_id);
      const coveredQty = effectiveQty - totalMissing;
      const lastBatchCost = batches.filter(b => b.material_id === pm.material_id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.unit_cost || 0;

      fullBreakdown.push({
        materialName: material?.name || 'Insumo desconocido',
        requiredQuantity: effectiveQty,
        coveredQuantity: coveredQty,
        missingQuantity: totalMissing,
        unit: pm.consumption_unit,
        unitCost: lastBatchCost
      });
    });

    if (missingItems.length > 0) {
      setMissingStockModal({ isOpen: true, productId, missingItems, quantity, targetPrice, maxCoveredProduction, fullBreakdown, showFullBreakdown: false });
      setProductionModal({ ...productionModal, isOpen: false });
    } else {
      consumeStockBatch(productId, quantity, targetPrice).then(() => {
        setProductionModal({ ...productionModal, isOpen: false });
        setSuccessModal({ isOpen: true, productName: product.name, cost: totalCostForBatch, quantity });
      }).catch(err => {
        alert('Error registrando producción: ' + err.message);
      });
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.reference.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(p => {
    if (statusFilter === 'todos') return true;
    return p.status === statusFilter;
  });

  const handleDuplicate = (product: Product) => {
    navigate('/productos/nuevo');
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Click outside closes kebab menu ──
  useEffect(() => {
    if (!menuState) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Skip if click is on a kebab trigger — let openMenu handle toggle
      if (target.closest('[data-kebab-trigger]')) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuState(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuState]);

  // ── Toggle selection ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  // ── Batch actions ──
  const handleBatchDiscontinue = async () => {
    if (!confirm(`¿Discontinuar ${selectedIds.size} producto(s)?`)) return;
    for (const id of selectedIds) {
      try { await discontinueProduct(id); } catch (e) { console.error(e); }
    }
    setSelectedIds(new Set());
  };
  const handleBatchDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedIds.size} producto(s)? Esta acción es irreversible.`)) return;
    const errors: string[] = [];
    for (const id of selectedIds) {
      try { await deleteProduct(id); } catch (e: any) { errors.push(e.message); }
    }
    if (errors.length > 0) alert(`No se pudieron eliminar algunos productos:\n${errors.join('\n')}`);
    setSelectedIds(new Set());
  };

  // ── Single actions from kebab ──
  const handleDiscontinue = async (id: string) => {
    setMenuState(null);
    if (!confirm('¿Discontinuar este producto?')) return;
    try { await discontinueProduct(id); } catch (e: any) { alert(e.message); }
  };
  const handleDelete = async (id: string) => {
    setMenuState(null);
    if (!confirm('¿Eliminar este producto? Esta acción es irreversible.')) return;
    try { await deleteProduct(id); } catch (e: any) { alert(e.message); }
  };

  // ── Open kebab with fixed positioning ──
  const openMenu = (productId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (menuState?.productId === productId) {
      setMenuState(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuState({ productId, rect });
  };

  return (
    <PageContainer>
      <style>{`
      @media print {
        body * { visibility: hidden; }
        #print-area, #print-area * { visibility: visible; }
        #print-area { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }
      `}</style>

      <SectionBlock>
        <UniversalPageHeader
          title="Catálogo de Productos"
          breadcrumbs={
            <>
              <span>BETO OS</span>
              <span>/</span>
              <span className={colors.textPrimary}>Productos</span>
            </>
          }
          metadata={[
            <span key="1">Gestión de Escandallos (Costos FIFO)</span>,
            <span key="2">{products.length} productos registrados</span>
          ]}
          actions={
            canCreate && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/materias-primas')}
                >
                  NUEVO INSUMO
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/productos/nuevo')}
                  icon={<Plus />}
                >
                  NUEVO PRODUCTO
                </Button>
              </>
            )
          }
        />

        {/* UNIFIED TOOLBAR */}
        <div className="flex flex-wrap items-center gap-4 pt-6 mt-6 border-t border-slate-100 no-print">
          <div className="relative flex-1 min-w-[300px]">
            <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${colors.textMuted}`} />
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.text.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white`}
            />
          </div>

          <div className="flex items-center gap-3">
            <Select
              className="w-48"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="activa">Solo Activos</option>
              <option value="inactiva">Discontinuados</option>
              <option value="todos">Todos los productos</option>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className={colors.textSecondary}
              onClick={handlePrint}
              title="Imprimir Catálogo"
              icon={<Printer size={20} />}
            />
          </div>
        </div>
      </SectionBlock>

      <div className="space-y-4">
        {/* ✅ MÓVIL - Layout Cards */}
        <div className="md:hidden space-y-4">
          {filteredProducts.map((p) => {
            const cost = calculateProductCost(p, batches, rawMaterials);
            const metrics = calculateFinancialMetrics(cost, p.price, p.target_margin || 0.3);
            return (
              <Card key={p.id} className="border border-slate-200">
                <Card.Header className="mb-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0" onClick={() => navigate(`/productos/detalle/${p.id}`)}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                      onClick={(e) => e.stopPropagation()}
                      className={`mt-1 h-4 w-4 rounded-md accent-indigo-600 shrink-0`}
                      aria-label={`Seleccionar ${p.name}`}
                    />
                    <div className="min-w-0">
                      <h3 className={`${typography.text.section} ${colors.textPrimary} truncate`}>{p.name}</h3>
                      <p className={`${typography.text.caption} ${colors.textSecondary} mt-0.5`}>{p.reference || 'SIN REF'}</p>
                    </div>
                  </div>
                  <Badge variant={metrics.realMargin >= (p.target_margin || 0.3) ? 'success' : 'warning'}>
                    {(metrics.realMargin * 100).toFixed(1)}%
                  </Badge>
                </Card.Header>

                <Card.Content className="grid grid-cols-2 gap-4 bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                  <div className="flex flex-col">
                    <span className={`${typography.text.caption} text-slate-500 font-bold uppercase`}>Costo (FIFO)</span>
                    <span className={`${typography.text.body} font-bold ${colors.textPrimary}`}>{formatCurrency(cost)}</span>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className={`${typography.text.caption} text-slate-500 font-bold uppercase`}>Precio Venta</span>
                    <span className={`${typography.text.body} font-black text-indigo-600`}>{formatCurrency(p.price)}</span>
                  </div>
                </Card.Content>

                <Card.Footer className="mt-4 pt-4 flex justify-end">
                  <div className="relative">
                    <button
                      data-kebab-trigger
                      className="rounded-lg p-2 transition-colors hover:bg-slate-100 text-slate-400"
                      onClick={(e) => openMenu(p.id, e)}
                      aria-label="Más opciones"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </Card.Footer>
              </Card>
            );
          })}
        </div>

        {/* ✅ ESCRITORIO - Tabla normal */}
        <div id="print-area" className="hidden md:block">
          <div className={`table-container rounded-2xl ${colors.bgSurface} border ${colors.borderStandard} overflow-hidden ${shadows.sm}`}>
            <table className="w-full text-left table-fixed">
              <thead className={`${colors.bgMain} border-b ${colors.borderStandard}`}>
                <tr>
                  <th className={`w-[48px] ${spacing.pxLg} py-4`}>
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                      onChange={toggleSelectAll}
                      className={`h-4 w-4 rounded accent-indigo-600`}
                      aria-label="Seleccionar todos"
                    />
                  </th>
                  <th className={`w-[28%] ${spacing.pxLg} py-4 truncate ${typography.text.caption} text-slate-500 font-bold uppercase`}>Producto</th>
                  <th className={`w-[18%] ${spacing.pxLg} py-4 truncate ${typography.text.caption} text-slate-500 font-bold uppercase`}>Referencia / SKU</th>
                  <th className={`w-[14%] ${spacing.pxLg} py-4 text-right truncate ${typography.text.caption} text-slate-500 font-bold uppercase`}>Costo (FIFO)</th>
                  <th className={`w-[14%] ${spacing.pxLg} py-4 text-right truncate ${typography.text.caption} text-slate-500 font-bold uppercase`}>Precio Venta</th>
                  <th className={`w-[10%] ${spacing.pxLg} py-4 text-center truncate ${typography.text.caption} text-slate-500 font-bold uppercase`}>Margen</th>
                  <th className={`w-[16%] min-w-[120px] ${spacing.pxLg} py-4 text-center ${typography.text.caption} text-slate-500 font-bold uppercase`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const cost = calculateProductCost(p, batches, rawMaterials);
                  const metrics = calculateFinancialMetrics(cost, p.price, p.target_margin || 0.3);
                  return (
                    <tr key={p.id} className={`group transition-all hover:bg-slate-50/50 ${selectedIds.has(p.id) ? `bg-indigo-50/30` : colors.bgSurface}`}>
                      <td className={`${spacing.pxLg} py-4`}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className={`h-4 w-4 rounded accent-indigo-600`}
                          aria-label={`Seleccionar ${p.name}`}
                        />
                      </td>
                      <td
                        className={`${spacing.pxLg} py-4 ${typography.text.body} font-black ${colors.textPrimary} truncate cursor-pointer hover:text-indigo-600 transition-colors capitalize`}
                        title={p.name}
                        onClick={() => navigate(`/productos/detalle/${p.id}`)}
                      >
                        {p.name}
                      </td>
                      <td className={`${spacing.pxLg} py-4 ${typography.text.secondary} text-slate-500 truncate font-medium`} title={p.reference || '---'}>
                        {p.reference || '---'}
                      </td>
                      <td className={`${spacing.pxLg} py-4 text-right ${typography.text.body} font-bold ${colors.textPrimary} truncate tabular-nums`}>
                        {formatCurrency(cost)}
                      </td>
                      <td className={`${spacing.pxLg} py-4 text-right ${typography.text.body} font-bold text-indigo-600 truncate tabular-nums`}>
                        {formatCurrency(p.price)}
                      </td>
                      <td className={`${spacing.pxLg} py-4 text-center`}>
                        <Badge variant={metrics.realMargin >= (p.target_margin || 0.3) ? 'success' : 'warning'} className="font-bold">
                          {(metrics.realMargin * 100).toFixed(1)}%
                        </Badge>
                      </td>
                      <td className={`${spacing.pxLg} py-4`}>
                        <div className="flex justify-center items-center">
                          <button
                            data-kebab-trigger
                            className={`rounded-lg p-2 transition-all border border-transparent ${menuState?.productId === p.id ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                            onClick={(e) => openMenu(p.id, e)}
                            aria-label="Más opciones"
                          >
                            <MoreVertical size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── FIXED KEBAB DROPDOWN (escapes all overflow) ── */}
      {
        menuState && (() => {
          const product = products.find(pp => pp.id === menuState.productId);
          if (!product) return null;
          const cost = calculateProductCost(product, batches, rawMaterials);
          const { rect } = menuState;
          const menuHeight = 164;
          const openUpward = rect.bottom + menuHeight > window.innerHeight;
          const style: React.CSSProperties = {
            position: 'fixed',
            right: window.innerWidth - rect.right,
            zIndex: 9999,
            ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
          };
          return (
            <div ref={menuRef} className={`${radius.xl} border ${colors.borderStandard} ${colors.bgSurface} ${shadows.xl} py-1.5`} style={style}>
              <button className={`w-full flex items-center gap-2 ${spacing.pxMd} py-1.5 ${typography.uiLabel} font-medium ${colors.textSecondary} hover:${colors.bgMain} transition-colors`} onClick={() => { setMenuState(null); navigate(`/productos/detalle/${product.id}`); }}>
                <History size={14} className={colors.textMuted} /> Ver Historial
              </button>
              <div className={`border-t ${colors.borderSubtle} my-1.5`} />
              <button className={`w-full flex items-center gap-2 ${spacing.pxMd} py-1.5 ${typography.uiLabel} font-medium ${colors.statusSuccess} hover:${colors.bgSuccess} transition-colors`} onClick={() => { setMenuState(null); setProductionModal({ isOpen: true, productId: product.id, productName: product.name, quantity: 1, targetPrice: product.price, cost }); }}>
                <PlayCircle size={14} /> Producir
              </button>
              <button className={`w-full flex items-center gap-2 ${spacing.pxMd} py-1.5 ${typography.uiLabel} font-medium ${colors.textSecondary} hover:${colors.bgMain} transition-colors`} onClick={() => { setMenuState(null); navigate(`/productos/editar/${product.id}`); }}>
                <Edit2 size={14} className={colors.textMuted} /> Editar
              </button>
              {canCreate && (
                <button className={`w-full flex items-center gap-2 ${spacing.pxMd} py-1.5 ${typography.uiLabel} font-medium ${colors.textSecondary} hover:${colors.bgMain} transition-colors`} onClick={() => { setMenuState(null); handleDuplicate(product); }}>
                  <Copy size={14} className={colors.textMuted} /> Duplicar
                </button>
              )}
              {product.status === 'activa' && (
                <button className={`w-full flex items-center gap-2 ${spacing.pxMd} py-1.5 ${typography.uiLabel} font-medium ${colors.textSecondary} hover:${colors.bgMain} transition-colors`} onClick={() => handleDiscontinue(product.id)}>
                  <Archive size={14} className={colors.textMuted} /> Discontinuar
                </button>
              )}
              <div className={`border-t ${colors.borderSubtle} my-1.5`} />
              <button className={`w-full flex items-center gap-2 ${spacing.pxMd} py-1.5 ${typography.uiLabel} font-medium ${colors.statusDanger} hover:${colors.bgDanger} transition-colors`} onClick={() => handleDelete(product.id)}>
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          );
        })()
      }

      {/* ── BATCH TOOLBAR ── */}
      {
        selectedIds.size > 0 && (
          <div className={`fixed bottom-0 left-0 right-0 z-50 border-t ${colors.borderStandard} ${colors.bgSurface} ${shadows.xl} no-print`}>
            <div className={`max-w-7xl mx-auto ${spacing.pxLg} py-3 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked readOnly className={`h-4 w-4 ${radius.sm} accent-indigo-600`} />
                <span className={`${typography.body} font-semibold ${colors.textPrimary}`}>{selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleBatchDiscontinue} className={typography.bodySm}>
                  <Archive size={15} className="mr-1.5" /> Discontinuar
                </Button>
                <Button variant="ghost" size="icon" onClick={handlePrint} className={colors.textSecondary} title="Imprimir"><Printer size={18} /></Button>
                <Button variant="secondary" size="sm" onClick={handleBatchDelete} className={`${typography.bodySm} ${colors.statusDanger} hover:${colors.bgDanger} border-red-200`}>
                  <Trash2 size={15} className="mr-1.5" /> Eliminar
                </Button>
                <button className={`ml-2 p-1.5 ${radius.lg} hover:${colors.bgMain} ${colors.textMuted} transition-colors`} onClick={() => setSelectedIds(new Set())} aria-label="Deseleccionar">
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        (missingStockModal.isOpen || productionModal.isOpen || (successModal && successModal.isOpen)) && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
            {productionModal.isOpen && (
              <Card className={`w-full max-w-md ${spacing.pLg} ${shadows.xl} border ${colors.borderStandard} ${colors.bgSurface}`}>
                <h3 className={`${typography.sectionTitle} ${colors.textPrimary} mb-6`}>Nuevo Lote de {productionModal.productName}</h3>
                <div className="space-y-4">
                  <Input label="Cantidad a fabricar" type="number" value={productionModal.quantity} onChange={e => setProductionModal({ ...productionModal, quantity: Number(e.target.value) || 1 })} />
                  <Input label="Precio Venta (Unid.)" type="number" value={productionModal.targetPrice} onChange={e => setProductionModal({ ...productionModal, targetPrice: Number(e.target.value) || 1 })} />
                  <Button variant="primary" fullWidth size="lg" onClick={handleConfirmBatchProduction} icon={<CheckCircle2 size={20} />}>Confirmar Producción</Button>
                  <Button variant="ghost" fullWidth onClick={() => setProductionModal({ ...productionModal, isOpen: false })}>Cancelar</Button>
                </div>
              </Card>
            )}

            {missingStockModal.isOpen && (
              <Card className={`w-full max-w-xl ${spacing.pLg} ${shadows.xl} border border-red-200 ${colors.bgSurface} space-y-6`}>
                <div className={`flex items-center gap-4 ${colors.statusDanger}`}>
                  <AlertTriangle size={28} />
                  <h3 className={`${typography.sectionTitle}`}>Faltante de Inventario</h3>
                </div>
                <p className={`${typography.body} ${colors.textSecondary}`}>No tienes stock suficiente de algunos insumos. Se registrará una deuda de inventario.</p>
                <div className="flex gap-4 pt-4">
                  <Button variant="ghost" className="flex-1" onClick={() => setMissingStockModal({ ...missingStockModal, isOpen: false })}>Cancelar</Button>
                  <Button fullWidth variant="danger" onClick={() => {
                    consumeStockBatch(missingStockModal.productId, missingStockModal.quantity, missingStockModal.targetPrice).then(() => {
                      const product = products.find(p => p.id === missingStockModal.productId);
                      const baseCost = calculateProductCost(product!, batches, rawMaterials);
                      setMissingStockModal({ ...missingStockModal, isOpen: false });
                      setSuccessModal({ isOpen: true, productName: product?.name || '', cost: baseCost * missingStockModal.quantity, quantity: missingStockModal.quantity });
                    });
                  }}>Aceptar y Generar Deuda</Button>
                </div>
              </Card>
            )}

            {successModal && successModal.isOpen && (
              <Card className="w-full max-w-sm p-8 text-center space-y-6">
                <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
                <h3 className={typography.sectionTitle}>¡Producción Exitosa!</h3>
                <p className={`${typography.body} text-gray-600`}>El lote ha sido ingresado al inventario.</p>
                <Button fullWidth onClick={() => setSuccessModal(null)}>Entendido</Button>
              </Card>
            )}
          </div>
        )
      }
    </PageContainer>
  );
};

export default Products;
