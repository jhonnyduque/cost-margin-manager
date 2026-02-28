import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Search, X, History, ShoppingCart, ArrowDownToLine, Printer, Pencil, AlertCircle, Maximize2, Scissors, RotateCcw, Package } from 'lucide-react';
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

const RawMaterials: React.FC = () => {
  const { currentCompanyId, currentUserRole, rawMaterials, batches, movements, addRawMaterial, deleteRawMaterial, updateRawMaterial, addBatch, deleteBatch, updateBatch } = useStore();
  const { formatCurrency, currencySymbol } = useCurrency();

  // 🔹 Helpers de permisos según rol
  const allowedRoles = ['super_admin', 'admin', 'owner', 'manager'];
  const canCreate = allowedRoles.includes(currentUserRole || '');
  const canEdit = allowedRoles.includes(currentUserRole || '');
  const canDelete = allowedRoles.includes(currentUserRole || '');

  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState<'todos' | Unit>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entry_mode, set_entry_mode] = useState<'rollo' | 'pieza'>('rollo');
  const [isSaving, setIsSaving] = useState(false);
  const [editingBatchData, setEditingBatchData] = useState<MaterialBatch | null>(null);
  const [formData, setFormData] = useState<any>({
    name: '',
    description: '',
    type: 'Tela',
    unit: 'metro',
    provider: '',
    status: 'activa',
    initialQty: 0,
    unitCost: 0,
    width: 140
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

    // Deduct active debt from remaining qty
    const debt = getMaterialDebt(materialId, movements).pendingQty;
    totalRemainingQty -= debt;

    const totalValue = matBatches.reduce((acc, b) => acc + (b.unit_cost * b.initial_quantity), 0);
    const weightedAvgCost = totalOriginalQty > 0 ? totalValue / totalOriginalQty : 0;
    const totalArea = matBatches.reduce((acc, b) => acc + (b.area || 0), 0);
    const avgCostPerM2 = totalArea > 0 ? totalValue / totalArea : 0;
    return { totalOriginalQty, totalRemainingQty, totalValue, weightedAvgCost, totalArea, avgCostPerM2 };
  };

  const totalFinancialDebt = useMemo(() => {
    return calculateTotalFinancialDebt(movements, rawMaterials);
  }, [movements, rawMaterials]);

  const handleMasterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const materialId = editingId || crypto.randomUUID();
    const materialData: RawMaterial = {
      id: materialId,
      name: formData.name,
      description: formData.description,
      type: formData.type,
      unit: formData.unit,
      provider: formData.provider,
      status: formData.status,
      company_id: currentCompanyId || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    };
    try {
      if (editingId) {
        await updateRawMaterial(materialData);
      } else {
        await addRawMaterial(materialData);
        if (formData.initialQty > 0) {
          const area = formData.unit === 'metro' ? formData.initialQty * ((formData.width || 0) / 100) : 0;
          const batch: MaterialBatch = {
            id: crypto.randomUUID(),
            material_id: materialId,
            date: new Date().toISOString().split('T')[0],
            provider: formData.provider || 'Carga Inicial',
            initial_quantity: formData.initialQty,
            remaining_quantity: formData.initialQty,
            unit_cost: formData.unitCost,
            reference: 'Carga Inicial',
            width: formData.width,
            length: 0,
            area: area,
            entry_mode: 'rollo',
            company_id: currentCompanyId || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null
          };
          await addBatch(batch);
        }
      }
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error: any) {
      console.error("Error saving material:", error);
      alert(`Hubo un error al guardar: ${translateError(error)} `);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedMaterialId) return;
    setIsSaving(true);
    try {
      const material = rawMaterials.find(m => m.id === expandedMaterialId);
      const isDimensional = material?.unit === 'metro' || material?.unit === 'cm';
      let area = 0;
      let finalQty = batchFormData.initial_quantity || 0;
      let finalUnitCost = batchFormData.unit_cost || 0;

      if (!isDimensional) {
        area = 0;
        finalQty = batchFormData.initial_quantity || 0;
        // User inputs total cost for std, so we divide by qty
        finalUnitCost = finalQty > 0 ? (batchFormData.unit_cost || 0) / finalQty : 0;
      } else if (entry_mode === 'rollo') {
        area = (batchFormData.initial_quantity || 0) * ((batchFormData.width || 0) / 100);
        finalUnitCost = batchFormData.unit_cost || 0; // Cost is per metro
      } else {
        area = ((batchFormData.length || 0) * (batchFormData.width || 0)) / 10000;
        finalQty = (batchFormData.length || 0) / 100;
        // User inputs total cost for piece
        finalUnitCost = finalQty > 0 ? (batchFormData.unit_cost || 0) / finalQty : 0;
      }
      const data = {
        ...batchFormData,
        id: crypto.randomUUID(),
        material_id: expandedMaterialId,
        initial_quantity: finalQty,
        remaining_quantity: finalQty,
        unit_cost: finalUnitCost,
        area: area,
        entry_mode: entry_mode,
        company_id: currentCompanyId || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as MaterialBatch;
      await addBatch(data);
      setBatchFormData({
        date: new Date().toISOString().split('T')[0],
        provider: material?.provider || '',
        initial_quantity: 0,
        unit_cost: 0,
        reference: '',
        width: 140,
        length: 0
      });
    } catch (error: any) {
      console.error("Error saving batch:", error);
      alert(`No se pudo agregar el ingreso físico: ${translateError(error)} `);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBatchData) {
      setIsSaving(true);
      try {
        const original = batches.find(b => b.id === editingBatchData.id);
        if (original && original.remaining_quantity < original.initial_quantity) {
          await updateBatch({
            ...editingBatchData,
            initial_quantity: original.initial_quantity,
            unit_cost: original.unit_cost
          });
        } else {
          let area = 0;
          let finalQty = editingBatchData.initial_quantity;
          let finalUnitCost = editingBatchData.unit_cost;
          if (editingBatchData.entry_mode === 'rollo') {
            area = editingBatchData.initial_quantity * ((editingBatchData.width || 0) / 100);
            finalUnitCost = editingBatchData.unit_cost;
          } else {
            area = ((editingBatchData.length || 0) * (editingBatchData.width || 0)) / 10000;
            finalQty = (editingBatchData.length || 0) / 100;
            finalUnitCost = (editingBatchData.unit_cost || 0) / finalQty;
          }
          await updateBatch({
            ...editingBatchData,
            initial_quantity: finalQty,
            unit_cost: finalUnitCost,
            area: area,
            remaining_quantity: finalQty
          });
        }
        setEditingBatchData(null);
      } catch (error: any) {
        console.error("Error editing batch:", error);
        alert(`Fallo al actualizar el lote: ${translateError(error)} `);
      } finally {
        setIsSaving(false);
      }
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

  const handlePrint = () => {
    window.print();
  };

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
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900">Materias Primas</h1>
          <p className="mt-1 text-sm lg:text-base text-slate-500">Inventario Maestro y Gestión FIFO</p>
        </div>
        {canCreate && (
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
        )}
      </div>



      {/* Financial Governance Banner */}
      {totalFinancialDebt > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-red-900">Producciones realizadas sin respaldo de inventario</h3>
              <p className="text-xs font-medium text-red-700">Compre e ingrese Lotes Físicos de material para regularizar la integridad contable.</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-red-500">Deuda Valorizada Estimada</span>
            <span className="text-lg font-black text-red-700">{formatCurrency(totalFinancialDebt)}</span>
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
            const { totalRemainingQty, weightedAvgCost } = getBatchStats(m.id);
            return (
              <div key={m.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                {/* Top: Name + badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{m.name}</h3>
                    <p className="text-xs text-slate-400">{m.provider || 'Varios'}</p>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">{m.type}</Badge>
                </div>
                {/* Stats row */}
                <div className="flex items-center gap-4 mt-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Stock</p>
                    <p className={`text - sm font - bold ${totalRemainingQty <= 0 ? 'text-red-500' : 'text-slate-900'} `}>
                      {totalRemainingQty.toFixed(2)} <span className="text-xs font-normal text-slate-400">{m.unit}s</span>
                    </p>
                  </div>
                  <div className="h-6 w-px bg-slate-100" />
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Costo Prom.</p>
                    <p className="text-sm font-bold text-slate-700">{formatCurrency(weightedAvgCost)}</p>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setExpandedMaterialId(expandedMaterialId === m.id ? null : m.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${expandedMaterialId === m.id ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                  >
                    <History size={13} />
                    {expandedMaterialId === m.id ? 'Cerrar' : 'Lotes'}
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => {
                        const stats = getBatchStats(m.id);
                        setEditingId(m.id);
                        setFormData({ ...m, initialQty: stats.totalRemainingQty, unitCost: stats.weightedAvgCost });
                        setIsModalOpen(true);
                      }}
                      className="flex items-center justify-center rounded-lg bg-slate-50 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 transition-all"
                    >
                      <Edit2 size={15} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={async () => {
                        try {
                          await deleteRawMaterial(m.id);
                        } catch (err: any) {
                          console.error("Error deleting material:", err);
                          alert(`No se pudo eliminar el material: ${translateError(err)} `);
                        }
                      }}
                      className="flex items-center justify-center rounded-lg bg-slate-50 p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {/* ACCORDION MOBILE */}
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
      <div className="hidden md:block overflow-x-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full border-collapse text-left table-fixed">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/50 text-xs font-semibold uppercase tracking-wider text-gray-500 backdrop-blur-sm">
              <tr>
                <th className="w-[30%] px-4 py-3 truncate">Materia Prima</th>
                <th className="w-[12%] px-4 py-3 truncate">Categoría</th>
                <th className="w-[18%] px-4 py-3 truncate text-right">Disponible / Deuda</th>
                <th className="w-[15%] px-4 py-3 truncate text-right">Valor en Bodega</th>
                <th className="w-[15%] px-4 py-3 truncate text-right">Costo Promedio</th>
                <th className="w-[10%] px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMaterials.map((m) => {
                const { totalRemainingQty, weightedAvgCost } = getBatchStats(m.id);
                const debtInfo = getMaterialDebt(m.id, movements);
                const hasDebt = debtInfo.pendingQty > 0;
                const isDimensional = m.unit === 'metro' || m.unit === 'cm';

                // Real stock representation based on Single Ledger
                const displayStock = totalRemainingQty;

                // Financial valuation (Stock * Cost), projecting negative if debt
                const valuation = displayStock * weightedAvgCost;

                return (
                  <React.Fragment key={m.id}>
                    <tr className={`group transition-all hover:bg-slate-50 ${expandedMaterialId === m.id ? 'bg-slate-50/50' : 'bg-white'}`}>
                      <td className="px-4 py-4 truncate border-l-4 border-transparent">
                        <div className="flex flex-col gap-0.5" title={`${m.name} - ${m.provider || 'Varios'}`}>
                          <span className="font-semibold text-gray-900 truncate" title={m.name}>{m.name}</span>
                          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest truncate" title={m.provider || 'Varios'}>{m.provider || 'Varios'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 truncate">
                        <Badge variant="secondary" className="font-medium bg-gray-100 text-gray-700" title={m.type}>
                          {m.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 truncate text-right">
                        <div className="flex justify-end items-center" title={`Stock Actual: ${displayStock.toFixed(2)} ${m.unit}s`}>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-black ${displayStock > 0 ? 'bg-emerald-100 text-emerald-800' : displayStock < 0 ? 'bg-red-100 border border-red-200 text-red-700 shadow-sm' : 'bg-gray-100 text-gray-600'}`}>
                            {displayStock < 0 ? '🔴 ' : displayStock > 0 ? '🟢 ' : ''}
                            {displayStock.toFixed(2)} <span className="ml-1 text-[10px] opacity-70 font-bold">{m.unit}s</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 truncate text-right">
                        <span className={`font-mono text-sm font-bold ${valuation < 0 ? 'text-red-600' : 'text-indigo-900'}`} title={`Valorización: ${formatCurrency(valuation)}`}>
                          {formatCurrency(valuation)}
                        </span>
                      </td>
                      <td className="px-4 py-4 truncate text-right">
                        <span className="font-semibold text-gray-600 text-sm" title={`Costo Promedio FIFO: ${formatCurrency(weightedAvgCost)}`}>
                          {formatCurrency(weightedAvgCost)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => setExpandedMaterialId(expandedMaterialId === m.id ? null : m.id)}
                            className={`rounded-lg p-1.5 transition-colors border ${expandedMaterialId === m.id ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'border-transparent bg-gray-50 text-indigo-600 hover:border-gray-200 hover:bg-white hover:text-indigo-700'}`}
                            title={expandedMaterialId === m.id ? "Cerrar Detalles" : "Ver Lotes (Histórico)"}
                          >
                            <History size={16} />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => {
                                const stats = getBatchStats(m.id);
                                setEditingId(m.id);
                                setFormData({ ...m, initialQty: stats.totalRemainingQty, unitCost: stats.weightedAvgCost });
                                setIsModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 transition-colors border border-transparent bg-gray-50 text-gray-400 hover:border-gray-200 hover:bg-white hover:text-gray-600"
                              title="Editar Materia Prima"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={async () => {
                                try {
                                  await deleteRawMaterial(m.id);
                                } catch (err: any) {
                                  console.error("Error deleting material:", err);
                                  alert(`No se pudo eliminar: ${translateError(err)}`);
                                }
                              }}
                              className="rounded-lg p-1.5 transition-colors border border-transparent bg-gray-50 text-gray-400 hover:border-gray-200 hover:bg-white hover:text-red-600"
                              title="Eliminar Materia Prima"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ACCORDION DESKTOP IN-LINE */}
                    {expandedMaterialId === m.id && (
                      <tr>
                        <td colSpan={6} className="p-0 border-b border-indigo-100 bg-indigo-50/30">
                          <div className="p-6 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">

                            {/* NEW BATCH FORM */}
                            <div className="no-print rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                              <div className="mb-4 flex items-center justify-between">
                                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
                                  <ShoppingCart size={14} /> Registrar Nueva Entrada Física
                                </h4>
                                {isDimensional && (
                                  <div className="flex gap-1 rounded-xl border border-indigo-100 bg-slate-50 p-1">
                                    <button type="button" onClick={() => set_entry_mode('rollo')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-[10px] font-bold uppercase transition-all ${entry_mode === 'rollo' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}>
                                      <RotateCcw size={12} /> Rollo
                                    </button>
                                    <button type="button" onClick={() => set_entry_mode('pieza')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-[10px] font-bold uppercase transition-all ${entry_mode === 'pieza' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}>
                                      <Scissors size={12} /> Pieza
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
                                          <div className="w-24"><Input label={`M. Lineales`} type="number" step="0.01" value={batchFormData.initial_quantity || ''} onChange={e => setBatchFormData({ ...batchFormData, initial_quantity: parseFloat(e.target.value) })} required /></div>
                                        ) : (
                                          <div className="w-24"><Input label="Largo (cm)" type="number" step="0.01" value={batchFormData.length || ''} onChange={e => setBatchFormData({ ...batchFormData, length: parseFloat(e.target.value) })} required /></div>
                                        )}
                                        <div className="w-24"><Input label="Ancho (cm)" type="number" step="1" value={batchFormData.width || ''} onChange={e => setBatchFormData({ ...batchFormData, width: parseInt(e.target.value) })} required className="text-emerald-700" /></div>
                                        <div className="w-32"><Input label={entry_mode === 'rollo' ? `Costo / Metro` : `Costo Total`} type="number" step="0.01" value={batchFormData.unit_cost || ''} onChange={e => setBatchFormData({ ...batchFormData, unit_cost: parseFloat(e.target.value) })} required /></div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="w-32"><Input label={`Cantidad (${m.unit})`} type="number" step="0.01" value={batchFormData.initial_quantity || ''} onChange={e => setBatchFormData({ ...batchFormData, initial_quantity: parseFloat(e.target.value) })} required /></div>
                                        <div className="w-32"><Input label={`Costo Total (€)`} type="number" step="0.01" value={batchFormData.unit_cost || ''} onChange={e => setBatchFormData({ ...batchFormData, unit_cost: parseFloat(e.target.value) })} required /></div>
                                      </>
                                    )}

                                    <Button type="submit" variant="primary" icon={<Plus size={16} />} className="mb-0.5 h-10 w-full sm:w-auto shadow-md">Añadir Lote</Button>
                                  </div>
                                </form>
                              )}
                            </div>

                            {/* BATCHES TABLE IN-LINE */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Kardex de Lotes y Movimientos</h4>
                                <Button variant="ghost" size="sm" onClick={handlePrint} className="h-8 text-xs font-bold text-slate-500 hover:text-indigo-600"><Printer size={14} className="mr-1" /> Imprimir</Button>
                              </div>
                              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <table className="w-full text-left text-sm table-fixed min-w-[700px] border-collapse">
                                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <tr>
                                      <th className="w-[12%] px-4 py-3">Fecha</th>
                                      <th className="w-[10%] px-4 py-3">Modo</th>
                                      <th className="w-[18%] px-4 py-3">Proveedor</th>
                                      <th className="w-[15%] px-4 py-3 text-right">Dimensiones</th>
                                      <th className="w-[10%] px-4 py-3 text-right text-emerald-600">Área</th>
                                      <th className="w-[10%] px-4 py-3 text-right">Costo</th>
                                      <th className="w-[10%] px-4 py-3 text-right text-indigo-500">/m²</th>
                                      <th className="w-[10%] px-4 py-3 text-right">Restante</th>
                                      <th className="w-[5%] px-4 py-3 text-center"></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-600">
                                    {batches.filter(b => b.material_id === m.id).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(batch => {
                                      const currentTotalPurchaseCost = isDimensional ? (batch.entry_mode === 'pieza' ? batch.unit_cost : (batch.unit_cost * batch.initial_quantity)) : (batch.unit_cost * batch.initial_quantity);
                                      const currentCostPerM2 = isDimensional && batch.area && batch.area > 0 ? currentTotalPurchaseCost / batch.area : 0;
                                      return (
                                        <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                                          <td className="px-4 py-2.5 font-mono text-[10px] font-bold">{batch.date}</td>
                                          <td className="px-4 py-2.5">
                                            {isDimensional ? (
                                              <Badge variant={batch.entry_mode === 'pieza' ? 'warning' : 'default'} className="flex w-fit items-center gap-1 text-[9px] px-1.5 py-0">
                                                {batch.entry_mode === 'pieza' ? <Scissors size={8} /> : <RotateCcw size={8} />}
                                                {batch.entry_mode || 'Rollo'}
                                              </Badge>
                                            ) : (
                                              <Badge variant="default" className="text-[9px] bg-slate-100 text-slate-500">Estándar</Badge>
                                            )}
                                          </td>
                                          <td className="px-4 py-2.5 font-bold text-xs truncate" title={batch.provider}>{batch.provider}</td>
                                          <td className="px-4 py-2.5 text-right flex flex-col items-end">
                                            {isDimensional ? (
                                              <>
                                                <span className="text-xs font-bold text-gray-900 leading-tight">
                                                  {batch.entry_mode === 'pieza' ? `${batch.length} × ${batch.width} cm` : `${batch.initial_quantity.toFixed(2)} m`}
                                                </span>
                                                <span className="text-[9px] font-bold uppercase text-gray-400 leading-tight">{batch.width} cm ancho</span>
                                              </>
                                            ) : (
                                              <span className="text-slate-400 font-bold">---</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-2.5 text-right font-mono text-[10px] font-bold text-emerald-600">{isDimensional && batch.area ? `${batch.area.toFixed(2)} m²` : '---'}</td>
                                          <td className="px-4 py-2.5 text-right font-mono text-[11px] font-bold">{formatCurrency(currentTotalPurchaseCost)}</td>
                                          <td className="px-4 py-2.5 text-right font-mono text-[11px] font-bold text-indigo-600">{isDimensional && currentCostPerM2 > 0 ? formatCurrency(currentCostPerM2) : '---'}</td>
                                          <td className="px-4 py-2.5 text-right">
                                            <Badge variant={batch.remaining_quantity > 0 ? 'success' : 'secondary'} className="text-[10px] font-mono font-bold">
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
                                                  try { await deleteBatch(batch.id); } catch (err: any) { alert(`Error: ${translateError(err)}`); }
                                                }} className="p-1 hover:text-red-600" title="Eliminar Lote">
                                                  <Trash2 size={12} />
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                    {/* Totals Row */}
                                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                                      <td colSpan={3} className="px-4 py-3 uppercase text-[10px] text-slate-800 text-right">Totales Acumulados</td>
                                      <td className="px-4 py-3 text-right font-mono text-[10px] text-slate-500">{isDimensional ? `${totalRemainingQty.toFixed(2)} m` : '---'}</td>
                                      <td className="px-4 py-3 text-right font-mono text-[10px] text-emerald-600">{isDimensional ? `${getBatchStats(m.id).totalArea.toFixed(2)} m²` : '---'}</td>
                                      <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-700">{formatCurrency(getBatchStats(m.id).totalValue)}</td>
                                      <td className="px-4 py-3 text-right font-mono text-[11px] text-indigo-600">{isDimensional ? formatCurrency(getBatchStats(m.id).avgCostPerM2) : '---'}</td>
                                      <td className="px-4 py-3 text-right font-mono text-[10px] text-emerald-600">{totalRemainingQty.toFixed(2)}</td>
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

      {/* ============================================ */}
      {/* MODALS — unchanged logic, kept as-is         */}
      {/* ============================================ */}
      {
        isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}
          >
            <Card className="my-4 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
              <h3 className="mb-6 sm:mb-8 text-xl sm:text-2xl font-bold">
                {editingId ? 'Editar' : 'Nueva'} Materia Prima
              </h3>
              <form onSubmit={handleMasterSubmit} className="space-y-4 sm:space-y-5">
                <Input
                  label="Nombre"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Tela de Corazón"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Tipo / Categoría"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="Tela">Tela</option>
                    <option value="Hilo">Hilo</option>
                    <option value="Herrajes">Herrajes</option>
                    <option value="Accesorios">Accesorios</option>
                    <option value="Otros">Otros</option>
                  </Select>
                  <Input
                    label="Proveedor"
                    value={formData.provider}
                    onChange={e => setFormData({ ...formData, provider: e.target.value })}
                    placeholder="Ej. Textiles Premium"
                  />
                </div>
                <Input
                  label="Descripción"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalles de la materia prima..."
                />
                {/* Unidad + Costo en una línea */}
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Unidad de Medida"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value as Unit })}
                  >
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
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.unitCost || ''}
                      onChange={e => setFormData({ ...formData, unitCost: parseFloat(e.target.value) })}
                      placeholder="0"
                      disabled={!!editingId}
                    />
                  </div>
                </div>
                {/* Ancho + Cantidad + Estado toggle en una línea */}
                <div className="grid grid-cols-3 gap-3 items-end">
                  {formData.unit === 'metro' ? (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-emerald-500">Ancho (cm)</label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.width || ''}
                        onChange={e => setFormData({ ...formData, width: parseInt(e.target.value) })}
                        placeholder="140"
                      />
                    </div>
                  ) : (
                    <div />
                  )}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Cantidad</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.initialQty || ''}
                      onChange={e => setFormData({ ...formData, initialQty: parseFloat(e.target.value) })}
                      placeholder="0"
                      disabled={!!editingId}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Estado</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: formData.status === 'activa' ? 'inactiva' : 'activa' })}
                      className={`
w - full flex items - center justify - center gap - 2 rounded - xl px - 3 py - 2.5 text - sm font - bold transition - all active: scale - 95
                      ${formData.status === 'activa'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : 'bg-gray-100 text-gray-400 ring-1 ring-gray-200'
                        }
`}
                    >
                      <div className={`size - 2.5 rounded - full transition - colors ${formData.status === 'activa' ? 'bg-emerald-500' : 'bg-gray-300'} `} />
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



      {
        editingBatchData && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          >
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto p-6 sm:p-8">
              <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
                <Pencil size={18} className="text-indigo-500" /> Editar Registro
              </h4>
              <form onSubmit={handleEditBatchSubmit} className="space-y-4">
                {editingBatchData.remaining_quantity < editingBatchData.initial_quantity && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <AlertCircle size={20} className="mt-0.5 shrink-0 text-amber-500" />
                    <p className="text-xs font-bold leading-tight text-amber-700">
                      ESTE LOTE YA SE HA USADO. La cantidad, costo y dimensiones no son editables para mantener la coherencia FIFO.
                    </p>
                  </div>
                )}
                <Input
                  label="Fecha"
                  type="date"
                  value={editingBatchData.date}
                  onChange={e => setEditingBatchData({ ...editingBatchData, date: e.target.value })}
                  required
                />
                <Input
                  label="Proveedor / Referencia"
                  value={editingBatchData.provider}
                  onChange={e => setEditingBatchData({ ...editingBatchData, provider: e.target.value })}
                />
                {editingBatchData.entry_mode === 'pieza' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Largo (cm)"
                      type="number" step="0.01"
                      disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity}
                      value={editingBatchData.length || ''}
                      onChange={e => setEditingBatchData({ ...editingBatchData, length: parseFloat(e.target.value) })}
                    />
                    <Input
                      label="Ancho (cm)"
                      type="number" step="1"
                      disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity}
                      value={editingBatchData.width || ''}
                      onChange={e => setEditingBatchData({ ...editingBatchData, width: parseInt(e.target.value) })}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="M. Lineales"
                      type="number" step="0.01"
                      disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity}
                      value={editingBatchData.initial_quantity}
                      onChange={e => setEditingBatchData({ ...editingBatchData, initial_quantity: parseFloat(e.target.value) })}
                    />
                    <Input
                      label="Ancho (cm)"
                      type="number" step="1"
                      disabled={editingBatchData.remaining_quantity < editingBatchData.initial_quantity}
                      value={editingBatchData.width || ''}
                      onChange={e => setEditingBatchData({ ...editingBatchData, width: parseInt(e.target.value) })}
                    />
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