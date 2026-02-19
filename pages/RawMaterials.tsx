import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Search, X, History, ShoppingCart, ArrowDownToLine, Printer, Pencil, AlertCircle, Maximize2, Scissors, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { RawMaterial, Status, Unit, MaterialBatch } from '../types';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Select } from '@/src/components/ui/Select';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/Table';
import { tokens } from '@/src/design/design-tokens';

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
      <PageHeader
        title="Materias Primas"
        description="Inventario Maestro y Gestión FIFO"
        actions={
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
        }
      />

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Search size={18} />
        </div>
        <Input
          placeholder="Buscar material o proveedor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          fullWidth
        />
      </div>

      <TableContainer>

        <TableHeader>
          <TableRow>
            <TableHead>Materia Prima</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Stock Actual</TableHead>
            <TableHead className="text-right">Costo Promedio</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredMaterials.map((m) => {
            const { totalRemainingQty, weightedAvgCost } = getBatchStats(m.id);
            return (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold">{m.name}</span>
                    <span className="text-xs text-gray-400">{m.provider || 'Varios'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{m.type}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className={`font-bold ${totalRemainingQty <= 0 ? 'text-red-500' : ''}`}>
                    {totalRemainingQty.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">{m.unit}s</span>
                </TableCell>
                <TableCell className="text-right font-medium text-gray-700">
                  {formatCurrency(weightedAvgCost)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setActiveMaterialId(m.id); setIsBatchModalOpen(true); }} title="Ver Lotes">
                      <History size={16} className="text-indigo-400" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      const stats = getBatchStats(m.id);
                      setEditingId(m.id);
                      setFormData({ ...m, initialQty: stats.totalRemainingQty, unitCost: stats.weightedAvgCost });
                      setIsModalOpen(true);
                    }}>
                      <Edit2 size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteRawMaterial(m.id)}>
                      <Trash2 size={16} className="text-red-400" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>

      </TableContainer>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}
        >
          <Card className="w-full max-w-xl p-8 my-8">
            <h3 className="text-2xl font-bold mb-8">
              {editingId ? 'Editar' : 'Nueva'} Materia Prima
            </h3>

            <form onSubmit={handleMasterSubmit} className="space-y-6">
              <Input
                label="Nombre"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej. Tela de Corazón"
                required
              />

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Costo por {formData.unit}</label>
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

              {formData.unit === 'metro' && (
                <div className="animate-in fade-in zoom-in-95">
                  <label className="text-xs font-bold text-emerald-500 uppercase tracking-widest ml-1 mb-1 block">Ancho útil (cm)</label>
                  <Input
                    type="number"
                    step="1"
                    value={formData.width || ''}
                    onChange={e => setFormData({ ...formData, width: parseInt(e.target.value) })}
                    placeholder="140"
                    className="!ring-emerald-500 !text-emerald-700 !bg-emerald-50/10"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 ml-1 mb-1 block">Cantidad Inventario</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.initialQty || ''}
                    onChange={e => setFormData({ ...formData, initialQty: parseFloat(e.target.value) })}
                    placeholder="0"
                    disabled={!!editingId}
                    className="text-center"
                  />
                </div>
                <Select
                  label="Estado"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as Status })}
                >
                  <option value="activa">Activa</option>
                  <option value="inactiva">Inactiva</option>
                </Select>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1" variant="primary">Guardar Material</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {isBatchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <Card className="w-full max-w-[90vw] flex flex-col max-h-[90vh] overflow-hidden !p-0">
            <div className="px-10 py-6 border-b flex justify-between items-center" style={{ backgroundColor: tokens.colors.bg, borderColor: tokens.colors.border }}>
              <div>
                <h3 className="text-xl font-bold">Histórico de Compras y Lotes</h3>
                <p className="text-sm font-medium text-gray-400">{activeMaterial?.name} ({activeMaterial?.type})</p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <Button variant="ghost" onClick={handlePrint} icon={<Printer size={20} />} title="Imprimir" />
                <Button variant="ghost" onClick={() => setIsBatchModalOpen(false)} icon={<X size={20} />} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-10" id="print-area">
              <div className="bg-indigo-50/50 p-8 rounded-3xl border border-indigo-100 no-print">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <ShoppingCart size={14} /> Registrar Nueva Entrada de Stock
                  </h4>
                  <div className="bg-white p-1 rounded-xl border border-indigo-100 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEntryMode('rollo')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-all ${entryMode === 'rollo' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                      <RotateCcw size={12} /> Rollo
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryMode('pieza')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-all ${entryMode === 'pieza' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                      <Scissors size={12} /> Pieza
                    </button>
                  </div>
                </div>

                <form onSubmit={handleBatchSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
                    <Input
                      type="date"
                      label="Fecha"
                      value={batchFormData.date}
                      onChange={e => setBatchFormData({ ...batchFormData, date: e.target.value })}
                      required
                    />
                    <div className="lg:col-span-2">
                      <Input
                        label="Proveedor / Ref."
                        value={batchFormData.provider}
                        onChange={e => setBatchFormData({ ...batchFormData, provider: e.target.value })}
                      />
                    </div>

                    {entryMode === 'rollo' ? (
                      <Input
                        label="Metros Lineales"
                        type="number"
                        step="0.01"
                        value={batchFormData.initialQuantity || ''}
                        onChange={e => setBatchFormData({ ...batchFormData, initialQuantity: parseFloat(e.target.value) })}
                        required
                      />
                    ) : (
                      <Input
                        label="Largo (cm)"
                        type="number"
                        step="0.01"
                        value={batchFormData.length || ''}
                        onChange={e => setBatchFormData({ ...batchFormData, length: parseFloat(e.target.value) })}
                        required
                      />
                    )}

                    <Input
                      label="Ancho (cm)"
                      type="number"
                      step="1"
                      value={batchFormData.width || ''}
                      onChange={e => setBatchFormData({ ...batchFormData, width: parseInt(e.target.value) })}
                      required
                      className="text-emerald-700"
                    />

                    <Input
                      label={entryMode === 'rollo' ? 'Costo/Metro (€)' : 'Costo Total (€)'}
                      type="number"
                      step="0.01"
                      value={batchFormData.unitCost || ''}
                      onChange={e => setBatchFormData({ ...batchFormData, unitCost: parseFloat(e.target.value) })}
                      required
                    />
                  </div>

                  <div className="flex flex-wrap gap-4 items-center p-4 bg-white/60 border border-indigo-100 rounded-2xl shadow-sm">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Área Calculada</span>
                      <span className="text-lg font-black text-indigo-900">{calculatedArea.toFixed(2)} m²</span>
                    </div>
                    <div className="w-px h-8 bg-indigo-100 mx-2 hidden sm:block"></div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Costo Real / m²</span>
                      <span className="text-lg font-black text-emerald-600">{formatCurrency(calculatedCostPerM2)}/m²</span>
                    </div>
                    <div className="ml-auto">
                      <Button type="submit" variant="primary" icon={<Plus size={18} />}>Confirmar Entrada</Button>
                    </div>
                  </div>
                </form>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 no-print">Lotes Activos y Movimientos</h4>
                <TableContainer>

                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>FECHA ENTRADA</TableHead>
                      <TableHead>MODO</TableHead>
                      <TableHead>PROVEEDOR / REF.</TableHead>
                      <TableHead className="text-right">DIMENSIONES</TableHead>
                      <TableHead className="text-right text-emerald-600">ÁREA (m²)</TableHead>
                      <TableHead className="text-right">COSTO COMPRA</TableHead>
                      <TableHead className="text-right text-indigo-500">COSTO m²</TableHead>
                      <TableHead className="text-right">RESTANTE</TableHead>
                      <TableHead className="text-center no-print">ACCIÓN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.filter(b => b.materialId === activeMaterialId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((batch) => {
                      const currentTotalPurchaseCost = batch.entryMode === 'pieza' ? (batch.unitCost * batch.initialQuantity) : (batch.unitCost * batch.initialQuantity);
                      const currentCostPerM2 = batch.area && batch.area > 0 ? currentTotalPurchaseCost / batch.area : 0;

                      return (
                        <TableRow key={batch.id}>
                          <TableCell className="text-center"><ArrowDownToLine size={16} className="text-emerald-500 mx-auto" /></TableCell>
                          <TableCell className="font-bold text-gray-600 font-mono text-xs">{batch.date}</TableCell>
                          <TableCell>
                            <Badge variant={batch.entryMode === 'pieza' ? 'warning' : 'default'} className="flex items-center gap-1 w-fit">
                              {batch.entryMode === 'pieza' ? <Scissors size={10} /> : <RotateCcw size={10} />}
                              {batch.entryMode || 'Rollo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">{batch.provider}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-bold text-gray-900">
                                {batch.entryMode === 'pieza' ? `${batch.length} × ${batch.width} cm` : `${batch.initialQuantity.toFixed(2)} m lineales`}
                              </span>
                              <span className="text-[10px] text-gray-400 font-bold uppercase">{batch.width} cm ancho</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600 text-xs">{batch.area ? `${batch.area.toFixed(2)} m²` : '---'}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs">{formatCurrency(currentTotalPurchaseCost)}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-indigo-600 text-xs">{currentCostPerM2 > 0 ? formatCurrency(currentCostPerM2) : '---'}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={batch.remainingQuantity > 0 ? 'success' : 'default'}>
                              {batch.remainingQuantity.toFixed(2)} m
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center no-print">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setEditingBatchData(batch)} icon={<Pencil size={16} />} />
                              <Button variant="ghost" size="sm" onClick={() => deleteBatch(batch.id)} icon={<Trash2 size={16} className="text-red-400" />} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {activeMaterialId && (
                      <TableRow className="bg-gray-50 font-bold border-t-2 border-gray-200">
                        <TableCell></TableCell>
                        <TableCell colSpan={3} className="text-gray-900 uppercase">TOTALES</TableCell>
                        <TableCell className="text-right font-mono text-gray-400 text-xs">{getBatchStats(activeMaterialId).totalOriginalQty.toFixed(2)} m</TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 text-xs">{getBatchStats(activeMaterialId).totalArea.toFixed(2)} m²</TableCell>
                        <TableCell className="text-right font-mono text-gray-400 text-xs">{formatCurrency(getBatchStats(activeMaterialId).totalValue)}</TableCell>
                        <TableCell className="text-right font-mono text-indigo-600 text-xs">{formatCurrency(getBatchStats(activeMaterialId).avgCostPerM2)}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 text-xs">{getBatchStats(activeMaterialId).totalRemainingQty.toFixed(2)} m</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    )}
                  </TableBody>

                </TableContainer>
              </div>
            </div>

            <div className="px-10 py-6 bg-gray-50 border-t flex justify-end no-print" style={{ borderColor: tokens.colors.border }}>
              <Button variant="secondary" onClick={() => setIsBatchModalOpen(false)}>Cerrar Visor</Button>
            </div>
          </Card>
        </div>
      )}

      {editingBatchData && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        >
          <Card className="w-full max-w-md p-8">
            <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Pencil size={18} className="text-indigo-500" /> Editar Registro
            </h4>

            <form onSubmit={handleEditBatchSubmit} className="space-y-4">
              {editingBatchData.remainingQuantity < editingBatchData.initialQuantity && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                  <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-amber-700 leading-tight">
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

              {editingBatchData.entryMode === 'pieza' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Largo (cm)"
                    type="number" step="0.01"
                    disabled={editingBatchData.remainingQuantity < editingBatchData.initialQuantity}
                    value={editingBatchData.length || ''}
                    onChange={e => setEditingBatchData({ ...editingBatchData, length: parseFloat(e.target.value) })}
                  />
                  <Input
                    label="Ancho (cm)"
                    type="number" step="1"
                    disabled={editingBatchData.remainingQuantity < editingBatchData.initialQuantity}
                    value={editingBatchData.width || ''}
                    onChange={e => setEditingBatchData({ ...editingBatchData, width: parseInt(e.target.value) })}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="M. Lineales"
                    type="number" step="0.01"
                    disabled={editingBatchData.remainingQuantity < editingBatchData.initialQuantity}
                    value={editingBatchData.initialQuantity}
                    onChange={e => setEditingBatchData({ ...editingBatchData, initialQuantity: parseFloat(e.target.value) })}
                  />
                  <Input
                    label="Ancho (cm)"
                    type="number" step="1"
                    disabled={editingBatchData.remainingQuantity < editingBatchData.initialQuantity}
                    value={editingBatchData.width || ''}
                    onChange={e => setEditingBatchData({ ...editingBatchData, width: parseInt(e.target.value) })}
                  />
                </div>
              )}

              <Input
                label={editingBatchData.entryMode === 'pieza' ? 'Costo Total (€)' : 'Costo Unitario (€/m)'}
                type="number" step="0.01"
                disabled={editingBatchData.remainingQuantity < editingBatchData.initialQuantity}
                value={editingBatchData.unitCost}
                onChange={e => setEditingBatchData({ ...editingBatchData, unitCost: parseFloat(e.target.value) })}
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
