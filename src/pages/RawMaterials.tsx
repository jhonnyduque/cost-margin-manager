import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2, Search, X, History, ShoppingCart, ArrowDownToLine, Printer, Pencil, AlertCircle, Maximize2, Scissors, RotateCcw, Package, Archive, MoreVertical } from 'lucide-react';
import { useStore, getMaterialDebt, calculateTotalFinancialDebt } from '../store';
import { RawMaterial, Unit, MaterialBatch, UnitOfMeasure } from '@/types';
import { UnitConverter } from '../services/inventoryEngineV2';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { colors, typography, spacing, radius, shadows } from '@/design/design-tokens';
import { useCurrency } from '@/hooks/useCurrency';
import { Badge } from '@/components/ui/Badge';
import { translateError } from '@/utils/errorHandler';
import { calculateBatchArea } from '@/utils/materialCalculations';
import { PageContainer, SectionBlock } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';

const RawMaterials: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentCompanyId, currentUserRole,
    rawMaterials, products, batches, movements,
    uomCategories, unitsOfMeasure, materialTypes,
    addRawMaterial, deleteRawMaterial, archiveMaterial, updateRawMaterial,
    addBatch, deleteBatch, updateBatch, loadUomMetadata
  } = useStore();
  const { formatCurrency, currencySymbol } = useCurrency();

  const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
  const canCreate = allowedRoles.includes((currentUserRole as string) || '');
  const canEdit = allowedRoles.includes((currentUserRole as string) || '');
  const canDelete = allowedRoles.includes((currentUserRole as string) || '');

  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entry_mode, set_entry_mode] = useState<'rollo' | 'pieza'>('rollo');
  const [isSaving, setIsSaving] = useState(false);
  const [editingBatchData, setEditingBatchData] = useState<MaterialBatch | null>(null);
  const [formData, setFormData] = useState<any>({
    name: '', description: '', type: 'Tela',
    category_id: '', base_unit_id: '', purchase_unit_id: '', display_unit_id: '',
    provider: '', status: 'activa', initialQty: 0, unitCost: 0, totalCost: 0, width: 140
  });
  const [batchFormData, setBatchFormData] = useState<Partial<MaterialBatch>>({
    date: new Date().toISOString().split('T')[0],
    provider: '', initial_quantity: 0, unit_cost: 0, total_cost: 0, reference: '', width: 140, length: 0,
    received_unit_id: ''
  });
  const [menuState, setMenuState] = useState<{ materialId: string; rect: DOMRect } | null>(null);
  const [batchMenuState, setBatchMenuState] = useState<{ batchId: string; rect: DOMRect } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const batchMenuRef = useRef<HTMLDivElement>(null);

  // ── Click outside closes kebab menu ──
  React.useEffect(() => {
    if (!menuState && !batchMenuState) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-kebab-trigger]')) return;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuState(null);
      if (batchMenuRef.current && !batchMenuRef.current.contains(target)) setBatchMenuState(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuState, batchMenuState]);

  useEffect(() => {
    loadUomMetadata();
  }, [loadUomMetadata]);

  const openMenu = (materialId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuState?.materialId === materialId) {
      setMenuState(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuState({ materialId, rect });
  };

  const openBatchMenu = (batchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (batchMenuState?.batchId === batchId) {
      setBatchMenuState(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setBatchMenuState({ batchId, rect });
  };

  const filteredMaterials = rawMaterials.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.provider.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(m => {
    if (unitFilter === 'todos') return true;
    return m.unit === unitFilter;
  });

  const getBatchStats = (materialId: string) => {
    const matBatches = batches.filter(b => b.material_id === materialId);

    // v2 Prioritization: If base quantities exist, use them for everything.
    const totalOriginalQty = matBatches.reduce((acc, b) => acc + ((b as any).base_initial_quantity ?? b.initial_quantity ?? 0), 0);
    let totalRemainingQty = matBatches.reduce((acc, b) => acc + ((b as any).base_remaining_quantity ?? b.remaining_quantity ?? 0), 0);

    const debt = getMaterialDebt(materialId, movements).pendingQty;
    totalRemainingQty -= debt;

    const totalValue = matBatches.reduce((acc, b) => {
      const qty = (b as any).base_initial_quantity ?? b.initial_quantity ?? 0;
      const cost = (b as any).cost_per_base_unit ?? b.unit_cost ?? 0;
      return acc + (qty * cost);
    }, 0);

    const weightedAvgCost = totalOriginalQty > 0 ? totalValue / totalOriginalQty : 0;
    const totalArea = matBatches.reduce((acc, b) => acc + (b.area || 0), 0);
    const avgCostPerM2 = totalArea > 0 ? totalValue / totalArea : 0;

    return { totalOriginalQty, totalRemainingQty, totalValue, weightedAvgCost, totalArea, avgCostPerM2 };
  };

  // Memoizar stats por material — evita recalcular O(n²) en cada render
  const batchStatsByMaterial = useMemo(() => {
    return Object.fromEntries(rawMaterials.map(m => [m.id, getBatchStats(m.id)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMaterials, batches, movements]);

  const totalFinancialDebt = useMemo(() => {
    return calculateTotalFinancialDebt(movements, rawMaterials);
  }, [movements, rawMaterials]);

  const handleMasterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard — no escribir sin tenant activo
    if (!currentCompanyId) {
      alert('Error: No hay una empresa activa. Por favor recarga la sesión.');
      return;
    }

    setIsSaving(true);
    const now = new Date().toISOString();
    const materialId = editingId || crypto.randomUUID();

    // Audit trail (created_by/updated_by) gestionado internamente por el store.
    const materialData: RawMaterial = {
      id: materialId,
      name: formData.name,
      description: formData.description,
      type: formData.type,
      category_id: formData.category_id,
      base_unit_id: formData.base_unit_id,
      purchase_unit_id: formData.purchase_unit_id,
      display_unit_id: formData.display_unit_id,
      provider: formData.provider,
      status: formData.status,
      company_id: currentCompanyId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      unit: unitsOfMeasure.find(u => u.id === formData.purchase_unit_id)?.symbol || formData.unit,
    } as RawMaterial;

    try {
      if (editingId) {
        await updateRawMaterial(materialData);
      } else {
        await addRawMaterial(materialData);
        if (formData.initialQty > 0) {
          const area = calculateBatchArea('rollo', {
            initial_quantity: formData.initialQty,
            width: formData.width || 0,
          });
          const purchaseUom = unitsOfMeasure.find(u => u.id === formData.purchase_unit_id);
          const baseUom = unitsOfMeasure.find(u => u.id === formData.base_unit_id);

          // Ensure we use the best available factor
          const factor = purchaseUom?.conversion_factor || 1;
          const baseQty = formData.initialQty * factor;
          const costPerBase = factor > 0 ? (formData.unitCost / factor) : formData.unitCost;



          const batch: MaterialBatch = {
            id: crypto.randomUUID(),
            material_id: materialId,
            date: now.split('T')[0],
            provider: formData.provider || 'Carga Inicial',
            initial_quantity: formData.initialQty,
            remaining_quantity: formData.initialQty,
            unit_cost: formData.unitCost,
            received_unit_id: formData.purchase_unit_id,
            // v2 base fields
            base_initial_quantity: baseQty,
            base_remaining_quantity: baseQty,
            cost_per_base_unit: costPerBase,
            reference: 'Carga Inicial',
            width: formData.width,
            length: 0,
            area: area,
            entry_mode: 'rollo',
            company_id: currentCompanyId,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            created_by: '', // Auto-handled by store
            updated_by: '', // Auto-handled by store
          } as MaterialBatch;
          await addBatch(batch);
        }
      }
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error: any) {
      console.error('Error saving material:', error);
      alert(`Hubo un error al guardar: ${translateError(error)} `);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedMaterialId) return;

    // Guard — no escribir sin tenant activo
    if (!currentCompanyId) {
      alert('Error: No hay una empresa activa. Por favor recarga la sesión.');
      return;
    }

    setIsSaving(true);

    try {
      const material = rawMaterials.find(m => m.id === expandedMaterialId);
      const isDimensional = (material?.type === 'Tela') && (material?.unit === 'metro' || material?.unit === 'cm');
      let finalQty = batchFormData.initial_quantity || 0;
      let finalUnitCost = batchFormData.unit_cost || 0;
      let area = 0;

      if (!isDimensional) {
        finalQty = batchFormData.initial_quantity || 0;
        finalUnitCost = batchFormData.unit_cost || 0;
        area = 0;
      } else if (entry_mode === 'rollo') {
        area = calculateBatchArea('rollo', {
          initial_quantity: batchFormData.initial_quantity || 0,
          width: batchFormData.width || 0,
        });
        finalUnitCost = batchFormData.unit_cost || 0;
      } else {
        area = calculateBatchArea('pieza', {
          length: batchFormData.length || 0,
          width: batchFormData.width || 0,
        });
        finalQty = (batchFormData.length || 0) / 100;
        finalUnitCost = finalQty > 0 ? (batchFormData.unit_cost || 0) / finalQty : 0;
      }

      const unitId = batchFormData.received_unit_id || material?.purchase_unit_id || material?.base_unit_id;
      const purchaseUom = unitsOfMeasure.find(u => u.id === unitId);
      const factor = purchaseUom?.conversion_factor || 1;
      const baseQty = finalQty * factor;
      const costPerBase = factor > 0 ? (finalUnitCost / factor) : finalUnitCost;



      // Audit trail gestionado internamente por el store (addBatch llama getActorId).
      const data: MaterialBatch = {
        ...batchFormData,
        id: crypto.randomUUID(),
        material_id: expandedMaterialId,
        initial_quantity: finalQty,
        remaining_quantity: finalQty,
        unit_cost: finalUnitCost,
        received_unit_id: unitId,
        // v2 base fields
        base_initial_quantity: baseQty,
        base_remaining_quantity: baseQty,
        cost_per_base_unit: costPerBase,
        area: area,
        entry_mode: entry_mode,
        company_id: currentCompanyId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as MaterialBatch;

      await addBatch(data);

      setBatchFormData({
        date: new Date().toISOString().split('T')[0],
        provider: material?.provider || '',
        initial_quantity: 0, unit_cost: 0, reference: '', width: 140, length: 0
      });
    } catch (error: any) {
      console.error('Error saving batch:', error);
      alert(`No se pudo agregar el ingreso físico: ${translateError(error)} `);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatchData) return;

    // Guard — no escribir sin tenant activo
    if (!currentCompanyId) {
      alert('Error: No hay una empresa activa. Por favor recarga la sesión.');
      return;
    }

    setIsSaving(true);

    try {
      const original = batches.find(b => b.id === editingBatchData.id);

      // Protección FIFO — lote parcialmente consumido: solo metadatos editables
      if (original && original.remaining_quantity < original.initial_quantity) {
        await updateBatch({
          ...editingBatchData,
          initial_quantity: original.initial_quantity,
          remaining_quantity: original.remaining_quantity,
          unit_cost: original.unit_cost,
          area: original.area,
          length: original.length,
          width: original.width,
        });
        setEditingBatchData(null);
        return;
      }

      // Lote intacto: edición completa con recálculo dimensional
      let area = 0;
      let finalQty = editingBatchData.initial_quantity;
      let finalUnitCost = editingBatchData.unit_cost;

      if (editingBatchData.entry_mode === 'rollo') {
        area = calculateBatchArea('rollo', {
          initial_quantity: editingBatchData.initial_quantity,
          width: editingBatchData.width || 0,
        });
        finalUnitCost = editingBatchData.unit_cost;
      } else {
        area = calculateBatchArea('pieza', {
          length: editingBatchData.length || 0,
          width: editingBatchData.width || 0,
        });
        finalQty = (editingBatchData.length || 0) / 100;
        finalUnitCost = (editingBatchData.unit_cost || 0) / finalQty;
      }

      // Audit trail (updated_by) gestionado internamente por el store (updateBatch llama getActorId).
      await updateBatch({
        ...editingBatchData,
        initial_quantity: finalQty,
        unit_cost: finalUnitCost,
        area: area,
        remaining_quantity: finalQty,
      });

      setEditingBatchData(null);
    } catch (error: any) {
      console.error('Error editing batch:', error);
      alert(`Fallo al actualizar el lote: ${translateError(error)} `);
    } finally {
      setIsSaving(false);
    }
  };

  const calculatedArea = useMemo(() => {
    if (entry_mode === 'rollo') {
      return (batchFormData.initial_quantity || 0) * ((batchFormData.width || 0) / 100);
    } else {
      return ((batchFormData.length || 0) * (batchFormData.width || 0)) / 10000;
    }
  }, [entry_mode, batchFormData.initial_quantity, batchFormData.width, batchFormData.length]);

  const calculatedCostPerM2 = useMemo(() => {
    const totalCostInput = batchFormData.unit_cost || 0;
    if (entry_mode === 'rollo') {
      const totalCost = (batchFormData.initial_quantity || 0) * totalCostInput;
      return calculatedArea > 0 ? totalCost / calculatedArea : 0;
    } else {
      return calculatedArea > 0 ? totalCostInput / calculatedArea : 0;
    }
  }, [entry_mode, batchFormData.unit_cost, batchFormData.initial_quantity, calculatedArea]);

  const handlePrint = () => { window.print(); };

  const expandedMaterial = rawMaterials.find(m => m.id === expandedMaterialId);

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
        {/* Responsive Header */}
        <UniversalPageHeader
          title="Materias Primas"
          breadcrumbs={
            <>
              <span>BETO OS</span>
              <span>/</span>
              <span className={colors.textPrimary}>Inventario</span>
            </>
          }
          metadata={[
            <span key="1">Inventario Maestro y Gestión FIFO</span>,
            <span key="2">{rawMaterials.length} insumos registrados</span>
          ]}
          actions={
            canCreate && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => navigate('/productos')}
                  icon={<Package size={16} />}
                >
                  <span className="hidden sm:inline">PRODUCTOS</span>
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ name: '', description: '', type: 'Tela', unit: 'metro', provider: '', status: 'activa', initialQty: 0, unitCost: 0, width: 140 });
                    setIsModalOpen(true);
                  }}
                  icon={<Plus size={16} />}
                >
                  <span className="hidden sm:inline">NUEVO MATERIAL</span>
                </Button>
              </>
            )
          }
        />

        {/* Financial Governance Banner */}
        {totalFinancialDebt > 0 && (
          <div className="mt-6">
            <Card className="bg-rose-50 border-rose-100">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-sm">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h3 className={`${typography.text.body} font-black text-rose-900`}>Deuda de Inventario Detectada</h3>
                    <p className={`${typography.text.caption} text-rose-600 font-bold uppercase tracking-tight`}>
                      Producciones realizadas sin respaldo físico. Regularice para integridad contable.
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end">
                  <span className={`${typography.text.caption} text-rose-500 font-black`}>VALORIZACIÓN ESTIMADA</span>
                  <span className={`${typography.text.title} text-rose-700 font-black`}>{formatCurrency(totalFinancialDebt)}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-slate-100">
          <div className="relative flex-1 min-w-[300px]">
            <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${colors.textMuted}`} />
            <input
              type="text"
              placeholder="Buscar por nombre o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl ${typography.text.body} transition-all focus:ring-2 focus:ring-indigo-500 focus:bg-white`}
            />
          </div>
          <Select
            className="w-48"
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
          >
            <option value="todos">Todas las unidades</option>
            {unitsOfMeasure.map(u => (
              <option key={u.id} value={u.symbol}>{u.name} ({u.symbol})</option>
            ))}
          </Select>
        </div>
      </SectionBlock>

      <div className={`space-y-3 md:hidden`}>
        {filteredMaterials.length === 0 ? (
          <div className={`${radius.xl} border border-dashed ${colors.borderStandard} ${colors.bgSurface} ${spacing.pLg} text-center`}>
            <Package size={48} className={`mx-auto mb-3 ${colors.textMuted}`} />
            <p className={`font-medium ${colors.textSecondary}`}>No hay materias primas registradas.</p>
          </div>
        ) : (
          filteredMaterials.map((m) => {
            const { totalRemainingQty, weightedAvgCost } = batchStatsByMaterial[m.id] ?? getBatchStats(m.id);
            return (
              <div key={m.id} className={`${colors.bgSurface} ${radius.xl} ${spacing.pMd} ${colors.borderStandard} border ${shadows.sm}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className={`${typography.body} font-bold ${colors.textPrimary} truncate`}>{m.name}</h3>
                    <p className={`${typography.caption} ${colors.textSecondary} mt-0.5`}>{m.provider || 'Varios'}</p>
                  </div>
                  <span className={`${typography.text.caption} font-bold uppercase tracking-wider text-slate-400 flex-shrink-0`}>{m.type}</span>
                </div>
                <div className={`grid grid-cols-2 gap-4 mt-4 mb-4 ${radius.lg} ${colors.bgMain} ${spacing.pMd} border ${colors.borderSubtle}`}>
                  <div className="flex flex-col">
                    <span className={`${typography.uiLabel} ${colors.textSecondary}`}>Stock</span>
                    <span className={`${typography.body} font-medium ${totalRemainingQty <= 0 ? colors.statusDanger : colors.textPrimary}`}>
                      {UnitConverter.formatFromBase(
                        totalRemainingQty,
                        unitsOfMeasure.find(u => u.id === m.display_unit_id) ||
                        unitsOfMeasure.find(u => u.id === m.base_unit_id) ||
                        { symbol: m.unit, conversion_factor: 1 } as any
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className={`${typography.uiLabel} ${colors.textSecondary}`}>Costo Prom.</span>
                    <span className={`${typography.body} font-medium ${colors.textPrimary}`}>{formatCurrency(weightedAvgCost)}</span>
                  </div>
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <div className="relative">
                    <button
                      data-kebab-trigger
                      className="rounded-lg p-2 transition-colors hover:bg-slate-100 text-slate-400"
                      onClick={(e) => openMenu(m.id, e)}
                      aria-label="Más opciones"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>
                {expandedMaterialId === m.id && (
                  <div className={`mt-3 pt-3 border-t ${colors.borderSubtle} animate-in fade-in hide-in-from-top-2`}>
                    <div className={`text-center ${typography.caption} ${colors.textSecondary} py-4 ${colors.bgMain} ${radius.xl}`}>
                      Vista detallada de Kardex y Entradas. <br />(Disponible en versión horizontal/Desktop)
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ========== DESKTOP: Table ========== */}
      <div className="hidden md:block">
        <div className={`table-container ${radius.xl} border ${colors.borderStandard} overflow-hidden ${shadows.sm}`}>
          <table className="w-full text-left table-fixed">
            <thead className={`${colors.bgMain} border-b ${colors.borderStandard}`}>
              <tr>
                <th className={`w-[25%] ${spacing.pxLg} py-3 ${typography.uiLabel} ${colors.textSecondary} truncate`}>Materia Prima</th>
                <th className={`w-[12%] ${spacing.pxLg} py-3 ${typography.uiLabel} ${colors.textSecondary} truncate`}>Categoría</th>
                <th className={`w-[18%] ${spacing.pxLg} py-3 ${typography.uiLabel} ${colors.textSecondary} truncate text-right`}>Disponible / Deuda</th>
                <th className={`w-[15%] ${spacing.pxLg} py-3 ${typography.uiLabel} ${colors.textSecondary} truncate text-right`}>Valor en Bodega</th>
                <th className={`w-[15%] ${spacing.pxLg} py-3 ${typography.uiLabel} ${colors.textSecondary} truncate text-right`}>Costo Promedio</th>
                <th className={`w-[10%] ${spacing.pxLg} py-3 ${typography.uiLabel} ${colors.textSecondary} text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredMaterials.map((m) => {
                const { totalRemainingQty, weightedAvgCost } = batchStatsByMaterial[m.id] ?? getBatchStats(m.id);
                const debtInfo = getMaterialDebt(m.id, movements);
                const isDimensional = m.unit === 'metro' || m.unit === 'cm';
                const displayStock = totalRemainingQty;
                const valuation = displayStock * weightedAvgCost;

                return (
                  <React.Fragment key={m.id}>
                    <tr className={`table-row ${expandedMaterialId === m.id ? `${colors.bgMain}/50` : colors.bgSurface}`}>
                      <td className={`${spacing.pxLg} py-3 truncate`}>
                        <div className="flex flex-col" title={`${m.name} - ${m.provider || 'Varios'}`}>
                          <span className={`${typography.body} font-bold ${colors.textPrimary} truncate`} title={m.name}>{m.name}</span>
                          <span className={`${typography.caption} font-medium ${colors.textSecondary} truncate mt-0.5`} title={m.provider || 'Varios'}>{m.provider || 'Varios'}</span>
                        </div>
                      </td>
                      <td className={`${spacing.pxLg} py-3 truncate`}>
                        <span className={`${typography.text.caption} font-bold uppercase tracking-wider text-slate-500`} title={m.type}>{m.type}</span>
                      </td>
                      <td className={`${spacing.pxLg} py-3 truncate text-right`}>
                        <div className="flex justify-end items-center" title={`Stock Actual (Base)`}>
                          <span className={`${typography.text.body} font-bold tabular-nums ${displayStock > 0 ? colors.statusSuccess : displayStock < 0 ? colors.statusDanger : colors.textSecondary}`}>
                            {UnitConverter.formatFromBase(
                              displayStock,
                              unitsOfMeasure.find(u => u.id === (m as any).display_unit_id) ||
                              unitsOfMeasure.find(u => u.id === (m as any).base_unit_id) ||
                              { symbol: m.unit || 'base', conversion_factor: 1 } as any
                            )}
                          </span>
                        </div>
                      </td>
                      <td className={`${spacing.pxLg} py-3 truncate text-right`}>
                        <span className={`${typography.text.body} font-bold tabular-nums ${valuation < 0 ? colors.statusDanger : colors.textPrimary}`} title={`Valorización: ${formatCurrency(valuation)}`}>
                          {formatCurrency(valuation)}
                        </span>
                      </td>
                      <td className={`${spacing.pxLg} py-3 truncate text-right`}>
                        <span className={`${typography.text.body} font-bold tabular-nums ${colors.textSecondary}`} title={`Costo Promedio FIFO: ${formatCurrency(weightedAvgCost)}`}>
                          {formatCurrency(weightedAvgCost)}
                        </span>
                      </td>
                      <td className={`${spacing.pxLg} py-3 text-right`}>
                        <div className="flex justify-end items-center">
                          <button
                            data-kebab-trigger
                            className={`rounded-lg p-2 transition-all border border-transparent ${menuState?.materialId === m.id ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                            onClick={(e) => openMenu(m.id, e)}
                            aria-label="Más opciones"
                          >
                            <MoreVertical size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ACCORDION DESKTOP IN-LINE */}
                    {expandedMaterialId === m.id && (
                      <tr className={`${colors.bgMain} border-b ${colors.borderStandard}`}>
                        <td colSpan={7} className={`${spacing.pxMd} py-6`}>
                          <div className="space-y-6">
                            {/* FORMULARIO DE NUEVA ENTRADA (LOTES) */}
                            <div className={`no-print ${colors.bgSurface} ${radius.xl} ${spacing.pLg} ${shadows.sm}`}>
                              <div className="mb-6 flex items-center justify-between">
                                <h4 className={`flex items-center gap-2 ${typography.uiLabel} text-indigo-700`}>
                                  <ShoppingCart size={16} /> Registrar Nueva Entrada Física
                                </h4>
                                {isDimensional && (
                                  <div className={`flex gap-1 ${radius.xl} border ${colors.borderSubtle} ${colors.bgMain} p-1`}>
                                    <button type="button" onClick={() => set_entry_mode('rollo')} className={`flex items-center gap-1.5 ${radius.lg} ${spacing.pxMd} py-1 ${typography.uiLabel} uppercase transition-all ${entry_mode === 'rollo' ? `${colors.bgBrand} text-white ${shadows.md}` : `${colors.textSecondary} hover:${colors.bgMain}`}`}>
                                      <RotateCcw size={14} /> Rollo
                                    </button>
                                    <button type="button" onClick={() => set_entry_mode('pieza')} className={`flex items-center gap-1.5 ${radius.lg} ${spacing.pxMd} py-1 ${typography.uiLabel} uppercase transition-all ${entry_mode === 'pieza' ? `${colors.bgBrand} text-white ${shadows.md}` : `${colors.textSecondary} hover:${colors.bgMain}`}`}>
                                      <Scissors size={14} /> Pieza
                                    </button>
                                  </div>
                                )}
                              </div>
                              {canCreate && (
                                <form onSubmit={handleBatchSubmit} className="space-y-4">
                                  <div className="flex items-end gap-3 flex-wrap">
                                    <div className="w-32"><Input type="date" label="Fecha" value={batchFormData.date} onChange={e => setBatchFormData({ ...batchFormData, date: e.target.value })} required /></div>
                                    <div className="flex-1 min-w-[150px]"><Input label="Proveedor / Ref." value={batchFormData.provider} onChange={e => setBatchFormData({ ...batchFormData, provider: e.target.value })} /></div>
                                    {isDimensional ? (
                                      <>
                                        {entry_mode === 'rollo' ? (
                                          <>
                                            <div className="w-24"><Input label="M. Lineales" type="number" step="0.01" value={batchFormData.initial_quantity || ''} onChange={e => {
                                              const qty = parseFloat(e.target.value) || 0;
                                              setBatchFormData({ ...batchFormData, initial_quantity: qty, total_cost: qty * (batchFormData.unit_cost || 0) });
                                            }} required /></div>
                                            <div className="w-32"><Input label="Costo / Metro (€)" type="number" step="0.0001" value={batchFormData.unit_cost || ''} onChange={e => {
                                              const unitCost = parseFloat(e.target.value) || 0;
                                              setBatchFormData({ ...batchFormData, unit_cost: unitCost, total_cost: (batchFormData.initial_quantity || 0) * unitCost });
                                            }} required /></div>
                                            <div className="w-32"><Input label="Costo Total (€)" type="number" step="0.01" value={batchFormData.total_cost || ''} onChange={e => {
                                              const total = parseFloat(e.target.value) || 0;
                                              const unitCost = (batchFormData.initial_quantity || 0) > 0 ? total / (batchFormData.initial_quantity || 0) : 0;
                                              setBatchFormData({ ...batchFormData, total_cost: total, unit_cost: unitCost });
                                            }} placeholder="Auto" /></div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="w-24"><Input label={`Largo (${unitsOfMeasure.find(u => u.category_id === (unitsOfMeasure.find(un => un.symbol === 'm')?.category_id))?.symbol === 'cm' ? 'cm' : 'cm'})`} type="number" step="0.01" value={batchFormData.length || ''} onChange={e => setBatchFormData({ ...batchFormData, length: parseFloat(e.target.value) })} required /></div>
                                            <div className="w-32"><Input label="Costo Total (€)" type="number" step="0.01" value={batchFormData.unit_cost || ''} onChange={e => setBatchFormData({ ...batchFormData, unit_cost: parseFloat(e.target.value) })} required /></div>
                                          </>
                                        )}
                                        <div className="w-24"><Input label="Ancho (cm)" type="number" step="1" value={batchFormData.width || ''} onChange={e => setBatchFormData({ ...batchFormData, width: parseInt(e.target.value) })} required className="text-emerald-700 font-bold" /></div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="w-32"><Input label={`Cant. (${unitsOfMeasure.find(u => u.id === m.purchase_unit_id || m.base_unit_id)?.symbol || m.unit || 'un'})`} type="number" step="0.01" value={batchFormData.initial_quantity || ''} onChange={e => {
                                          const qty = parseFloat(e.target.value) || 0;
                                          setBatchFormData({ ...batchFormData, initial_quantity: qty, total_cost: qty * (batchFormData.unit_cost || 0) });
                                        }} required /></div>
                                        <div className="w-32"><Input label="Costo Unit. (€)" type="number" step="0.0001" value={batchFormData.unit_cost || ''} onChange={e => {
                                          const unitCost = parseFloat(e.target.value) || 0;
                                          setBatchFormData({ ...batchFormData, unit_cost: unitCost, total_cost: (batchFormData.initial_quantity || 0) * unitCost });
                                        }} required /></div>
                                        <div className="w-32"><Input label="Costo Factura (€)" type="number" step="0.01" value={batchFormData.total_cost || ''} onChange={e => {
                                          const total = parseFloat(e.target.value) || 0;
                                          const unitCost = (batchFormData.initial_quantity || 0) > 0 ? total / (batchFormData.initial_quantity || 0) : 0;
                                          setBatchFormData({ ...batchFormData, total_cost: total, unit_cost: unitCost });
                                        }} placeholder="Auto" /></div>
                                      </>
                                    )}
                                    <Button type="submit" variant="primary" icon={<Plus size={16} />} className={`mb-0.5 h-10 w-full sm:w-auto ${shadows.md}`}>Añadir Lote</Button>
                                  </div>
                                </form>
                              )}
                            </div>

                            {/* KARDEX SECTION */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className={`${typography.sectionTitle} ${colors.textPrimary}`}>Kardex de Lotes y Movimientos</h4>
                                <Button variant="ghost" size="icon" onClick={handlePrint} className={colors.textSecondary} title="Imprimir"><Printer size={18} /></Button>
                              </div>
                              <div className={`table-container ${shadows.sm} ${colors.bgSurface} ${radius.xl} border ${colors.borderStandard} overflow-hidden`}>
                                <table className="w-full text-left table-fixed min-w-[700px]">
                                  <thead>
                                    <tr className={`${colors.bgMain} border-b ${colors.borderStandard}`}>
                                      <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} ${colors.textSecondary} w-[12%]`}>Fecha</th>
                                      <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} ${colors.textSecondary} w-[10%]`}>Modo</th>
                                      <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} ${colors.textSecondary} w-[18%]`}>Proveedor</th>
                                      <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} ${colors.textSecondary} w-[15%] text-right`}>{isDimensional ? 'Dimensiones' : 'Cantidad Compra'}</th>
                                      {isDimensional && (
                                        <>
                                          <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} ${colors.statusSuccess} w-[10%] text-right`}>Área</th>
                                          <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} text-indigo-600 w-[10%] text-right`}>/m²</th>
                                        </>
                                      )}
                                      <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} ${colors.textSecondary} w-[15%] text-right`}>Costo Total</th>
                                      <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} ${colors.textSecondary} w-[15%] text-right`}>Restante ({unitsOfMeasure.find(u => u.id === m.display_unit_id || m.base_unit_id)?.symbol})</th>
                                      <th className="w-[5%] text-center"></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/50 text-text-primary bg-bg-card">
                                    {batches.filter(b => b.material_id === m.id).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(batch => {
                                      const currentTotalPurchaseCost = isDimensional
                                        ? (batch.entry_mode === 'pieza' ? batch.unit_cost : (batch.unit_cost * batch.initial_quantity))
                                        : (batch.unit_cost * batch.initial_quantity);
                                      const currentCostPerM2 = isDimensional && batch.area && batch.area > 0 ? currentTotalPurchaseCost / batch.area : 0;
                                      return (
                                        <tr key={batch.id} className="group hover:bg-slate-50 transition-colors">
                                          <td className={`${spacing.pxMd} py-2.5 tabular-nums ${typography.text.caption} font-medium`}>
                                            {batch.date.includes('T') ? batch.date.split('T')[0] : batch.date}
                                          </td>
                                          <td className={`${spacing.pxMd} py-2.5`}>
                                            {isDimensional ? (
                                              <span className={`flex w-fit items-center gap-1 flex-shrink-0 ${typography.text.caption} font-bold uppercase tracking-tight ${batch.entry_mode === 'pieza' ? colors.statusWarning : colors.statusSuccess}`}>
                                                {batch.entry_mode === 'pieza' ? <Scissors size={12} /> : <RotateCcw size={12} />}
                                                {batch.entry_mode || 'Rollo'}
                                              </span>
                                            ) : (
                                              <span className={`${typography.text.caption} font-bold uppercase tracking-wider text-slate-400`}>Estándar</span>
                                            )}
                                          </td>
                                          <td className={`${spacing.pxMd} py-2.5 font-medium ${typography.text.caption} truncate`} title={batch.provider}>{batch.provider}</td>
                                          <td className={`${spacing.pxMd} py-2.5 text-right flex flex-col items-end`}>
                                            <span className={`${typography.text.caption} font-medium ${colors.textPrimary} leading-tight`}>
                                              {isDimensional ? (
                                                batch.entry_mode === 'pieza'
                                                  ? `${batch.length} × ${batch.width} cm`
                                                  : `${batch.initial_quantity.toFixed(2)} ${unitsOfMeasure.find(u => u.id === batch.received_unit_id)?.symbol || 'm'}`
                                              ) : (
                                                `${batch.initial_quantity.toFixed(2)} ${unitsOfMeasure.find(u => u.id === batch.received_unit_id)?.symbol || ''}`
                                              )}
                                            </span>
                                            {isDimensional && (
                                              <span className={`${typography.text.caption} font-medium ${colors.textSecondary} leading-tight`}>{batch.width} cm ancho</span>
                                            )}
                                          </td>
                                          {isDimensional && (
                                            <>
                                              <td className={`${spacing.pxMd} py-2.5 text-right tabular-nums ${typography.text.caption} font-medium ${colors.statusSuccess}`}>{batch.area ? `${batch.area.toFixed(2)} m²` : '---'}</td>
                                              <td className={`${spacing.pxMd} py-2.5 text-right tabular-nums ${typography.text.caption} font-medium text-indigo-600`}>{currentCostPerM2 > 0 ? formatCurrency(currentCostPerM2) : '---'}</td>
                                            </>
                                          )}
                                          <td className={`${spacing.pxMd} py-2.5 text-right tabular-nums ${typography.text.caption} font-medium`}>{formatCurrency(currentTotalPurchaseCost)}</td>
                                          <td className={`${spacing.pxMd} py-2.5 text-right`}>
                                            <Badge variant={batch.remaining_quantity > 0 ? 'success' : 'secondary'} className={`${typography.text.caption} tabular-nums`}>
                                              {UnitConverter.formatFromBase(
                                                (batch as any).base_remaining_quantity ?? batch.remaining_quantity,
                                                unitsOfMeasure.find(u => u.id === m.display_unit_id) ||
                                                unitsOfMeasure.find(u => u.id === m.base_unit_id) ||
                                                { symbol: '', conversion_factor: 1 } as any
                                              )}
                                            </Badge>
                                          </td>
                                          <td className="px-4 py-2.5 text-center">
                                            <div className="flex justify-center">
                                              <button
                                                data-kebab-trigger
                                                className={`rounded-lg p-1.5 transition-all border border-transparent ${batchMenuState?.batchId === batch.id ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                                                onClick={(e) => openBatchMenu(batch.id, e)}
                                                aria-label="Más opciones de lote"
                                              >
                                                <MoreVertical size={14} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {/* Totals Row */}
                                    <tr className={`${colors.bgMain} border-t-2 ${colors.borderStandard} font-bold`}>
                                      <td colSpan={3} className={`${spacing.pxMd} py-4 text-right ${typography.text.caption} ${colors.textSecondary}`}>Totales Acumulados</td>
                                      <td className={`${spacing.pxMd} py-4 text-right ${typography.text.body} font-medium ${colors.textSecondary} tabular-nums`}>
                                        {isDimensional ? UnitConverter.format(totalRemainingQty, unitsOfMeasure.find(u => u.id === m.base_unit_id) || { symbol: '' } as any) : '---'}
                                      </td>
                                      {isDimensional && (
                                        <>
                                          <td className={`${spacing.pxMd} py-4 text-right ${typography.text.body} font-medium ${colors.statusSuccess} tabular-nums`}>{batchStatsByMaterial[m.id].totalArea.toFixed(2)} m²</td>
                                          <td className={`${spacing.pxMd} py-4 text-right ${typography.text.body} font-medium text-indigo-600`}>{formatCurrency(batchStatsByMaterial[m.id].avgCostPerM2)}</td>
                                        </>
                                      )}
                                      <td className={`${spacing.pxMd} py-4 text-right ${typography.text.body} font-medium ${colors.textPrimary}`}>{formatCurrency(batchStatsByMaterial[m.id].totalValue)}</td>
                                      <td className={`${spacing.pxMd} py-4 text-right ${typography.text.body} font-medium ${colors.statusSuccess} tabular-nums`}>
                                        {UnitConverter.formatFromBase(
                                          (batchStatsByMaterial[m.id] as any).totalRemainingQty,
                                          unitsOfMeasure.find(u => u.id === m.display_unit_id) ||
                                          unitsOfMeasure.find(u => u.id === m.base_unit_id) ||
                                          { symbol: '', conversion_factor: 1 } as any
                                        )}
                                      </td>
                                      <td></td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL — Nueva / Editar Materia Prima */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}>
          <Card className={`my-4 w-full max-w-xl max-h-[90vh] overflow-y-auto ${spacing.pLg} sm:${spacing.pLg} border ${colors.borderStandard} ${shadows.xl}`}>
            <h3 className={`mb-6 sm:mb-8 ${typography.sectionTitle} ${colors.textPrimary} text-xl sm:text-2xl`}>
              {editingId ? 'Editar' : 'Nueva'} Materia Prima
            </h3>
            <form onSubmit={handleMasterSubmit} className="space-y-4 sm:space-y-5">
              <Input label="Nombre" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Tela de Corazón" required />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Tipo / Categoría" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                  {materialTypes.length > 0 ? (
                    materialTypes.map((t: any) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))
                  ) : (
                    <>
                      <option value="Tela">Tela</option>
                      <option value="Hilo">Hilo</option>
                      <option value="Herrajes">Herrajes</option>
                      <option value="Accesorios">Accesorios</option>
                      <option value="Otros">Otros</option>
                    </>
                  )}
                </Select>
                <Input label="Proveedor" value={formData.provider} onChange={e => setFormData({ ...formData, provider: e.target.value })} placeholder="Ej. Textiles Premium" />
              </div>
              <Input label="Descripción" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Detalles de la materia prima..." />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Categoría Universal"
                  value={formData.category_id}
                  onChange={e => {
                    const catId = e.target.value;
                    const firstUnit = unitsOfMeasure.find(u => u.category_id === catId && u.is_base);
                    setFormData({
                      ...formData,
                      category_id: catId,
                      base_unit_id: firstUnit?.id || '',
                      purchase_unit_id: firstUnit?.id || '',
                      display_unit_id: firstUnit?.id || ''
                    });
                  }}
                  required
                >
                  <option value="">Seleccionar categoría...</option>
                  {uomCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </Select>
                <Select
                  label="Unidad de Compra"
                  value={formData.purchase_unit_id}
                  onChange={e => setFormData({ ...formData, purchase_unit_id: e.target.value })}
                  disabled={!formData.category_id}
                  required
                >
                  {unitsOfMeasure
                    .filter(u => u.category_id === formData.category_id)
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                    ))
                  }
                </Select>
                <Select
                  label="Unidad de Visualización"
                  value={formData.display_unit_id}
                  onChange={e => setFormData({ ...formData, display_unit_id: e.target.value })}
                  disabled={!formData.category_id}
                >
                  <option value="">Igual que compra...</option>
                  {unitsOfMeasure
                    .filter(u => u.category_id === formData.category_id)
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                    ))
                  }
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Costo Unitario (€)</label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={formData.unitCost || ''}
                    onChange={e => {
                      const unitCost = parseFloat(e.target.value) || 0;
                      setFormData({ ...formData, unitCost, totalCost: (formData.initialQty || 0) * unitCost });
                    }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Costo Factura (€)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.totalCost || ''}
                    onChange={e => {
                      const total = parseFloat(e.target.value) || 0;
                      const unitCost = (formData.initialQty || 0) > 0 ? total / (formData.initialQty || 0) : 0;
                      setFormData({ ...formData, totalCost: total, unitCost });
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 items-end">
                {formData.type === 'Tela' ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-emerald-600">Ancho (cm)</label>
                    <Input type="number" step="1" value={formData.width || ''} onChange={e => setFormData({ ...formData, width: parseInt(e.target.value) })} placeholder="140" />
                  </div>
                ) : <div />}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Cantidad Inicial</label>
                  <Input type="number" step="0.01" value={formData.initialQty || ''} onChange={e => {
                    const qty = parseFloat(e.target.value) || 0;
                    setFormData({ ...formData, initialQty: qty, totalCost: qty * (formData.unitCost || 0) });
                  }} placeholder="0" disabled={!!editingId} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Estado</label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: formData.status === 'activa' ? 'inactiva' : 'activa' })}
                    className={`w-full flex items-center justify-center gap-2 ${radius.xl} px-3 py-2.5 ${typography.uiLabel} font-bold transition-all active:scale-95 ${formData.status === 'activa' ? `${colors.bgSuccess} ${colors.statusSuccess} ring-1 ring-emerald-200` : `${colors.bgMain} ${colors.textSecondary} ring-1 ${colors.borderStandard}`}`}
                  >
                    <div className={`size-2.5 rounded-full transition-colors ${formData.status === 'activa' ? 'bg-emerald-500' : colors.textMuted}`} />
                    {formData.status === 'activa' ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" className="flex-1" variant="primary" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar Material'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )
      }

      {/* MODAL — Editar Lote */}
      {
        editingBatchData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
            <Card className={`w-full max-w-md max-h-[90vh] overflow-y-auto ${spacing.pLg} sm:${spacing.pLg} border ${colors.borderStandard} ${shadows.xl}`}>
              <h4 className={`mb-6 flex items-center gap-2 ${typography.sectionTitle} ${colors.textPrimary}`}>
                <Pencil size={20} className="text-indigo-500" /> Editar Registro
              </h4>
              <form onSubmit={handleEditBatchSubmit} className="space-y-4">
                {editingBatchData.remaining_quantity < editingBatchData.initial_quantity && (
                  <div className={`flex items-start gap-3 ${radius.xl} border border-amber-100 bg-amber-50 p-4`}>
                    <AlertCircle size={20} className="mt-0.5 shrink-0 text-amber-500" />
                    <p className={`${typography.bodySm} font-semibold leading-tight text-amber-700`}>
                      ESTE LOTE YA SE HA USADO. La cantidad, costo y dimensiones no son editables para mantener la coherencia FIFO.
                    </p>
                  </div>
                )}
                <Input label="Fecha" type="date" value={editingBatchData.date} onChange={e => setEditingBatchData({ ...editingBatchData, date: e.target.value })} required />
                <Input label="Proveedor / Referencia" value={editingBatchData.provider} onChange={e => setEditingBatchData({ ...editingBatchData, provider: e.target.value })} />
                {editingBatchData.entry_mode === 'pieza' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Largo (cm)" type="number" step="0.01" disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity} value={editingBatchData.length || ''} onChange={e => setEditingBatchData({ ...editingBatchData, length: parseFloat(e.target.value) })} />
                    <Input label="Ancho (cm)" type="number" step="1" disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity} value={editingBatchData.width || ''} onChange={e => setEditingBatchData({ ...editingBatchData, width: parseInt(e.target.value) })} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="M. Lineales" type="number" step="0.01" disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity} value={editingBatchData.initial_quantity} onChange={e => setEditingBatchData({ ...editingBatchData, initial_quantity: parseFloat(e.target.value) })} />
                    <Input label="Ancho (cm)" type="number" step="1" disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity} value={editingBatchData.width || ''} onChange={e => setEditingBatchData({ ...editingBatchData, width: parseInt(e.target.value) })} />
                  </div>
                )}
                <Input
                  label={editingBatchData.entry_mode === 'pieza' ? 'Costo Total (€)' : 'Costo Unitario (€/m)'}
                  type="number" step="0.01"
                  disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity}
                  value={editingBatchData.unit_cost}
                  onChange={e => setEditingBatchData({ ...editingBatchData, unit_cost: parseFloat(e.target.value) })}
                />
                <div className="flex gap-3 pt-4">
                  <Button variant="ghost" className="flex-1" onClick={() => setEditingBatchData(null)}>Cancelar</Button>
                  <Button type="submit" className="flex-1" variant="primary">Guardar</Button>
                </div>
              </form>
            </Card>
          </div>
        )
      }

      {/* ── FIXED KEBAB DROPDOWN (escapes all overflow) ── */}
      {
        menuState && (() => {
          const material = rawMaterials.find(m => m.id === menuState.materialId);
          if (!material) return null;
          const { rect } = menuState;
          const menuHeight = 164;
          const openUpward = rect.bottom + menuHeight > window.innerHeight;
          const style: React.CSSProperties = {
            position: 'fixed',
            right: window.innerWidth - rect.right,
            zIndex: 9999,
            ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
          };

          const stats = batchStatsByMaterial[material.id] ?? getBatchStats(material.id);
          const hasLinkedProducts = products.some(p => (p.materials ?? []).some(pm => pm.material_id === material.id));
          const remainingStock = stats.totalRemainingQty;
          const mustArchive = hasLinkedProducts || remainingStock > 0;
          const archiveReason = hasLinkedProducts ? 'Vinculada a productos activos' : 'Tiene stock físico con valor en libro';

          return (
            <div ref={menuRef} className={`${radius.xl} border ${colors.borderStandard} ${colors.bgSurface} ${shadows.xl} py-1.5 min-w-[180px]`} style={style}>
              <button
                className={`w-full flex items-center gap-2 ${spacing.pxMd} py-1.5 ${typography.uiLabel} font-medium ${expandedMaterialId === material.id ? 'text-indigo-700 bg-indigo-50' : `${colors.textSecondary} hover:${colors.bgMain}`} transition-colors`}
                onClick={() => { setMenuState(null); setExpandedMaterialId(expandedMaterialId === material.id ? null : material.id); }}
              >
                <History size={14} className={colors.textMuted} /> {expandedMaterialId === material.id ? 'Cerrar Detalles' : 'Ver Lotes'}
              </button>
              <div className={`border-t ${colors.borderSubtle} my-1.5`} />

              {canEdit && (
                <button
                  className={`w-full flex items-center gap-2 ${spacing.pxMd} py-1.5 ${typography.uiLabel} font-medium ${colors.textSecondary} hover:${colors.bgMain} transition-colors`}
                  onClick={() => {
                    setMenuState(null);
                    setEditingId(material.id);
                    setFormData({
                      name: material.name,
                      description: material.description || '',
                      type: material.type,
                      category_id: material.category_id || '',
                      base_unit_id: material.base_unit_id || '',
                      purchase_unit_id: material.purchase_unit_id || '',
                      display_unit_id: material.display_unit_id || '',
                      provider: material.provider || '',
                      status: material.status,
                      initialQty: stats.totalRemainingQty,
                      unitCost: stats.weightedAvgCost,
                      totalCost: stats.totalRemainingQty * stats.weightedAvgCost
                    });
                    setIsModalOpen(true);
                  }}
                >
                  <Edit2 size={14} className={colors.textMuted} /> Editar Material
                </button>
              )}

              {canDelete && (
                mustArchive ? (
                  <button
                    className={`w-full flex items-center gap-2 ${spacing.pxMd} py-1.5 ${typography.uiLabel} font-medium ${colors.statusWarning} hover:${colors.bgWarning} transition-colors`}
                    onClick={async () => {
                      setMenuState(null);
                      if (window.confirm(`¿Archivar "${material.name}"? Razón: ${archiveReason}. Quedará inactiva pero el historial se conserva.`)) {
                        try { await archiveMaterial(material.id); }
                        catch (err: any) { alert(`Error: ${translateError(err)}`); }
                      }
                    }}
                  >
                    <Archive size={14} /> Archivar Insumo
                  </button>
                ) : (
                  <button
                    className={`w-full flex items-center gap-2 ${spacing.pxMd} py-1.5 ${typography.uiLabel} font-medium ${colors.statusDanger} hover:${colors.bgDanger} transition-colors`}
                    onClick={async () => {
                      setMenuState(null);
                      if (window.confirm(`¿Eliminar "${material.name}"? Sin stock ni productos vinculados. Esta acción no se puede deshacer.`)) {
                        try { await deleteRawMaterial(material.id); }
                        catch (err: any) { alert(`No se pudo eliminar: ${translateError(err)}`); }
                      }
                    }}
                  >
                    <Trash2 size={14} /> Eliminar Insumo
                  </button>
                )
              )}
            </div>
          );
        })()
      }

      {/* ── FIXED BATCH KEBAB DROPDOWN ── */}
      {
        batchMenuState && (() => {
          const batch = batches.find(b => b.id === batchMenuState.batchId);
          if (!batch) return null;
          const { rect } = batchMenuState;
          const menuHeight = 100;
          const openUpward = rect.bottom + menuHeight > window.innerHeight;
          const style: React.CSSProperties = {
            position: 'fixed',
            right: window.innerWidth - rect.right,
            zIndex: 9999,
            ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
          };

          return (
            <div ref={batchMenuRef} className={`${radius.xl} border ${colors.borderStandard} ${colors.bgSurface} ${shadows.xl} py-1.5 min-w-[150px]`} style={style}>
              {canEdit && (
                <button
                  className={`w-full flex items-center gap-2 ${spacing.pxMd} py-2 ${typography.uiLabel} font-medium ${colors.textSecondary} hover:${colors.bgMain} transition-colors`}
                  onClick={() => { setBatchMenuState(null); setEditingBatchData(batch); }}
                >
                  <Pencil size={14} className={colors.textMuted} /> Editar Lote
                </button>
              )}
              {canDelete && (
                <button
                  className={`w-full flex items-center gap-2 ${spacing.pxMd} py-2 ${typography.uiLabel} font-medium ${colors.statusDanger} hover:${colors.bgDanger} transition-colors`}
                  onClick={async () => {
                    setBatchMenuState(null);
                    if (window.confirm('¿Eliminar este lote? Afectará el costeo FIFO. Esta acción no se puede deshacer.')) {
                      try { await deleteBatch(batch.id); } catch (err: any) { alert(`Error: ${translateError(err)}`); }
                    }
                  }}
                >
                  <Trash2 size={14} /> Eliminar Lote
                </button>
              )}
            </div>
          );
        })()
      }
    </PageContainer>
  );
};

export default RawMaterials;
