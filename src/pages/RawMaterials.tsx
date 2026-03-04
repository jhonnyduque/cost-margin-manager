import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2, Search, X, History, ShoppingCart, ArrowDownToLine, Printer, Pencil, AlertCircle, Maximize2, Scissors, RotateCcw, Package, Archive } from 'lucide-react';
import { useStore, getMaterialDebt, calculateTotalFinancialDebt } from '../store';
import { RawMaterial, Status, Unit, MaterialBatch } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { tokens } from '@/design/design-tokens';
import { useCurrency } from '@/hooks/useCurrency';
import { Badge } from '@/components/ui/Badge';
import { translateError } from '@/utils/errorHandler';
import { calculateBatchArea } from '@/utils/materialCalculations';

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
    <div className="space-y-5 lg:space-y-6">
      <style>{`
      @media print {
        body * { visibility: hidden; }
        #print-area, #print-area * { visibility: visible; }
        #print-area { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }
      `}</style>

      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-display text-text-primary leading-tight">Materias Primas</h1>
          <p className="mt-1 text-body text-text-secondary">Inventario Maestro y Gestión FIFO</p> lập tức
        </div>
        {canCreate && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/productos')}>
              Nuevo Producto
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditingId(null);
                setFormData({ name: '', description: '', type: 'Tela', unit: 'metro', provider: '', status: 'activa', initialQty: 0, unitCost: 0, width: 140 });
                setIsModalOpen(true);
              }}
              icon={<Plus size={18} />}
            >
              Nuevo Material
            </Button>
          </div>
        )}
      </div>

      {/* Financial Governance Banner */}
      {totalFinancialDebt > 0 && (
        <div className="flex items-center justify-between rounded-md border border-error/20 bg-error/5 p-4 shadow-subtle">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-error shrink-0" />
            <div>
              <h3 className="text-body font-bold text-error">Producciones realizadas sin respaldo de inventario</h3>
              <p className="text-sm font-medium text-error/80">Compre e ingrese Lotes Físicos de material para regularizar la integridad contable.</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-label text-error/80 uppercase tracking-widest">Deuda Valorizada Estimada</span>
            <span className="text-lg font-extrabold text-error tabular-nums">{formatCurrency(totalFinancialDebt)}</span>
          </div>
        </div>
      )}

      {/* ========== MOBILE: Cards ========== */}
      <div className="space-y-3 md:hidden">
        {filteredMaterials.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <Package size={48} className="mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-500">No hay materias primas registradas.</p>
          </div>
        ) : (
          filteredMaterials.map((m) => {
            const { totalRemainingQty, weightedAvgCost } = batchStatsByMaterial[m.id] ?? getBatchStats(m.id);
            return (
              <div key={m.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-body font-bold text-text-primary truncate">{m.name}</h3>
                    <p className="text-sm text-text-secondary mt-0.5">{m.provider || 'Varios'}</p>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">{m.type}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 mb-4 rounded-sm bg-bg-page p-3 border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-label text-text-secondary uppercase">Stock</span>
                    <span className={`text-lg font-extrabold tabular-nums ${totalRemainingQty <= 0 ? 'text-error' : 'text-text-primary'}`}>
                      {totalRemainingQty.toFixed(2)} <span className="text-sm font-medium text-text-secondary">{m.unit}s</span>
                    </span>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className="text-label text-text-secondary uppercase">Costo Prom.</span>
                    <span className="text-lg font-extrabold tabular-nums text-text-primary">{formatCurrency(weightedAvgCost)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Button
                    variant="secondary"
                    onClick={() => setExpandedMaterialId(expandedMaterialId === m.id ? null : m.id)}
                    className={`h-8 px-3 text-xs ${expandedMaterialId === m.id ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
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
                      className="h-8 w-8 p-0 border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
                        className="h-8 w-8 p-0 border border-slate-200 bg-slate-50 text-amber-500 hover:bg-amber-50 hover:text-amber-600"
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
                        className="h-8 w-8 p-0 border border-slate-200 bg-slate-50 text-red-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar (sin stock ni productos vinculados)"
                        icon={<Trash2 size={15} />}
                      />
                    );
                  })()}
                </div>
                {expandedMaterialId === m.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                    <div className="text-center text-xs text-slate-500 py-4 bg-slate-50 rounded-xl">
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
        <div className="table-container">
          <table className="w-full text-left table-fixed">
            <thead className="table-header">
              <tr>
                <th className="w-[30%] px-4 py-3 truncate">Materia Prima</th>
                <th className="w-[12%] px-4 py-3 truncate">Categoría</th>
                <th className="w-[18%] px-4 py-3 truncate text-right">Disponible / Deuda</th>
                <th className="w-[15%] px-4 py-3 truncate text-right">Valor en Bodega</th>
                <th className="w-[15%] px-4 py-3 truncate text-right">Costo Promedio</th>
                <th className="w-[10%] px-4 py-3 text-right">Acciones</th>
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
                    <tr className={`table-row ${expandedMaterialId === m.id ? 'bg-bg-page/50' : 'bg-bg-card'}`}>
                      <td className="px-4 py-3 truncate">
                        <div className="flex flex-col" title={`${m.name} - ${m.provider || 'Varios'}`}>
                          <span className="text-body font-bold text-text-primary truncate" title={m.name}>{m.name}</span>
                          <span className="text-sm font-medium text-text-secondary truncate mt-0.5" title={m.provider || 'Varios'}>{m.provider || 'Varios'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 truncate">
                        <Badge variant="secondary" className="text-xs font-semibold bg-bg-page text-text-secondary" title={m.type}>{m.type}</Badge>
                      </td>
                      <td className="px-4 py-3 truncate text-right">
                        <div className="flex justify-end items-center" title={`Stock Actual: ${displayStock.toFixed(2)} ${m.unit}s`}>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium ${displayStock > 0 ? 'bg-emerald-50 text-emerald-700' : displayStock < 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                            {displayStock < 0 ? '🔴 ' : displayStock > 0 ? '🟢 ' : ''}
                            {displayStock.toFixed(2)} <span className="ml-1 text-xs font-semibold opacity-70">{m.unit}s</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 truncate text-right">
                        <span className={`text-lg font-extrabold tabular-nums ${valuation < 0 ? 'text-error' : 'text-text-primary'}`} title={`Valorización: ${formatCurrency(valuation)}`}>
                          {formatCurrency(valuation)}
                        </span>
                      </td>
                      <td className="px-4 py-3 truncate text-right">
                        <span className="text-body font-medium tabular-nums text-text-secondary" title={`Costo Promedio FIFO: ${formatCurrency(weightedAvgCost)}`}>
                          {formatCurrency(weightedAvgCost)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
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
                              className="h-8 w-8 p-0 border border-transparent bg-gray-50 text-gray-400 hover:border-gray-200 hover:bg-white hover:text-gray-600"
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
                                className="h-8 w-8 p-0 border border-transparent bg-gray-50 text-gray-400 hover:border-gray-200 hover:bg-white hover:text-red-600"
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
                        <td colSpan={6} className="p-0 border-b border-indigo-100 bg-indigo-50/30">
                          <div className="p-6 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">

                            {/* NEW BATCH FORM */}
                            <div className="no-print surface-card p-6 shadow-sm">
                              <div className="mb-6 flex items-center justify-between">
                                <h4 className="flex items-center gap-2 text-label font-bold uppercase tracking-widest text-brand">
                                  <ShoppingCart size={16} /> Registrar Nueva Entrada Física
                                </h4>
                                {isDimensional && (
                                  <div className="flex gap-1 rounded-xl border border-indigo-100 bg-slate-50 p-1">
                                    <button type="button" onClick={() => set_entry_mode('rollo')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold uppercase transition-all ${entry_mode === 'rollo' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                                      <RotateCcw size={14} /> Rollo
                                    </button>
                                    <button type="button" onClick={() => set_entry_mode('pieza')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold uppercase transition-all ${entry_mode === 'pieza' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
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
                                    <Button type="submit" variant="primary" icon={<Plus size={16} />} className="mb-0.5 h-10 w-full sm:w-auto shadow-md">Añadir Lote</Button>
                                  </div>
                                </form>
                              )}
                            </div>

                            {/* BATCHES TABLE IN-LINE */}
                            <div>
                              <div className="flex items-center justify-between mb-4 mt-8">
                                <h4 className="text-body font-bold text-text-primary">Kardex de Lotes y Movimientos</h4>
                                <Button variant="ghost" size="icon" onClick={handlePrint} className="text-slate-500" title="Imprimir"><Printer size={18} /></Button>
                              </div>
                              <div className="table-container shadow-subtle bg-bg-card">
                                <table className="w-full text-left table-fixed min-w-[700px]">
                                  <thead className="table-header">
                                    <tr>
                                      <th className="table-header-cell w-[12%]">Fecha</th>
                                      <th className="table-header-cell w-[10%]">Modo</th>
                                      <th className="table-header-cell w-[18%]">Proveedor</th>
                                      <th className="table-header-cell w-[15%] text-right">Dimensiones</th>
                                      <th className="table-header-cell w-[10%] text-right text-emerald-600">Área</th>
                                      <th className="table-header-cell w-[10%] text-right">Costo</th>
                                      <th className="table-header-cell w-[10%] text-right text-brand">/m²</th>
                                      <th className="table-header-cell w-[10%] text-right">Restante</th>
                                      <th className="table-header-cell w-[5%] text-center"></th>
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
                                          <td className="px-4 py-2.5 tabular-nums text-sm font-medium">{batch.date}</td>
                                          <td className="px-4 py-2.5">
                                            {isDimensional ? (
                                              <Badge variant={batch.entry_mode === 'pieza' ? 'warning' : 'default'} className="flex w-fit items-center gap-1 flex-shrink-0 text-xs font-semibold px-2 py-0.5">
                                                {batch.entry_mode === 'pieza' ? <Scissors size={12} /> : <RotateCcw size={12} />}
                                                {batch.entry_mode || 'Rollo'}
                                              </Badge>
                                            ) : (
                                              <Badge variant="default" className="text-xs font-semibold bg-slate-100 text-slate-600">Estándar</Badge>
                                            )}
                                          </td>
                                          <td className="px-4 py-2.5 font-medium text-sm truncate" title={batch.provider}>{batch.provider}</td>
                                          <td className="px-4 py-2.5 text-right flex flex-col items-end">
                                            {isDimensional ? (
                                              <>
                                                <span className="text-sm font-medium text-slate-900 leading-tight">
                                                  {batch.entry_mode === 'pieza' ? `${batch.length} × ${batch.width} cm` : `${batch.initial_quantity.toFixed(2)} m`}
                                                </span>
                                                <span className="text-xs font-medium text-slate-500 leading-tight">{batch.width} cm ancho</span>
                                              </>
                                            ) : (
                                              <span className="text-slate-400 font-medium text-sm">---</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-2.5 text-right tabular-nums text-sm font-medium text-emerald-600">{isDimensional && batch.area ? `${batch.area.toFixed(2)} m²` : '---'}</td>
                                          <td className="px-4 py-2.5 text-right tabular-nums text-sm font-medium">{formatCurrency(currentTotalPurchaseCost)}</td>
                                          <td className="px-4 py-2.5 text-right tabular-nums text-sm font-medium text-indigo-600">{isDimensional && currentCostPerM2 > 0 ? formatCurrency(currentCostPerM2) : '---'}</td>
                                          <td className="px-4 py-2.5 text-right">
                                            <Badge variant={batch.remaining_quantity > 0 ? 'success' : 'secondary'} className="text-xs tabular-nums font-semibold">
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
                                    <tr className="bg-bg-page border-t-2 border-border">
                                      <td colSpan={3} className="px-4 py-4 uppercase text-label font-bold text-text-secondary text-right">Totales Acumulados</td>
                                      <td className="px-4 py-4 text-right tabular-nums text-body font-medium text-text-secondary">{isDimensional ? `${totalRemainingQty.toFixed(2)} m` : '---'}</td>
                                      <td className="px-4 py-4 text-right tabular-nums text-body font-medium text-emerald-600">{isDimensional ? `${batchStatsByMaterial[m.id].totalArea.toFixed(2)} m²` : '---'}</td>
                                      <td className="px-4 py-4 text-right tabular-nums text-lg font-extrabold text-text-primary">{formatCurrency(batchStatsByMaterial[m.id].totalValue)}</td>
                                      <td className="px-4 py-4 text-right tabular-nums text-lg font-extrabold text-brand">{isDimensional ? formatCurrency(batchStatsByMaterial[m.id].avgCostPerM2) : '---'}</td>
                                      <td className="px-4 py-4 text-right tabular-nums text-lg font-extrabold text-emerald-600">{totalRemainingQty.toFixed(2)}</td>
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
          <Card className="my-4 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <h3 className="mb-6 sm:mb-8 text-xl sm:text-2xl font-bold">
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
                    className={`w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all active:scale-95 ${formData.status === 'activa' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-400 ring-1 ring-gray-200'}`}
                  >
                    <div className={`size-2.5 rounded-full transition-colors ${formData.status === 'activa' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
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
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <h4 className="mb-6 flex items-center gap-2 text-xl font-bold">
              <Pencil size={20} className="text-indigo-500" /> Editar Registro
            </h4>
            <form onSubmit={handleEditBatchSubmit} className="space-y-4">
              {editingBatchData.remaining_quantity < editingBatchData.initial_quantity && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <AlertCircle size={20} className="mt-0.5 shrink-0 text-amber-500" />
                  <p className="text-sm font-semibold leading-tight text-amber-700">
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
    </div>
  );
};

export default RawMaterials;