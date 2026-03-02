import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const ProductBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // For editing an existing product
  const { currentCompanyId, currentUserRole, products, productMovements, rawMaterials, batches, movements, addProduct, deleteProduct, discontinueProduct, updateProduct, consumeStock, consumeStockBatch } = useStore();

  const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
  const canCreate = allowedRoles.includes(currentUserRole || '');
  const canEdit = allowedRoles.includes(currentUserRole || '');
  const canDelete = allowedRoles.includes(currentUserRole || '');

  const { formatCurrency, currencySymbol } = useCurrency();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedMaterial, setExpandedMaterial] = useState<number | null>(null);

  const [missingStockModal, setMissingStockModal] = useState<{ isOpen: boolean; productId: string; missingItems: any[]; quantity: number; targetPrice: number; maxCoveredProduction: number; fullBreakdown: any[]; showFullBreakdown: boolean }>({ isOpen: false, productId: '', missingItems: [], quantity: 1, targetPrice: 0, maxCoveredProduction: 0, fullBreakdown: [], showFullBreakdown: false });
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; productName: string; cost: number; quantity: number } | null>(null);
  const [selectorModal, setSelectorModal] = useState<{ isOpen: boolean; forIndex: number | null }>({ isOpen: false, forIndex: null });
  const [selectorSearch, setSelectorSearch] = useState('');

  const [formData, setFormData] = useState<any>({
    name: '', reference: '', price: 0, target_margin: 30, materials: [], status: 'activa'
  });

  const [productionModal, setProductionModal] = useState<{ isOpen: boolean; productId: string; quantity: number; cost: number; targetPrice: number; productName: string }>({ isOpen: false, productId: '', quantity: 1, cost: 0, targetPrice: 0, productName: '' });

  // Utilidad para manejar la coma del teclado numérico
  const handleNumberInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',') {
      e.preventDefault();
      const target = e.target as HTMLInputElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      if (start !== null && end !== null) {
        target.value = target.value.substring(0, start) + '.' + target.value.substring(end);
        target.selectionStart = target.selectionEnd = start + 1;
        const event = new Event('input', { bubbles: true });
        target.dispatchEvent(event);
      }
    }
  };

  // Fetch product data if editing
  useEffect(() => {
    window.scrollTo(0, 0);
    if (id && products.length > 0) {
      const p = products.find(prod => prod.id === id);
      if (p) {
        setEditingId(p.id);
        const processedMaterials = (p.materials || []).map(pm => {
          if (pm.mode === 'pieces' && pm.pieces) {
            const latestBatch = batches.find(b => b.material_id === pm.material_id);
            const width = latestBatch?.width || 140;
            const targetQty = pm.quantity;
            const requiredArea = targetQty * width * 100;
            const defaultPieceArea = 10 * width;
            const numPieces = Math.ceil(requiredArea / defaultPieceArea);
            const pieces = Array(numPieces).fill({ length: 10, width });
            return { ...pm, pieces };
          }
          return pm;
        });
        setFormData({ ...p, materials: processedMaterials });
      } else {
        navigate('/productos');
      }
    } else if (!id) {
      // New product mode, clear form
      setEditingId(null);
      setFormData({ name: '', materials: [], target_margin: 30, price: undefined }); // set to undefined to leave empty if new
    }
  }, [id, products, batches, navigate]);

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
    setSelectorModal({ isOpen: true, forIndex: null });
    setSelectorSearch('');
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
      navigate('/productos');
    } catch (error: any) {
      console.error("Error saving product:", error);
      alert(`No se pudo guardar el producto: ${translateError(error)} `);
    }
  }, [formData, editingId, batches, products, currentCompanyId, updateProduct, addProduct, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProduct();
  };

  // Atajo de teclado: Ctrl+G guarda, Escape cierra
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        saveProduct();
      }
      if (e.key === 'Escape') {
        if (selectorModal.isOpen) {
          setSelectorModal({ isOpen: false, forIndex: null });
        } else {
          navigate('/productos');
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [saveProduct, navigate, selectorModal.isOpen]);

  // Bloquear scroll del body al abrir el modal de insumos (comportamiento de bottom sheet)
  useEffect(() => {
    if (selectorModal.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [selectorModal.isOpen]);

  const metrics = calculateFinancialMetrics(
    totalCurrentCost,
    formData.price || 0,
    (formData.target_margin || 30) / 100
  );

  const primaryActionLabel = editingId ? "Guardar Cambios" : "Crear Producto";

  return (
    <div className="w-full bg-slate-50 min-h-screen flex flex-col pb-44 lg:pb-12">
      {/* ── HEADER FIJO ── */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 sm:px-6 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate('/productos')} className="text-gray-500 hover:text-gray-800 -ml-2 sm:ml-0 transition-colors">
            <ChevronRight className="rotate-180" size={24} />
          </Button>
          <h1 className="text-lg sm:text-2xl font-black text-gray-900 tracking-tight truncate">
            {editingId ? 'Editar Producto' : 'Nuevo Producto'}
          </h1>
        </div>
      </div>

      <div className="p-4 sm:p-6 flex-1 w-full max-w-7xl mx-auto">
        <form onSubmit={handleSubmit} className="w-full">
          {/* LENGUAJE VISUAL UNIFICADO (DESKTOP & MOBILE) */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* LEFT COLUMN: Formularios */}
            <div className="flex-1 w-full space-y-6">

              {/* ── SECCIÓN 1: INFORMACIÓN GENERAL ── */}
              <Card className="p-4 sm:p-6 shadow-sm border border-gray-100 bg-white">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-800 mb-4 flex items-center gap-2">
                  <Package size={16} className="text-indigo-500" /> 1. Información General
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </Card>

              {/* ── SECCIÓN 2: MATERIA PRIMA ── */}
              <Card className="p-0 sm:p-0 shadow-sm border border-gray-100 overflow-visible bg-white">
                <div className="p-4 lg:p-6 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-gray-800 flex items-center gap-2"><Scissors size={16} className="text-indigo-500" /> 2. Materia Prima</h2>
                    <p className="text-xs text-gray-500 hidden sm:block mt-0.5">Define los insumos y el consumo base.</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={handleAddMaterial} icon={<Plus size={16} />} className="bg-gray-50 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 border border-gray-200 hover:border-indigo-200 text-sm py-1.5 px-3">
                    Nuevo Insumo
                  </Button>
                </div>

                <div className="flex-1 p-3 lg:p-6 space-y-4">
                  {(formData.materials || []).length === 0 && (
                    <div className="text-center py-8 px-4 text-sm text-gray-400 font-medium border-2 border-dashed border-gray-100 rounded-xl">
                      <div className="bg-indigo-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <PackageSearch size={24} className="text-indigo-400" />
                      </div>
                      Aún no hay materias primas asignadas.<br />
                      Añade materiales para armar tu receta.
                    </div>
                  )}

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
                      mainBatchInfo = `FIFO — lote ${formattedDate} @${formatCurrency(isFabric ? costPerM2 : breakdown[0].unit_cost)}${isFabric ? '/m²' : ''}`;
                    } else if (effectiveQty === 0) {
                      const fallbackBatch = batches.filter(b => b.material_id === pm.material_id && b.remaining_quantity > 0).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
                      if (fallbackBatch) {
                        const costPerM2 = (fallbackBatch.unit_cost || 0) / ((fallbackBatch.width || 140) / 100);
                        const formattedDate = new Date(fallbackBatch.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        mainBatchInfo = `FIFO — lote ${formattedDate} @${formatCurrency(isFabric ? costPerM2 : (fallbackBatch.unit_cost || 0))}${isFabric ? '/m²' : ''}`;
                      }
                    }

                    let stockInfo = '';
                    const mBatches = batches.filter(b => b.material_id === pm.material_id);
                    const totalAvailable = mBatches.reduce((acc, b) => acc + (b.remaining_quantity || 0), 0);
                    stockInfo = `Stock: ${totalAvailable.toFixed(2)} ${material?.unit || ''}`;

                    return (
                      <div key={idx} className={`overflow-hidden rounded-xl border transition-all ${hasMissingStock ? 'border-red-300 shadow-sm bg-red-50/20' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex flex-col gap-3 bg-gray-50/60 px-3 py-3 relative border-b border-gray-100 last:border-b-0">

                          {/* LINEA 1: Acciones superioes */}
                          <div className="flex items-center justify-between w-full gap-2">
                            <button
                              type="button"
                              onClick={() => { setSelectorModal({ isOpen: true, forIndex: idx }); setSelectorSearch(''); }}
                              className="flex-1 min-w-0 flex items-center justify-between rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors shadow-sm"
                            >
                              <span className="truncate">{material ? material.name : 'Seleccionar insumo...'}</span>
                              <ChevronRight size={14} className="text-gray-400 flex-shrink-0 ml-1" />
                            </button>

                            <div className="flex items-center gap-0.5 bg-white rounded-lg border border-gray-200 p-0.5 shadow-sm shrink-0">
                              <button type="button" onClick={() => setExpandedMaterial(isExpanded ? null : idx)} className={`rounded p-1.5 transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`} title="Método FIFO (Primeras Entradas, Primeras Salidas) - Desglose de lotes para costeo">
                                <Info size={18} />
                              </button>
                              <button type="button" onClick={() => removeMaterial(idx)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>

                          {/* LINEA 2: Inputs y Resultados */}
                          <div className="flex items-center justify-between w-full gap-2 mt-1">
                            <div className="flex items-center gap-2">
                              {/* Quantity Control */}
                              <div className="w-24 shrink-0">
                                {pm.mode === 'linear' ? (
                                  <div className="flex items-center rounded-lg border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-indigo-100 shadow-sm overflow-hidden">
                                    <span className="pl-2 pt-0.5 text-[9px] text-gray-400 font-bold uppercase transition-colors">Cant</span>
                                    <input
                                      type="number" step="0.01" min="0"
                                      value={pm.quantity === 0 ? '' : pm.quantity ?? ''}
                                      onChange={e => updateMaterial(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                      onKeyDown={handleNumberInputKeyDown}
                                      className="w-full border-0 bg-transparent px-2 py-1.5 text-right text-[13px] font-bold tabular-nums text-gray-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                      placeholder="0"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex h-[32px] items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-2 shadow-sm">
                                    <span className="text-[9px] text-indigo-400 font-bold uppercase">Área</span>
                                    <span className="text-[13px] font-bold tabular-nums text-indigo-700">{areaM2.toFixed(2)}m²</span>
                                  </div>
                                )}
                              </div>

                              {/* Stock Badge & Mode Toggle */}
                              <div className="flex flex-col gap-1 items-start justify-center">
                                {isFabric && (
                                  <div className="flex gap-0.5 rounded border border-gray-200 bg-white p-0.5 text-[8px] font-bold uppercase leading-none overflow-hidden hidden sm:flex">
                                    <button type="button" onClick={() => updateMaterial(idx, 'mode', 'linear')} className={`px-1.5 py-1 rounded-[2px] ${pm.mode === 'linear' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}>Lin</button>
                                    <button type="button" onClick={() => updateMaterial(idx, 'mode', 'pieces')} className={`px-1.5 py-1 rounded-[2px] ${pm.mode === 'pieces' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}>Pzas</button>
                                  </div>
                                )}
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${totalAvailable > 0 ? 'text-gray-400' : 'text-red-400'}`}>
                                  {stockInfo}
                                </span>
                              </div>
                            </div>

                            {/* Cost Row Area */}
                            <div className="flex flex-col items-end flex-shrink-0">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Costo Línea</span>
                              <span className={`text-base font-black tabular-nums leading-none ${hasMissingStock ? 'text-red-600' : 'text-gray-900'}`} title={hasMissingStock ? 'Stock insuficiente' : mainBatchInfo}>
                                {formatCurrency(costRow)}
                              </span>
                              <div className="flex items-center mt-1">
                                {mainBatchInfo && !hasMissingStock && (
                                  <span className="text-[9px] font-bold text-emerald-600 truncate max-w-[130px]" title={mainBatchInfo}>
                                    {mainBatchInfo}
                                  </span>
                                )}
                                {hasMissingStock && (
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-red-500 bg-red-50 px-1 py-0.5 rounded leading-none flex items-center gap-1"><AlertTriangle size={8} /> Falta Stock</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* EXPANDED BREAKDOWN */}
                        {isExpanded && (
                          <div className="space-y-6 border-t border-gray-100 px-4 sm:px-8 pb-6 pt-5 bg-white shadow-inner">
                            {(breakdown.length > 0 || effectiveQty === 0) && (
                              <div className="space-y-3">
                                <h5 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500"><History size={14} /> Asignación Lotes (FIFO)</h5>
                                <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
                                  <table className="w-full text-xs">
                                    <thead className="bg-gray-100/80 border-b border-gray-200">
                                      <tr>
                                        <th className="px-3 md:px-4 py-2 text-left font-bold text-gray-500">Lote</th>
                                        <th className="px-3 md:px-4 py-2 text-right font-bold text-gray-500">Volumen</th>
                                        <th className="px-3 md:px-4 py-2 text-right font-bold text-gray-500">Costo Und.</th>
                                        <th className="px-3 md:px-4 py-2 text-right font-bold text-gray-500">Parcial</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {breakdown.length > 0 ? (
                                        breakdown.map((b, i) => (
                                          <tr key={i} className={b.is_missing ? 'bg-red-50 text-red-700' : 'text-gray-700'}>
                                            <td className="px-3 md:px-4 py-2.5 font-medium truncate max-w-[120px]">
                                              {b.is_missing ? 'Sobreconsumo' : `Lote ${new Date(b.date).toLocaleDateString()}`}
                                            </td>
                                            <td className="px-3 md:px-4 py-2.5 text-right font-mono text-[11px]">{b.quantity.toFixed(4)}</td>
                                            <td className="px-3 md:px-4 py-2.5 text-right font-mono text-[11px]">{formatCurrency(b.unit_cost)}</td>
                                            <td className="px-3 md:px-4 py-2.5 text-right font-bold tabular-nums">{formatCurrency(b.subtotal)}</td>
                                          </tr>
                                        ))
                                      ) : (() => {
                                        const fallbackBatch = batches.filter(b => b.material_id === pm.material_id && b.remaining_quantity > 0).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
                                        if (!fallbackBatch) return null;
                                        return (
                                          <tr className="text-gray-700 italic opacity-70">
                                            <td className="px-3 md:px-4 py-2.5 font-medium truncate max-w-[120px]">
                                              Lote {new Date(fallbackBatch.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-3 md:px-4 py-2.5 text-right font-mono text-[11px] text-gray-400">0.0000</td>
                                            <td className="px-3 md:px-4 py-2.5 text-right font-mono text-[11px]">{formatCurrency(fallbackBatch.unit_cost || 0)}</td>
                                            <td className="px-3 md:px-4 py-2.5 text-right font-bold tabular-nums">$0.00</td>
                                          </tr>
                                        );
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {pm.mode === 'pieces' && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h5 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-indigo-500"><Scissors size={14} /> Trazado de Piezas</h5>
                                  <Button size="sm" variant="secondary" onClick={() => addPiece(idx)} className="text-[11px] h-7 px-2">Añadir Pieza</Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {(pm.pieces || []).map((piece: any, pIdx: number) => (
                                    <div key={pIdx} className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/30 p-2 shadow-sm">
                                      <div className="flex-1">
                                        <label className="text-[9px] font-bold uppercase text-indigo-400 block mb-0.5">Largo</label>
                                        <input type="number" step="0.1" className="w-full rounded bg-white border border-gray-200 px-2 py-1 text-sm font-bold focus:ring-1 focus:ring-indigo-300 outline-none" value={piece.length} onChange={e => updatePiece(idx, pIdx, 'length', parseFloat(e.target.value) || 0)} />
                                      </div>
                                      <span className="text-gray-400 mt-4">×</span>
                                      <div className="flex-1">
                                        <label className="text-[9px] font-bold uppercase text-indigo-400 block mb-0.5">Ancho</label>
                                        <input type="number" step="0.1" className="w-full rounded bg-white border border-gray-200 px-2 py-1 text-sm font-bold focus:ring-1 focus:ring-indigo-300 outline-none" value={piece.width} onChange={e => updatePiece(idx, pIdx, 'width', parseFloat(e.target.value) || 0)} />
                                      </div>
                                      <button type="button" onClick={() => removePiece(idx, pIdx)} className="text-gray-400 hover:text-red-500 mt-4 px-1"><X size={16} /></button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* ── SECCIÓN 3: COSTOS & PRECIO ── */}
              <Card className="p-4 sm:p-6 shadow-sm border border-gray-100 bg-white">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-500" /> 3. Configuración de Precios
                </h2>

                {/* FLOW LOCK: Hide section if recipe has no materials */}
                {(formData.materials || []).length === 0 ? (
                  <div className="flex flex-col gap-6">
                    <div className="rounded-xl border border-dashed border-indigo-100 bg-indigo-50/50 p-6 sm:p-8 flex flex-col items-center justify-center text-center">
                      <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                        <TrendingUp className="text-indigo-400" size={28} />
                      </div>
                      <h4 className="text-base font-black text-gray-800 mb-2">Diseña tu receta primero</h4>
                      <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-2">
                        El margen y precio ideal dependen de lo que cueste fabricarlo. <br className="hidden sm:block" />
                        Vuelve al paso anterior, añade tus <strong className="font-semibold text-gray-700">materias primas</strong> y nosotros nos encargamos de las matemáticas.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 sm:gap-6 items-start">
                      {/* Control Numerico Determinista (Eliminado Slider) */}
                      <div className="space-y-2">
                        <label className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">Margen Objetivo (%)</label>
                        <div className="w-full flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:bg-white focus-within:border-indigo-400 transition-colors">
                          <input
                            type="number" step="0.1" min="0" max="100"
                            value={formData.target_margin === 0 ? '' : formData.target_margin ?? ''}
                            onChange={e => setFormData({ ...formData, target_margin: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            onKeyDown={handleNumberInputKeyDown}
                            className="w-full text-right text-base sm:text-lg font-bold outline-none bg-transparent tabular-nums text-gray-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <span className="text-sm font-bold text-gray-400">%</span>
                        </div>
                      </div>

                      {/* Input Precio Final */}
                      <div className="space-y-2">
                        <label className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">Precio Final</label>
                        <div className="relative">
                          <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold leading-none ${metrics.priceState === 'loss' ? 'text-red-500' : metrics.priceState === 'warning' ? 'text-amber-500' : 'text-gray-800'}`}>{currencySymbol}</span>
                          <input
                            type="number" step="0.01"
                            value={formData.price === 0 ? '' : formData.price ?? ''}
                            onChange={e => setFormData({ ...formData, price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            onKeyDown={handleNumberInputKeyDown}
                            className={`w-full rounded-lg border py-2.5 pl-9 pr-4 text-lg font-bold tabular-nums outline-none transition-colors ${metrics.priceState === 'loss' ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-400 focus:ring-red-100' : metrics.priceState === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-800 focus:border-amber-400 focus:ring-amber-100' : 'border-gray-200 bg-gray-50 text-gray-800 focus:bg-white focus:border-indigo-400 focus:ring-indigo-100'} focus:ring-2`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                      <div className="w-full text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Precios sugeridos según costo y margen</div>
                      <button type="button" onClick={() => setFormData({ ...formData, price: exactSuggestedPrice })} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 px-2 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm group flex flex-col justify-center items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-indigo-500">Exacto</span>
                        <span className="text-sm font-black leading-none tabular-nums text-gray-800 group-hover:text-indigo-700 transition-colors">Aplicar {formatCurrency(exactSuggestedPrice)}</span>
                      </button>
                      <button type="button" onClick={() => setFormData({ ...formData, price: commercialSuggestedPrice })} className="flex-1 rounded-xl border border-emerald-100 bg-emerald-50/50 py-2.5 px-2 text-center transition-all hover:border-emerald-300 hover:bg-emerald-100 hover:shadow-sm group flex flex-col justify-center items-center gap-1">
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600/80 group-hover:text-emerald-600"><TrendingUp size={10} /> Redondeo Básico</span>
                        <span className="text-sm font-black leading-none tabular-nums text-emerald-700 group-hover:text-emerald-800 transition-colors">Aplicar {formatCurrency(commercialSuggestedPrice)}</span>
                      </button>
                    </div>
                  </>
                )}
              </Card>

            </div>

            {/* ── SECCIÓN 4: RESUMEN FINANCIERO (SCROLL NORMAL MÓVIL / SIDEBAR DESKTOP) ── */}
            <div className="w-full lg:w-[360px] mt-6 lg:mt-0 lg:sticky lg:top-24 lg:z-10">
              <Card className="rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm border border-gray-200 bg-white lg:bg-gray-900 lg:text-white lg:shadow-xl lg:border-gray-800">
                <h2 className="flex text-[11px] font-bold uppercase tracking-widest text-gray-500 lg:text-gray-400 mb-4 lg:mb-6 items-center gap-2">
                  <Layers size={14} className="text-indigo-500 lg:text-indigo-400" /> Resumen Comercial
                </h2>

                <div className="space-y-4 lg:space-y-5">
                  <div className="flex items-center justify-between pb-0 lg:pb-3 lg:border-b lg:border-gray-700">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500 lg:text-gray-400">Costo Base (FIFO)</span>
                    <span className="text-lg font-black tabular-nums text-gray-900 lg:text-gray-300">{formatCurrency(totalCurrentCost)}</span>
                  </div>

                  {/* Financial Mini-Dashboard: Visible if cost > 0 and price > 0 */}
                  {(totalCurrentCost > 0 && !!formData.price && formData.price > 0) ? (
                    <div className="flex flex-col space-y-4 pt-1">

                      {/* Margen Real % */}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">Margen real</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-base font-black tabular-nums leading-none ${metrics.priceState === 'loss' ? 'text-red-500 lg:text-red-400' : metrics.priceState === 'warning' ? 'text-amber-500 lg:text-amber-400' : metrics.targetStatus === 'increase_required' ? 'text-amber-500 lg:text-amber-300' : 'text-emerald-500 lg:text-emerald-400'}`}>
                            {metrics.marginDisplay}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${metrics.priceState === 'loss' ? 'text-red-400' : metrics.priceState === 'warning' ? 'text-amber-400' : metrics.targetStatus === 'increase_required' ? 'text-amber-400' : 'text-emerald-400'}`}>
                            · {metrics.priceState === 'loss' ? 'Pérdida' : metrics.priceState === 'warning' ? 'Eq.' : metrics.targetStatus === 'increase_required' ? 'Bajo' : 'Óptimo'}
                          </span>
                        </div>
                      </div>

                      {/* PRECIO FINAL - PRIMARY VALUE */}
                      <div className="pt-5 pb-2 border-t border-gray-100 lg:border-gray-700/50 flex flex-col items-center justify-center relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-indigo-50/50 to-transparent lg:from-indigo-900/10 lg:to-transparent -mx-4 sm:-mx-5 lg:-mx-6 -mb-6 pointer-events-none rounded-b-2xl"></div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 lg:text-gray-500 mb-1 z-10">Precio Final</span>
                        <span className="text-[40px] lg:text-5xl font-black tabular-nums text-gray-900 lg:text-white tracking-tight z-10">
                          {formatCurrency(formData.price || 0)}
                        </span>
                      </div>

                      {/* Disclaimer */}
                      <div className="mt-2 flex items-start gap-2 text-gray-500 lg:text-gray-400 bg-gray-50 lg:bg-gray-800/80 p-3 rounded-xl border border-gray-100 lg:border-gray-700/80 z-10 relative">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-[11px] font-medium leading-snug">
                          Este será el precio de venta al público publicado.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="hidden lg:block text-[11px] font-medium text-gray-500 pb-2 text-center border-t border-gray-700/50 pt-5">
                      Faltan datos para calcular rentabilidad.
                    </div>
                  )}

                  {/* ACTION BUTTONS */}
                  <div className="flex gap-2 sm:gap-3 lg:flex-col lg:gap-3 mt-4 lg:mt-6">
                    <Button type="button" variant="secondary" className="flex-1 lg:w-full bg-gray-100 hover:bg-gray-200 text-gray-700 lg:bg-gray-800 lg:text-gray-300 lg:hover:bg-gray-700 lg:border-gray-700 justify-center py-3.5 sm:py-4 transition-colors font-bold" onClick={() => navigate('/productos')}>
                      Cancelar
                    </Button>
                    <Button type="button" className={`flex-[2] lg:w-full py-3.5 sm:py-4 text-sm sm:text-base font-bold text-white shadow-lg transition-all ${((formData.materials || []).length === 0 || totalCurrentCost <= 0) ? 'bg-indigo-400 cursor-not-allowed opacity-80' : 'bg-indigo-600 hover:bg-indigo-700'}`} onClick={saveProduct} icon={<CheckCircle2 size={18} />} disabled={(formData.materials || []).length === 0 || totalCurrentCost <= 0}>
                      {primaryActionLabel}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

          </div>
        </form>
      </div>

      {/* ── MATERIAL PICKER MODAL (Shopify Bottom Sheet) ── */}
      {selectorModal.isOpen && (
        <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectorModal({ isOpen: false, forIndex: null })}>
          <div
            className="w-full lg:max-w-2xl bg-white fixed top-[10vh] left-0 right-0 h-[90vh] lg:h-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:max-h-[85vh] rounded-t-[20px] lg:rounded-[20px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-full lg:zoom-in-95 duration-300 z-[9999]"
            onClick={e => e.stopPropagation()}
          >
            {/* Grabber Handle para Mobile */}
            <div className="w-full flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
            </div>

            <div className="px-5 pt-3 pb-4 lg:p-6 border-b border-gray-100 bg-white flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base lg:text-lg font-black tracking-tight text-gray-900">Buscar Insumos</h3>
                <button onClick={() => setSelectorModal({ isOpen: false, forIndex: null })} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" autoFocus placeholder="Busca por nombre o código SKU..."
                  value={selectorSearch} onChange={e => setSelectorSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-base font-medium outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 lg:p-4 bg-gray-50/50">
              {rawMaterials
                .filter(m => m.name.toLowerCase().includes(selectorSearch.toLowerCase()))
                .map(m => {
                  const mBatches = batches.filter(b => b.material_id === m.id);
                  const totalAvailable = mBatches.reduce((acc, b) => acc + (b.remaining_quantity || 0), 0);
                  const isFabric = m.unit === 'metro';

                  let costStr = '';
                  if (mBatches.length > 0) {
                    const currentBatch = mBatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    const unitCost = currentBatch.unit_cost || 0;
                    costStr = isFabric ? `${formatCurrency(unitCost / ((currentBatch.width || 140) / 100))}/m²` : `${formatCurrency(unitCost)}/${m.unit === 'unidad' ? 'und' : m.unit}`;
                  } else {
                    costStr = 'Sin stock';
                  }

                  return (
                    <button
                      key={m.id} type="button"
                      onClick={() => {
                        if (selectorModal.forIndex !== null) {
                          updateMaterial(selectorModal.forIndex, 'material_id', m.id);
                        } else {
                          const materials = [...(formData.materials || []), { material_id: m.id, quantity: 0, consumption_unit: m.unit, mode: 'linear', pieces: [{ length: 50, width: m.unit === 'metro' ? 140 : 0 }] }];
                          setFormData({ ...formData, materials });
                        }
                        setSelectorModal({ isOpen: false, forIndex: null });
                        setSelectorSearch('');
                      }}
                      className="w-full flex items-center justify-between p-4 mb-2 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all text-left group gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">{m.name}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] font-bold uppercase tracking-widest text-[9px] ${totalAvailable > 0 ? 'bg-indigo-50 text-indigo-500' : 'bg-red-50 text-red-500'}`}>
                            {totalAvailable > 0 ? `${totalAvailable.toFixed(2)} ${m.unit}` : 'Agotado'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black tabular-nums text-gray-800 group-hover:text-indigo-900">
                          {costStr}
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center justify-center p-2 rounded-full bg-gray-50 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <Plus size={16} />
                      </div>
                    </button>
                  );
                })
              }
              {rawMaterials.filter(m => m.name.toLowerCase().includes(selectorSearch.toLowerCase())).length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <PackageSearch size={48} className="text-gray-300 mb-4" />
                  <h4 className="text-base font-bold text-gray-900 mb-1">Ningún insumo encontrado</h4>
                  <p className="text-sm text-gray-500">Prueba con otro término o crea un nuevo insumo desde el módulo de materias primas.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductBuilder;
