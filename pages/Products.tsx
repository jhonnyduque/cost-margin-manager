
import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Search, PlayCircle, Info, Layers, TrendingUp, CheckCircle2, X, ChevronRight, AlertTriangle, Scissors, RotateCcw, Ruler, History, Copy } from 'lucide-react';
import { useStore, calculateProductCost, calculateMargin, calculateFifoCost, getFifoBreakdown } from '../store';
import { Product, ProductMaterial, Status, Unit, RawMaterial, MaterialBatch } from '../types';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

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

const Products: React.FC = () => {
  const { currentCompanyId, products, rawMaterials, batches, addProduct, deleteProduct, updateProduct, consumeStock } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedMaterial, setExpandedMaterial] = useState<number | null>(null);

  const [formData, setFormData] = useState<any>({
    name: '', reference: '', price: 0, targetMargin: 30, materials: [], status: 'activa'
  });

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateTotalCost = (materials: any[]) => {
    return (materials || []).reduce((total: number, pm: any) => {
      let effectiveQty = pm.quantity;
      if (pm.mode === 'pieces' && pm.pieces) {
        // Obtenemos el ancho del lote más reciente como referencia para la UI
        // El cálculo real de costo lo hace el store.ts a través de FIFO
        const latestBatch = batches.filter(b => b.materialId === pm.materialId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const width = latestBatch?.width || 140;
        const totalAreaCm2 = pm.pieces.reduce((acc: number, p: any) => acc + (p.length * p.width), 0);
        effectiveQty = (totalAreaCm2 / width) / 100;
      }
      return total + calculateFifoCost(pm.materialId, effectiveQty, pm.consumptionUnit, batches, rawMaterials);
    }, 0);
  };

  const totalCurrentCost = useMemo(() => calculateTotalCost(formData.materials), [formData.materials, batches, rawMaterials]);

  const exactSuggestedPrice = useMemo(() => {
    const margin = formData.targetMargin || 0;
    if (margin >= 100) return 0;
    return totalCurrentCost / (1 - margin / 100);
  }, [totalCurrentCost, formData.targetMargin]);

  const commercialSuggestedPrice = useMemo(() => getCommercialPrice(exactSuggestedPrice), [exactSuggestedPrice]);

  const handleAddMaterial = () => {
    if (rawMaterials.length === 0) return;
    const material = rawMaterials[0];
    const materials = [...(formData.materials || []), {
      materialId: material.id,
      quantity: 1,
      consumptionUnit: material.unit,
      mode: 'linear',
      pieces: [{ length: 50, width: material.unit === 'metro' ? 140 : 0 }]
    }];
    setFormData({ ...formData, materials });
  };

  const updateMaterial = (idx: number, field: string, value: any) => {
    const materials = [...(formData.materials || [])];
    materials[idx] = { ...materials[idx], [field]: value };

    if (field === 'materialId') {
      const selectedBase = rawMaterials.find(m => m.id === value);
      if (selectedBase) {
        materials[idx].consumptionUnit = selectedBase.unit;
        materials[idx].mode = 'linear';
      }
    }
    setFormData({ ...formData, materials });
  };

  const removeMaterial = (idx: number) => {
    const materials = (formData.materials || []).filter((_: any, i: number) => i !== idx);
    setFormData({ ...formData, materials });
    // Reset or adjust expanded state if the removed material was expanded or before it
    if (expandedMaterial === idx) {
      setExpandedMaterial(null);
    } else if (expandedMaterial !== null && expandedMaterial > idx) {
      setExpandedMaterial(expandedMaterial - 1);
    }
  };

  const addPiece = (idx: number) => {
    const materials = [...(formData.materials || [])];
    const mat = materials[idx];
    const latestBatch = batches.filter(b => b.materialId === mat.materialId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
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

  const handleDuplicate = (product: Product) => {
    const duplicatedProduct = {
      ...product,
      name: `${product.name} (copia)`,
      reference: product.reference ? `${product.reference}-COPIA` : '',
      createdAt: new Date().toISOString()
    };
    // No establecemos editingId para que al guardar se cree como nuevo
    setEditingId(null);
    setFormData(duplicatedProduct);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const processedMaterials = formData.materials.map((pm: any) => {
      if (pm.mode === 'pieces' && pm.pieces) {
        const latestBatch = batches.filter(b => b.materialId === pm.materialId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const width = latestBatch?.width || 140;
        const totalAreaCm2 = pm.pieces.reduce((acc: number, p: any) => acc + (p.length * p.width), 0);
        return { ...pm, quantity: (totalAreaCm2 / width) / 100 };
      }
      return pm;
    });

    const data = {
      ...formData,
      materials: processedMaterials,
      id: editingId || crypto.randomUUID(),
      company_id: currentCompanyId || '',
      createdAt: editingId ? (products.find(p => p.id === editingId)?.createdAt) : new Date().toISOString()
    } as Product;

    if (editingId) updateProduct(data);
    else addProduct(data);
    setIsModalOpen(false);
  };

  const diffPrice = (formData.price || 0) - exactSuggestedPrice;
  const diffPercent = exactSuggestedPrice > 0 ? (diffPrice / exactSuggestedPrice) * 100 : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Catálogo de Productos</h1>
          <p className="text-gray-500 font-medium">Gestión de Escandallos (Costos FIFO)</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', reference: '', price: 0, targetMargin: 30, materials: [], status: 'activa' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-[#4f46e5] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-[#4338ca] transition-all"
        >
          <Plus size={18} /> Nuevo Producto
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text" placeholder="Buscar por nombre o SKU..."
          className="w-full pl-10 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#4f46e5] outline-none"
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Producto</th>
              <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Referencia / SKU</th>
              <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Costo (FIFO)</th>
              <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Precio Venta</th>
              <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center">Margen</th>
              <th className="px-8 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredProducts.map((p) => {
              const cost = calculateProductCost(p, batches, rawMaterials);
              const margin = calculateMargin(p.price, cost);
              return (
                <tr key={p.id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="px-8 py-5 font-bold text-gray-900">{p.name}</td>
                  <td className="px-8 py-5 font-mono text-[10px] font-black text-gray-400 uppercase tracking-tighter">{p.reference || '---'}</td>
                  <td className="px-8 py-5 text-right font-mono text-sm font-bold text-gray-600">{formatCurrency(cost)}</td>
                  <td className="px-8 py-5 text-right font-mono text-sm font-black text-[#4f46e5]">{formatCurrency(p.price)}</td>
                  <td className="px-8 py-5 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${margin >= 30 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { if (window.confirm('¿Registrar consumo de stock?')) consumeStock(p.id); }} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="Producir"><PlayCircle size={18} /></button>
                      <button onClick={() => handleDuplicate(p)} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg transition-colors" title="Duplicar"><Copy size={18} /></button>
                      <button onClick={() => { setEditingId(p.id); setFormData(p); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors" title="Editar"><Edit2 size={18} /></button>
                      <button onClick={() => deleteProduct(p.id)} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors" title="Eliminar"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-10 py-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-2xl font-black text-gray-900">{editingId ? 'Editar Receta' : 'Nueva Receta de Producto'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all"><X size={24} className="text-gray-400" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 overflow-y-auto flex-1 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre Comercial</label>
                  <input required className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#4f46e5] font-bold" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Bolso de Mano Primavera" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Referencia / SKU</label>
                  <input className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none font-mono font-bold uppercase" value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} placeholder="REF-001" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={14} className="text-[#4f46e5]" /> Composición del Producto
                  </h4>
                  <button type="button" onClick={handleAddMaterial} className="text-[10px] font-bold text-[#4f46e5] bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
                    + Añadir Insumo
                  </button>
                </div>

                <div className="space-y-4">
                  {(formData.materials || []).map((pm: any, idx: number) => {
                    const material = rawMaterials.find(m => m.id === pm.materialId);
                    const isFabric = material?.unit === 'metro';

                    let effectiveQty = pm.quantity;
                    let areaM2 = 0;
                    if (pm.mode === 'pieces' && pm.pieces) {
                      const latestBatch = batches.filter(b => b.materialId === pm.materialId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                      const width = latestBatch?.width || 140;
                      const totalAreaCm2 = pm.pieces.reduce((acc: number, p: any) => acc + (p.length * p.width), 0);
                      areaM2 = totalAreaCm2 / 10000;
                      effectiveQty = (totalAreaCm2 / width) / 100;
                    } else if (isFabric) {
                      const latestBatch = batches.filter(b => b.materialId === pm.materialId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                      areaM2 = pm.quantity * ((latestBatch?.width || 140) / 100);
                    }

                    const breakdown = getFifoBreakdown(pm.materialId, effectiveQty, pm.consumptionUnit, batches, rawMaterials);
                    const costRow = breakdown.reduce((acc, item) => acc + item.subtotal, 0);
                    const isExpanded = expandedMaterial === idx;
                    const hasMissingStock = breakdown.some(b => b.isMissing);

                    let mainBatchInfo = '';
                    if (breakdown.length > 0 && !breakdown[0].isMissing) {
                      const batch = batches.find(b => b.id === breakdown[0].batchId);
                      const costPerM2 = breakdown[0].unitCost / ((batch?.width || 140) / 100);
                      mainBatchInfo = `Usando FIFO → lote ${breakdown[0].date} @ ${formatCurrency(costPerM2)}/m²`;
                    }

                    return (
                      <div key={idx} className={`bg-white border rounded-[2rem] overflow-hidden shadow-sm transition-all ${hasMissingStock ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'}`}>
                        <div className="p-6 flex flex-wrap items-center gap-6">
                          <div className="flex-1 min-w-[200px]">
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Insumo</label>
                            <select className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none" value={pm.materialId} onChange={e => updateMaterial(idx, 'materialId', e.target.value)}>
                              {rawMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </div>

                          {isFabric && (
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block text-center">Modo Uso</label>
                              <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                                <button type="button" onClick={() => updateMaterial(idx, 'mode', 'linear')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 transition-all ${pm.mode === 'linear' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>
                                  <RotateCcw size={10} /> Lineal
                                </button>
                                <button type="button" onClick={() => updateMaterial(idx, 'mode', 'pieces')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 transition-all ${pm.mode === 'pieces' ? 'bg-[#4f46e5] text-white shadow-sm' : 'text-gray-400'}`}>
                                  <Scissors size={10} /> Piezas
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="w-36">
                            {pm.mode === 'linear' ? (
                              <>
                                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Cant. ({pm.consumptionUnit}s)</label>
                                <input type="number" step="0.01" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black text-right" value={pm.quantity} onChange={e => updateMaterial(idx, 'quantity', parseFloat(e.target.value))} />
                              </>
                            ) : (
                              <>
                                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Superficie Total</label>
                                <div className="px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-black text-indigo-700 text-right">
                                  {areaM2.toFixed(3)} m²
                                </div>
                              </>
                            )}
                          </div>

                          <div className="flex-1 min-w-[150px] text-right">
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Costo Aplicado</label>
                            <div className={`text-lg font-black ${hasMissingStock ? 'text-red-500' : 'text-[#4f46e5]'}`}>
                              {formatCurrency(costRow)}
                            </div>
                            <div className={`text-[9px] font-bold uppercase tracking-tighter ${hasMissingStock ? 'text-red-400' : 'text-gray-400'}`}>
                              {hasMissingStock ? "Stock insuficiente" : mainBatchInfo}
                            </div>
                          </div>

                          <div className="flex gap-1 self-end mb-1">
                            <button type="button" onClick={() => setExpandedMaterial(isExpanded ? null : idx)} className={`p-3 rounded-xl transition-all ${isExpanded ? 'bg-[#4f46e5] text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}><Info size={18} /></button>
                            <button type="button" onClick={() => removeMaterial(idx)} className="p-3 text-gray-300 hover:text-red-500 rounded-xl"><Trash2 size={18} /></button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-8 pb-8 pt-4 bg-gray-50/50 border-t border-gray-100 space-y-6">
                            {pm.mode === 'pieces' && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Scissors size={12} /> Desglose de piezas (cm)</h5>
                                  <button type="button" onClick={() => addPiece(idx)} className="text-[9px] font-bold text-indigo-600 bg-white border border-indigo-100 px-3 py-1.5 rounded-lg">+ Añadir Pieza</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {(pm.pieces || []).map((piece: any, pIdx: number) => (
                                    <div key={pIdx} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3 shadow-sm group">
                                      <div className="flex-1 space-y-1">
                                        <label className="text-[8px] font-bold text-gray-400 uppercase block ml-1">Largo</label>
                                        <input type="number" className="w-full bg-gray-50 border-none rounded-lg text-xs font-bold px-2 py-1.5" value={piece.length} onChange={e => updatePiece(idx, pIdx, 'length', parseFloat(e.target.value))} />
                                      </div>
                                      <div className="text-gray-300 mt-4">×</div>
                                      <div className="flex-1 space-y-1">
                                        <label className="text-[8px] font-bold text-gray-400 uppercase block ml-1">Ancho</label>
                                        <input type="number" className="w-full bg-gray-50 border-none rounded-lg text-xs font-bold px-2 py-1.5" value={piece.width} onChange={e => updatePiece(idx, pIdx, 'width', parseFloat(e.target.value))} />
                                      </div>
                                      <button type="button" onClick={() => removePiece(idx, pIdx)} className="p-2 text-gray-300 hover:text-red-500"><X size={14} /></button>
                                    </div>
                                  ))}
                                </div>
                                <div className="p-4 bg-indigo-600 rounded-2xl text-white flex justify-between items-center shadow-lg shadow-indigo-100">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-lg"><Ruler size={16} /></div>
                                    <div>
                                      <div className="text-[8px] font-black uppercase opacity-60 tracking-widest text-white">Consumo Geométrico</div>
                                      <div className="text-sm font-black text-white">{pm.pieces?.map((p: any) => `${p.length}×${p.width}`).join(' + ')} cm</div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[14px] font-black text-white">{areaM2.toFixed(4)} m²</div>
                                    <div className="text-[9px] font-bold opacity-60 text-white">Equivale a: {effectiveQty.toFixed(3)} m lineales</div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <h5 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><History size={12} /> Trazabilidad FIFO por m²</h5>
                              {breakdown.map((item, bIdx) => {
                                const batch = batches.find(b => b.id === item.batchId);
                                const batchWidth = batch?.width || 140;
                                const m2InBatch = (item.quantityUsed * batchWidth) / 100;
                                const costPerM2 = item.unitCost / (batchWidth / 100);

                                return (
                                  <div key={bIdx} className={`flex justify-between items-center text-[10px] p-4 bg-white rounded-2xl border shadow-sm ${item.isMissing ? 'border-red-100 bg-red-50' : 'border-emerald-50'}`}>
                                    <span className={`font-bold ${item.isMissing ? 'text-red-500' : 'text-gray-600'}`}>
                                      {item.isMissing ? 'SIN STOCK DISPONIBLE' : `Lote ${item.date} (${batch?.provider})`}
                                    </span>
                                    <div className="flex gap-6 items-center">
                                      <div className="text-right">
                                        <div className="text-gray-400 font-bold uppercase text-[8px]">Área Aplicada</div>
                                        <div className="font-black text-gray-900">{m2InBatch.toFixed(3)} m²</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-gray-400 font-bold uppercase text-[8px]">Precio Real m²</div>
                                        <div className="font-black text-indigo-600">{formatCurrency(costPerM2)}/m²</div>
                                      </div>
                                      <div className="text-right pl-4 border-l border-gray-100">
                                        <div className="text-gray-400 font-bold uppercase text-[8px]">Costo Parcial</div>
                                        <div className="font-black text-[#4f46e5]">{formatCurrency(item.subtotal)}</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-indigo-50/40 p-10 rounded-[2.5rem] border border-indigo-100 space-y-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Escandallo de Producción</label>
                    <div className="flex items-end justify-between border-b border-indigo-100 pb-4">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Costo FIFO Total</span>
                      <span className="text-4xl font-black text-indigo-900">{formatCurrency(totalCurrentCost)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Precios Sugeridos ({formData.targetMargin}%)</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button type="button" onClick={() => setFormData({ ...formData, price: exactSuggestedPrice })} className="bg-white p-5 rounded-3xl border border-indigo-100 text-left">
                        <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Margen Exacto</div>
                        <div className="text-lg font-black text-indigo-600">{formatCurrency(exactSuggestedPrice)}</div>
                      </button>
                      <button type="button" onClick={() => setFormData({ ...formData, price: commercialSuggestedPrice })} className="bg-white p-5 rounded-3xl border-2 border-emerald-200 text-left">
                        <div className="text-[9px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><TrendingUp size={10} /> Redondeo</div>
                        <div className="text-lg font-black text-emerald-600">{formatCurrency(commercialSuggestedPrice)}</div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase text-gray-400">
                      <span>Margen Objetivo</span>
                      <span className="text-indigo-600">{formData.targetMargin}%</span>
                    </div>
                    <input type="range" min="10" max="90" className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" value={formData.targetMargin} onChange={e => setFormData({ ...formData, targetMargin: parseFloat(e.target.value) })} />
                  </div>
                </div>

                <div className="bg-[#1a1c23] p-10 rounded-[2.5rem] shadow-2xl space-y-8 border border-gray-800">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Precio Final al Público</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-4xl opacity-50">€</span>
                      <input required type="number" step="0.01" className="w-full pl-16 pr-6 py-8 bg-gray-800/50 border-2 border-emerald-500/30 rounded-[2rem] text-4xl font-black text-emerald-400 outline-none" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
                    </div>
                  </div>

                  {formData.price && formData.price > 0 && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-8 bg-gray-800/30 rounded-[2rem] border border-gray-700">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Margen Real</span>
                          <span className="text-4xl font-black text-white">{calculateMargin(formData.price, totalCurrentCost).toFixed(1)}%</span>
                        </div>
                        <CheckCircle2 size={40} className="text-emerald-500 opacity-20" />
                      </div>

                      <div className={`text-[12px] font-bold flex items-center gap-2 px-4 py-3 rounded-xl ${diffPrice >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {diffPrice >= 0 ? '+' : ''}{formatCurrency(diffPrice)} vs costo ({diffPrice >= 0 ? '+' : ''}{diffPercent.toFixed(1)}%)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>

            <div className="px-10 py-8 border-t border-gray-100 bg-gray-50 flex gap-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 py-5 border border-gray-200 rounded-2xl font-bold text-gray-500">Descartar</button>
              <button onClick={handleSubmit} className="flex-1 px-10 py-5 bg-[#4f46e5] text-white rounded-2xl font-black shadow-xl flex items-center justify-center gap-2">
                <CheckCircle2 size={20} /> Guardar Receta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
