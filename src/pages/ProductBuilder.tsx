import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Edit2, Search, Info, Layers, TrendingUp, CheckCircle2, X, ChevronRight, AlertTriangle, RotateCcw, Ruler, History, Copy, Package, PackageSearch, Printer, Archive } from 'lucide-react';
import { useStore, calculateProductCost, calculateFifoCost, getFifoBreakdown, hasProductGeneratedActiveDebt } from '../store';
import { calculateFinancialMetrics } from '@/core/financialMetricsEngine';
import { getEffectiveQuantity, calculatePiecesAreaM2, getLatestRollWidth, calculatePiecesToLinearMeters } from '@/utils/materialCalculations';
import { InventoryEngineV2, UnitConverter } from '../services/inventoryEngineV2';
import { Product, ProductMaterial, Status, Unit, RawMaterial, MaterialBatch } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
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

// ── INTERFACES: Estado tipado del formulario ─────────────────────────────
interface ProductFormState {
  name: string;
  reference?: string;
  price?: number;
  target_margin: number;
  materials: ProductMaterialUI[];
  status?: Status;
}

interface ProductMaterialUI extends ProductMaterial {
  mode: 'linear' | 'pieces';
  pieces: { length: number; width: number }[];
}

const ProductBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // For editing an existing product
  const { currentCompanyId, currentUserRole, products, productMovements, rawMaterials, batches, movements, unitsOfMeasure, addProduct, deleteProduct, discontinueProduct, updateProduct } = useStore();

  // ✅ RBAC eliminado del frontend — ahora se aplica mediante RLS en Supabase
  // Policies: 20260303211300_rbac_role_policies_v2.sql

  const { formatCurrency, currencySymbol } = useCurrency();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedMaterial, setExpandedMaterial] = useState<number | null>(null);

  const [selectorModal, setSelectorModal] = useState<{ isOpen: boolean; forIndex: number | null }>({ isOpen: false, forIndex: null });
  const [selectorSearch, setSelectorSearch] = useState('');

  // ✅ formData tipado correctamente (hallazgo #6/#13)
  const [formData, setFormData] = useState<ProductFormState>({
    name: '', reference: '', price: 0, target_margin: 30, materials: [], status: 'activa'
  });

  const [minStock, setMinStock] = useState<number | null>(null);


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
        setMinStock(p.min_stock ?? null);
      } else {
        navigate('/productos');
      }
    } else if (!id) {
      // New product mode — auto-generate next incremental reference
      setEditingId(null);
      const nextRef = (() => {
        const existingRefs = products
          .map(p => p.reference || '')
          .filter(r => /^REF-\d+$/i.test(r))
          .map(r => parseInt(r.replace(/^REF-/i, ''), 10));
        const maxNum = existingRefs.length > 0 ? Math.max(...existingRefs) : 0;
        return `REF-${String(maxNum + 1).padStart(3, '0')}`;
      })();

      // 🟢 CLAUDE FIX: Support duplication via router state
      const duplicateFrom = (window.history.state?.usr as any)?.duplicateFrom as Product;
      if (duplicateFrom) {
        setFormData({
          name: `${duplicateFrom.name} (Copia)`,
          reference: nextRef,
          price: duplicateFrom.price ?? 0,
          target_margin: duplicateFrom.target_margin ?? 30,
          materials: (duplicateFrom.materials || []) as ProductMaterialUI[],
          status: 'activa',
          min_stock: duplicateFrom.min_stock ?? null
        });
        setMinStock(duplicateFrom.min_stock ?? null);
      } else {
        setFormData({ name: '', reference: nextRef, materials: [], target_margin: 30, price: undefined });
        setMinStock(null);
      }
    }
  }, [id, products, batches, navigate]);

  // 🟠 AUDIT FIX: calculateTotalCost local eliminado.
  // Se usa calculateProductCost del store — fuente única de verdad para el costeo FIFO.
  // Esto garantiza que el costo mostrado aquí sea idéntico al que guarda el store en Supabase.
  const totalCurrentCost = useMemo(() => {
    const tempProduct = { ...formData, materials: formData.materials || [] } as Product;
    return calculateProductCost(tempProduct, batches, rawMaterials, unitsOfMeasure);
  }, [formData.materials, batches, rawMaterials]);

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
        // 🟢 UOM v2: resolver símbolo desde units_of_measure, no desde el campo unit legacy
        const displayUnit = unitsOfMeasure.find(u => u.id === selectedBase.display_unit_id)
          || unitsOfMeasure.find(u => u.id === selectedBase.base_unit_id);
        materials[idx].consumption_unit = displayUnit?.symbol ?? selectedBase.unit;
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
    const rollWidth = getLatestRollWidth(mat.material_id, batches);
    mat.pieces = [...(mat.pieces || []), { length: 10, width: rollWidth }];
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
    // 🔴 AUDIT FIX: Guard — no escribir sin tenant activo
    if (!currentCompanyId) {
      alert('Error: No hay una empresa activa. Por favor recarga la sesión.');
      return;
    }

    // ── VALIDATION ──
    const errors: string[] = [];
    if (!formData.name?.trim()) errors.push('Nombre del producto');
    if ((formData.materials || []).length === 0) errors.push('Al menos un insumo en la receta');
    if (!formData.price || formData.price <= 0) errors.push('Precio de venta mayor a 0');
    if (errors.length > 0) {
      alert(`Faltan campos obligatorios:\n\n• ${errors.join('\n• ')}`);
      return;
    }

    // Audit trail (created_by/updated_by) is handled by the store mutations.
    const processedMaterials = formData.materials.map((pm: any) => {
      if (pm.mode === 'pieces' && pm.pieces) {
        const rollWidth = getLatestRollWidth(pm.material_id, batches);
        return { ...pm, quantity: calculatePiecesToLinearMeters(pm.pieces, rollWidth) };
      }
      return pm;
    });

    const now = new Date().toISOString();
    const data = {
      ...formData,
      materials: processedMaterials,
      id: editingId || crypto.randomUUID(),
      company_id: currentCompanyId,
      status: formData.status || 'activa', // 🔴 FIX FORZAR ACTIVO
      min_stock: minStock ?? null,
      created_at: editingId ? (products.find(p => p.id === editingId)?.created_at) : now,
      updated_at: now,
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
  }, [formData, editingId, batches, products, currentCompanyId, updateProduct, addProduct, navigate, minStock]);

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
    (formData.target_margin || 30) / 100,
    currencySymbol
  );

  // 🟢 PHASE 3: Production Readiness — feasibility check per material (BASE vs BASE)
  const productionReadiness = useMemo(() => {
    const materials = formData.materials || [];
    if (materials.length === 0) return { ready: false, items: [], hasMaterials: false };

    const items = materials.map((pm: any) => {
      const material = rawMaterials.find(m => m.id === pm.material_id);
      const uom = unitsOfMeasure.find(u => u.symbol === pm.consumption_unit);

      // 1. Obtener cantidad efectiva YA EN UNIDBASE (al pasar el uom)
      const baseEffectiveQty = getEffectiveQuantity(pm, batches, pm.material_id, uom);

      const availableBatches = batches.filter(b => b.material_id === pm.material_id);

      // 2. Sumar stock disponible en UNIDADES BASE
      const totalBaseAvailable = availableBatches.reduce((acc, b) => acc + (b.base_remaining_quantity || 0), 0);

      const baseDeficit = Math.max(0, baseEffectiveQty - totalBaseAvailable);

      // 3. Calcular déficit en unidad de consumo para mostrar al usuario
      const displayDeficit = uom && baseDeficit > 0 ? UnitConverter.fromBase(baseDeficit, uom) : baseDeficit;

      return {
        name: material?.name || 'Desconocido',
        unit: material?.unit || '',
        required: getEffectiveQuantity(pm, batches, pm.material_id), // Visual qty
        available: totalBaseAvailable,
        deficit: displayDeficit,
        isCovered: baseDeficit <= 0.0001,
      };
    });

    return {
      ready: items.every(i => i.isCovered),
      items,
      hasMaterials: true,
    };
  }, [formData.materials, batches, rawMaterials, unitsOfMeasure]);

  const primaryActionLabel = editingId ? "Guardar Cambios" : "Crear Producto";


  return (
    <PageContainer>
      {/* ── HEADER FIJO ── */}
      <div className={`sticky top-0 z-40 flex items-center justify-between ${spacing.pxMd} sm: py-4${spacing.pxLg} ${colors.bgSurface} border-b ${colors.borderStandard} ${shadows.sm} -mx-4 -mt-6 mb-6 sm:-mx-6 lg:-mx-8`}>
        <div className="flex flex-1 items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/productos')} className={`${colors.textSecondary} hover:${colors.textPrimary} transition-colors`}>
            <ChevronRight className="rotate-180" size={20} />
          </Button>
          <div className="space-y-0.5">
            <h1 className={`${typography.text.title} ${colors.textPrimary} leading-tight`}>
              {editingId ? 'Editar Producto' : 'Nuevo Producto'}
            </h1>
            <p className={`${typography.text.caption} ${colors.textSecondary} hidden font-medium uppercase tracking-wider sm:block`}>BETO OS · CONFIGURACIÓN TÉCNICA</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" className="hidden font-bold text-slate-400 sm:flex" onClick={() => navigate('/productos')}>
            CANCELAR
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={saveProduct}
            icon={<CheckCircle2 size={18} />}
            disabled={(formData.materials || []).length === 0 || totalCurrentCost <= 0}
            className="px-6 font-black uppercase tracking-widest"
          >
            {editingId ? "GUARDAR" : "CREAR"}
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl">
        <form onSubmit={handleSubmit} className="w-full">
          {/* LENGUAJE VISUAL UNIFICADO (DESKTOP & MOBILE) */}
          <div className="flex flex-col items-start gap-6 lg:flex-row">

            {/* LEFT COLUMN: Formularios */}
            <div className="w-full flex-1 space-y-6">
              <SectionBlock className="space-y-6 border-0 bg-transparent p-0 shadow-none">
                {/* ── SECCIÓN 1: INFORMACIÓN GENERAL ── */}
                <Card className={`${spacing.pMd} sm:${spacing.pMd} lg:${spacing.pLg} ${shadows.sm} border ${colors.borderStandard} ${colors.bgSurface}`}>
                  <h2 className={`${typography.text.section} ${colors.textPrimary} mb-6 flex items-center gap-2 border-b border-slate-50 pb-4`}>
                    <Package size={parseInt(typography.icon.md)} className="text-slate-500" aria-hidden="true" /> 1. Información General
                  </h2>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Input
                      label="Nombre Comercial"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej. Bolso de Mano Primavera"
                      className="h-12 font-bold"
                      required
                    />
                    <Input
                      label="Referencia / SKU"
                      value={formData.reference}
                      onChange={e => setFormData({ ...formData, reference: e.target.value })}
                      placeholder="REF-001"
                      className="h-12 font-mono font-black"
                    />
                  </div>
                </Card>

                {/* ── SECCIÓN 2: COMPOSICIÓN DE MATERIALES ── */}
                <Card className={`${spacing.pMd} sm:${spacing.pMd} lg:${spacing.pLg} ${shadows.sm} border ${colors.borderStandard} ${colors.bgSurface}`}>
                  <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-50 pb-4 sm:flex-row sm:items-center">
                    <h2 className={`${typography.text.section} ${colors.textPrimary} flex items-center gap-2`}>
                      <RotateCcw size={parseInt(typography.icon.md)} className="text-slate-500" aria-hidden="true" /> 2. Receta de Producción
                    </h2>
                    <div className="flex items-center gap-4">
                      <p className={`${typography.text.caption} ${colors.textSecondary} mt-0.5 hidden font-bold uppercase tracking-wider sm:block`}>Composición Técnica del Producto</p>
                      <Button type="button" variant="secondary" onClick={handleAddMaterial} icon={<Plus size={16} />} className="border-slate-200 font-bold">
                        NUEVO INSUMO
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(formData.materials || []).length === 0 && (
                      <div className={`px-4 py-8 text-center ${typography.text.body} rounded-xl border-2 border-dashed border-slate-200 text-slate-500`}>
                        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100">
                          <PackageSearch size={24} className="text-slate-400" />
                        </div>
                        Aún no hay materias primas asignadas.<br />
                        Añade materiales para armar tu receta.
                      </div>
                    )}

                    {(formData.materials || []).map((pm: any, idx: number) => {
                      const material = rawMaterials.find(m => m.id === pm.material_id);
                      const isFabric = material?.unit === 'metro';
                      const rollWidth = getLatestRollWidth(pm.material_id, batches);

                      let effectiveQty = pm.quantity;
                      let areaM2 = 0;
                      if (pm.mode === 'pieces' && pm.pieces) {
                        areaM2 = calculatePiecesAreaM2(pm.pieces);
                        effectiveQty = calculatePiecesToLinearMeters(pm.pieces, rollWidth);
                      } else if (isFabric) {
                        areaM2 = pm.quantity * (rollWidth / 100);
                      }

                      const breakdown = getFifoBreakdown(pm.material_id, effectiveQty, pm.consumption_unit, batches, rawMaterials, unitsOfMeasure);
                      const costRow = breakdown.reduce((acc, item) => acc + item.subtotal, 0);
                      const isExpanded = expandedMaterial === idx;
                      const hasMissingStock = breakdown.some((b: any) => b.is_missing);

                      let mainBatchInfo = '';
                      if (breakdown.length > 0 && !(breakdown[0] as any).is_missing) {
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
                      const totalAvailableBase = mBatches.reduce((acc, b) => acc + (b.base_remaining_quantity || 0), 0);

                      // Mostramos stock en unidad de consumo para el UI del constructor
                      const uomForStock = unitsOfMeasure.find(u => u.symbol === pm.consumption_unit);
                      const displayStock = (uomForStock && totalAvailableBase > 0)
                        ? UnitConverter.fromBase(totalAvailableBase, uomForStock)
                        : totalAvailableBase;

                      stockInfo = `Stock: ${displayStock.toFixed(2)} ${pm.consumption_unit}`;

                      return (
                        <div key={idx} className={`overflow-hidden ${radius.xl} border transition-all ${hasMissingStock ? 'border-slate-300 bg-slate-50/20 shadow-sm' : `${colors.borderStandard} hover:border-gray-300`}`}>
                          <div className={`flex flex-col gap-2 ${colors.bgMain} relative border-b p-3 ${colors.borderSubtle} last:border-b-0`}>

                            <div className="flex w-full items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => { setSelectorModal({ isOpen: true, forIndex: idx }); setSelectorSearch(''); }}
                                className={`flex min-w-0 flex-1 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 ${typography.text.body} font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400`}
                                aria-label={`Seleccionar insumo para ${material?.name || 'nuevo material'}`}
                              >
                                <span className="truncate">{material ? material.name : 'Seleccionar insumo...'}</span>
                                <ChevronRight size={14} className="ml-1 shrink-0 text-slate-500" aria-hidden="true" />
                              </button>

                              <div className="w-32 sm:w-40 shrink-0">
                                {pm.mode === 'linear' ? (
                                  <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-100">
                                    <input
                                      type="number" step="0.0001" min="0"
                                      inputMode="decimal"
                                      value={pm.quantity === 0 ? '' : pm.quantity ?? ''}
                                      onChange={e => updateMaterial(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                      onKeyDown={handleNumberInputKeyDown}
                                      className={`w-full border-0 bg-transparent py-1.5 pl-3 pr-1 text-right ${typography.text.body} font-bold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                                      placeholder="0"
                                      aria-label={`Cantidad de ${material?.name || 'material'}`}
                                    />
                                    <span className="select-none pl-1 pr-3 text-xs font-bold uppercase text-slate-400">{pm.consumption_unit}</span>
                                  </div>
                                ) : (
                                  <div className="flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 shadow-sm">
                                    <span className={`${typography.text.body} font-bold text-slate-700`}>{areaM2.toFixed(2)}m²</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
                                <button type="button" onClick={() => setExpandedMaterial(isExpanded ? null : idx)} className={`rounded p-1.5 transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-600'}`} title="Desglose FIFO" aria-label={isExpanded ? 'Ocultar desglose FIFO' : 'Mostrar desglose FIFO'}>
                                  <Info size={18} aria-hidden="true" />
                                </button>
                                <button type="button" onClick={() => removeMaterial(idx)} className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600" aria-label={`Eliminar ${material?.name || 'material'} de la receta`}>
                                  <Trash2 size={18} aria-hidden="true" />
                                </button>
                              </div>

                              <div className="flex shrink-0 flex-col items-end">
                                <span className={`${typography.text.caption} font-bold tabular-nums leading-none ${hasMissingStock ? 'text-slate-500' : 'text-slate-900'}`} title={hasMissingStock ? 'Stock insuficiente' : mainBatchInfo}>
                                  {formatCurrency(costRow)}
                                </span>
                              </div>
                            </div>

                            <div className="flex w-full items-center justify-between gap-2 px-0.5">
                              <div className="flex items-center gap-2">
                                <div className={`flex gap-0.5 rounded border border-slate-200 bg-white p-0.5 ${typography.text.caption} flex overflow-hidden uppercase leading-none`}>
                                  {isFabric ? (
                                    <>
                                      <button type="button" onClick={() => updateMaterial(idx, 'mode', 'linear')} className={`rounded-[3px] px-2 py-1 ${pm.mode === 'linear' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'} font-bold transition-colors`} aria-label="Modo metros lineales">Lin</button>
                                      <button type="button" onClick={() => updateMaterial(idx, 'mode', 'pieces')} className={`rounded-[3px] px-2 py-1 ${pm.mode === 'pieces' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'} font-bold transition-colors`} aria-label="Modo piezas">Pzas</button>
                                    </>
                                  ) : (
                                    /* Unit switcher for non-fabric materials within the same category */
                                    unitsOfMeasure
                                      .filter(u => u.category_id === material?.category_id)
                                      .sort((a, b) => b.conversion_factor - a.conversion_factor) // Show larger units first
                                      .map(u => (
                                        <button
                                          key={u.id}
                                          type="button"
                                          onClick={() => updateMaterial(idx, 'consumption_unit', u.symbol)}
                                          className={`rounded-[3px] px-2 py-1 ${pm.consumption_unit === u.symbol ? 'bg-indigo-50 font-bold text-indigo-600' : 'text-slate-500 hover:bg-slate-100'} transition-colors`}
                                        >
                                          {u.symbol}
                                        </button>
                                      ))
                                  )}
                                </div>
                                <span className={`${typography.text.caption} font-bold uppercase tracking-widest ${totalAvailableBase > 0 ? 'text-slate-600' : 'text-slate-400'}`}>
                                  {stockInfo}
                                </span>
                              </div>
                              <div className="flex items-center">
                                {mainBatchInfo && !hasMissingStock && (
                                  <span className={`${typography.text.caption} max-w-[180px] truncate font-medium text-slate-600`} title={mainBatchInfo}>
                                    {mainBatchInfo}
                                  </span>
                                )}
                                {hasMissingStock && (
                                  <span className={`${typography.text.caption} flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-bold uppercase leading-none tracking-widest text-slate-500`}><AlertTriangle size={10} aria-hidden="true" /> Falta Stock</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="space-y-6 border-t border-gray-100 bg-white px-4 pb-6 pt-5 shadow-inner sm:px-8">
                              {(breakdown.length > 0 || effectiveQty === 0) && (
                                <div className="space-y-3">
                                  <h5 className={`flex items-center gap-2 ${typography.text.caption} font-bold uppercase tracking-widest text-slate-600`}><History size={14} aria-hidden="true" /> Asignación Lotes (FIFO)</h5>
                                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
                                    <table className="w-full text-xs">
                                      <thead className="border-b border-gray-200 bg-gray-100/80">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-bold text-slate-600 md:px-4">Lote</th>
                                          <th className="px-3 py-2 text-right font-bold text-slate-600 md:px-4">Volumen</th>
                                          <th className="px-3 py-2 text-right font-bold text-slate-600 md:px-4">Costo Und.</th>
                                          <th className="px-3 py-2 text-right font-bold text-slate-600 md:px-4">Parcial</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {breakdown.length > 0 ? (
                                          breakdown.map((b: any, i) => (
                                            <tr key={i} className={b.is_missing ? 'bg-slate-50 text-slate-500' : 'text-gray-700'}>
                                              <td className="py-2.5 max-w-[120px] truncate px-3 font-medium md:px-4">
                                                {b.is_missing ? 'Sobreconsumo' : `Lote ${new Date(b.date).toLocaleDateString()}`}
                                              </td>
                                              <td className="py-2.5 px-3 text-right font-mono text-xs md:px-4">{(b.quantity_used || 0).toFixed(4)}</td>
                                              <td className="py-2.5 px-3 text-right font-mono text-xs md:px-4">{formatCurrency(b.unit_cost, 4)}</td>
                                              <td className="py-2.5 px-3 text-right font-bold tabular-nums md:px-4">{formatCurrency(b.subtotal)}</td>
                                            </tr>
                                          ))
                                        ) : (() => {
                                          const fallbackBatch = batches.filter(b => b.material_id === pm.material_id && (b.base_remaining_quantity || 0) > 0).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
                                          if (!fallbackBatch) return null;
                                          return (
                                            <tr className="italic text-gray-700 opacity-70">
                                              <td className="py-2.5 max-w-[120px] truncate px-3 font-medium md:px-4">
                                                Lote {new Date(fallbackBatch.date).toLocaleDateString()}
                                              </td>
                                              <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-500 md:px-4">0.0000</td>
                                              <td className="py-2.5 px-3 text-right font-mono text-xs md:px-4">{formatCurrency(fallbackBatch.unit_cost || 0, 4)}</td>
                                              <td className="py-2.5 px-3 text-right font-bold tabular-nums md:px-4">$0.00</td>
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
                                    <h5 className={`flex items-center gap-2 ${typography.text.caption} font-bold uppercase tracking-widest text-slate-500`}><Ruler size={14} aria-hidden="true" /> Trazado de Piezas</h5>
                                    <Button variant="secondary" onClick={() => addPiece(idx)} className="h-7 px-2 text-xs">Añadir Pieza</Button>
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {(pm.pieces || []).map((piece: any, pIdx: number) => (
                                      <div key={pIdx} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/30 p-2 shadow-sm">
                                        <div className="flex-1">
                                          <label className={`${typography.text.caption} mb-0.5 block font-bold uppercase text-slate-500`}>Largo</label>
                                          <input type="number" step="0.1" inputMode="decimal" aria-label={`Largo pieza ${pIdx + 1}`} className={`w-full rounded border border-slate-200 bg-white px-2 py-1 ${typography.text.body} font-bold outline-none focus:ring-1 focus:ring-slate-300`} value={piece.length} onChange={e => updatePiece(idx, pIdx, 'length', parseFloat(e.target.value) || 0)} onKeyDown={handleNumberInputKeyDown} />
                                        </div>
                                        <span className="mt-4 text-slate-500" aria-hidden="true">×</span>
                                        <div className="flex-1">
                                          <label className={`${typography.text.caption} mb-0.5 block font-bold uppercase text-slate-500`}>Ancho</label>
                                          <input type="number" step="0.1" inputMode="decimal" aria-label={`Ancho pieza ${pIdx + 1}`} className={`w-full rounded border border-gray-200 bg-white px-2 py-1 ${typography.text.body} font-bold outline-none focus:ring-1 focus:ring-slate-300`} value={piece.width} onChange={e => updatePiece(idx, pIdx, 'width', parseFloat(e.target.value) || 0)} onKeyDown={handleNumberInputKeyDown} />
                                        </div>
                                        <button type="button" onClick={() => removePiece(idx, pIdx)} className="mt-4 px-1 text-slate-500 hover:text-slate-400" aria-label={`Eliminar pieza ${pIdx + 1}`}><X size={16} aria-hidden="true" /></button>
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
                <Card className={`${spacing.pMd} sm:${spacing.pMd} lg:${spacing.pLg} ${shadows.sm} border ${colors.borderStandard} ${colors.bgSurface}`}>
                  <h2 className={`${typography.text.section} mb-4 flex items-center gap-2`}>
                    <TrendingUp size={parseInt(typography.icon.sm)} className="text-slate-500" aria-hidden="true" /> 3. Configuración de Precios
                  </h2>

                  {(formData.materials || []).length === 0 ? (
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center sm:p-8">
                        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-slate-100">
                          <TrendingUp className="text-slate-400" size={28} />
                        </div>
                        <h4 className="mb-2 text-base font-semibold text-gray-800">Diseña tu receta primero</h4>
                        <p className="mb-2 max-w-sm text-sm leading-relaxed text-gray-500">
                          El margen y precio ideal dependen de lo que cueste fabricarlo. <br className="hidden sm:block" />
                          Vuelve al paso anterior, añade tus <strong className="font-semibold text-gray-700">materias primas</strong> y nosotros nos encargamos de las matemáticas.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                      <div className="space-y-1.5">
                        <label className={typography.text.caption}>Margen Objetivo (%)</label>
                        <div className="py-2.5 flex w-full items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 transition-colors focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100">
                          <input
                            type="number" step="0.1" min="0" max="100"
                            inputMode="decimal"
                            value={formData.target_margin === 0 ? '' : formData.target_margin ?? ''}
                            onChange={e => setFormData({ ...formData, target_margin: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            onKeyDown={handleNumberInputKeyDown}
                            className={`w-full text-right ${typography.text.body} bg-transparent font-bold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          />
                          <span className={`text-xs font-bold text-slate-500`}>%</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={typography.text.caption}>Precio Final</label>
                        <div className="relative">
                          <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${typography.text.body} font-bold leading-none ${metrics.priceState === 'loss' ? 'text-slate-500' : metrics.priceState === 'warning' ? 'text-slate-500' : 'text-slate-800'}`}>{currencySymbol}</span>
                          <input
                            type="number" step="0.01"
                            inputMode="decimal"
                            value={formData.price === 0 ? '' : formData.price ?? ''}
                            onChange={e => setFormData({ ...formData, price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            onKeyDown={handleNumberInputKeyDown}
                            className={`py-2.5 w-full rounded-lg border pl-9 pr-4 ${typography.text.body} font-bold tabular-nums outline-none transition-colors ${metrics.priceState === 'loss' ? 'border-slate-300 bg-slate-50 text-slate-700 focus:border-slate-400 focus:ring-slate-100' : metrics.priceState === 'warning' ? 'border-slate-300 bg-slate-50 text-slate-800 focus:border-slate-400 focus:ring-slate-100' : 'border-gray-200 bg-gray-50 text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-slate-100'} focus:ring-2`}
                          />
                        </div>
                      </div>

                      <button type="button" onClick={() => setFormData({ ...formData, price: exactSuggestedPrice })} className="py-2.5 group flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2 text-center transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm">
                        <span className={`${typography.text.caption} text-slate-600 group-hover:text-slate-700`}>Exacto</span>
                        <span className={`${typography.text.caption} font-semibold tabular-nums leading-none text-slate-900 transition-colors group-hover:text-slate-800`}>{formatCurrency(exactSuggestedPrice)}</span>
                      </button>

                      <button type="button" onClick={() => setFormData({ ...formData, price: commercialSuggestedPrice })} className="py-2.5 group flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50/50 px-2 text-center transition-all hover:border-slate-300 hover:bg-slate-100 hover:shadow-sm">
                        <span className={`${typography.text.caption} text-slate-500 group-hover:text-slate-600`}>Redondeo</span>
                        <span className={`${typography.text.caption} font-semibold tabular-nums leading-none text-slate-700 transition-colors group-hover:text-slate-800`}>{formatCurrency(commercialSuggestedPrice)}</span>
                      </button>
                    </div>
                  )}

                  <div className="mt-8 grid grid-cols-1 gap-6 border-t border-slate-50 pt-8 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">
                        Stock Mínimo
                        <span className="text-slate-400 font-normal ml-1">(opcional)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={minStock ?? ''}
                        onChange={(e) => setMinStock(e.target.value === '' ? null : Number(e.target.value))}
                        placeholder="Ej: 10"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                      />
                      <p className="text-xs text-slate-400">
                        Cuando el stock disponible caiga por debajo de este número, el sistema mostrará una alerta.
                      </p>
                    </div>
                  </div>
                </Card>
              </SectionBlock>
            </div>

            {/* RIGHT COLUMN: RESUMEN FINANCIERO */}
            <div className="lg:top-24 mt-6 w-full lg:sticky lg:z-10 lg:mt-0 lg:w-[360px]">
              <Card className={`${radius.xl} ${spacing.pMd} lg:${spacing.pLg} ${shadows.sm} border ${colors.borderStandard} ${colors.bgSurface}`}>
                <h2 className={`flex ${typography.text.caption} ${colors.textSecondary} mb-4 items-center gap-2 font-bold uppercase lg:mb-6`}>
                  <Layers size={14} className="text-slate-500" /> Resumen Comercial
                </h2>

                <div className="space-y-3 lg:space-y-4">
                  <div className={`flex items-center justify-between ${radius.xl} ${colors.bgMain} px-4 py-3`}>
                    <span className={`${typography.text.caption} ${colors.textSecondary} font-bold`}>Costo Base (FIFO)</span>
                    <span className={`${typography.text.body} font-bold ${colors.textPrimary}`}>{formatCurrency(totalCurrentCost)}</span>
                  </div>

                  {(totalCurrentCost > 0 && !!formData.price && formData.price > 0) ? (
                    <>
                      <div className={`flex items-center justify-between ${radius.xl} ${colors.bgMain} px-4 py-3`}>
                        <span className={`${typography.text.caption} ${colors.textSecondary} font-bold`}>Margen real</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={`${typography.text.body} font-bold leading-none ${metrics.priceState === 'loss' ? colors.statusDanger : metrics.priceState === 'warning' ? 'text-slate-500' : metrics.targetStatus === 'increase_required' ? 'text-slate-500' : colors.statusSuccess}`}>
                            {metrics.marginDisplay}
                          </span>
                        </div>
                      </div>

                      <div className={`${radius.xl} ${colors.bgMain} flex flex-col items-center justify-center border px-4 py-5 ${colors.borderStandard}`}>
                        <span className={`${typography.text.caption} ${colors.textSecondary} mb-1 font-bold`}>Precio Final</span>
                        <span className={`text-3xl font-black tabular-nums tracking-tight ${colors.textPrimary}`}>
                          {formatCurrency(formData.price || 0)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl bg-slate-50 px-4 py-5 text-center">
                      <span className={`${typography.text.caption} font-medium text-slate-500`}>
                        Faltan datos para calcular rentabilidad.
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 pt-2">
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full py-6 font-black uppercase tracking-widest"
                      onClick={saveProduct}
                      icon={<CheckCircle2 size={20} />}
                      disabled={(formData.materials || []).length === 0 || totalCurrentCost <= 0}
                    >
                      {primaryActionLabel}
                    </Button>
                  </div>
                </div>
              </Card>

              {productionReadiness.hasMaterials && (
                <Card className={`${radius.xl} ${spacing.pMd} mt-4 border transition-colors ${productionReadiness.ready
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-red-200 bg-red-50'
                  }`}>
                  <h2 className={`flex ${typography.text.caption} mb-3 items-center gap-2 font-bold uppercase tracking-widest ${productionReadiness.ready
                    ? 'text-emerald-600'
                    : 'text-red-600'
                    }`}>
                    {productionReadiness.ready
                      ? <><CheckCircle2 size={14} /> Listo para Producir</>
                      : <><AlertTriangle size={14} /> Stock Insuficiente</>
                    }
                  </h2>

                  {productionReadiness.ready ? (
                    <p className={`${typography.text.caption} font-medium text-emerald-700`}>
                      Todos los insumos tienen stock suficiente para producir al menos 1 unidad.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {productionReadiness.items.filter(i => !i.isCovered).map((item, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-white shadow-sm">
                          <div className="min-w-0 flex-1">
                            <span className={`${typography.text.caption} block truncate font-bold uppercase text-red-800`}>{item.name}</span>
                            <span className={`${typography.text.caption} font-medium text-red-500`}>
                              Déficit: {item.deficit.toFixed(2)} {item.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* ── MODALS OPERATIVOS ── */}

      {/* ── MATERIAL SELECTOR MODAL (Shopify Style) ── */}
      {selectorModal.isOpen && (
        <div className="animate-in fade-in fixed inset-0 z-[10001] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm duration-200 sm:items-center" onClick={() => setSelectorModal({ isOpen: false, forIndex: null })}>
          <Card
            className={`w-full max-w-2xl ${radius.xl} animate-in slide-in-from-bottom sm:zoom-in-95 flex max-h-[90vh] flex-col border-t border-slate-200 bg-white shadow-2xl duration-300 sm:border`}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-white p-4">
              <div>
                <h3 className={`${typography.text.section} ${colors.textPrimary}`}>Seleccionar Insumo</h3>
                <p className={`${typography.text.caption} ${colors.textSecondary} font-bold uppercase tracking-wider`}>Inventario de Materias Primas</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectorModal({ isOpen: false, forIndex: null })} className="size-10 rounded-full p-0 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </Button>
            </div>

            <div className="border-b border-slate-50 p-4">
              <div className="group relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500" size={18} />
                <input
                  autoFocus
                  type="search"
                  placeholder="Buscar por nombre o descripción..."
                  className="w-full rounded-xl border-none bg-slate-50 py-3 pl-10 pr-4 font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100"
                  value={selectorSearch}
                  onChange={e => setSelectorSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto p-2 sm:p-4">
              {rawMaterials
                .filter(m => m.name.toLowerCase().includes(selectorSearch.toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(material => {
                  const mBatches = batches.filter(b => b.material_id === material.id);
                  const totalStock = mBatches.reduce((acc, b) => acc + (b.remaining_quantity || 0), 0);
                  const latestBatch = mBatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                  const hasStock = totalStock > 0;

                  return (
                    <button
                      key={material.id}
                      onClick={() => {
                        if (selectorModal.forIndex !== null) {
                          updateMaterial(selectorModal.forIndex, 'material_id', material.id);
                        } else {
                          // 🟢 UOM v2: resolver símbolo desde units_of_measure, no desde el campo unit legacy
                          const displayUnit = unitsOfMeasure.find(u => u.id === material.display_unit_id)
                            || unitsOfMeasure.find(u => u.id === material.base_unit_id);
                          const consumptionUnit = displayUnit?.symbol ?? material.unit;
                          const newMat = {
                            material_id: material.id,
                            quantity: 1,
                            consumption_unit: consumptionUnit,
                            mode: 'linear' as any,
                            pieces: []
                          };
                          setFormData({ ...formData, materials: [...(formData.materials || []), newMat] });
                        }
                        setSelectorModal({ isOpen: false, forIndex: null });
                      }}
                      className="p-3.5 group flex w-full items-center justify-between rounded-xl border border-transparent text-left transition-all hover:border-slate-100 hover:bg-slate-50 active:bg-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex size-11 items-center justify-center rounded-xl transition-colors ${hasStock ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Package size={22} />
                        </div>
                        <div>
                          <p className={`${typography.text.body} font-bold text-slate-900 transition-colors group-hover:text-indigo-600`}>{material.name}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className={`${typography.text.caption} ${colors.textSecondary} font-bold uppercase tracking-tight`}>
                              {totalStock.toFixed(2)} {material.unit}
                            </span>
                            <span className="text-slate-200">|</span>
                            {latestBatch ? (
                              <span className={`${typography.text.caption} font-black text-emerald-600`}>
                                {formatCurrency(latestBatch.unit_cost || 0)}/und
                              </span>
                            ) : (
                              <span className={`${typography.text.caption} font-bold text-slate-400`}>Sin costo</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-400" />
                    </button>
                  );
                })}

              {rawMaterials.filter(m => m.name.toLowerCase().includes(selectorSearch.toLowerCase())).length === 0 && (
                <div className="py-12 text-center">
                  <PackageSearch size={48} className="mx-auto mb-3 text-slate-200" />
                  <p className={`${typography.text.body} font-medium text-slate-500`}>No se encontraron materiales.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
};

export default ProductBuilder;