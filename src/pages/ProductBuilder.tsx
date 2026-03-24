import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Search, Info, Layers, TrendingUp, CheckCircle2, X, ChevronRight, AlertTriangle, RotateCcw, Ruler, History, Package, PackageSearch } from 'lucide-react';
import { useStore, calculateProductCost, getFifoBreakdown } from '../store';
import { calculateFinancialMetrics } from '@/core/financialMetricsEngine';
import { getEffectiveQuantity, calculatePiecesAreaM2, getLatestRollWidth, calculatePiecesToLinearMeters } from '@/utils/materialCalculations';
import { InventoryEngineV2, UnitConverter } from '../services/inventoryEngineV2';
import { Product, ProductMaterial, Status, Unit, RawMaterial, MaterialBatch } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
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

interface ProductFormState {
  name: string;
  reference?: string;
  price?: number;
  target_margin: number;
  materials: ProductMaterialUI[];
  status?: Status;
  min_stock?: number | null;
}

interface ProductMaterialUI extends ProductMaterial {
  mode: 'linear' | 'pieces';
  pieces: { length: number; width: number }[];
}

const ProductBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentCompanyId, currentUserRole, products, productMovements, rawMaterials, batches, movements, unitsOfMeasure, addProduct, deleteProduct, discontinueProduct, updateProduct } = useStore();
  const { formatCurrency, currencySymbol } = useCurrency();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedMaterial, setExpandedMaterial] = useState<number | null>(null);
  const materialRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [selectorModal, setSelectorModal] = useState<{ isOpen: boolean; forIndex: number | null }>({ isOpen: false, forIndex: null });
  const [selectorSearch, setSelectorSearch] = useState('');
  const [minStock, setMinStock] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProductFormState>({
    name: '', reference: '', price: 0, target_margin: 30, materials: [], status: 'activa',
  });

  const handleNumberInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',') {
      e.preventDefault();
      const target = e.target as HTMLInputElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      if (start !== null && end !== null) {
        target.value = target.value.substring(0, start) + '.' + target.value.substring(end);
        target.selectionStart = target.selectionEnd = start + 1;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

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
            const pieces = Array(Math.ceil((pm.quantity * width * 100) / (10 * width))).fill({ length: 10, width });
            return { ...pm, pieces };
          }
          return pm;
        });
        setFormData({ ...p, materials: processedMaterials });
        setMinStock(p.min_stock ?? null);
      } else { navigate('/productos'); }
    } else if (!id) {
      setEditingId(null);
      const nextRef = (() => {
        const existingRefs = products.map(p => p.reference || '').filter(r => /^REF-\d+$/i.test(r)).map(r => parseInt(r.replace(/^REF-/i, ''), 10));
        const maxNum = existingRefs.length > 0 ? Math.max(...existingRefs) : 0;
        return `REF-${String(maxNum + 1).padStart(3, '0')}`;
      })();
      const duplicateFrom = (window.history.state?.usr as any)?.duplicateFrom as Product;
      if (duplicateFrom) {
        setFormData({ name: `${duplicateFrom.name} (Copia)`, reference: nextRef, price: duplicateFrom.price ?? 0, target_margin: duplicateFrom.target_margin ?? 30, materials: (duplicateFrom.materials || []) as ProductMaterialUI[], status: 'activa', min_stock: duplicateFrom.min_stock ?? null });
        setMinStock(duplicateFrom.min_stock ?? null);
      } else {
        setFormData({ name: '', reference: nextRef, materials: [], target_margin: 30, price: undefined });
        setMinStock(null);
      }
    }
  }, [id, products, batches, navigate]);

  const totalCurrentCost = useMemo(() => {
    const tempProduct = { ...formData, materials: formData.materials || [] } as Product;
    return calculateProductCost(tempProduct, batches, rawMaterials, unitsOfMeasure);
  }, [formData.materials, batches, rawMaterials]);

  const exactSuggestedPrice = useMemo(() => { const margin = formData.target_margin || 0; if (margin >= 100) return 0; return totalCurrentCost / (1 - margin / 100); }, [totalCurrentCost, formData.target_margin]);
  const commercialSuggestedPrice = useMemo(() => getCommercialPrice(exactSuggestedPrice), [exactSuggestedPrice]);

  const updateMaterial = (idx: number, field: string, value: any) => {
    const materials = [...(formData.materials || [])];
    materials[idx] = { ...materials[idx], [field]: value };
    if (field === 'material_id') {
      const selectedBase = rawMaterials.find(m => m.id === value);
      if (selectedBase) {
        const displayUnit = unitsOfMeasure.find(u => u.id === selectedBase.display_unit_id) || unitsOfMeasure.find(u => u.id === selectedBase.base_unit_id);
        materials[idx].consumption_unit = displayUnit?.symbol ?? selectedBase.unit;
        materials[idx].mode = 'linear';
      }
    }
    setFormData({ ...formData, materials });
  };

  const removeMaterial = (idx: number) => {
    const materials = (formData.materials || []).filter((_: any, i: number) => i !== idx);
    setFormData({ ...formData, materials });
    if (expandedMaterial === idx) setExpandedMaterial(null);
    else if (expandedMaterial !== null && expandedMaterial > idx) setExpandedMaterial(expandedMaterial - 1);
  };

  const addPiece = (idx: number) => { const materials = [...(formData.materials || [])]; const mat = materials[idx]; const rollWidth = getLatestRollWidth(mat.material_id, batches); mat.pieces = [...(mat.pieces || []), { length: 10, width: rollWidth }]; setFormData({ ...formData, materials }); };
  const updatePiece = (matIdx: number, pieceIdx: number, field: 'length' | 'width', value: number) => { const materials = [...(formData.materials || [])]; materials[matIdx].pieces[pieceIdx][field] = value; setFormData({ ...formData, materials }); };
  const removePiece = (matIdx: number, pieceIdx: number) => { const materials = [...(formData.materials || [])]; materials[matIdx].pieces = materials[matIdx].pieces.filter((_: any, i: number) => i !== pieceIdx); setFormData({ ...formData, materials }); };

  const saveProduct = useCallback(async () => {
    if (!currentCompanyId) { alert('Error: No hay una empresa activa.'); return; }
    const errors: string[] = [];
    if (!formData.name?.trim()) errors.push('Nombre del producto');
    if ((formData.materials || []).length === 0) errors.push('Al menos un insumo en la receta');
    if (!formData.price || formData.price <= 0) errors.push('Precio de venta mayor a 0');
    if (errors.length > 0) { alert(`Faltan campos obligatorios:\n\n• ${errors.join('\n• ')}`); return; }
    const processedMaterials = formData.materials.map((pm: any) => {
      if (pm.mode === 'pieces' && pm.pieces) { const rollWidth = getLatestRollWidth(pm.material_id, batches); return { ...pm, quantity: calculatePiecesToLinearMeters(pm.pieces, rollWidth) }; }
      return pm;
    });
    const now = new Date().toISOString();
    const data = { ...formData, materials: processedMaterials, id: editingId || crypto.randomUUID(), company_id: currentCompanyId, status: formData.status || 'activa', min_stock: minStock ?? null, created_at: editingId ? (products.find(p => p.id === editingId)?.created_at) : now, updated_at: now } as Product;
    try {
      if (editingId) { await updateProduct(data); } else { await addProduct(data); }
      navigate('/productos');
    } catch (error: any) { alert(`No se pudo guardar: ${translateError(error)}`); }
  }, [formData, editingId, batches, products, currentCompanyId, updateProduct, addProduct, navigate, minStock]);

  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); await saveProduct(); };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'g') { e.preventDefault(); saveProduct(); }
      if (e.key === 'Escape') { if (selectorModal.isOpen) { setSelectorModal({ isOpen: false, forIndex: null }); } else { navigate('/productos'); } }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [saveProduct, navigate, selectorModal.isOpen]);

  useEffect(() => { document.body.style.overflow = selectorModal.isOpen ? 'hidden' : 'auto'; return () => { document.body.style.overflow = 'auto'; }; }, [selectorModal.isOpen]);

  const metrics = calculateFinancialMetrics(totalCurrentCost, formData.price || 0, (formData.target_margin || 30) / 100, currencySymbol);

  const productionReadiness = useMemo(() => {
    const materials = formData.materials || [];
    if (materials.length === 0) return { ready: false, items: [], hasMaterials: false };
    const items = materials.map((pm: any) => {
      const material = rawMaterials.find(m => m.id === pm.material_id);
      const uom = unitsOfMeasure.find(u => u.symbol === pm.consumption_unit);
      const baseEffectiveQty = getEffectiveQuantity(pm, batches, pm.material_id, uom);
      const availableBatches = batches.filter(b => b.material_id === pm.material_id);
      const totalBaseAvailable = availableBatches.reduce((acc, b) => acc + (b.base_remaining_quantity || 0), 0);
      const baseDeficit = Math.max(0, baseEffectiveQty - totalBaseAvailable);
      const displayDeficit = uom && baseDeficit > 0 ? UnitConverter.fromBase(baseDeficit, uom) : baseDeficit;
      return { name: material?.name || 'Desconocido', unit: material?.unit || '', required: getEffectiveQuantity(pm, batches, pm.material_id), available: totalBaseAvailable, deficit: displayDeficit, isCovered: baseDeficit <= 0.0001 };
    });
    return { ready: items.every(i => i.isCovered), items, hasMaterials: true };
  }, [formData.materials, batches, rawMaterials, unitsOfMeasure]);

  const primaryActionLabel = editingId ? 'Guardar Cambios' : 'Crear Producto';

  return (
    <PageContainer>
      {/* Responsive breakpoints inline */}
      <style>{`
        .pb-price-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-12); }
        .pb-pieces-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-12); }
        .pb-main-layout { display: flex; flex-direction: column; gap: var(--space-24); align-items: flex-start; }
        .pb-sidebar { width: 100%; }
        @media (min-width: 48rem) {
          .pb-price-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .pb-pieces-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (min-width: 64rem) {
          .pb-main-layout { flex-direction: row; }
          .pb-sidebar { width: 22rem; flex-shrink: 0; }
        }
      `}</style>

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-12) var(--space-24)', background: 'var(--surface-card)', borderBottom: 'var(--border-default)', boxShadow: 'var(--shadow-sm)', margin: 'calc(-1 * var(--space-24)) calc(-1 * var(--space-24)) var(--space-24)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-16)', flex: 1 }}>
          <Button variant="ghost" size="sm" onClick={() => navigate('/productos')}><ChevronRight style={{ transform: 'rotate(180deg)' }} size={20} /></Button>
          <div>
            <h1 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h1>
            <p className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>BETO OS · CONFIGURACIÓN TÉCNICA</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
          <Button type="button" variant="ghost" onClick={() => navigate('/productos')}>CANCELAR</Button>
          <Button type="button" variant="primary" onClick={saveProduct} icon={<CheckCircle2 size={18} />} disabled={(formData.materials || []).length === 0 || totalCurrentCost <= 0}>
            {editingId ? 'GUARDAR' : 'CREAR'}
          </Button>
        </div>
      </div>

      <div style={{ maxWidth: 'var(--container-xl)', margin: '0 auto' }}>
        <form onSubmit={handleSubmit}>
          <div className="pb-main-layout">

            {/* Left column — forms */}
            <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>

              {/* Sección 1: Información general */}
              <Card>
                <h2 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-24)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)', borderBottom: 'var(--border-default)', paddingBottom: 'var(--space-16)' }}>
                  <Package size={18} style={{ color: 'var(--text-muted)' }} /> 1. Información General
                </h2>
                {/* Responsive: 1 col mobile → 2 cols tablet+ */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: 'var(--space-24)' }}>
                  <Input label="Nombre Comercial" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Bolso de Mano Primavera" required />
                  <Input label="Referencia / SKU" value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} placeholder="REF-001" />
                </div>
              </Card>

              {/* Sección 2: Receta */}
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-24)', borderBottom: 'var(--border-default)', paddingBottom: 'var(--space-16)', flexWrap: 'wrap', gap: 'var(--space-12)' }}>
                  <h2 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                    <RotateCcw size={18} style={{ color: 'var(--text-muted)' }} /> 2. Receta de Producción
                  </h2>
                  <Button type="button" variant="secondary" onClick={() => { setSelectorModal({ isOpen: true, forIndex: null }); setSelectorSearch(''); }} icon={<Plus size={16} />}>
                    NUEVO INSUMO
                  </Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                  {(formData.materials || []).length === 0 && (
                    <div style={{ padding: 'var(--space-32)', textAlign: 'center', borderRadius: 'var(--radius-xl)', border: '2px dashed var(--border-color-default)', color: 'var(--text-muted)' }}>
                      <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-12)' }}>
                        <PackageSearch size={24} style={{ color: 'var(--text-muted)' }} />
                      </div>
                      Aún no hay materias primas asignadas.<br />Añade materiales para armar tu receta.
                    </div>
                  )}

                  {(formData.materials || []).map((pm: any, idx: number) => {
                    const material = rawMaterials.find(m => m.id === pm.material_id);
                    const isFabric = material?.unit === 'metro';
                    const rollWidth = getLatestRollWidth(pm.material_id, batches);
                    let effectiveQty = pm.quantity;
                    let areaM2 = 0;
                    if (pm.mode === 'pieces' && pm.pieces) { areaM2 = calculatePiecesAreaM2(pm.pieces); effectiveQty = calculatePiecesToLinearMeters(pm.pieces, rollWidth); }
                    else if (isFabric) { areaM2 = pm.quantity * (rollWidth / 100); }
                    const breakdown = getFifoBreakdown(pm.material_id, effectiveQty, pm.consumption_unit, batches, rawMaterials, unitsOfMeasure);
                    const costRow = breakdown.reduce((acc, item) => acc + item.subtotal, 0);
                    const isExpanded = expandedMaterial === idx;
                    const hasMissingStock = breakdown.some((b: any) => b.is_missing);
                    const mBatches = batches.filter(b => b.material_id === pm.material_id);
                    const totalAvailableBase = mBatches.reduce((acc, b) => acc + (b.base_remaining_quantity || 0), 0);
                    const uomForStock = unitsOfMeasure.find(u => u.symbol === pm.consumption_unit);
                    const displayStock = (uomForStock && totalAvailableBase > 0) ? UnitConverter.fromBase(totalAvailableBase, uomForStock) : totalAvailableBase;

                    return (
                      <div key={idx} ref={el => { materialRefs.current[idx] = el; }} style={{ borderRadius: 'var(--radius-xl)', border: hasMissingStock ? '1px solid var(--border-color-strong)' : 'var(--border-default)', overflow: 'hidden', transition: 'border-color var(--transition-fast)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', background: 'var(--surface-muted)', padding: 'var(--space-12)', borderBottom: isExpanded ? 'var(--border-default)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                            <button type="button" onClick={() => { setSelectorModal({ isOpen: true, forIndex: idx }); setSelectorSearch(''); }}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 'var(--radius-md)', border: 'var(--border-default)', background: 'var(--surface-card)', padding: 'var(--space-8) var(--space-12)', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', minWidth: 0 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{material ? material.name : 'Seleccionar insumo...'}</span>
                              <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            </button>
                            <div style={{ width: '8rem', flexShrink: 0 }}>
                              {pm.mode === 'linear' ? (
                                <div style={{ display: 'flex', alignItems: 'center', border: 'var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', overflow: 'hidden' }}>
                                  <input type="number" step="0.0001" min="0" inputMode="decimal" value={pm.quantity === 0 ? '' : pm.quantity ?? ''}
                                    onChange={e => updateMaterial(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                    onKeyDown={handleNumberInputKeyDown}
                                    style={{ flex: 1, border: 0, background: 'transparent', padding: 'var(--space-8) var(--space-4) var(--space-8) var(--space-12)', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', outline: 'none', fontSize: 'var(--text-body-size)' }} />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', paddingRight: 'var(--space-12)' }}>{pm.consumption_unit}</span>
                                </div>
                              ) : (
                                <div style={{ height: '2.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', border: 'var(--border-default)', background: 'var(--surface-muted)' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{areaM2.toFixed(2)}m²</span>
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-md)', border: 'var(--border-default)', background: 'var(--surface-card)', padding: 'var(--space-4)' }}>
                              <button type="button" onClick={() => setExpandedMaterial(isExpanded ? null : idx)}
                                style={{ borderRadius: 'var(--radius-sm)', padding: 'var(--space-6)', background: isExpanded ? 'var(--surface-primary-soft)' : 'transparent', color: isExpanded ? 'var(--state-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'background var(--transition-fast)' }}>
                                <Info size={16} />
                              </button>
                              <button type="button" onClick={() => removeMaterial(idx)}
                                style={{ borderRadius: 'var(--radius-sm)', padding: 'var(--space-6)', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'background var(--transition-fast)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: hasMissingStock ? 'var(--text-muted)' : 'var(--text-primary)', flexShrink: 0 }}>
                              {formatCurrency(costRow)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-8)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', gap: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: 'var(--border-default)', background: 'var(--surface-card)', padding: 'var(--space-2)', fontSize: 'var(--text-caption-size)', textTransform: 'uppercase' }}>
                                {isFabric ? (
                                  <>
                                    <button type="button" onClick={() => updateMaterial(idx, 'mode', 'linear')} style={{ borderRadius: '3px', padding: '2px var(--space-8)', fontWeight: 700, border: 'none', cursor: 'pointer', background: pm.mode === 'linear' ? 'var(--surface-primary-soft)' : 'transparent', color: pm.mode === 'linear' ? 'var(--state-primary)' : 'var(--text-muted)', transition: 'background var(--transition-fast)' }}>Lin</button>
                                    <button type="button" onClick={() => updateMaterial(idx, 'mode', 'pieces')} style={{ borderRadius: '3px', padding: '2px var(--space-8)', fontWeight: 700, border: 'none', cursor: 'pointer', background: pm.mode === 'pieces' ? 'var(--surface-primary-soft)' : 'transparent', color: pm.mode === 'pieces' ? 'var(--state-primary)' : 'var(--text-muted)', transition: 'background var(--transition-fast)' }}>Pzas</button>
                                  </>
                                ) : (
                                  unitsOfMeasure.filter(u => u.category_id === material?.category_id).sort((a, b) => b.conversion_factor - a.conversion_factor).map(u => (
                                    <button key={u.id} type="button" onClick={() => updateMaterial(idx, 'consumption_unit', u.symbol)} style={{ borderRadius: '3px', padding: '2px var(--space-8)', fontWeight: pm.consumption_unit === u.symbol ? 700 : 400, border: 'none', cursor: 'pointer', background: pm.consumption_unit === u.symbol ? 'var(--surface-primary-soft)' : 'transparent', color: pm.consumption_unit === u.symbol ? 'var(--state-primary)' : 'var(--text-muted)', transition: 'background var(--transition-fast)' }}>{u.symbol}</button>
                                  ))
                                )}
                              </div>
                              <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: totalAvailableBase > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                Stock: {displayStock.toFixed(2)} {pm.consumption_unit}
                              </span>
                            </div>
                            {hasMissingStock && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--surface-muted)', padding: '2px var(--space-8)', borderRadius: 'var(--radius-xs)' }}>
                                <AlertTriangle size={10} /> Falta Stock
                              </span>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ background: 'var(--surface-card)', padding: 'var(--space-24)', display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
                            {/* FIFO table — scroll horizontal en móvil */}
                            <div>
                              <h5 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 'var(--space-12)' }}>
                                <History size={14} /> Asignación Lotes (FIFO)
                              </h5>
                              <div style={{ overflowX: 'auto', border: 'var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
                                <table style={{ width: '100%', minWidth: '28rem', fontSize: 'var(--text-caption-size)', borderCollapse: 'separate', borderSpacing: 0 }}>
                                  <thead>
                                    <tr style={{ background: 'var(--surface-muted)', borderBottom: 'var(--border-default)' }}>
                                      {['Lote', 'Volumen', 'Costo Und.', 'Parcial'].map((h, i) => (
                                        <th key={h} style={{ padding: 'var(--space-8) var(--space-16)', fontWeight: 700, color: 'var(--text-secondary)', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {breakdown.length > 0 ? breakdown.map((b: any, i) => (
                                      <tr key={i} style={{ borderTop: i > 0 ? 'var(--border-default)' : 'none', color: b.is_missing ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                        <td style={{ padding: 'var(--space-8) var(--space-16)' }}>{b.is_missing ? 'Sobreconsumo' : `Lote ${new Date(b.date).toLocaleDateString()}`}</td>
                                        <td style={{ padding: 'var(--space-8) var(--space-16)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{(b.quantity_used || 0).toFixed(4)}</td>
                                        <td style={{ padding: 'var(--space-8) var(--space-16)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(b.unit_cost, 4)}</td>
                                        <td style={{ padding: 'var(--space-8) var(--space-16)', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(b.subtotal)}</td>
                                      </tr>
                                    )) : null}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {pm.mode === 'pieces' && (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-16)', flexWrap: 'wrap', gap: 'var(--space-8)' }}>
                                  <h5 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                    <Ruler size={14} /> Trazado de Piezas
                                  </h5>
                                  <Button variant="secondary" size="sm" onClick={() => addPiece(idx)}>Añadir Pieza</Button>
                                </div>
                                {/* Responsive: 2 cols mobile → 3 cols tablet+ */}
                                <div className="pb-pieces-grid">
                                  {(pm.pieces || []).map((piece: any, pIdx: number) => (
                                    <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', border: 'var(--border-default)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-muted)', padding: 'var(--space-8)' }}>
                                      <div style={{ flex: 1 }}>
                                        <label className="text-small text-muted" style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', marginBottom: 'var(--space-4)' }}>Largo</label>
                                        <input type="number" step="0.1" inputMode="decimal" value={piece.length}
                                          onChange={e => updatePiece(idx, pIdx, 'length', parseFloat(e.target.value) || 0)} onKeyDown={handleNumberInputKeyDown}
                                          style={{ width: '100%', border: 'var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', padding: 'var(--space-4) var(--space-8)', fontWeight: 700, outline: 'none' }} />
                                      </div>
                                      <span style={{ marginTop: 'var(--space-16)', color: 'var(--text-muted)' }}>×</span>
                                      <div style={{ flex: 1 }}>
                                        <label className="text-small text-muted" style={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', marginBottom: 'var(--space-4)' }}>Ancho</label>
                                        <input type="number" step="0.1" inputMode="decimal" value={piece.width}
                                          onChange={e => updatePiece(idx, pIdx, 'width', parseFloat(e.target.value) || 0)} onKeyDown={handleNumberInputKeyDown}
                                          style={{ width: '100%', border: 'var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', padding: 'var(--space-4) var(--space-8)', fontWeight: 700, outline: 'none' }} />
                                      </div>
                                      <button type="button" onClick={() => removePiece(idx, pIdx)} style={{ marginTop: 'var(--space-16)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
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

                  {/* Inline add — always visible after last material */}
                  <button type="button"
                    onClick={() => { setSelectorModal({ isOpen: true, forIndex: null }); setSelectorSearch(''); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', padding: 'var(--space-16)', borderRadius: 'var(--radius-xl)', border: '2px dashed var(--border-color-default)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-small-size)', cursor: 'pointer', transition: 'border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-color-primary)'; e.currentTarget.style.color = 'var(--state-primary)'; e.currentTarget.style.background = 'var(--surface-primary-soft)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color-default)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                    <Plus size={16} /> Agregar otro insumo
                  </button>
                </div>
              </Card>

              {/* Sección 3: Precios */}
              <Card>
                <h2 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 600, marginBottom: 'var(--space-16)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                  <TrendingUp size={18} style={{ color: 'var(--text-muted)' }} /> 3. Configuración de Precios
                </h2>

                {(formData.materials || []).length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-32)', textAlign: 'center', borderRadius: 'var(--radius-xl)', border: '2px dashed var(--border-color-default)', background: 'var(--surface-page)' }}>
                    <TrendingUp size={28} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-8)' }} />
                    <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-8)' }}>Diseña tu receta primero</h4>
                    <p className="text-small text-muted">El margen y precio ideal dependen de lo que cueste fabricarlo.</p>
                  </div>
                ) : (
                  /* Responsive: 2 cols mobile → 4 cols tablet+ */
                  <div className="pb-price-grid">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                      <label className="text-small text-muted" style={{ fontWeight: 700 }}>Margen Objetivo (%)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-page)', padding: 'var(--space-10) var(--space-12)', transition: 'border-color var(--transition-fast)' }}
                        onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--border-color-primary)')}
                        onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border-color-default)')}>
                        <input type="number" step="0.1" min="0" max="100" inputMode="decimal"
                          value={formData.target_margin === 0 ? '' : formData.target_margin ?? ''}
                          onChange={e => setFormData({ ...formData, target_margin: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                          onKeyDown={handleNumberInputKeyDown}
                          style={{ flex: 1, textAlign: 'right', fontWeight: 700, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)' }} />
                        <span style={{ fontSize: 'var(--text-small-size)', fontWeight: 700, color: 'var(--text-muted)' }}>%</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                      <label className="text-small text-muted" style={{ fontWeight: 700 }}>Precio Final</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 'var(--space-16)', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-secondary)' }}>{currencySymbol}</span>
                        <input type="number" step="0.01" inputMode="decimal"
                          value={formData.price === 0 ? '' : formData.price ?? ''}
                          onChange={e => setFormData({ ...formData, price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                          onKeyDown={handleNumberInputKeyDown}
                          className="input" style={{ paddingLeft: 'var(--space-32)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
                      </div>
                    </div>
                    <button type="button" onClick={() => setFormData({ ...formData, price: exactSuggestedPrice })}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', background: 'var(--surface-card)', padding: 'var(--space-10) var(--space-8)', cursor: 'pointer', transition: 'border-color var(--transition-fast), background var(--transition-fast)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-color-strong)'; e.currentTarget.style.background = 'var(--surface-page)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color-default)'; e.currentTarget.style.background = 'var(--surface-card)'; }}>
                      <span className="text-small text-muted">Exacto</span>
                      <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{formatCurrency(exactSuggestedPrice)}</span>
                    </button>
                    <button type="button" onClick={() => setFormData({ ...formData, price: commercialSuggestedPrice })}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', background: 'var(--surface-page)', padding: 'var(--space-10) var(--space-8)', cursor: 'pointer', transition: 'border-color var(--transition-fast)' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-color-strong)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color-default)')}>
                      <span className="text-small text-muted">Redondeo</span>
                      <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{formatCurrency(commercialSuggestedPrice)}</span>
                    </button>
                  </div>
                )}

                {/* Stock mínimo */}
                <div style={{ marginTop: 'var(--space-32)', borderTop: 'var(--border-default)', paddingTop: 'var(--space-32)' }}>
                  <div style={{ maxWidth: '20rem' }}>
                    <label style={{ display: 'block', fontSize: 'var(--text-small-size)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-8)' }}>
                      Stock Mínimo <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(opcional)</span>
                    </label>
                    <input type="number" min={0} value={minStock ?? ''} onChange={e => setMinStock(e.target.value === '' ? null : Number(e.target.value))} placeholder="Ej: 10" className="input" />
                    <p className="text-small text-muted" style={{ marginTop: 'var(--space-8)' }}>
                      Cuando el stock disponible caiga por debajo de este número, el sistema mostrará una alerta.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right column — sidebar resumen */}
            <div className="pb-sidebar">
              <Card style={{ position: 'sticky', top: 'var(--space-64)' }}>
                <h2 className="text-small text-muted" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 'var(--space-24)' }}>
                  <Layers size={14} style={{ color: 'var(--text-muted)' }} /> Resumen Comercial
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
                  <div className="inset-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="text-small text-muted" style={{ fontWeight: 700 }}>Costo Base (FIFO)</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(totalCurrentCost)}</span>
                  </div>
                  {totalCurrentCost > 0 && !!formData.price && formData.price > 0 ? (
                    <>
                      <div className="inset-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="text-small text-muted" style={{ fontWeight: 700 }}>Margen real</span>
                        <span style={{ fontWeight: 700, color: metrics.priceState === 'loss' ? 'var(--state-danger)' : metrics.priceState === 'warning' ? 'var(--text-muted)' : 'var(--state-success)' }}>
                          {metrics.marginDisplay}
                        </span>
                      </div>
                      <div className="inset-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="text-small text-muted" style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>Precio Final</span>
                        <span style={{ fontSize: 'var(--text-display-size)', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                          {formatCurrency(formData.price || 0)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="inset-card" style={{ textAlign: 'center' }}>
                      <span className="text-small text-muted">Faltan datos para calcular rentabilidad.</span>
                    </div>
                  )}
                  <Button type="button" variant="primary" style={{ width: '100%' }} onClick={saveProduct} icon={<CheckCircle2 size={20} />}
                    disabled={(formData.materials || []).length === 0 || totalCurrentCost <= 0}>
                    {primaryActionLabel}
                  </Button>
                </div>
              </Card>

              {productionReadiness.hasMaterials && (
                <Card style={{ marginTop: 'var(--space-16)', background: productionReadiness.ready ? 'var(--surface-success-soft)' : 'var(--surface-danger-soft)', borderColor: productionReadiness.ready ? 'var(--border-color-success)' : 'var(--border-color-danger)' }}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: productionReadiness.ready ? 'var(--state-success)' : 'var(--state-danger)', marginBottom: 'var(--space-12)' }}>
                    {productionReadiness.ready ? <><CheckCircle2 size={14} /> Listo para Producir</> : <><AlertTriangle size={14} /> Stock Insuficiente</>}
                  </h2>
                  {productionReadiness.ready ? (
                    <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 500, color: 'var(--state-success)' }}>Todos los insumos tienen stock suficiente.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
                      {productionReadiness.items.filter(i => !i.isCovered).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-8)', borderRadius: 'var(--radius-lg)', border: 'var(--border-color-danger)', background: 'var(--surface-card)', padding: 'var(--space-10) var(--space-12)', boxShadow: 'var(--shadow-sm)' }}>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--state-danger)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                            <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 500, color: 'var(--state-danger)' }}>Déficit: {item.deficit.toFixed(2)} {item.unit}</span>
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

      {/* Material Selector Modal */}
      {selectorModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectorModal({ isOpen: false, forIndex: null })}>
          <Card style={{ width: '100%', maxWidth: '42rem', borderRadius: 'var(--radius-2xl)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-16) var(--space-24)', borderBottom: 'var(--border-default)', background: 'var(--surface-card)', borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Seleccionar Insumo</h3>
                <p className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Inventario de Materias Primas</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectorModal({ isOpen: false, forIndex: null })}><X size={20} /></Button>
            </div>
            <div style={{ padding: 'var(--space-16)', borderBottom: 'var(--border-default)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: 'var(--space-12)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input autoFocus type="search" placeholder="Buscar por nombre o descripción..." className="input" style={{ paddingLeft: 'var(--space-40)' }} value={selectorSearch} onChange={e => setSelectorSearch(e.target.value)} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-8)' }}>
              {rawMaterials.filter(m => m.name.toLowerCase().includes(selectorSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map(material => {
                const mBatches = batches.filter(b => b.material_id === material.id);
                const totalStock = mBatches.reduce((acc, b) => acc + (b.remaining_quantity || 0), 0);
                const latestBatch = mBatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                const hasStock = totalStock > 0;
                return (
                  <button key={material.id}
                    onClick={() => {
                      if (selectorModal.forIndex !== null) { updateMaterial(selectorModal.forIndex, 'material_id', material.id); }
                      else {
                        const displayUnit = unitsOfMeasure.find(u => u.id === material.display_unit_id) || unitsOfMeasure.find(u => u.id === material.base_unit_id);
                        const consumptionUnit = displayUnit?.symbol ?? material.unit;
                        setFormData(prev => {
                          const newMaterials = [...(prev.materials || []), { material_id: material.id, quantity: 1, consumption_unit: consumptionUnit, mode: 'linear' as any, pieces: [] }];
                          const newIndex = newMaterials.length - 1;
                          setExpandedMaterial(newIndex);
                          setTimeout(() => {
                            materialRefs.current[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            const qtyInput = materialRefs.current[newIndex]?.querySelector('input[type="number"]') as HTMLInputElement | null;
                            qtyInput?.focus();
                          }, 100);
                          return { ...prev, materials: newMaterials };
                        });
                      }
                      setSelectorModal({ isOpen: false, forIndex: null });
                    }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 'var(--radius-lg)', border: '1px solid transparent', padding: 'var(--space-12) var(--space-16)', textAlign: 'left', background: 'transparent', cursor: 'pointer', transition: 'background var(--transition-fast), border-color var(--transition-fast)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-page)'; e.currentTarget.style.borderColor = 'var(--border-color-default)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                      <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: 'var(--radius-lg)', background: hasStock ? 'var(--surface-primary-soft)' : 'var(--surface-muted)', color: hasStock ? 'var(--state-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background var(--transition-fast)' }}>
                        <Package size={22} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{material.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', marginTop: 'var(--space-2)' }}>
                          <span className="text-small text-muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>{totalStock.toFixed(2)} {material.unit}</span>
                          {latestBatch && <><span style={{ color: 'var(--border-color-default)' }}>|</span><span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 900, color: 'var(--state-success)' }}>{formatCurrency(latestBatch.unit_cost || 0)}/und</span></>}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                  </button>
                );
              })}
              {rawMaterials.filter(m => m.name.toLowerCase().includes(selectorSearch.toLowerCase())).length === 0 && (
                <div style={{ padding: 'var(--space-48)', textAlign: 'center' }}>
                  <PackageSearch size={48} style={{ margin: '0 auto var(--space-12)', color: 'var(--border-color-default)' }} />
                  <p style={{ fontWeight: 500, color: 'var(--text-muted)' }}>No se encontraron materiales.</p>
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