import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Edit2, Search, PlayCircle, Info, Layers, TrendingUp, CheckCircle2, X, ChevronRight, AlertTriangle, RotateCcw, Ruler, History, Copy, Package, PackageSearch, Printer, Archive } from 'lucide-react';
import { useStore, calculateProductCost, calculateFifoCost, getFifoBreakdown, hasProductGeneratedActiveDebt } from '../store';
import { calculateFinancialMetrics } from '@/core/financialMetricsEngine';
import { getEffectiveQuantity, calculatePiecesAreaM2, getLatestRollWidth, calculatePiecesToLinearMeters } from '@/utils/materialCalculations';
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
  const { currentCompanyId, currentUserRole, products, productMovements, rawMaterials, batches, movements, addProduct, deleteProduct, discontinueProduct, updateProduct, consumeStock, consumeStockBatch } = useStore();

  // ✅ RBAC eliminado del frontend — ahora se aplica mediante RLS en Supabase
  // Policies: 20260303211300_rbac_role_policies_v2.sql

  const { formatCurrency, currencySymbol } = useCurrency();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedMaterial, setExpandedMaterial] = useState<number | null>(null);

  const [missingStockModal, setMissingStockModal] = useState<{ isOpen: boolean; productId: string; missingItems: any[]; quantity: number; targetPrice: number; maxCoveredProduction: number; fullBreakdown: any[]; showFullBreakdown: boolean }>({ isOpen: false, productId: '', missingItems: [], quantity: 1, targetPrice: 0, maxCoveredProduction: 0, fullBreakdown: [], showFullBreakdown: false });
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; productName: string; cost: number; quantity: number } | null>(null);
  const [selectorModal, setSelectorModal] = useState<{ isOpen: boolean; forIndex: number | null }>({ isOpen: false, forIndex: null });
  const [selectorSearch, setSelectorSearch] = useState('');

  // ✅ formData tipado correctamente (hallazgo #6/#13)
  const [formData, setFormData] = useState<ProductFormState>({
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
      // New product mode — auto-generate next incremental reference
      setEditingId(null);
      const nextRef = (() => {
        const existingRefs = products
          .map(p => p.reference || '')
          .filter(r => /^REF-\d+$/i.test(r))
          .map(r => parseInt(r.replace(/^REF-/i, ''), 10));
        const maxNum = existingRefs.length > 0 ? Math.max(...existingRefs) : 0;
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
          status: 'activa'
        });
      } else {
        setFormData({ name: '', reference: nextRef, materials: [], target_margin: 30, price: undefined });
      }
    }
  }, [id, products, batches, navigate]);

  // 🟠 AUDIT FIX: calculateTotalCost local eliminado.
  // Se usa calculateProductCost del store — fuente única de verdad para el costeo FIFO.
  // Esto garantiza que el costo mostrado aquí sea idéntico al que guarda el store en Supabase.
  const totalCurrentCost = useMemo(() => {
    const tempProduct = { ...formData, materials: formData.materials || [] } as Product;
    return calculateProductCost(tempProduct, batches, rawMaterials);
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
    (formData.target_margin || 30) / 100,
    currencySymbol
  );

  // 🟢 PHASE 3: Production Readiness — feasibility check per material
  const productionReadiness = useMemo(() => {
    const materials = formData.materials || [];
    if (materials.length === 0) return { ready: false, items: [], hasMaterials: false };

    const items = materials.map((pm: any) => {
      const material = rawMaterials.find(m => m.id === pm.material_id);
      const effectiveQty = getEffectiveQuantity(pm, batches, pm.material_id);
      const availableBatches = batches.filter(b => b.material_id === pm.material_id);
      const totalAvailable = availableBatches.reduce((acc, b) => acc + (b.remaining_quantity || 0), 0);
      const deficit = Math.max(0, effectiveQty - totalAvailable);
      return {
        name: material?.name || 'Desconocido',
        unit: material?.unit || '',
        required: effectiveQty,
        available: totalAvailable,
        deficit,
        isCovered: deficit <= 0.0001, // floating point tolerance
      };
    });

    return {
      ready: items.every(i => i.isCovered),
      items,
      hasMaterials: true,
    };
  }, [formData.materials, batches, rawMaterials]);

  const primaryActionLabel = editingId ? "Guardar Cambios" : "Crear Producto";

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
        const latestBatch = batches.find(b => b.material_id === pm.material_id);
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
        alert('Error registrando producción: ' + translateError(err));
      });
    }
  };

  return (
    <PageContainer>
      {/* ── HEADER FIJO ── */}
      <div className={`sticky top-0 z-40 flex items-center justify-between ${spacing.pxMd} py-4 sm:${spacing.pxLg} ${colors.bgSurface} border-b ${colors.borderStandard} ${shadows.sm} -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 mb-6`}>
        <div className="flex items-center gap-3 sm:gap-4 flex-1">
          <Button variant="ghost" size="sm" onClick={() => navigate('/productos')} className={`${colors.textSecondary} hover:${colors.textPrimary} transition-colors`}>
            <ChevronRight className="rotate-180" size={20} />
          </Button>
          <div className="space-y-0.5">
            <h1 className={`${typography.text.title} ${colors.textPrimary} leading-tight`}>
              {editingId ? 'Editar Producto' : 'Nuevo Producto'}
            </h1>
            <p className={`${typography.text.caption} ${colors.textSecondary} hidden sm:block font-medium uppercase tracking-wider`}>BETO OS · CONFIGURACIÓN TÉCNICA</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" className="hidden sm:flex text-slate-400 font-bold" onClick={() => navigate('/productos')}>
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

      <div className="w-full max-w-7xl mx-auto">
        <form onSubmit={handleSubmit} className="w-full">
          {/* LENGUAJE VISUAL UNIFICADO (DESKTOP & MOBILE) */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* LEFT COLUMN: Formularios */}
            <div className="flex-1 w-full space-y-6">
              <SectionBlock className="p-0 border-0 bg-transparent shadow-none space-y-6">
                {/* ── SECCIÓN 1: INFORMACIÓN GENERAL ── */}
                <Card className={`${spacing.pMd} sm:${spacing.pMd} lg:${spacing.pLg} ${shadows.sm} border ${colors.borderStandard} ${colors.bgSurface}`}>
                  <h2 className={`${typography.text.section} ${colors.textPrimary} mb-6 flex items-center gap-2 border-b border-slate-50 pb-4`}>
                    <Package size={parseInt(typography.icon.md)} className="text-indigo-500" aria-hidden="true" /> 1. Información General
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-50 pb-4">
                    <h2 className={`${typography.text.section} ${colors.textPrimary} flex items-center gap-2`}>
                      <RotateCcw size={parseInt(typography.icon.md)} className="text-indigo-500" aria-hidden="true" /> 2. Receta de Producción
                    </h2>
                    <div className="flex items-center gap-4">
                      <p className={`${typography.text.caption} ${colors.textSecondary} hidden sm:block mt-0.5 uppercase font-bold tracking-wider`}>Composición Técnica del Producto</p>
                      <Button type="button" variant="secondary" onClick={handleAddMaterial} icon={<Plus size={16} />} className="font-bold border-slate-200">
                        NUEVO INSUMO
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(formData.materials || []).length === 0 && (
                      <div className={`text-center py-8 px-4 ${typography.text.body} text-slate-500 border-2 border-dashed border-slate-200 rounded-xl`}>
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
                      const rollWidth = getLatestRollWidth(pm.material_id, batches);

                      let effectiveQty = pm.quantity;
                      let areaM2 = 0;
                      if (pm.mode === 'pieces' && pm.pieces) {
                        areaM2 = calculatePiecesAreaM2(pm.pieces);
                        effectiveQty = calculatePiecesToLinearMeters(pm.pieces, rollWidth);
                      } else if (isFabric) {
                        areaM2 = pm.quantity * (rollWidth / 100);
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
                        <div key={idx} className={`overflow-hidden ${radius.xl} border transition-all ${hasMissingStock ? 'border-red-300 shadow-sm bg-red-50/20' : `${colors.borderStandard} hover:border-gray-300`}`}>
                          <div className={`flex flex-col gap-2 ${colors.bgMain} px-3 py-3 relative border-b ${colors.borderSubtle} last:border-b-0`}>

                            <div className="flex items-center justify-between w-full gap-2">
                              <button
                                type="button"
                                onClick={() => { setSelectorModal({ isOpen: true, forIndex: idx }); setSelectorSearch(''); }}
                                className={`min-w-0 flex-1 flex items-center justify-between rounded-lg border border-slate-200 bg-white py-2 px-3 ${typography.text.body} font-semibold text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors shadow-sm`}
                                aria-label={`Seleccionar insumo para ${material?.name || 'nuevo material'}`}
                              >
                                <span className="truncate">{material ? material.name : 'Seleccionar insumo...'}</span>
                                <ChevronRight size={14} className="text-slate-500 flex-shrink-0 ml-1" aria-hidden="true" />
                              </button>

                              <div className="w-20 shrink-0">
                                {pm.mode === 'linear' ? (
                                  <div className="flex items-center rounded-lg border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-indigo-100 shadow-sm overflow-hidden">
                                    <input
                                      type="number" step="0.01" min="0"
                                      inputMode="decimal"
                                      value={pm.quantity === 0 ? '' : pm.quantity ?? ''}
                                      onChange={e => updateMaterial(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                      onKeyDown={handleNumberInputKeyDown}
                                      className={`w-full border-0 bg-transparent px-2 py-1.5 text-center ${typography.text.body} font-bold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                                      placeholder="0"
                                      aria-label={`Cantidad de ${material?.name || 'material'}`}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex h-[32px] items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-2 shadow-sm">
                                    <span className={`${typography.text.body} font-bold text-indigo-700`}>{areaM2.toFixed(2)}m²</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-0.5 bg-white rounded-lg border border-gray-200 p-0.5 shadow-sm shrink-0">
                                <button type="button" onClick={() => setExpandedMaterial(isExpanded ? null : idx)} className={`rounded p-1.5 transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-600'}`} title="Desglose FIFO" aria-label={isExpanded ? 'Ocultar desglose FIFO' : 'Mostrar desglose FIFO'}>
                                  <Info size={18} aria-hidden="true" />
                                </button>
                                <button type="button" onClick={() => removeMaterial(idx)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors" aria-label={`Eliminar ${material?.name || 'material'} de la receta`}>
                                  <Trash2 size={18} aria-hidden="true" />
                                </button>
                              </div>

                              <div className="flex flex-col items-end shrink-0">
                                <span className={`${typography.text.caption} tabular-nums leading-none font-bold ${hasMissingStock ? 'text-red-600' : 'text-slate-900'}`} title={hasMissingStock ? 'Stock insuficiente' : mainBatchInfo}>
                                  {formatCurrency(costRow)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between w-full gap-2 px-0.5">
                              <div className="flex items-center gap-2">
                                {isFabric && (
                                  <div className={`flex gap-0.5 rounded border border-slate-200 bg-white p-0.5 ${typography.text.caption} uppercase leading-none overflow-hidden hidden sm:flex`}>
                                    <button type="button" onClick={() => updateMaterial(idx, 'mode', 'linear')} className={`px-2 py-1 rounded-[3px] ${pm.mode === 'linear' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'} transition-colors`} aria-label="Modo metros lineales">Lin</button>
                                    <button type="button" onClick={() => updateMaterial(idx, 'mode', 'pieces')} className={`px-2 py-1 rounded-[3px] ${pm.mode === 'pieces' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'} transition-colors`} aria-label="Modo piezas">Pzas</button>
                                  </div>
                                )}
                                <span className={`${typography.text.caption} uppercase tracking-widest font-bold ${totalAvailable > 0 ? 'text-slate-600' : 'text-red-500'}`}>
                                  {stockInfo}
                                </span>
                              </div>
                              <div className="flex items-center">
                                {mainBatchInfo && !hasMissingStock && (
                                  <span className={`${typography.text.caption} text-emerald-600 truncate max-w-[180px] font-medium`} title={mainBatchInfo}>
                                    {mainBatchInfo}
                                  </span>
                                )}
                                {hasMissingStock && (
                                  <span className={`${typography.text.caption} uppercase tracking-widest text-red-500 bg-red-50 px-1.5 py-0.5 rounded leading-none flex items-center gap-1 font-bold`}><AlertTriangle size={10} aria-hidden="true" /> Falta Stock</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="space-y-6 border-t border-gray-100 px-4 sm:px-8 pb-6 pt-5 bg-white shadow-inner">
                              {(breakdown.length > 0 || effectiveQty === 0) && (
                                <div className="space-y-3">
                                  <h5 className={`flex items-center gap-2 ${typography.text.caption} uppercase tracking-widest text-slate-600 font-bold`}><History size={14} aria-hidden="true" /> Asignación Lotes (FIFO)</h5>
                                  <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
                                    <table className="w-full text-xs">
                                      <thead className="bg-gray-100/80 border-b border-gray-200">
                                        <tr>
                                          <th className="px-3 md:px-4 py-2 text-left font-bold text-slate-600">Lote</th>
                                          <th className="px-3 md:px-4 py-2 text-right font-bold text-slate-600">Volumen</th>
                                          <th className="px-3 md:px-4 py-2 text-right font-bold text-slate-600">Costo Und.</th>
                                          <th className="px-3 md:px-4 py-2 text-right font-bold text-slate-600">Parcial</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {breakdown.length > 0 ? (
                                          breakdown.map((b, i) => (
                                            <tr key={i} className={b.is_missing ? 'bg-red-50 text-red-700' : 'text-gray-700'}>
                                              <td className="px-3 md:px-4 py-2.5 font-medium truncate max-w-[120px]">
                                                {b.is_missing ? 'Sobreconsumo' : `Lote ${new Date(b.date).toLocaleDateString()}`}
                                              </td>
                                              <td className="px-3 md:px-4 py-2.5 text-right font-mono text-xs">{(b.quantity || 0).toFixed(4)}</td>
                                              <td className="px-3 md:px-4 py-2.5 text-right font-mono text-xs">{formatCurrency(b.unit_cost)}</td>
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
                                              <td className="px-3 md:px-4 py-2.5 text-right font-mono text-xs text-slate-500">0.0000</td>
                                              <td className="px-3 md:px-4 py-2.5 text-right font-mono text-xs">{formatCurrency(fallbackBatch.unit_cost || 0)}</td>
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
                                    <h5 className={`flex items-center gap-2 ${typography.text.caption} uppercase tracking-widest text-indigo-500 font-bold`}><Ruler size={14} aria-hidden="true" /> Trazado de Piezas</h5>
                                    <Button variant="secondary" onClick={() => addPiece(idx)} className="text-xs h-7 px-2">Añadir Pieza</Button>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {(pm.pieces || []).map((piece: any, pIdx: number) => (
                                      <div key={pIdx} className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/30 p-2 shadow-sm">
                                        <div className="flex-1">
                                          <label className={`${typography.text.caption} uppercase text-indigo-500 block mb-0.5 font-bold`}>Largo</label>
                                          <input type="number" step="0.1" inputMode="decimal" aria-label={`Largo pieza ${pIdx + 1}`} className={`w-full rounded bg-white border border-slate-200 px-2 py-1 ${typography.text.body} font-bold focus:ring-1 focus:ring-indigo-300 outline-none`} value={piece.length} onChange={e => updatePiece(idx, pIdx, 'length', parseFloat(e.target.value) || 0)} onKeyDown={handleNumberInputKeyDown} />
                                        </div>
                                        <span className="text-slate-500 mt-4" aria-hidden="true">×</span>
                                        <div className="flex-1">
                                          <label className={`${typography.text.caption} uppercase text-indigo-500 block mb-0.5 font-bold`}>Ancho</label>
                                          <input type="number" step="0.1" inputMode="decimal" aria-label={`Ancho pieza ${pIdx + 1}`} className={`w-full rounded bg-white border border-gray-200 px-2 py-1 ${typography.text.body} font-bold focus:ring-1 focus:ring-indigo-300 outline-none`} value={piece.width} onChange={e => updatePiece(idx, pIdx, 'width', parseFloat(e.target.value) || 0)} onKeyDown={handleNumberInputKeyDown} />
                                        </div>
                                        <button type="button" onClick={() => removePiece(idx, pIdx)} className="text-slate-500 hover:text-red-500 mt-4 px-1" aria-label={`Eliminar pieza ${pIdx + 1}`}><X size={16} aria-hidden="true" /></button>
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
                    <TrendingUp size={parseInt(typography.icon.sm)} className="text-indigo-500" aria-hidden="true" /> 3. Configuración de Precios
                  </h2>

                  {(formData.materials || []).length === 0 ? (
                    <div className="flex flex-col gap-6">
                      <div className="rounded-xl border border-dashed border-indigo-100 bg-indigo-50/50 p-6 sm:p-8 flex flex-col items-center justify-center text-center">
                        <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                          <TrendingUp className="text-indigo-400" size={28} />
                        </div>
                        <h4 className="text-base font-semibold text-gray-800 mb-2">Diseña tu receta primero</h4>
                        <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-2">
                          El margen y precio ideal dependen de lo que cueste fabricarlo. <br className="hidden sm:block" />
                          Vuelve al paso anterior, añade tus <strong className="font-semibold text-gray-700">materias primas</strong> y nosotros nos encargamos de las matemáticas.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <div className="space-y-1.5">
                        <label className={typography.text.caption}>Margen Objetivo (%)</label>
                        <div className="w-full flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:bg-white focus-within:border-indigo-400 transition-colors">
                          <input
                            type="number" step="0.1" min="0" max="100"
                            inputMode="decimal"
                            value={formData.target_margin === 0 ? '' : formData.target_margin ?? ''}
                            onChange={e => setFormData({ ...formData, target_margin: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            onKeyDown={handleNumberInputKeyDown}
                            className={`w-full text-right ${typography.text.body} font-bold outline-none bg-transparent tabular-nums text-slate-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          />
                          <span className={`text-xs font-bold text-slate-500`}>%</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={typography.text.caption}>Precio Final</label>
                        <div className="relative">
                          <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${typography.text.body} font-bold leading-none ${metrics.priceState === 'loss' ? 'text-red-500' : metrics.priceState === 'warning' ? 'text-amber-500' : 'text-slate-800'}`}>{currencySymbol}</span>
                          <input
                            type="number" step="0.01"
                            inputMode="decimal"
                            value={formData.price === 0 ? '' : formData.price ?? ''}
                            onChange={e => setFormData({ ...formData, price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            onKeyDown={handleNumberInputKeyDown}
                            className={`w-full rounded-lg border py-2.5 pl-9 pr-4 ${typography.text.body} font-bold tabular-nums outline-none transition-colors ${metrics.priceState === 'loss' ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-400 focus:ring-red-100' : metrics.priceState === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-800 focus:border-amber-400 focus:ring-amber-100' : 'border-gray-200 bg-gray-50 text-slate-900 focus:bg-white focus:border-indigo-400 focus:ring-indigo-100'} focus:ring-2`}
                          />
                        </div>
                      </div>

                      <button type="button" onClick={() => setFormData({ ...formData, price: exactSuggestedPrice })} className="flex flex-col justify-center items-center gap-1 rounded-xl border border-gray-200 bg-white py-2.5 px-2 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm group">
                        <span className={`${typography.text.caption} text-slate-600 group-hover:text-indigo-500`}>Exacto</span>
                        <span className={`${typography.text.caption} font-semibold leading-none tabular-nums text-slate-900 group-hover:text-indigo-700 transition-colors`}>{formatCurrency(exactSuggestedPrice)}</span>
                      </button>

                      <button type="button" onClick={() => setFormData({ ...formData, price: commercialSuggestedPrice })} className="flex flex-col justify-center items-center gap-1 rounded-xl border border-emerald-100 bg-emerald-50/50 py-2.5 px-2 text-center transition-all hover:border-emerald-300 hover:bg-emerald-100 hover:shadow-sm group">
                        <span className={`${typography.text.caption} text-emerald-600/80 group-hover:text-emerald-600`}>Redondeo</span>
                        <span className={`${typography.text.caption} font-semibold leading-none tabular-nums text-emerald-700 group-hover:text-emerald-800 transition-colors`}>{formatCurrency(commercialSuggestedPrice)}</span>
                      </button>
                    </div>
                  )}
                </Card>
              </SectionBlock>
            </div>

            {/* RIGHT COLUMN: RESUMEN FINANCIERO */}
            <div className="w-full lg:w-[360px] mt-6 lg:mt-0 lg:sticky lg:top-24 lg:z-10">
              <Card className={`${radius.xl} ${spacing.pMd} lg:${spacing.pLg} ${shadows.sm} border ${colors.borderStandard} ${colors.bgSurface}`}>
                <h2 className={`flex ${typography.text.caption} ${colors.textSecondary} mb-4 lg:mb-6 items-center gap-2 font-bold uppercase`}>
                  <Layers size={14} className="text-indigo-500" /> Resumen Comercial
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
                          <span className={`${typography.text.body} font-bold leading-none ${metrics.priceState === 'loss' ? colors.statusDanger : metrics.priceState === 'warning' ? 'text-amber-500' : metrics.targetStatus === 'increase_required' ? 'text-amber-500' : colors.statusSuccess}`}>
                            {metrics.marginDisplay}
                          </span>
                        </div>
                      </div>

                      <div className={`${radius.xl} ${colors.bgMain} px-4 py-5 flex flex-col items-center justify-center border ${colors.borderStandard}`}>
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
                    {editingId && totalCurrentCost > 0 && productionReadiness.ready && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold"
                        onClick={() => setProductionModal({
                          isOpen: true,
                          productId: editingId,
                          quantity: 1,
                          cost: totalCurrentCost,
                          targetPrice: formData.price || 0,
                          productName: formData.name
                        })}
                        icon={<PlayCircle size={18} />}
                      >
                        REGISTRAR PRODUCCIÓN
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {productionReadiness.hasMaterials && (
                <Card className={`${radius.xl} ${spacing.pMd} border mt-4 transition-colors ${productionReadiness.ready
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-red-200 bg-red-50'
                  }`}>
                  <h2 className={`flex ${typography.text.caption} uppercase tracking-widest mb-3 items-center gap-2 font-bold ${productionReadiness.ready
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
                        <div key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-red-100 p-2.5 shadow-sm">
                          <div className="min-w-0 flex-1">
                            <span className={`${typography.text.caption} text-red-800 truncate block font-bold uppercase`}>{item.name}</span>
                            <span className={`${typography.text.caption} text-red-500 font-medium`}>
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
      {productionModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <Card className={`w-full max-w-md ${spacing.pLg} ${shadows.xl} ${colors.bgSurface} border-0 space-y-6 animate-in zoom-in-95 duration-200`}>
            <div className="text-center space-y-2">
              <div className="h-16 w-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package size={32} className="text-indigo-600" />
              </div>
              <h3 className={`${typography.text.section} ${colors.textPrimary}`}>Registrar Producción</h3>
              <p className={`${typography.text.caption} ${colors.textSecondary} uppercase font-bold tracking-widest`}>{productionModal.productName}</p>
            </div>

            <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <Input
                label="Cantidad a Producir"
                type="number"
                min="1"
                value={productionModal.quantity}
                onChange={e => setProductionModal({ ...productionModal, quantity: parseInt(e.target.value) || 1 })}
                className="h-12 font-bold text-center text-xl bg-white"
              />
              <div className="flex justify-between items-center px-1">
                <span className={`${typography.text.caption} text-slate-500 font-bold uppercase`}>Costo Total Est.</span>
                <span className={`${typography.text.body} font-black text-slate-900 text-lg`}>
                  {formatCurrency(productionModal.cost * productionModal.quantity)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button variant="primary" fullWidth size="lg" className="uppercase font-black tracking-widest" onClick={handleConfirmBatchProduction}>
                CONFIRMAR INGRESO
              </Button>
              <Button variant="ghost" fullWidth className="font-bold text-slate-400" onClick={() => setProductionModal({ ...productionModal, isOpen: false })}>
                CANCELAR
              </Button>
            </div>
          </Card>
        </div>
      )}

      {missingStockModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <Card className={`w-full max-w-xl ${spacing.pLg} ${shadows.xl} border-2 border-red-100 ${colors.bgSurface} space-y-6 animate-in zoom-in-95 duration-200`}>
            <div className="flex items-center gap-4 text-red-600">
              <div className="h-14 w-14 bg-red-50 rounded-3xl flex items-center justify-center">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className={`${typography.text.section} leading-tight`}>Déficit de Inventario</h3>
                <p className={`${typography.text.caption} text-red-400 uppercase font-black tracking-widest`}>ALERTA DE SEGURIDAD</p>
              </div>
            </div>
            <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100">
              <p className={`${typography.text.body} text-red-800 font-medium`}>
                No tienes stock suficiente para este lote. Se registrará una <span className="font-black underline">DEUDA TÉCNICA</span> en tu inventario.
              </p>
            </div>

            {/* List missing items */}
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {missingStockModal.missingItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
                  <div className="min-w-0 flex-1">
                    <p className={`${typography.text.body} font-bold text-slate-700 truncate`}>{item.materialName}</p>
                    <p className={`${typography.text.caption} text-slate-400 font-bold`}>Déficit: {item.missingQuantity.toFixed(2)} {item.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className={`${typography.text.body} font-black text-red-600`}>{formatCurrency(item.totalDebt)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-2">
              <Button variant="ghost" className="flex-1 font-bold text-slate-500" onClick={() => setMissingStockModal({ ...missingStockModal, isOpen: false })}>
                CANCELAR
              </Button>
              <Button variant="danger" className="flex-1 font-black uppercase tracking-wider" onClick={() => {
                consumeStockBatch(missingStockModal.productId, missingStockModal.quantity, missingStockModal.targetPrice).then(() => {
                  const product = products.find(p => p.id === missingStockModal.productId);
                  const baseCost = calculateProductCost(product!, batches, rawMaterials);
                  setMissingStockModal({ ...missingStockModal, isOpen: false });
                  setSuccessModal({ isOpen: true, productName: product?.name || '', cost: baseCost * missingStockModal.quantity, quantity: missingStockModal.quantity });
                });
              }}>
                GENERAR DEUDA
              </Button>
            </div>
          </Card>
        </div>
      )}

      {successModal && successModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-sm p-10 text-center space-y-6 animate-in zoom-in-95 duration-300 border-2 border-emerald-100 bg-white">
            <div className="h-24 w-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 size={56} className="text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h3 className={`${typography.text.section} text-slate-900 font-black`}>¡Éxito!</h3>
              <p className={`${typography.text.body} text-slate-500`}>
                Lote de <span className="font-bold text-slate-900">{successModal.productName}</span> ingresado correctamente.
              </p>
            </div>
            <Button variant="primary" size="lg" fullWidth className="font-black uppercase tracking-widest shadow-emerald-200" style={{ backgroundColor: '#059669', borderColor: '#059669' }} onClick={() => {
              setSuccessModal(null);
              navigate('/productos');
            }}>
              FINALIZAR
            </Button>
          </Card>
        </div>
      )}

      {/* ── MATERIAL SELECTOR MODAL (Shopify Style) ── */}
      {selectorModal.isOpen && (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectorModal({ isOpen: false, forIndex: null })}>
          <Card
            className={`w-full max-w-2xl ${radius.xl} bg-white shadow-2xl border-t sm:border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 max-h-[90vh] flex flex-col`}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h3 className={`${typography.text.section} ${colors.textPrimary}`}>Seleccionar Insumo</h3>
                <p className={`${typography.text.caption} ${colors.textSecondary} uppercase font-bold tracking-wider`}>Inventario de Materias Primas</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectorModal({ isOpen: false, forIndex: null })} className="rounded-full h-10 w-10 p-0 hover:bg-slate-100 text-slate-400">
                <X size={20} />
              </Button>
            </div>

            <div className="p-4 border-b border-slate-50">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  autoFocus
                  type="search"
                  placeholder="Buscar por nombre o descripción..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-slate-900 font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  value={selectorSearch}
                  onChange={e => setSelectorSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-1.5 custom-scrollbar">
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
                          const newMat = {
                            material_id: material.id,
                            quantity: 1,
                            consumption_unit: material.unit,
                            mode: (material.unit === 'metro' ? 'linear' : 'linear') as any,
                            pieces: []
                          };
                          setFormData({ ...formData, materials: [...(formData.materials || []), newMat] });
                        }
                        setSelectorModal({ isOpen: false, forIndex: null });
                      }}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-all text-left border border-transparent hover:border-slate-100 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-11 w-11 rounded-xl flex items-center justify-center transition-colors ${hasStock ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Package size={22} />
                        </div>
                        <div>
                          <p className={`${typography.text.body} font-bold text-slate-900 group-hover:text-indigo-600 transition-colors`}>{material.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`${typography.text.caption} ${colors.textSecondary} uppercase font-bold tracking-tight`}>
                              {totalStock.toFixed(2)} {material.unit}
                            </span>
                            <span className="text-slate-200">|</span>
                            {latestBatch ? (
                              <span className={`${typography.text.caption} text-emerald-600 font-black`}>
                                {formatCurrency(latestBatch.unit_cost || 0)}/und
                              </span>
                            ) : (
                              <span className={`${typography.text.caption} text-slate-400 font-bold`}>Sin costo</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-400 transform group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                })}

              {rawMaterials.filter(m => m.name.toLowerCase().includes(selectorSearch.toLowerCase())).length === 0 && (
                <div className="py-12 text-center">
                  <PackageSearch size={48} className="mx-auto text-slate-200 mb-3" />
                  <p className={`${typography.text.body} text-slate-500 font-medium`}>No se encontraron materiales.</p>
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
