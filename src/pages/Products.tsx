import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2, Search, PlayCircle, Info, Layers, TrendingUp, CheckCircle2, X, ChevronRight, AlertTriangle, RotateCcw, Ruler, History, Copy, Package, PackageSearch, Printer, Archive, MoreVertical } from 'lucide-react';
import { useStore, calculateProductCost, calculateFifoCost, getFifoBreakdown, hasProductGeneratedActiveDebt } from '../store';
import { calculateFinancialMetrics } from '@/core/financialMetricsEngine';
import { Product, ProductMaterial, Status, Unit, RawMaterial, MaterialBatch } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { tokens } from '@/design/design-tokens';
import { useCurrency } from '@/hooks/useCurrency';
import { translateError } from '@/utils/errorHandler';

const Products: React.FC = () => {
  const navigate = useNavigate();
  const { currentCompanyId, currentUserRole, products, productMovements, rawMaterials, batches, movements, addProduct, deleteProduct, discontinueProduct, updateProduct, consumeStock, consumeStockBatch } = useStore();
  const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
  const canCreate = allowedRoles.includes(currentUserRole || '');
  const canEdit = allowedRoles.includes(currentUserRole || '');
  const canDelete = allowedRoles.includes(currentUserRole || '');
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
    <div className="space-y-6">
      <style>{`
      @media print {
        body * { visibility: hidden; }
        #print-area, #print-area * { visibility: visible; }
        #print-area { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }
      `}</style>

      <PageHeader
        title="Catálogo de Productos"
        description="Gestión de Escandallos (Costos FIFO)"
        actions={
          canCreate ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => navigate('/materias-primas')}
                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-none px-3"
              >
                Nuevo Insumo
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/productos/nuevo')}
                icon={<Plus size={18} />}
              >
                Nuevo Producto
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* UNIFIED TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200 no-print">
        <div className="relative flex-1 w-full max-w-md group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" size={18} />
          <Input
            placeholder="Buscar por nombre o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 py-2.5 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm w-full"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline-block">Estado:</span>
            <select
              title="Filtro de estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-sm font-semibold text-slate-700 py-1.5 focus:outline-none border-none cursor-pointer"
            >
              <option value="activa">Solo Activos</option>
              <option value="inactiva">Discontinuados</option>
              <option value="todos">Todos los productos</option>
            </select>
          </div>
          <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 h-10 px-3" onClick={handlePrint} title="Imprimir Catálogo">
            <Printer size={18} />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* ✅ MÓVIL - Layout Cards */}
        <div className="md:hidden space-y-4">
          {filteredProducts.map((p) => {
            const cost = calculateProductCost(p, batches, rawMaterials);
            const metrics = calculateFinancialMetrics(cost, p.price, p.target_margin || 0.3);
            return (
              <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/productos/detalle/${p.id}`)}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-4 w-4 rounded accent-indigo-600 shrink-0"
                      aria-label={`Seleccionar ${p.name}`}
                    />
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{p.name}</h3>
                      <p className="text-xs font-mono text-gray-500 mt-0.5">{p.reference || 'Sin Ref'}</p>
                    </div>
                  </div>
                  <Badge variant={metrics.realMargin >= (p.target_margin || 0.3) ? 'success' : 'warning'}>
                    {(metrics.realMargin * 100).toFixed(1)}%
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 rounded-lg bg-gray-50 p-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase text-slate-500">Costo (FIFO)</p>
                    <p className="font-mono font-medium text-gray-700">{formatCurrency(cost)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold uppercase text-slate-500">Precio Venta</p>
                    <p className="font-mono font-black" style={{ color: tokens.colors.brand }}>{formatCurrency(p.price)}</p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                  <Button variant="ghost" size="sm" className="h-8 hover:bg-emerald-50 text-emerald-600" onClick={() => setProductionModal({ isOpen: true, productId: p.id, productName: p.name, quantity: 1, targetPrice: p.price, cost })}>
                    <PlayCircle size={14} className="mr-1.5" /> Producir
                  </Button>
                  <div className="relative">
                    <button
                      data-kebab-trigger
                      className="rounded-lg p-1.5 transition-colors hover:bg-slate-100 text-slate-500"
                      onClick={(e) => openMenu(p.id, e)}
                      aria-label="Más opciones"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ✅ ESCRITORIO - Tabla normal */}
        <div id="print-area" className="hidden md:block overflow-x-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <table className="w-full border-collapse text-left table-fixed">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/50 text-xs font-semibold uppercase tracking-wider text-gray-500 backdrop-blur-sm">
                <tr>
                  <th className="w-[40px] px-4 py-4">
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded accent-indigo-600"
                      aria-label="Seleccionar todos"
                    />
                  </th>
                  <th className="w-[28%] px-4 py-4 truncate">Producto</th>
                  <th className="w-[18%] px-4 py-4 truncate">Referencia / SKU</th>
                  <th className="w-[14%] px-4 py-4 text-right truncate">Costo (FIFO)</th>
                  <th className="w-[14%] px-4 py-4 text-right truncate">Precio Venta</th>
                  <th className="w-[10%] px-4 py-4 text-center truncate">Margen</th>
                  <th className="w-[16%] min-w-[120px] px-4 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const cost = calculateProductCost(p, batches, rawMaterials);
                  const metrics = calculateFinancialMetrics(cost, p.price, p.target_margin || 0.3);
                  return (
                    <tr key={p.id} className="group transition-all hover:bg-slate-50/70 bg-white">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="h-4 w-4 rounded accent-indigo-600"
                          aria-label={`Seleccionar ${p.name}`}
                        />
                      </td>
                      <td
                        className="px-4 py-4 font-semibold text-gray-900 truncate cursor-pointer hover:text-indigo-600 transition-colors"
                        title={p.name}
                        onClick={() => navigate(`/productos/detalle/${p.id}`)}
                      >
                        {p.name}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-gray-500 truncate" title={p.reference || '---'}>{p.reference || '---'}</td>
                      <td className="px-4 py-4 text-right font-mono font-medium text-gray-700 truncate">{formatCurrency(cost)}</td>
                      <td className="px-4 py-4 text-right font-mono font-black truncate" style={{ color: tokens.colors.brand }}>{formatCurrency(p.price)}</td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant={metrics.realMargin >= (p.target_margin || 0.3) ? 'success' : 'warning'}>
                          {(metrics.realMargin * 100).toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            className="rounded-lg p-1.5 transition-colors border border-transparent bg-emerald-50 text-emerald-600 hover:border-emerald-200 hover:bg-emerald-100"
                            onClick={() => setProductionModal({ isOpen: true, productId: p.id, productName: p.name, quantity: 1, targetPrice: p.price, cost })}
                            title="Producir"
                            aria-label="Producir"
                          >
                            <PlayCircle size={16} />
                          </button>
                          <div className="relative">
                            <button
                              data-kebab-trigger
                              className={`rounded-lg p-1.5 transition-colors border border-transparent ${menuState?.productId === p.id ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                              onClick={(e) => openMenu(p.id, e)}
                              aria-label="Más opciones"
                            >
                              <MoreVertical size={16} />
                            </button>
                          </div>
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
      {menuState && (() => {
        const product = products.find(pp => pp.id === menuState.productId);
        if (!product) return null;
        const { rect } = menuState;
        const menuHeight = 140;
        const openUpward = rect.bottom + menuHeight > window.innerHeight;
        const style: React.CSSProperties = {
          position: 'fixed',
          right: window.innerWidth - rect.right,
          zIndex: 9999,
          ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        };
        return (
          <div ref={menuRef} className="w-48 rounded-xl border border-slate-200 bg-white shadow-lg py-1" style={style}>
            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => { setMenuState(null); navigate(`/productos/editar/${product.id}`); }}>
              <Edit2 size={15} className="text-slate-400" /> Editar
            </button>
            {canCreate && (
              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => { setMenuState(null); handleDuplicate(product); }}>
                <Copy size={15} className="text-slate-400" /> Duplicar
              </button>
            )}
            {product.status === 'activa' && (
              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => handleDiscontinue(product.id)}>
                <Archive size={15} className="text-slate-400" /> Discontinuar
              </button>
            )}
            <div className="border-t border-slate-100 my-1" />
            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors" onClick={() => handleDelete(product.id)}>
              <Trash2 size={15} /> Eliminar
            </button>
          </div>
        );
      })()}

      {/* ── BATCH TOOLBAR ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)] no-print">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked readOnly className="h-4 w-4 rounded accent-indigo-600" />
              <span className="text-sm font-semibold text-slate-900">{selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleBatchDiscontinue} className="text-sm">
                <Archive size={15} className="mr-1.5" /> Discontinuar
              </Button>
              <Button variant="secondary" size="sm" onClick={handleBatchDelete} className="text-sm text-red-600 hover:bg-red-50 border-red-200">
                <Trash2 size={15} className="mr-1.5" /> Eliminar
              </Button>
              <button className="ml-2 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors" onClick={() => setSelectedIds(new Set())} aria-label="Deseleccionar">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {(missingStockModal.isOpen || productionModal.isOpen || (successModal && successModal.isOpen)) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          {productionModal.isOpen && (
            <Card className="w-full max-w-md p-6 shadow-2xl border border-gray-200 bg-white">
              <h3 className="text-xl font-black mb-6">Nuevo Lote de {productionModal.productName}</h3>
              <div className="space-y-4">
                <Input label="Cantidad a fabricar" type="number" value={productionModal.quantity} onChange={e => setProductionModal({ ...productionModal, quantity: Number(e.target.value) || 1 })} />
                <Input label="Precio Venta (Unid.)" type="number" value={productionModal.targetPrice} onChange={e => setProductionModal({ ...productionModal, targetPrice: Number(e.target.value) || 1 })} />
                <Button variant="primary" className="w-full py-6" onClick={handleConfirmBatchProduction} icon={<CheckCircle2 size={20} />}>Confirmar Producción</Button>
                <Button variant="ghost" className="w-full" onClick={() => setProductionModal({ ...productionModal, isOpen: false })}>Cancelar</Button>
              </div>
            </Card>
          )}

          {missingStockModal.isOpen && (
            <Card className="w-full max-w-xl p-8 shadow-2xl space-y-6 border-red-200">
              <div className="flex items-center gap-4 text-red-600">
                <AlertTriangle size={28} />
                <h3 className="text-xl font-black">Faltante de Inventario</h3>
              </div>
              <p className="text-gray-600">No tienes stock suficiente de algunos insumos. Se registrará una deuda de inventario.</p>
              <div className="flex gap-4 pt-4">
                <Button variant="ghost" className="flex-1" onClick={() => setMissingStockModal({ ...missingStockModal, isOpen: false })}>Cancelar</Button>
                <Button className="flex-1 bg-red-600 text-white" onClick={() => {
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
              <h3 className="text-xl font-black">¡Producción Exitosa!</h3>
              <p className="text-gray-600">El lote ha sido ingresado al inventario.</p>
              <Button className="w-full" onClick={() => setSuccessModal(null)}>Entendido</Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Products;
