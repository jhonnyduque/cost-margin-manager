import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, Search, PlayCircle, Info, Layers, TrendingUp, CheckCircle2, X, ChevronRight, AlertTriangle, Scissors, RotateCcw, Ruler, History, Copy, Package, PackageSearch, Printer, Archive } from 'lucide-react';
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

const getCommercialPrice = (price: number) => {
  if (price <= 0) return 0;
  const floor = Math.floor(price);
  const decimals = price - floor;
  if (decimals < 0.50) return floor + 0.50;
  if (decimals < 0.90) return floor + 0.99;
  return floor + 1.00;
};

// Interfaz extendida localmente para el estado del formulario de composición
interface ProductMaterialUI extends ProductMaterial {
  mode: 'linear' | 'pieces';
  pieces: { length: number; width: number }[];
}

const Products: React.FC = () => {
  const { currentCompanyId, currentUserRole, products, productMovements, rawMaterials, batches, movements, addProduct, deleteProduct, discontinueProduct, updateProduct, consumeStock, consumeStockBatch } = useStore();
  const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
  const canCreate = allowedRoles.includes(currentUserRole || '');
  const canEdit = allowedRoles.includes(currentUserRole || '');
  const canDelete = allowedRoles.includes(currentUserRole || '');
  const { formatCurrency, currencySymbol } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'activa' | 'inactiva' | 'todos'>('activa');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedMaterial, setExpandedMaterial] = useState<number | null>(null);
  const [missingStockModal, setMissingStockModal] = useState<{ isOpen: boolean; productId: string; missingItems: any[]; quantity: number; targetPrice: number; maxCoveredProduction: number; fullBreakdown: any[]; showFullBreakdown: boolean }>({ isOpen: false, productId: '', missingItems: [], quantity: 1, targetPrice: 0, maxCoveredProduction: 0, fullBreakdown: [], showFullBreakdown: false });
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; productName: string; cost: number; quantity: number } | null>(null);

  const [formData, setFormData] = useState<any>({
    name: '', reference: '', price: 0, target_margin: 30, materials: [], status: 'activa'
  });

  const [productionModal, setProductionModal] = useState<{ isOpen: boolean; productId: string; quantity: number; cost: number; targetPrice: number; productName: string }>({ isOpen: false, productId: '', quantity: 1, cost: 0, targetPrice: 0, productName: '' });

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

  const calculateTotalCost = (materials: any[]) => {
    return (materials || []).reduce((total: number, pm: any) => {
      let effectiveQty = pm.quantity;
      if (pm.mode === 'pieces' && pm.pieces) {
        const latestBatch = batches.filter(b => b.material_id === pm.material_id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const width = latestBatch?.width || 140;
        const totalAreaCm2 = pm.pieces.reduce((acc: number, p: any) => acc + (p.length * p.width), 0);
        effectiveQty = (totalAreaCm2 / width) / 100;
      }
      return total + calculateFifoCost(pm.material_id, effectiveQty, pm.consumption_unit, batches, rawMaterials);
    }, 0);
  };

  const totalCurrentCost = useMemo(() => calculateTotalCost(formData.materials), [formData.materials, batches, rawMaterials]);

  const exactSuggestedPrice = useMemo(() => {
    const margin = formData.target_margin || 0;
    if (margin >= 100) return 0;
    return totalCurrentCost / (1 - margin / 100);
  }, [totalCurrentCost, formData.target_margin]);

  const commercialSuggestedPrice = useMemo(() => getCommercialPrice(exactSuggestedPrice), [exactSuggestedPrice]);

  const handleAddMaterial = () => {
    if (rawMaterials.length === 0) return;
    const material = rawMaterials[0];
    const materials = [...(formData.materials || []), {
      material_id: material.id,
      quantity: 1,
      consumption_unit: material.unit,
      mode: 'linear',
      pieces: [{ length: 50, width: material.unit === 'metro' ? 140 : 0 }]
    }];
    setFormData({ ...formData, materials });
  };

  const updateMaterial = (idx: number, field: string, value: any) => {
    const materials = [...(formData.materials || [])];
    materials[idx] = { ...materials[idx], [field]: value };

    if (field === 'material_id') {
      const selectedBase = rawMaterials.find(m => m.id === value);
      if (selectedBase) {
        materials[idx].consumption_unit = selectedBase.unit;
        materials[idx].mode = 'linear';
      }
    }
    setFormData({ ...formData, materials });
  };

  const removeMaterial = (idx: number) => {
    const materials = (formData.materials || []).filter((_: any, i: number) => i !== idx);
    setFormData({ ...formData, materials });
    if (expandedMaterial === idx) {
      setExpandedMaterial(null);
    } else if (expandedMaterial !== null && expandedMaterial > idx) {
      setExpandedMaterial(expandedMaterial - 1);
    }
  };

  const addPiece = (idx: number) => {
    const materials = [...(formData.materials || [])];
    const mat = materials[idx];
    const latestBatch = batches.filter(b => b.material_id === mat.material_id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    mat.pieces = [...(mat.pieces || []), { length: 10, width: latestBatch?.width || 140 }];
    setFormData({ ...formData, materials });
  };

  const updatePiece = (matIdx: number, pieceIdx: number, field: 'length' | 'width', value: number) => {
    const materials = [...(formData.materials || [])];
    materials[matIdx].pieces[pieceIdx][field] = value;
    setFormData({ ...formData, materials });
  };

  const removePiece = (matIdx: number, pieceIdx: number) => {
    const materials = [...(formData.materials || [])];
    materials[matIdx].pieces = materials[matIdx].pieces.filter((_: any, i: number) => i !== pieceIdx);
    setFormData({ ...formData, materials });
  };

  const handleDuplicate = (product: Product) => {
    const duplicatedProduct = {
      ...product,
      name: `${product.name} (copia)`,
      reference: product.reference ? `${product.reference}-COPIA` : '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setEditingId(null);
    setFormData(duplicatedProduct);
    setIsModalOpen(true);
  };

  const saveProduct = useCallback(async () => {
    const processedMaterials = formData.materials.map((pm: any) => {
      if (pm.mode === 'pieces' && pm.pieces) {
        const latestBatch = batches.filter(b => b.material_id === pm.material_id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const width = latestBatch?.width || 140;
        const totalAreaCm2 = pm.pieces.reduce((acc: number, p: any) => acc + (p.length * p.width), 0);
        return { ...pm, quantity: (totalAreaCm2 / width) / 100 };
      }
      return pm;
    });

    const now = new Date().toISOString();
    const data = {
      ...formData,
      materials: processedMaterials,
      id: editingId || crypto.randomUUID(),
      company_id: currentCompanyId || '',
      created_at: editingId ? (products.find(p => p.id === editingId)?.created_at) : now,
      updated_at: now
    } as Product;

    try {
      if (editingId) {
        await updateProduct(data);
      } else {
        await addProduct(data);
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving product:", error);
      alert(`No se pudo guardar el producto: ${translateError(error)}`);
    }
  }, [formData, editingId, batches, products, currentCompanyId, updateProduct, addProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProduct();
  };

  // Atajo de teclado: Ctrl+G guarda, Escape cierra
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        saveProduct();
      }
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, saveProduct]);

  // Central financial metrics engine — single source of truth
  const metrics = calculateFinancialMetrics(
    totalCurrentCost,
    formData.price || 0,
    (formData.target_margin || 30) / 100
  );

  const handlePrint = () => {
    window.print();
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
            <Button
              variant="primary"
              onClick={() => {
                setEditingId(null);
                setFormData({ name: '', reference: '', price: 0, target_margin: 30, materials: [], status: 'activa' });
                setIsModalOpen(true);
              }}
              icon={<Plus size={18} />}
            >
              Nuevo Producto
            </Button>
          ) : undefined
        }
      />

      {/* UNIFIED TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200 no-print">
        {/* Left: Search */}
        <div className="relative flex-1 w-full max-w-md group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" size={18} />
          <Input
            placeholder="Buscar por nombre o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 py-2.5 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm w-full"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Right: Filters & Tools */}
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
                  <div>
                    <h3 className="font-bold text-gray-900">{p.name}</h3>
                    <p className="text-xs font-mono text-gray-500 mt-0.5">{p.reference || 'Sin Ref'}</p>
                  </div>
                  <Badge variant={metrics.realMargin >= (p.target_margin || 30) / 100 ? 'success' : 'warning'}>
                    {(metrics.realMargin * 100).toFixed(1)}%
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 rounded-lg bg-gray-50 p-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-gray-400">Costo (FIFO)</p>
                    <p className="font-mono font-medium text-gray-700">{formatCurrency(cost)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-gray-400">Precio Venta</p>
                    <p className="font-mono font-black" style={{ color: tokens.colors.brand }}>{formatCurrency(p.price)}</p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                  <Button variant="ghost" size="sm" className="h-8 hover:bg-emerald-50 text-emerald-600" onClick={() => setProductionModal({ isOpen: true, productId: p.id, productName: p.name, quantity: 1, targetPrice: p.price, cost })}>
                    <PlayCircle size={14} className="mr-1.5" /> Producir
                  </Button>
                  {canCreate && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-50" onClick={() => handleDuplicate(p)} title="Duplicar">
                      <Copy size={16} className="text-slate-500" />
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${hasProductGeneratedActiveDebt(p.id, movements) ? 'bg-gray-50' : 'hover:bg-blue-50'}`}
                      onClick={() => {
                        if (hasProductGeneratedActiveDebt(p.id, movements)) {
                          alert('Integridad Contable: No se puede editar la receta de un producto que mantiene deuda activa de inventario.');
                          return;
                        }
                        setEditingId(p.id); setFormData(p); setIsModalOpen(true);
                      }}
                      title={hasProductGeneratedActiveDebt(p.id, movements) ? "⚠ Producción con deuda activa" : "Editar"}
                    >
                      <Edit2 size={16} className={hasProductGeneratedActiveDebt(p.id, movements) ? "text-gray-400" : "text-blue-600"} />
                    </Button>
                  )}
                  {canDelete && (() => {
                    const hasMovements = productMovements.some(m => m.product_id === p.id);
                    return hasMovements ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-amber-50"
                        title="Discontinuar producto (tiene historial de movimientos)"
                        onClick={async () => {
                          if (window.confirm(`¿Discontinuar "${p.name}"? El producto se archivará y no aparecerá en nuevas producciones, pero se conserva el historial.`)) {
                            try { await discontinueProduct(p.id); }
                            catch (err: any) { alert(`Error: ${translateError(err)}`); }
                          }
                        }}>
                        <Archive size={16} className="text-amber-600" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50"
                        title="Eliminar producto (sin historial)"
                        onClick={async () => {
                          if (window.confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) {
                            try { await deleteProduct(p.id); }
                            catch (err: any) { alert(`No se pudo eliminar: ${translateError(err)}`); }
                          }
                        }}>
                        <Trash2 size={16} className="text-red-500" />
                      </Button>
                    );
                  })()}
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="p-8 text-center text-gray-500">No se encontraron productos.</div>
          )}
        </div>

        {/* ✅ ESCRITORIO - Tabla normal */}
        <div id="print-area" className="hidden md:block overflow-x-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full border-collapse text-left table-fixed">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/50 text-xs font-semibold uppercase tracking-wider text-gray-500 backdrop-blur-sm">
                <tr>
                  <th className="w-[30%] px-6 py-4 truncate">Producto</th>
                  <th className="w-[20%] px-6 py-4 truncate">Referencia / SKU</th>
                  <th className="w-[15%] px-6 py-4 text-right truncate">Costo (FIFO)</th>
                  <th className="w-[15%] px-6 py-4 text-right truncate">Precio Venta</th>
                  <th className="w-[10%] px-6 py-4 text-center truncate">Margen</th>
                  <th className="w-[10%] min-w-[140px] px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const cost = calculateProductCost(p, batches, rawMaterials);
                  const metrics = calculateFinancialMetrics(cost, p.price, p.target_margin || 0.3);
                  return (
                    <tr key={p.id} className="group transition-all hover:bg-slate-50 bg-white">
                      <td className="px-6 py-4 font-semibold text-gray-900 truncate" title={p.name}>{p.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500 truncate" title={p.reference || '---'}>{p.reference || '---'}</td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-gray-700 truncate" title={formatCurrency(cost)}>{formatCurrency(cost)}</td>
                      <td className="px-6 py-4 text-right font-mono font-black truncate" style={{ color: tokens.colors.brand }} title={formatCurrency(p.price)}>{formatCurrency(p.price)}</td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={metrics.realMargin >= (p.target_margin || 30) / 100 ? 'success' : 'warning'}>
                          {(metrics.realMargin * 100).toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
                          <button className="rounded-lg p-1.5 transition-colors border border-transparent bg-emerald-50 text-emerald-600 hover:border-emerald-200 hover:bg-emerald-100" onClick={() => setProductionModal({ isOpen: true, productId: p.id, productName: p.name, quantity: 1, targetPrice: p.price, cost })} title="Producir">
                            <PlayCircle size={16} />
                          </button>
                          {canCreate && (
                            <button className="rounded-lg p-1.5 transition-colors border border-transparent bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-white" onClick={() => handleDuplicate(p)} title="Duplicar">
                              <Copy size={16} />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              className={`rounded-lg p-1.5 transition-colors border border-transparent ${hasProductGeneratedActiveDebt(p.id, movements) ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:border-blue-200 hover:bg-blue-100'}`}
                              onClick={() => {
                                if (hasProductGeneratedActiveDebt(p.id, movements)) {
                                  alert('Integridad Contable: No se puede editar la receta de un producto que mantiene deuda activa de inventario.');
                                  return;
                                }
                                setEditingId(p.id); setFormData(p); setIsModalOpen(true);
                              }}
                              title={hasProductGeneratedActiveDebt(p.id, movements) ? "⚠ Producción con deuda activa" : "Editar"}
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          {canDelete && (() => {
                            const hasMovements = productMovements.some(m => m.product_id === p.id);
                            return hasMovements ? (
                              <button
                                className="rounded-lg p-1.5 transition-colors border border-transparent bg-amber-50 text-amber-600 hover:border-amber-200 hover:bg-amber-100"
                                title="Discontinuar (tiene historial — no se puede eliminar)"
                                onClick={async () => {
                                  if (window.confirm(`¿Discontinuar "${p.name}"? Se archivará conservando el historial de movimientos.`)) {
                                    try { await discontinueProduct(p.id); }
                                    catch (err: any) { alert(`Error: ${translateError(err)}`); }
                                  }
                                }}>
                                <Archive size={16} />
                              </button>
                            ) : (
                              <button
                                className="rounded-lg p-1.5 transition-colors border border-transparent bg-red-50 text-red-600 hover:border-red-200 hover:bg-red-100"
                                title="Eliminar (sin historial)"
                                onClick={async () => {
                                  if (window.confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) {
                                    try { await deleteProduct(p.id); }
                                    catch (err: any) { alert(`No se pudo eliminar: ${translateError(err)}`); }
                                  }
                                }}>
                                <Trash2 size={16} />
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm font-medium text-gray-500">
                      No se encontraron productos. Usa el botón "Nuevo Producto" para empezar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {
        isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(4px)'
            }}
          >
            <Card className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden !p-0 mx-0 sm:mx-0">
              <div className="flex items-center justify-between border-b px-4 py-3 sm:px-10 sm:py-6" style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.bg }}>
                <h3 className="text-lg font-bold lg:text-xl" style={{ color: tokens.colors.text.primary }}>{editingId ? 'Editar Receta' : 'Nueva Receta de Producto'}</h3>
                <Button variant="ghost" onClick={() => setIsModalOpen(false)} icon={<X size={20} />} />
              </div>

              <form onSubmit={handleSubmit} className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_20rem] overflow-hidden min-h-0">
                {/* ── LEFT PANEL — scroll independiente ─────────────────── */}
                <div className="overflow-y-auto p-3 lg:p-6 space-y-4 lg:space-y-5">
                  <div className="grid grid-cols-2 gap-2 lg:gap-3">
                    <Input
                      label="Nombre Comercial"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej. Bolso de Mano Primavera"
                      required
                    />
                    <Input
                      label="Referencia / SKU"
                      value={formData.reference}
                      onChange={e => setFormData({ ...formData, reference: e.target.value })}
                      placeholder="REF-001"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: tokens.colors.border }}>
                      <h4
                        className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider"
                        style={{ color: tokens.colors.text.primary }}
                      >
                        <Layers size={14} color={tokens.colors.brand} /> Composición del Producto
                      </h4>
                      <Button type="button" variant="secondary" onClick={handleAddMaterial} size="sm">
                        + Añadir Insumo
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {(formData.materials || []).map((pm: any, idx: number) => {
                        const material = rawMaterials.find(m => m.id === pm.material_id);
                        const isFabric = material?.unit === 'metro';

                        let effectiveQty = pm.quantity;
                        let areaM2 = 0;
                        if (pm.mode === 'pieces' && pm.pieces) {
                          const latestBatch = batches.filter(b => b.material_id === pm.material_id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                          const width = latestBatch?.width || 140;
                          const totalAreaCm2 = pm.pieces.reduce((acc: number, p: any) => acc + (p.length * p.width), 0);
                          areaM2 = totalAreaCm2 / 10000;
                          effectiveQty = (totalAreaCm2 / width) / 100;
                        } else if (isFabric) {
                          const latestBatch = batches.filter(b => b.material_id === pm.material_id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                          areaM2 = pm.quantity * ((latestBatch?.width || 140) / 100);
                        }

                        const breakdown = getFifoBreakdown(pm.material_id, effectiveQty, pm.consumption_unit, batches, rawMaterials);
                        const costRow = breakdown.reduce((acc, item) => acc + item.subtotal, 0);
                        const isExpanded = expandedMaterial === idx;
                        const hasMissingStock = breakdown.some(b => b.is_missing);

                        let mainBatchInfo = '';
                        if (breakdown.length > 0 && !breakdown[0].is_missing) {
                          const batch = batches.find(b => b.id === breakdown[0].batch_id);
                          const costPerM2 = breakdown[0].unit_cost / ((batch?.width || 140) / 100);
                          const formattedDate = new Date(breakdown[0].date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                          mainBatchInfo = `FIFO — lote ${formattedDate} @ ${formatCurrency(costPerM2)}/m²`;
                        }

                        return (
                          <div key={idx} className={`overflow-hidden rounded-lg border transition-all ${hasMissingStock ? 'border-red-200' : 'border-gray-100'}`}>
                            {/* Desktop: grid columnas fijas | Mobile: flex-wrap */}
                            <div className="flex flex-wrap items-center gap-2 bg-gray-50/60 px-3 py-2 lg:grid lg:flex-none lg:grid-cols-[1fr_auto_90px_110px_56px] lg:gap-x-3">

                              {/* Col 1: Insumo */}
                              <div className="min-w-0 flex-1 lg:flex-none">
                                <select
                                  value={pm.material_id}
                                  onChange={e => updateMaterial(idx, 'material_id', e.target.value)}
                                  className="w-full rounded-lg border-0 bg-transparent py-1.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                >
                                  {rawMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                              </div>

                              {/* Col 2: Modo (siempre presente como celda; vacía si no es tela) */}
                              <div className="flex items-center">
                                {isFabric && (
                                  <div className="flex gap-0.5 rounded-md bg-gray-200/60 p-0.5">
                                    <button type="button" onClick={() => updateMaterial(idx, 'mode', 'linear')} className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase transition-all ${pm.mode === 'linear' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                                      <RotateCcw size={9} /> Lin.
                                    </button>
                                    <button type="button" onClick={() => updateMaterial(idx, 'mode', 'pieces')} className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase transition-all ${pm.mode === 'pieces' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                                      <Scissors size={9} /> Pzas.
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Col 3: Cantidad */}
                              <div className="w-20 lg:w-auto">
                                {pm.mode === 'linear' ? (
                                  <div className="flex items-center rounded-lg border border-gray-200 bg-white">
                                    <span className="pl-2 text-xs text-gray-400">Cant.</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={pm.quantity}
                                      onChange={e => updateMaterial(idx, 'quantity', parseFloat(e.target.value))}
                                      className="w-full rounded-lg border-0 bg-transparent px-1 py-1.5 text-right text-sm font-bold tabular-nums text-gray-800 [appearance:textfield] focus:outline-none focus:ring-1 focus:ring-indigo-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex h-8 items-center justify-end rounded-lg border border-indigo-100 bg-indigo-50 px-2 text-right text-xs font-bold tabular-nums text-indigo-700">
                                    {areaM2.toFixed(2)}m²
                                  </div>
                                )}
                              </div>

                              {/* Col 4: Costo + FIFO badge */}
                              <div className="flex items-center gap-1.5 lg:justify-end">
                                <span
                                  className={`text-sm font-bold tabular-nums ${hasMissingStock ? 'text-red-500' : 'text-gray-700'}`}
                                  title={hasMissingStock ? 'Stock insuficiente' : mainBatchInfo}
                                >
                                  {formatCurrency(costRow)}
                                </span>
                                {mainBatchInfo && !hasMissingStock && (
                                  <span
                                    className="cursor-help rounded bg-gray-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:bg-gray-200"
                                    title={mainBatchInfo}
                                  >
                                    FIFO
                                  </span>
                                )}
                                {hasMissingStock && (
                                  <span className="text-[10px] font-bold text-red-400">Sin stock</span>
                                )}
                              </div>

                              {/* Col 5: Acciones */}
                              <div className="flex gap-0.5 lg:justify-center">
                                <button type="button" onClick={() => setExpandedMaterial(isExpanded ? null : idx)} className="rounded p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500" title="Desglose FIFO">
                                  <Info size={14} />
                                </button>
                                <button type="button" onClick={() => removeMaterial(idx)} className="rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-400">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {
                              isExpanded && (
                                <div className="space-y-6 border-t px-8 pb-8 pt-4" style={{ backgroundColor: tokens.colors.bg, borderColor: tokens.colors.border }}>
                                  {pm.mode === 'pieces' && (
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between">
                                        <h5 className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-500"><Scissors size={12} /> Desglose de piezas (cm)</h5>
                                        <Button size="sm" variant="secondary" onClick={() => addPiece(idx)}>+ Añadir Pieza</Button>
                                      </div>
                                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                        {(pm.pieces || []).map((piece: any, pIdx: number) => (
                                          <div key={pIdx} className="flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm">
                                            <div className="flex-1">
                                              <label className="text-[10px] font-bold uppercase text-gray-400">Largo</label>
                                              <input type="number" className="w-full rounded bg-gray-50 p-1 text-sm font-bold" value={piece.length} onChange={e => updatePiece(idx, pIdx, 'length', parseFloat(e.target.value))} />
                                            </div>
                                            <span className="text-gray-300">×</span>
                                            <div className="flex-1">
                                              <label className="text-[10px] font-bold uppercase text-gray-400">Ancho</label>
                                              <input type="number" className="w-full rounded bg-gray-50 p-1 text-sm font-bold" value={piece.width} onChange={e => updatePiece(idx, pIdx, 'width', parseFloat(e.target.value))} />
                                            </div>
                                            <button type="button" onClick={() => removePiece(idx, pIdx)} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            }
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>{/* end LEFT PANEL */}

                {/* ── RIGHT PANEL — zona de decisión ─────────────────────── */}
                <div className="overflow-y-auto p-3 lg:p-6 space-y-4 lg:space-y-5 border-t border-gray-100 lg:border-t-0 lg:border-l bg-gray-50/40">
                  {/* Costo FIFO */}
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Costo FIFO</span>
                    <span className="text-lg font-black tabular-nums leading-tight text-gray-800">{formatCurrency(totalCurrentCost)}</span>
                  </div>

                  {/* Precios sugeridos — sin label redundante */}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setFormData({ ...formData, price: exactSuggestedPrice })} className="rounded-xl border border-gray-200 bg-white p-3 text-left transition-shadow hover:shadow-sm hover:border-indigo-200">
                      <div className="text-[10px] font-bold uppercase leading-tight text-gray-400">Exacto</div>
                      <div className="text-sm font-black leading-snug tabular-nums text-indigo-600">{formatCurrency(exactSuggestedPrice)}</div>
                    </button>
                    <button type="button" onClick={() => setFormData({ ...formData, price: commercialSuggestedPrice })} className="rounded-xl border border-gray-200 bg-white p-3 text-left transition-shadow hover:shadow-sm hover:border-emerald-200">
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase leading-tight text-gray-400"><TrendingUp size={10} /> Redondeo</div>
                      <div className="text-sm font-black leading-snug tabular-nums text-emerald-600">{formatCurrency(commercialSuggestedPrice)}</div>
                    </button>
                  </div>

                  {/* Margen objetivo */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase leading-none tracking-widest text-gray-400">Margen</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.target_margin}
                      onChange={e => {
                        const v = Math.min(100, Math.max(0, Number(e.target.value)));
                        setFormData({ ...formData, target_margin: v });
                      }}
                      className="w-14 rounded-lg border border-gray-200 bg-white px-2 py-1 text-center text-sm font-bold leading-none text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-bold leading-none text-gray-400">%</span>
                  </div>

                  {/* ── Precio Final — DESKTOP dark block (lg only) ────── */}
                  {(() => {
                    const priceState = metrics.priceState;
                    const borderClass = priceState === 'loss' ? 'border-red-700' : priceState === 'warning' ? 'border-amber-600' : 'border-gray-700';
                    const textClass = priceState === 'loss' ? 'text-red-400' : priceState === 'warning' ? 'text-amber-300' : 'text-emerald-400';
                    const symbolClass = priceState === 'loss' ? 'text-red-400' : priceState === 'warning' ? 'text-amber-400' : 'text-emerald-500';
                    return (
                      <>
                        {/* ── DESKTOP: dark financial block (unchanged) ── */}
                        <div className="hidden lg:block space-y-2 rounded-xl border border-gray-700 bg-gray-800 p-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Precio Final</label>
                          <div className="relative">
                            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold leading-none ${symbolClass}`}>{currencySymbol}</span>
                            <input
                              type="number"
                              step="0.01"
                              className={`w-full rounded-lg border py-3 pl-9 pr-4 text-xl font-black leading-tight tabular-nums outline-none transition-colors bg-gray-900 ${borderClass} ${textClass} focus:ring-1 focus:ring-offset-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                              value={formData.price || ''}
                              onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                            />
                          </div>

                          {formData.price && formData.price > 0 && (
                            <div className="space-y-1 pt-0.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Margen real</span>
                                <span className={`text-sm font-black tabular-nums ${priceState === 'loss' ? 'text-red-400' : priceState === 'warning' ? 'text-amber-300' : metrics.targetStatus === 'increase_required' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {metrics.marginDisplay}
                                </span>
                              </div>
                              <p className={`text-xs leading-tight ${metrics.profitVsCost >= 0 ? 'text-gray-500' : 'text-red-400'}`}>
                                {metrics.profitLabel}
                              </p>
                              <p className="text-xs leading-tight text-gray-500">
                                {metrics.adjustmentLabel}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* ── MOBILE: light operational card (COMPACT) ── */}
                        <div className="lg:hidden">
                          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                            {/* Header Row: Label + Margen Real */}
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Precio Final</label>
                              {formData.price && formData.price > 0 && (
                                <span className={`text-sm font-bold tabular-nums ${priceState === 'loss' ? 'text-red-500' : priceState === 'warning' ? 'text-amber-600' : metrics.targetStatus === 'increase_required' ? 'text-amber-500' : 'text-emerald-600'
                                  }`}>
                                  {metrics.marginDisplay}
                                </span>
                              )}
                            </div>

                            {/* Price Input */}
                            <div className="relative">
                              <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold leading-none ${priceState === 'loss' ? 'text-red-500' : priceState === 'warning' ? 'text-amber-500' : 'text-emerald-600'
                                }`}>{currencySymbol}</span>
                              <input
                                type="number"
                                step="0.01"
                                className={`w-full rounded-lg border py-2 pl-8 pr-3 text-lg font-bold leading-tight tabular-nums outline-none transition-colors bg-gray-50 ${priceState === 'loss' ? 'border-red-300 text-red-600 focus:border-red-400 focus:ring-red-200' : priceState === 'warning' ? 'border-amber-300 text-amber-700 focus:border-amber-400 focus:ring-amber-200' : 'border-gray-200 text-gray-800 focus:border-indigo-400 focus:ring-indigo-100'
                                  } focus:ring-2`}
                                value={formData.price || ''}
                                onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                              />
                            </div>

                            {/* Compact Legend */}
                            {formData.price && formData.price > 0 && (
                              <div className="mt-2.5 flex items-center justify-between text-xs leading-tight">
                                <span className={`font-medium ${metrics.profitVsCost >= 0 ? 'text-gray-500' : 'text-red-500'}`}>
                                  {metrics.profitLabel}
                                </span>
                                <span className="text-gray-400 font-medium whitespace-nowrap ml-2">
                                  {metrics.adjustmentLabel}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                </div>{/* end RIGHT PANEL */}
              </form>

              <div
                className="flex gap-3 border-t px-4 py-3 sticky bottom-0"
                style={{ backgroundColor: tokens.colors.bg, borderColor: tokens.colors.border, paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
              >
                <Button variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>Descartar</Button>
                <Button className="flex-1" onClick={saveProduct} icon={<CheckCircle2 size={20} />}>
                  {editingId ? 'Guardar Cambios' : 'Crear Producto'}
                </Button>
              </div>
            </Card>
          </div>
        )
      }

      {
        missingStockModal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
            <Card className={`w-full ${missingStockModal.showFullBreakdown ? 'max-w-2xl' : 'max-w-xl'} p-8 shadow-2xl space-y-6 border-red-200 transition-all duration-300`}>
              <div className="flex items-center gap-4 text-red-600">
                <div className="px-4 py-3 bg-red-50 rounded-2xl border border-red-100 flex-shrink-0">
                  <AlertTriangle size={28} />
                </div>
                <div className="flex-1 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-black">Faltante de Inventario</h3>
                    <p className="text-red-500 text-sm font-semibold">Se generará Deuda de Inventario</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`border-red-200 text-red-600 hover:bg-red-50 transition-colors ${missingStockModal.showFullBreakdown ? 'bg-red-50' : ''}`}
                    onClick={() => setMissingStockModal(m => ({ ...m, showFullBreakdown: !m.showFullBreakdown }))}
                  >
                    <PackageSearch size={16} className="mr-2" />
                    {missingStockModal.showFullBreakdown ? 'Ocultar detalle de consumo' : 'Ver detalle de consumo'}
                  </Button>
                </div>
              </div>

              <p className="text-gray-600 text-sm">
                El sistema ha detectado que <strong className="text-gray-800">no tienes stock suficiente</strong> de los siguientes insumos para fabricar esta receta.
                Si decides forzar la producción, el sistema registrará un faltante temporal asumiendo el costo transaccional del último lote adquirido para no alterar tus márgenes.
              </p>

              {missingStockModal.showFullBreakdown ? (
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4 animate-in fade-in duration-300">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-2">
                    <PackageSearch size={12} /> Detalle de Consumo de Producción
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="pb-2 font-bold">Material</th>
                          <th className="pb-2 text-right font-bold">Requerido</th>
                          <th className="pb-2 text-center font-bold">Estado del Consumo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {missingStockModal.fullBreakdown.map((item, idx) => (
                          <tr key={idx} className="text-slate-700">
                            <td className="py-2.5 font-bold">{item.materialName}</td>
                            <td className="py-2.5 text-right font-mono bg-white mx-1 px-2 border border-slate-100 shadow-sm rounded text-slate-600">{item.requiredQuantity.toFixed(2)} {item.unit}</td>
                            <td className="py-2.5">
                              <div className="flex flex-col gap-1 items-end justify-center w-full pl-4">
                                {item.coveredQuantity > 0 && (
                                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 w-full justify-between">
                                    <span>CUBIERTO:</span> <span>{item.coveredQuantity.toFixed(2)} {item.unit}</span>
                                  </span>
                                )}
                                {item.missingQuantity > 0 && (
                                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 w-full justify-between border border-red-200">
                                    <span>DEUDA:</span> <span>{item.missingQuantity.toFixed(2)} {item.unit}</span>
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50/50 rounded-xl p-5 border border-red-100 space-y-4 animate-in fade-in duration-300">
                  <div className="grid grid-cols-3 gap-4 mb-2 pb-4 border-b border-red-200/50">
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase text-red-800/60 mb-1">Prod. Solicitada</p>
                      <p className="text-xl font-bold text-gray-800">{missingStockModal.quantity}</p>
                    </div>
                    <div className="text-center border-l border-red-200/50">
                      <p className="text-[10px] font-black uppercase text-emerald-800/60 mb-1">Cubierta por Stock</p>
                      <p className="text-xl font-bold text-emerald-600">{missingStockModal.maxCoveredProduction}</p>
                    </div>
                    <div className="text-center border-l border-red-200/50">
                      <p className="text-[10px] font-black uppercase text-red-800/60 mb-1">Generará Deuda</p>
                      <p className="text-xl font-bold text-red-600">{missingStockModal.quantity - missingStockModal.maxCoveredProduction}</p>
                    </div>
                  </div>

                  <h4 className="text-[10px] font-black uppercase tracking-widest text-red-800 flex items-center gap-2 mb-2">
                    <Package size={12} /> Desglose de Faltantes y Costo Asumido
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase text-red-700/70 border-b border-red-200">
                        <tr>
                          <th className="pb-2 font-bold">Material</th>
                          <th className="pb-2 text-right font-bold">Faltante</th>
                          <th className="pb-2 text-right font-bold">Costo Aplicado</th>
                          <th className="pb-2 text-right font-bold">Deuda Generada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100/50">
                        {missingStockModal.missingItems.map((item, idx) => (
                          <tr key={idx} className="text-red-900">
                            <td className="py-2.5 font-bold">{item.materialName}</td>
                            <td className="py-2.5 text-right font-mono bg-white rounded my-1 px-2 border border-red-100 text-red-600 shadow-sm">faltan {item.missingQuantity.toFixed(2)} {item.unit}</td>
                            <td className="py-2.5 text-right font-mono text-red-700/80">{formatCurrency(item.unitCost)}</td>
                            <td className="py-2.5 text-right font-mono font-black">{formatCurrency(item.totalDebt)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="pt-3 text-right text-xs font-bold uppercase text-red-800">Costo Faltante Total Asumido:</td>
                          <td className="pt-3 text-right font-mono font-black text-red-600 text-base">
                            {formatCurrency(missingStockModal.missingItems.reduce((acc, item) => acc + item.totalDebt, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button variant="ghost" className="flex-1" onClick={() => setMissingStockModal({ isOpen: false, productId: '', missingItems: [], quantity: 1, targetPrice: 0, maxCoveredProduction: 0, fullBreakdown: [], showFullBreakdown: false })}>
                  Cancelar Operación
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white border-transparent"
                  onClick={() => {
                    const product = products.find(p => p.id === missingStockModal.productId);
                    if (!product) return;

                    consumeStockBatch(missingStockModal.productId, missingStockModal.quantity, missingStockModal.targetPrice).then(() => {
                      const baseCost = calculateProductCost(product, batches, rawMaterials);
                      setMissingStockModal({ isOpen: false, productId: '', missingItems: [], quantity: 1, targetPrice: 0, maxCoveredProduction: 0, fullBreakdown: [], showFullBreakdown: false });
                      setSuccessModal({ isOpen: true, productName: product?.name || '', cost: baseCost * missingStockModal.quantity, quantity: missingStockModal.quantity });
                    }).catch(err => {
                      alert('Error forzando producción: ' + err.message);
                    });
                  }}
                >
                  Aceptar y Generar Deuda
                </Button>
              </div>
            </Card>
          </div>
        )
      }

      {
        successModal && successModal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
            <Card className="w-full max-w-sm p-8 text-center space-y-6 border-emerald-200">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">¡Producción Exitosa!</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Se ha registrado el ingreso de <strong className="text-gray-900">{successModal.quantity} unid.</strong> y descontado el inventario de materias primas para:
                  <br />
                  <strong className="text-gray-800">{successModal.productName}</strong>
                </p>
              </div>

              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Costo Total del Lote</p>
                <p className="text-2xl font-black text-emerald-700">{formatCurrency(successModal.cost)}</p>
                <p className="text-xs text-emerald-600/70 mt-1 font-medium">{formatCurrency(successModal.cost / successModal.quantity)} por unidad</p>
              </div>

              <Button
                variant="primary"
                className="w-full"
                onClick={() => setSuccessModal(null)}
              >
                Entendido
              </Button>
            </Card>
          </div>
        )
      }

      {
        productionModal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
            <Card className="w-full max-w-md p-6 shadow-2xl border border-gray-200 bg-white">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <Package size={20} className="text-emerald-500" /> Nuevo Lote
                </h3>
                <button
                  onClick={() => setProductionModal({ ...productionModal, isOpen: false })}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Producto a elaborar</p>
                  <p className="text-lg font-black text-gray-900">{productionModal.productName}</p>
                  <p className="text-sm text-gray-500 mb-4">Costo unitario actual (FIFO): <span className="font-mono font-medium text-gray-700">{formatCurrency(productionModal.cost)}</span></p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Cantidad a fabricar</label>
                    <Input
                      type="number"
                      min={1}
                      value={productionModal.quantity}
                      onChange={e => setProductionModal({ ...productionModal, quantity: Number(e.target.value) || 1 })}
                      className="text-lg font-black rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Precio Venta (Unid.)</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={productionModal.targetPrice}
                      onChange={e => setProductionModal({ ...productionModal, targetPrice: Number(e.target.value) || 0 })}
                      className="text-lg font-mono font-black rounded-xl text-emerald-600"
                    />
                  </div>
                </div>

                <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Costo Estimado Lote</p>
                    <p className="text-xl font-black text-emerald-700">{formatCurrency(productionModal.cost * productionModal.quantity)}</p>
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6"
                  onClick={handleConfirmBatchProduction}
                  icon={<CheckCircle2 size={20} />}
                >
                  Confirmar Producción
                </Button>
              </div>
            </Card>
          </div>
        )
      }

    </div >
  );
};

export default Products;
