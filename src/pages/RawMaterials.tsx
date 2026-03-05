import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2, Search, X, History, ShoppingCart, ArrowDownToLine, Printer, Pencil, AlertCircle, Maximize2, Scissors, RotateCcw, Package, Archive } from 'lucide-react';
import { useStore, getMaterialDebt, calculateTotalFinancialDebt } from '../store';
import { RawMaterial, Unit, MaterialBatch } from '@/types';
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
    addRawMaterial, deleteRawMaterial, archiveMaterial, updateRawMaterial,
    addBatch, deleteBatch, updateBatch
  } = useStore();
  const { formatCurrency, currencySymbol } = useCurrency();

  const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
  const canCreate = allowedRoles.includes((currentUserRole as string) || '');
  const canEdit = allowedRoles.includes((currentUserRole as string) || '');
  const canDelete = allowedRoles.includes((currentUserRole as string) || '');

  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState<'todos' | Unit>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entry_mode, set_entry_mode] = useState<'rollo' | 'pieza'>('rollo');
  const [isSaving, setIsSaving] = useState(false);
  const [editingBatchData, setEditingBatchData] = useState<MaterialBatch | null>(null);
  const [formData, setFormData] = useState<any>({
    name: '', description: '', type: 'Tela', unit: 'metro',
    provider: '', status: 'activa', initialQty: 0, unitCost: 0, width: 140
  });
  const [batchFormData, setBatchFormData] = useState<Partial<MaterialBatch>>({
    date: new Date().toISOString().split('T')[0],
    provider: '', initial_quantity: 0, unit_cost: 0, reference: '', width: 140, length: 0
  });

  const filteredMaterials = rawMaterials.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.provider.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(m => {
    if (unitFilter === 'todos') return true;
    return m.unit === unitFilter;
  });

  const getBatchStats = (materialId: string) => {
    const matBatches = batches.filter(b => b.material_id === materialId);
    const totalOriginalQty = matBatches.reduce((acc, b) => acc + b.initial_quantity, 0);
    let totalRemainingQty = matBatches.reduce((acc, b) => acc + b.remaining_quantity, 0);
    const debt = getMaterialDebt(materialId, movements).pendingQty;
    totalRemainingQty -= debt;
    const totalValue = matBatches.reduce((acc, b) => acc + (b.unit_cost * b.initial_quantity), 0);
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
      unit: formData.unit,
      provider: formData.provider,
      status: formData.status,
      company_id: currentCompanyId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      created_by: '', // Auto-handled by store
      updated_by: '', // Auto-handled by store
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
          const batch: MaterialBatch = {
            id: crypto.randomUUID(),
            material_id: materialId,
            date: now.split('T')[0],
            provider: formData.provider || 'Carga Inicial',
            initial_quantity: formData.initialQty,
            remaining_quantity: formData.initialQty,
            unit_cost: formData.unitCost,
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
      const isDimensional = material?.unit === 'metro' || material?.unit === 'cm';
      let finalQty = batchFormData.initial_quantity || 0;
      let finalUnitCost = batchFormData.unit_cost || 0;
      let area = 0;

      if (!isDimensional) {
        finalQty = batchFormData.initial_quantity || 0;
        finalUnitCost = finalQty > 0 ? (batchFormData.unit_cost || 0) / finalQty : 0;
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

      // Audit trail gestionado internamente por el store (addBatch llama getActorId).
      const data: MaterialBatch = {
        ...batchFormData,
        id: crypto.randomUUID(),
        material_id: expandedMaterialId,
        initial_quantity: finalQty,
        remaining_quantity: finalQty,
        unit_cost: finalUnitCost,
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
                <Button variant="secondary" size="sm" onClick={() => navigate('/productos')}>
                  PRODUCTOS
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ name: '', description: '', type: 'Tela', unit: 'metro', provider: '', status: 'activa', initialQty: 0, unitCost: 0, width: 140 });
                    setIsModalOpen(true);
                  }}
                  icon={<Plus />}
                >
                  NUEVO MATERIAL
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
            onChange={(e) => setUnitFilter(e.target.value as any)}
          >
            <option value="todos">Todas las unidades</option>
            <option value="metro">Metros</option>
            <option value="unidad">Unidades</option>
            <option value="kg">Kilogramos</option>
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
                  <Badge variant="secondary" className="flex-shrink-0">{m.type}</Badge>
                </div>
                <div className={`grid grid-cols-2 gap-4 mt-4 mb-4 ${radius.lg} ${colors.bgMain} ${spacing.pMd} border ${colors.borderSubtle}`}>
                  <div className="flex flex-col">
                    <span className={`${typography.uiLabel} ${colors.textSecondary}`}>Stock</span>
                    <span className={`${typography.body} font-medium ${totalRemainingQty <= 0 ? colors.statusDanger : colors.textPrimary}`}>
                      {totalRemainingQty.toFixed(2)} <span className={`${typography.caption} ${colors.textSecondary}`}>{m.unit}s</span>
                    </span>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className={`${typography.uiLabel} ${colors.textSecondary}`}>Costo Prom.</span>
                    <span className={`${typography.body} font-medium ${colors.textPrimary}`}>{formatCurrency(weightedAvgCost)}</span>
                  </div>
                </div>
                <div className={`flex items-center gap-2 pt-2 border-t ${colors.borderSubtle}`}>
                  <Button
                    variant="secondary"
                    onClick={() => setExpandedMaterialId(expandedMaterialId === m.id ? null : m.id)}
                    className={`h-8 px-3 text-xs ${expandedMaterialId === m.id ? `${colors.bgBrandSubtle} text-indigo-700` : `${colors.bgBrandSubtle}/50 text-indigo-600 hover:${colors.bgBrandSubtle}`}`}
                    icon={<History size={13} />}
                  >
                    {expandedMaterialId === m.id ? 'Cerrar' : 'Lotes'}
                  </Button>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const stats = batchStatsByMaterial[m.id] ?? getBatchStats(m.id);
                        setEditingId(m.id);
                        setFormData({ ...m, initialQty: stats.totalRemainingQty, unitCost: stats.weightedAvgCost });
                        setIsModalOpen(true);
                      }}
                      className={`h-8 w-8 p-0 border ${colors.borderStandard} ${colors.bgMain} ${colors.textSecondary} hover:${colors.bgSurface} hover:${colors.textPrimary}`}
                      icon={<Edit2 size={15} />}
                    />
                  )}
                  {canDelete && (() => {
                    const hasLinkedProducts = products.some(p => (p.materials ?? []).some(pm => pm.material_id === m.id));
                    const remainingStock = batchStatsByMaterial[m.id].totalRemainingQty;
                    const mustArchive = hasLinkedProducts || remainingStock > 0;
                    const archiveReason = hasLinkedProducts ? 'Vinculada a productos activos' : 'Tiene stock físico con valor en libro';
                    return mustArchive ? (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          if (window.confirm(`¿Archivar "${m.name}"? Razón: ${archiveReason}. Quedará inactiva pero el historial se conserva.`)) {
                            try { await archiveMaterial(m.id); }
                            catch (err: any) { alert(`Error: ${translateError(err)}`); }
                          }
                        }}
                        className={`h-8 w-8 p-0 border ${colors.borderStandard} ${colors.bgWarning} ${colors.statusWarning} hover:opacity-80`}
                        title={`Archivar (${archiveReason})`}
                        icon={<Archive size={15} />}
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          if (window.confirm(`¿Eliminar "${m.name}"? Sin stock ni productos vinculados. Esta acción no se puede deshacer.`)) {
                            try { await deleteRawMaterial(m.id); }
                            catch (err: any) { alert(`No se pudo eliminar: ${translateError(err)}`); }
                          }
                        }}
                        className={`h-8 w-8 p-0 border ${colors.borderStandard} ${colors.bgDanger} ${colors.statusDanger} hover:opacity-80`}
                        title="Eliminar (sin stock ni productos vinculados)"
                        icon={<Trash2 size={15} />}
                      />
                    );
                  })()}
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
                <th className={`w-[30%] ${spacing.pxLg} py-3 ${typography.uiLabel} ${colors.textSecondary} truncate`}>Materia Prima</th>
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
                        <Badge variant="secondary" className={`${typography.uiLabel} ${colors.bgMain} ${colors.textSecondary}`} title={m.type}>{m.type}</Badge>
                      </td>
                      <td className={`${spacing.pxLg} py-3 truncate text-right`}>
                        <div className="flex justify-end items-center" title={`Stock Actual: ${displayStock.toFixed(2)} ${m.unit}s`}>
                          <span className={`inline-flex items-center ${spacing.pxMd} py-0.5 ${radius.sm} ${typography.caption} font-bold ${displayStock > 0 ? `${colors.bgSuccess} ${colors.statusSuccess} border ${colors.borderSubtle}` : displayStock < 0 ? `${colors.bgDanger} ${colors.statusDanger} border ${colors.borderSubtle}` : `${colors.bgMain} ${colors.textSecondary} border ${colors.borderStandard}`}`}>
                            {displayStock < 0 ? '🔴 ' : displayStock > 0 ? '🟢 ' : ''}
                            {displayStock.toFixed(2)} <span className="ml-1 opacity-70">{m.unit}s</span>
                          </span>
                        </div>
                      </td>
                      <td className={`${spacing.pxLg} py-3 truncate text-right`}>
                        <span className={`${typography.body} font-medium ${valuation < 0 ? colors.statusDanger : colors.textPrimary}`} title={`Valorización: ${formatCurrency(valuation)}`}>
                          {formatCurrency(valuation)}
                        </span>
                      </td>
                      <td className={`${spacing.pxLg} py-3 truncate text-right`}>
                        <span className={`${typography.body} font-medium tabular-nums ${colors.textSecondary}`} title={`Costo Promedio FIFO: ${formatCurrency(weightedAvgCost)}`}>
                          {formatCurrency(weightedAvgCost)}
                        </span>
                      </td>
                      <td className={`${spacing.pxLg} py-3 text-right`}>
                        <div className="flex justify-end gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="secondary"
                            onClick={() => setExpandedMaterialId(expandedMaterialId === m.id ? null : m.id)}
                            className={`h-8 w-8 p-0 border ${expandedMaterialId === m.id ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'border-transparent bg-gray-50 text-indigo-600 hover:border-gray-200 hover:bg-white hover:text-indigo-700'}`}
                            title={expandedMaterialId === m.id ? 'Cerrar Detalles' : 'Ver Lotes (Histórico)'}
                            icon={<History size={16} />}
                          />
                          {canEdit && (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                const stats = batchStatsByMaterial[m.id] ?? getBatchStats(m.id);
                                setEditingId(m.id);
                                setFormData({ ...m, initialQty: stats.totalRemainingQty, unitCost: stats.weightedAvgCost });
                                setIsModalOpen(true);
                              }}
                              className="h-8 w-8 p-0 border border-transparent bg-gray-50 text-slate-500 hover:border-gray-200 hover:bg-white hover:text-gray-600"
                              title="Editar Materia Prima"
                              icon={<Edit2 size={16} />}
                            />
                          )}
                          {canDelete && (() => {
                            const hasLinkedProducts = products.some(p => (p.materials ?? []).some(pm => pm.material_id === m.id));
                            const remainingStock = batchStatsByMaterial[m.id].totalRemainingQty;
                            const mustArchive = hasLinkedProducts || remainingStock > 0;
                            const archiveReason = hasLinkedProducts ? 'Vinculada a productos activos' : 'Tiene stock físico con valor en libro';
                            return mustArchive ? (
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 border border-transparent bg-amber-50 text-amber-500 hover:border-amber-200 hover:bg-amber-100"
                                title={`Archivar (${archiveReason})`}
                                onClick={async () => {
                                  if (window.confirm(`¿Archivar "${m.name}"? Razón: ${archiveReason}. Quedará inactiva pero el historial se conserva.`)) {
                                    try { await archiveMaterial(m.id); }
                                    catch (err: any) { alert(`Error: ${translateError(err)}`); }
                                  }
                                }}
                                icon={<Archive size={16} />}
                              />
                            ) : (
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 border border-transparent bg-gray-50 text-slate-500 hover:border-gray-200 hover:bg-white hover:text-red-600"
                                title="Eliminar (sin stock ni productos vinculados)"
                                onClick={async () => {
                                  if (window.confirm(`¿Eliminar "${m.name}"? Sin stock ni productos vinculados. Esta acción no se puede deshacer.`)) {
                                    try { await deleteRawMaterial(m.id); }
                                    catch (err: any) { alert(`No se pudo eliminar: ${translateError(err)}`); }
                                  }
                                }}
                                icon={<Trash2 size={16} />}
                              />
                            );
                          })()}
                        </div>
                      </td>
                    </tr>

                    {/* ACCORDION DESKTOP IN-LINE */}
                    {expandedMaterialId === m.id && (
                      <tr>
                        <td colSpan={6} className={`p-0 border-b ${colors.borderSubtle} ${colors.bgMain}/30`}>
                          <div className={`p-6 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300`}>

                            {/* NEW BATCH FORM */}
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
                                          <div className="w-24"><Input label="M. Lineales" type="number" step="0.01" value={batchFormData.initial_quantity || ''} onChange={e => setBatchFormData({ ...batchFormData, initial_quantity: parseFloat(e.target.value) })} required /></div>
                                        ) : (
                                          <div className="w-24"><Input label="Largo (cm)" type="number" step="0.01" value={batchFormData.length || ''} onChange={e => setBatchFormData({ ...batchFormData, length: parseFloat(e.target.value) })} required /></div>
                                        )}
                                        <div className="w-24"><Input label="Ancho (cm)" type="number" step="1" value={batchFormData.width || ''} onChange={e => setBatchFormData({ ...batchFormData, width: parseInt(e.target.value) })} required className="text-emerald-700" /></div>
                                        <div className="w-32"><Input label={entry_mode === 'rollo' ? 'Costo / Metro' : 'Costo Total'} type="number" step="0.01" value={batchFormData.unit_cost || ''} onChange={e => setBatchFormData({ ...batchFormData, unit_cost: parseFloat(e.target.value) })} required /></div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="w-32"><Input label={`Cantidad (${m.unit})`} type="number" step="0.01" value={batchFormData.initial_quantity || ''} onChange={e => setBatchFormData({ ...batchFormData, initial_quantity: parseFloat(e.target.value) })} required /></div>
                                        <div className="w-32"><Input label="Costo Total (€)" type="number" step="0.01" value={batchFormData.unit_cost || ''} onChange={e => setBatchFormData({ ...batchFormData, unit_cost: parseFloat(e.target.value) })} required /></div>
                                      </>
                                    )}
                                    <Button type="submit" variant="primary" icon={<Plus size={16} />} className={`mb-0.5 h-10 w-full sm:w-auto ${shadows.md}`}>Añadir Lote</Button>
                                  </div>
                                </form>
                              )}
                            </div>

                            {/* BATCHES TABLE IN-LINE */}
                            <div>
                              <div className="flex items-center justify-between mb-4 mt-8">
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
                                      <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} ${colors.textSecondary} w-[15%] text-right`}>Dimensiones</th>
                                      <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} ${colors.statusSuccess} w-[10%] text-right`}>Área</th>
                                      <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} ${colors.textSecondary} w-[10%] text-right`}>Costo</th>
                                      <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} text-indigo-600 w-[10%] text-right`}>/m²</th>
                                      <th className={`${spacing.pxMd} py-3 ${typography.uiLabel} ${colors.textSecondary} w-[10%] text-right`}>Restante</th>
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
                                        <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                                          <td className={`${spacing.pxMd} py-2.5 tabular-nums ${typography.text.caption} font-medium`}>{batch.date}</td>
                                          <td className={`${spacing.pxMd} py-2.5`}>
                                            {isDimensional ? (
                                              <Badge variant={batch.entry_mode === 'pieza' ? 'warning' : 'default'} className={`flex w-fit items-center gap-1 flex-shrink-0 ${typography.text.caption} px-2 py-0.5`}>
                                                {batch.entry_mode === 'pieza' ? <Scissors size={12} /> : <RotateCcw size={12} />}
                                                {batch.entry_mode || 'Rollo'}
                                              </Badge>
                                            ) : (
                                              <Badge variant="default" className={`${typography.text.caption} ${colors.bgMain} ${colors.textSecondary}`}>Estándar</Badge>
                                            )}
                                          </td>
                                          <td className={`${spacing.pxMd} py-2.5 font-medium ${typography.text.caption} truncate`} title={batch.provider}>{batch.provider}</td>
                                          <td className={`${spacing.pxMd} py-2.5 text-right flex flex-col items-end`}>
                                            {isDimensional ? (
                                              <>
                                                <span className={`${typography.text.caption} font-medium ${colors.textPrimary} leading-tight`}>
                                                  {batch.entry_mode === 'pieza' ? `${batch.length} × ${batch.width} cm` : `${batch.initial_quantity.toFixed(2)} m`}
                                                </span>
                                                <span className={`${typography.text.caption} font-medium ${colors.textSecondary} leading-tight`}>{batch.width} cm ancho</span>
                                              </>
                                            ) : (
                                              <span className={`${colors.textSecondary} font-medium ${typography.text.caption}`}>---</span>
                                            )}
                                          </td>
                                          <td className={`${spacing.pxMd} py-2.5 text-right tabular-nums ${typography.text.caption} font-medium ${colors.statusSuccess}`}>{isDimensional && batch.area ? `${batch.area.toFixed(2)} m²` : '---'}</td>
                                          <td className={`${spacing.pxMd} py-2.5 text-right tabular-nums ${typography.text.caption} font-medium`}>{formatCurrency(currentTotalPurchaseCost)}</td>
                                          <td className={`${spacing.pxMd} py-2.5 text-right tabular-nums ${typography.text.caption} font-medium text-indigo-600`}>{isDimensional && currentCostPerM2 > 0 ? formatCurrency(currentCostPerM2) : '---'}</td>
                                          <td className={`${spacing.pxMd} py-2.5 text-right`}>
                                            <Badge variant={batch.remaining_quantity > 0 ? 'success' : 'secondary'} className={`${typography.text.caption} tabular-nums`}>
                                              {batch.remaining_quantity.toFixed(2)}
                                            </Badge>
                                          </td>
                                          <td className="px-4 py-2.5 text-center">
                                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              {canEdit && (
                                                <button onClick={() => setEditingBatchData(batch)} className="p-1 hover:text-indigo-600" title="Editar Lote">
                                                  <Pencil size={12} />
                                                </button>
                                              )}
                                              {canDelete && (
                                                <button onClick={async () => {
                                                  if (!window.confirm('¿Eliminar este lote? Afectará el costeo FIFO. Esta acción no se puede deshacer.')) return;
                                                  try { await deleteBatch(batch.id); } catch (err: any) { alert(`Error: ${translateError(err)}`); }
                                                }} className="p-1 hover:text-red-600" title="Eliminar Lote" aria-label={`Eliminar lote del ${batch.date}`}>
                                                  <Trash2 size={12} />
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {/* Totals Row */}
                                    <tr className={`${colors.bgMain} border-t-2 ${colors.borderStandard}`}>
                                      <td colSpan={3} className={`${spacing.pxMd} py-4 text-right ${typography.text.caption} ${colors.textSecondary}`}>Totales Acumulados</td>
                                      <td className={`${spacing.pxMd} py-4 text-right ${typography.text.body} font-medium ${colors.textSecondary} tabular-nums`}>{isDimensional ? `${totalRemainingQty.toFixed(2)} m` : '---'}</td>
                                      <td className={`${spacing.pxMd} py-4 text-right ${typography.text.body} font-medium ${colors.statusSuccess} tabular-nums`}>{isDimensional ? `${batchStatsByMaterial[m.id].totalArea.toFixed(2)} m²` : '---'}</td>
                                      <td className={`${spacing.pxMd} py-4 text-right ${typography.text.body} font-medium ${colors.textPrimary}`}>{formatCurrency(batchStatsByMaterial[m.id].totalValue)}</td>
                                      <td className={`${spacing.pxMd} py-4 text-right ${typography.text.body} font-medium text-indigo-600`}>{isDimensional ? formatCurrency(batchStatsByMaterial[m.id].avgCostPerM2) : '---'}</td>
                                      <td className={`${spacing.pxMd} py-4 text-right ${typography.text.body} font-medium ${colors.statusSuccess}`}>{totalRemainingQty.toFixed(2)}</td>
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
                  <option value="Tela">Tela</option>
                  <option value="Hilo">Hilo</option>
                  <option value="Herrajes">Herrajes</option>
                  <option value="Accesorios">Accesorios</option>
                  <option value="Otros">Otros</option>
                </Select>
                <Input label="Proveedor" value={formData.provider} onChange={e => setFormData({ ...formData, provider: e.target.value })} placeholder="Ej. Textiles Premium" />
              </div>
              <Input label="Descripción" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Detalles de la materia prima..." />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Unidad de Medida" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value as Unit })}>
                  <option value="metro">Metro (m)</option>
                  <option value="cm">Centímetro (cm)</option>
                  <option value="kg">Kilogramo (kg)</option>
                  <option value="gramo">Gramo (g)</option>
                  <option value="unidad">Unidad (u)</option>
                  <option value="bobina">Bobina</option>
                  <option value="litro">Litro (L)</option>
                </Select>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Costo/{formData.unit}</label>
                  <Input type="number" step="0.01" value={formData.unitCost || ''} onChange={e => setFormData({ ...formData, unitCost: parseFloat(e.target.value) })} placeholder="0" disabled={!!editingId} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 items-end">
                {formData.unit === 'metro' ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-emerald-600">Ancho (cm)</label>
                    <Input type="number" step="1" value={formData.width || ''} onChange={e => setFormData({ ...formData, width: parseInt(e.target.value) })} placeholder="140" />
                  </div>
                ) : <div />}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Cantidad</label>
                  <Input type="number" step="0.01" value={formData.initialQty || ''} onChange={e => setFormData({ ...formData, initialQty: parseFloat(e.target.value) })} placeholder="0" disabled={!!editingId} />
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
      )}

      {/* MODAL — Editar Lote */}
      {editingBatchData && (
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
      )}
    </PageContainer>
  );
};

export default RawMaterials;

