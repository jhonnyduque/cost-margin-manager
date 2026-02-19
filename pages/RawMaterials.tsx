
import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Search, X, History, ShoppingCart, Info, ArrowDownToLine, Printer, Pencil, AlertCircle, Maximize2, Scissors, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { RawMaterial, Status, Unit, MaterialBatch } from '../types';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const RawMaterials: React.FC = () => {
  const { currentCompanyId, rawMaterials, batches, addRawMaterial, deleteRawMaterial, updateRawMaterial, addBatch, deleteBatch, updateBatch } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<'rollo' | 'pieza'>('rollo');

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
    provider: '', initialQuantity: 0, unitCost: 0, reference: '', width: 140, length: 0
  });

  const filteredMaterials = rawMaterials.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.provider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getBatchStats = (materialId: string) => {
    const matBatches = batches.filter(b => b.materialId === materialId);
    const totalOriginalQty = matBatches.reduce((acc, b) => acc + b.initialQuantity, 0);
    const totalRemainingQty = matBatches.reduce((acc, b) => acc + b.remainingQuantity, 0);
    const totalValue = matBatches.reduce((acc, b) => acc + (b.unitCost * b.initialQuantity), 0);
    const weightedAvgCost = totalOriginalQty > 0 ? totalValue / totalOriginalQty : 0;

    const totalArea = matBatches.reduce((acc, b) => acc + (b.area || 0), 0);
    const avgCostPerM2 = totalArea > 0 ? totalValue / totalArea : 0;

    return { totalOriginalQty, totalRemainingQty, totalValue, weightedAvgCost, totalArea, avgCostPerM2 };
  };

  const handleMasterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const materialId = editingId || crypto.randomUUID();

    const materialData: RawMaterial = {
      id: materialId,
      name: formData.name,
      description: formData.description,
      type: formData.type,
      unit: formData.unit,
      provider: formData.provider,
      status: formData.status,
      company_id: currentCompanyId || ''
    };

    if (editingId) {
      updateRawMaterial(materialData);
    } else {
      addRawMaterial(materialData);
      if (formData.initialQty > 0) {
        const area = formData.unit === 'metro' ? formData.initialQty * ((formData.width || 0) / 100) : undefined;
        const batch: MaterialBatch = {
          id: crypto.randomUUID(),
          materialId: materialId,
          date: new Date().toISOString().split('T')[0],
          provider: formData.provider || 'Carga Inicial',
          initialQuantity: formData.initialQty,
          remainingQuantity: formData.initialQty,
          unitCost: formData.unitCost,
          reference: 'Carga Inicial',
          width: formData.width,
          area: area,
          entryMode: 'rollo',
          company_id: currentCompanyId || ''
        };
        addBatch(batch);
      }
    }
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMaterialId) return;
    const material = rawMaterials.find(m => m.id === activeMaterialId);

    let area = 0;
    let finalQty = batchFormData.initialQuantity || 0;
    let finalUnitCost = batchFormData.unitCost || 0;

    if (entryMode === 'rollo') {
      area = (batchFormData.initialQuantity || 0) * ((batchFormData.width || 0) / 100);
      finalUnitCost = batchFormData.unitCost || 0;
    } else {
      area = ((batchFormData.length || 0) * (batchFormData.width || 0)) / 10000;
      finalQty = (batchFormData.length || 0) / 100; // Largo en metros para FIFO
      finalUnitCost = (batchFormData.unitCost || 0) / finalQty; // Costo por metro para FIFO
    }

    const data = {
      ...batchFormData,
      id: crypto.randomUUID(),
      materialId: activeMaterialId,
      initialQuantity: finalQty,
      remainingQuantity: finalQty,
      unitCost: finalUnitCost,
      area: area,
      entryMode: entryMode,
      company_id: currentCompanyId || ''
    } as MaterialBatch;

    addBatch(data);
    setBatchFormData({
      date: new Date().toISOString().split('T')[0],
      provider: material?.provider || '',
      initialQuantity: 0,
      unitCost: 0,
      reference: '',
      width: 140,
      length: 0
    });
  };

  const handleEditBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBatchData) {
      const original = batches.find(b => b.id === editingBatchData.id);
      if (original && original.remainingQuantity < original.initialQuantity) {
        updateBatch({
          ...editingBatchData,
          initialQuantity: original.initialQuantity,
          unitCost: original.unitCost
        });
      } else {
        let area = 0;
        let finalQty = editingBatchData.initialQuantity;
        let finalUnitCost = editingBatchData.unitCost;

        if (editingBatchData.entryMode === 'rollo') {
          area = editingBatchData.initialQuantity * ((editingBatchData.width || 0) / 100);
          finalUnitCost = editingBatchData.unitCost;
        } else {
          area = ((editingBatchData.length || 0) * (editingBatchData.width || 0)) / 10000;
          finalQty = (editingBatchData.length || 0) / 100;
          finalUnitCost = (editingBatchData.unitCost || 0) / finalQty;
        }

        updateBatch({
          ...editingBatchData,
          initialQuantity: finalQty,
          unitCost: finalUnitCost,
          area: area,
          remainingQuantity: finalQty
        });
      }
      setEditingBatchData(null);
    }
  };

  const calculatedArea = useMemo(() => {
    if (entryMode === 'rollo') {
      return (batchFormData.initialQuantity || 0) * ((batchFormData.width || 0) / 100);
    } else {
      return ((batchFormData.length || 0) * (batchFormData.width || 0)) / 10000;
    }
  }, [entryMode, batchFormData.initialQuantity, batchFormData.width, batchFormData.length]);

  const calculatedCostPerM2 = useMemo(() => {
    const totalCostInput = batchFormData.unitCost || 0;
    if (entryMode === 'rollo') {
      const totalCost = (batchFormData.initialQuantity || 0) * totalCostInput;
      return calculatedArea > 0 ? totalCost / calculatedArea : 0;
    } else {
      return calculatedArea > 0 ? totalCostInput / calculatedArea : 0;
    }
  }, [entryMode, batchFormData.unitCost, batchFormData.initialQuantity, calculatedArea]);

  const handlePrint = () => {
    window.print();
  };

  const activeMaterial = rawMaterials.find(m => m.id === activeMaterialId);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Materias Primas</h1>
          <p className="text-gray-500 font-medium">Inventario Maestro y Gestión FIFO</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', description: '', type: 'Tela', unit: 'metro', provider: '', status: 'activa', initialQty: 0, unitCost: 0, width: 140 });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-[#4f46e5] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-[#4338ca] transition-all"
        >
          <Plus size={18} /> Nuevo Material
        </button>
      </header>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text" placeholder="Buscar material o proveedor..."
          className="w-full pl-10 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#4f46e5] outline-none transition-all"
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Materia Prima</th>
              <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Categoría</th>
              <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Stock Actual</th>
              <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Costo Promedio</th>
              <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredMaterials.map((m) => {
              const { totalRemainingQty, weightedAvgCost } = getBatchStats(m.id);
              return (
                <tr key={m.id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{m.name}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">{m.provider || 'Varios'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-500 uppercase">{m.type}</span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <span className={`text-sm font-black ${totalRemainingQty <= 0 ? 'text-red-500' : 'text-gray-900'}`}>
                      {totalRemainingQty.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase ml-1.5 font-bold">{m.unit}s</span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <span className="text-sm font-bold text-gray-700">{formatCurrency(weightedAvgCost)}</span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setActiveMaterialId(m.id); setIsBatchModalOpen(true); }} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver Lotes"><History size={18} /></button>
                      <button onClick={() => {
                        const stats = getBatchStats(m.id);
                        setEditingId(m.id);
                        setFormData({ ...m, initialQty: stats.totalRemainingQty, unitCost: stats.weightedAvgCost });
                        setIsModalOpen(true);
                      }} className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors"><Edit2 size={18} /></button>
                      <button onClick={() => deleteRawMaterial(m.id)} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl p-10 my-8">
            <h3 className="text-2xl font-black text-gray-900 mb-8">
              {editingId ? 'Editar' : 'Nueva'} Materia Prima
            </h3>

            <form onSubmit={handleMasterSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre</label>
                <input required className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#4f46e5] text-gray-900 font-medium placeholder-gray-300"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Tela de Corazón"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tipo / Categoría</label>
                  <select className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none text-gray-900 font-medium appearance-none cursor-pointer"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="Tela">Tela</option>
                    <option value="Hilo">Hilo</option>
                    <option value="Herrajes">Herrajes</option>
                    <option value="Accesorios">Accesorios</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Proveedor</label>
                  <input className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none text-gray-900 font-medium placeholder-gray-300"
                    value={formData.provider}
                    onChange={e => setFormData({ ...formData, provider: e.target.value })}
                    placeholder="Ej. Textiles Premium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Descripción</label>
                <input className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none text-gray-900 font-medium placeholder-gray-300"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalles de la materia prima..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Unidad de Medida</label>
                  <select className="w-full px-5 py-4 bg-indigo-50/30 border border-indigo-100 rounded-2xl outline-none text-indigo-900 font-black appearance-none cursor-pointer"
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
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Costo por {formData.unit}</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
                    <input type="number" step="0.01"
                      className="w-full pl-10 pr-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none text-gray-900 font-black"
                      value={formData.unitCost || ''}
                      onChange={e => setFormData({ ...formData, unitCost: parseFloat(e.target.value) })}
                      placeholder="0"
                      disabled={!!editingId}
                    />
                  </div>
                </div>
              </div>

              {formData.unit === 'metro' && (
                <div className="space-y-2 animate-in fade-in zoom-in-95">
                  <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">Ancho útil (cm)</label>
                  <div className="relative">
                    <input type="number" step="1"
                      className="w-full px-5 py-4 bg-emerald-50/30 border border-emerald-100 rounded-2xl outline-none text-emerald-700 font-black"
                      value={formData.width || ''}
                      onChange={e => setFormData({ ...formData, width: parseInt(e.target.value) })}
                      placeholder="140"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-300 uppercase">cm</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cantidad en Inventario</label>
                  <div className="relative group">
                    <input type="number" step="0.01"
                      className="w-full px-5 py-4 bg-white border-2 border-[#4f46e5] rounded-2xl outline-none text-gray-900 font-black text-center shadow-sm"
                      value={formData.initialQty || ''}
                      onChange={e => setFormData({ ...formData, initialQty: parseFloat(e.target.value) })}
                      placeholder="0"
                      disabled={!!editingId}
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300 uppercase select-none">
                      {formData.unit.charAt(0)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Estado</label>
                  <select className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none text-gray-900 font-medium appearance-none cursor-pointer"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as Status })}
                  >
                    <option value="activa">Activa</option>
                    <option value="inactiva">Inactiva</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 border border-gray-100 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-5 bg-[#4f46e5] text-white rounded-2xl font-black shadow-xl hover:shadow-indigo-200 transition-all">Guardar Material</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-[90vw] flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-10 py-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-2xl font-black text-gray-900">Histórico de Compras y Lotes</h3>
                <p className="text-sm font-medium text-gray-400">{activeMaterial?.name} ({activeMaterial?.type})</p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button onClick={handlePrint} className="p-3 hover:bg-white rounded-full transition-all text-gray-400 hover:text-[#4f46e5]" title="Imprimir Histórico"><Printer size={24} /></button>
                <button onClick={() => setIsBatchModalOpen(false)} className="p-3 hover:bg-white rounded-full transition-all"><X size={24} className="text-gray-400" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-10" id="print-area">
              <div className="bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100 no-print">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <ShoppingCart size={14} /> Registrar Nueva Entrada de Stock
                  </h4>
                  <div className="bg-white p-1 rounded-xl border border-indigo-100 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEntryMode('rollo')}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-all ${entryMode === 'rollo' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                      <RotateCcw size={12} /> Rollo Lineal
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryMode('pieza')}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-all ${entryMode === 'pieza' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                      <Scissors size={12} /> Pieza Irregular
                    </button>
                  </div>
                </div>

                <form onSubmit={handleBatchSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Fecha</label>
                      <input type="date" required className="w-full px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none" value={batchFormData.date} onChange={e => setBatchFormData({ ...batchFormData, date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Proveedor / Ref.</label>
                      <input className="w-full px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none" value={batchFormData.provider} onChange={e => setBatchFormData({ ...batchFormData, provider: e.target.value })} />
                    </div>

                    {entryMode === 'rollo' ? (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Metros Lineales</label>
                        <input type="number" step="0.01" required className="w-full px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none" value={batchFormData.initialQuantity || ''} onChange={e => setBatchFormData({ ...batchFormData, initialQuantity: parseFloat(e.target.value) })} />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Largo (cm)</label>
                        <input type="number" step="0.01" required className="w-full px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none" value={batchFormData.length || ''} onChange={e => setBatchFormData({ ...batchFormData, length: parseFloat(e.target.value) })} />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-emerald-500 uppercase ml-1">Ancho (cm)</label>
                      <input type="number" step="1" required className="w-full px-5 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm font-bold outline-none text-emerald-700" value={batchFormData.width || ''} onChange={e => setBatchFormData({ ...batchFormData, width: parseInt(e.target.value) })} />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{entryMode === 'rollo' ? 'Costo/Metro (€)' : 'Costo Total (€)'}</label>
                      <input type="number" step="0.01" required className="w-full px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none" value={batchFormData.unitCost || ''} onChange={e => setBatchFormData({ ...batchFormData, unitCost: parseFloat(e.target.value) })} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 items-center p-4 bg-white/50 border border-indigo-100 rounded-2xl shadow-inner">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Área Total Calculada</span>
                      <span className="text-lg font-black text-indigo-900">{calculatedArea.toFixed(2)} m²</span>
                    </div>
                    <div className="w-px h-8 bg-indigo-100 mx-2 hidden sm:block"></div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Costo Real por m²</span>
                      <span className="text-lg font-black text-emerald-600">{formatCurrency(calculatedCostPerM2)}/m²</span>
                    </div>
                    <button type="submit" className="ml-auto bg-[#4f46e5] text-white px-8 py-3 rounded-xl font-black shadow-lg hover:bg-[#4338ca] transition-all flex items-center gap-2 text-sm">
                      <Plus size={18} /> Confirmar Entrada
                    </button>
                  </div>
                </form>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 no-print">Lotes Activos y Movimientos</h4>
                <div className="bg-white border border-gray-100 rounded-[2rem] shadow-sm overflow-x-auto">
                  <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-5 w-10 text-center"></th>
                        <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">FECHA ENTRADA</th>
                        <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">MODO</th>
                        <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">PROVEEDOR / REF.</th>
                        <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">DIMENSIONES</th>
                        <th className="px-6 py-5 text-[10px] font-bold text-emerald-600 uppercase tracking-widest text-right">ÁREA (m²)</th>
                        <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">COSTO COMPRA</th>
                        <th className="px-6 py-5 text-[10px] font-bold text-indigo-500 uppercase tracking-widest text-right">COSTO m²</th>
                        <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">RESTANTE</th>
                        <th className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center no-print">ACCIÓN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {batches.filter(b => b.materialId === activeMaterialId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((batch) => {
                        const currentTotalPurchaseCost = batch.entryMode === 'pieza' ? (batch.unitCost * batch.initialQuantity) : (batch.unitCost * batch.initialQuantity);
                        const currentCostPerM2 = batch.area && batch.area > 0 ? currentTotalPurchaseCost / batch.area : 0;

                        return (
                          <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4 text-center">
                              <ArrowDownToLine size={16} className="text-emerald-500 mx-auto" />
                            </td>
                            <td className="px-6 py-4 text-[11px] font-bold text-gray-600">{batch.date}</td>
                            <td className="px-6 py-4">
                              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase ${batch.entryMode === 'pieza' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                                {batch.entryMode === 'pieza' ? <Scissors size={10} /> : <RotateCcw size={10} />}
                                {batch.entryMode || 'Rollo'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-[11px] font-black text-gray-900">{batch.provider}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-[11px] font-bold text-gray-900">
                                  {batch.entryMode === 'pieza' ? `${batch.length} × ${batch.width} cm` : `${batch.initialQuantity.toFixed(2)} m lineales`}
                                </span>
                                <span className="text-[9px] text-gray-400 font-bold uppercase">{batch.width} cm ancho</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-[11px] font-black text-right text-emerald-600 font-mono">{batch.area ? `${batch.area.toFixed(2)} m²` : '---'}</td>
                            <td className="px-6 py-4 text-[11px] font-black text-right font-mono text-gray-900">{formatCurrency(currentTotalPurchaseCost)}</td>
                            <td className="px-6 py-4 text-[11px] font-black text-right font-mono text-indigo-600">
                              {currentCostPerM2 > 0 ? formatCurrency(currentCostPerM2) : '---'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`px-2 py-1 rounded-lg font-black text-[11px] ${batch.remainingQuantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-300'}`}>
                                {batch.remainingQuantity.toFixed(2)} m
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center no-print">
                              <div className="flex justify-center gap-1">
                                <button onClick={() => setEditingBatchData(batch)} className="p-2 text-gray-300 hover:text-indigo-600 transition-colors" title="Editar Lote"><Pencil size={16} /></button>
                                <button onClick={() => deleteBatch(batch.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors" title="Eliminar Lote"><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {activeMaterialId && (
                        <tr className="bg-gray-50/80 font-black border-t-2 border-gray-200">
                          <td className="px-4"></td>
                          <td className="px-6 py-5 text-[10px] text-gray-900 uppercase">TOTALES</td>
                          <td className="px-6 py-5 text-center text-gray-400">-</td>
                          <td className="px-6 py-5 text-[10px] text-gray-400 text-center">-</td>
                          <td className="px-6 py-5 text-[11px] text-right font-mono text-gray-400">
                            {getBatchStats(activeMaterialId).totalOriginalQty.toFixed(2)} m lineales
                          </td>
                          <td className="px-6 py-5 text-[11px] text-right font-mono text-emerald-600">
                            {getBatchStats(activeMaterialId).totalArea.toFixed(2)} m²
                          </td>
                          <td className="px-6 py-5 text-[11px] text-right font-mono text-gray-400">
                            {formatCurrency(getBatchStats(activeMaterialId).totalValue)}
                          </td>
                          <td className="px-6 py-5 text-[11px] text-right font-mono text-indigo-600">
                            {formatCurrency(getBatchStats(activeMaterialId).avgCostPerM2)}
                          </td>
                          <td className="px-6 py-5 text-[11px] text-right font-mono text-emerald-600">
                            {getBatchStats(activeMaterialId).totalRemainingQty.toFixed(2)} m
                          </td>
                          <td className="px-6 py-5 text-center text-gray-400 no-print">-</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-10 py-8 bg-gray-50 border-t border-gray-100 flex justify-end no-print">
              <button onClick={() => setIsBatchModalOpen(false)} className="px-10 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 hover:bg-gray-100 transition-all shadow-sm">Cerrar Visor</button>
            </div>
          </div>
        </div>
      )}

      {editingBatchData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 border border-gray-100">
            <h4 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <Pencil size={18} className="text-indigo-500" /> Editar Registro
            </h4>

            <form onSubmit={handleEditBatchSubmit} className="space-y-4">
              {editingBatchData.remainingQuantity < editingBatchData.initialQuantity && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                  <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-amber-700 leading-tight">
                    ESTE LOTE YA SE HA USADO. La cantidad, costo y dimensiones no son editables para mantener la coherencia FIFO.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Fecha</label>
                <input type="date" required className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                  value={editingBatchData.date} onChange={e => setEditingBatchData({ ...editingBatchData, date: e.target.value })} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Proveedor / Referencia</label>
                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                  value={editingBatchData.provider} onChange={e => setEditingBatchData({ ...editingBatchData, provider: e.target.value })} />
              </div>

              {editingBatchData.entryMode === 'pieza' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase">Largo (cm)</label>
                    <input type="number" step="0.01"
                      disabled={editingBatchData.remainingQuantity < editingBatchData.initialQuantity}
                      className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none disabled:opacity-50 font-bold text-sm"
                      value={editingBatchData.length || ''} onChange={e => setEditingBatchData({ ...editingBatchData, length: parseFloat(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-emerald-500 uppercase">Ancho (cm)</label>
                    <input type="number" step="1"
                      disabled={editingBatchData.remainingQuantity < editingBatchData.initialQuantity}
                      className="w-full px-3 py-3 bg-emerald-50/50 border border-emerald-100 rounded-xl outline-none disabled:opacity-50 font-bold text-sm text-emerald-700"
                      value={editingBatchData.width || ''} onChange={e => setEditingBatchData({ ...editingBatchData, width: parseInt(e.target.value) })} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase">M. Lineales</label>
                    <input type="number" step="0.01"
                      disabled={editingBatchData.remainingQuantity < editingBatchData.initialQuantity}
                      className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none disabled:opacity-50 font-bold text-sm"
                      value={editingBatchData.initialQuantity} onChange={e => setEditingBatchData({ ...editingBatchData, initialQuantity: parseFloat(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-emerald-500 uppercase">Ancho (cm)</label>
                    <input type="number" step="1"
                      disabled={editingBatchData.remainingQuantity < editingBatchData.initialQuantity}
                      className="w-full px-3 py-3 bg-emerald-50/50 border border-emerald-100 rounded-xl outline-none disabled:opacity-50 font-bold text-sm text-emerald-700"
                      value={editingBatchData.width || ''} onChange={e => setEditingBatchData({ ...editingBatchData, width: parseInt(e.target.value) })} />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase">{editingBatchData.entryMode === 'pieza' ? 'Costo Total (€)' : 'Costo Unitario (€/m)'}</label>
                <input type="number" step="0.01"
                  disabled={editingBatchData.remainingQuantity < editingBatchData.initialQuantity}
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none disabled:opacity-50 font-bold text-sm"
                  value={editingBatchData.unitCost} onChange={e => setEditingBatchData({ ...editingBatchData, unitCost: parseFloat(e.target.value) })} />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditingBatchData(null)} className="flex-1 py-4 border border-gray-100 rounded-xl font-bold text-gray-400">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RawMaterials;
