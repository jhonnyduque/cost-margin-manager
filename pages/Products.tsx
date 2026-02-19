import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Search, PlayCircle, Info, Layers, TrendingUp, CheckCircle2, X, ChevronRight, AlertTriangle, Scissors, RotateCcw, Ruler, History, Copy } from 'lucide-react';
import { useStore, calculateProductCost, calculateMargin, calculateFifoCost, getFifoBreakdown } from '../store';
import { Product, ProductMaterial, Status, Unit, RawMaterial, MaterialBatch } from '../types';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { Card } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
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
      <PageHeader
        title="Catálogo de Productos"
        description="Gestión de Escandallos (Costos FIFO)"
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', reference: '', price: 0, targetMargin: 30, materials: [], status: 'activa' });
              setIsModalOpen(true);
            }}
            icon={<Plus size={18} />}
          >
            Nuevo Producto
          </Button>
        }
      />

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Search size={18} />
        </div>
        <Input
          placeholder="Buscar por nombre o SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          fullWidth
        />
      </div>

      <TableContainer>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Referencia / SKU</TableHead>
            <TableHead className="text-right">Costo (FIFO)</TableHead>
            <TableHead className="text-right">Precio Venta</TableHead>
            <TableHead className="text-center">Margen</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.map((p) => {
            const cost = calculateProductCost(p, batches, rawMaterials);
            const margin = calculateMargin(p.price, cost);
            return (
              <TableRow key={p.id}>
                <TableCell className="font-bold">{p.name}</TableCell>
                <TableCell className="font-mono text-xs text-gray-500">{p.reference || '---'}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(cost)}</TableCell>
                <TableCell className="text-right font-mono font-black" style={{ color: tokens.colors.brand }}>{formatCurrency(p.price)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={margin >= 30 ? 'success' : 'warning'}>
                    {margin.toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('¿Registrar consumo de stock?')) consumeStock(p.id); }} title="Producir">
                      <PlayCircle size={16} className="text-emerald-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDuplicate(p)} title="Duplicar">
                      <Copy size={16} className="text-indigo-400" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditingId(p.id); setFormData(p); setIsModalOpen(true); }} title="Editar">
                      <Edit2 size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteProduct(p.id)} title="Eliminar">
                      <Trash2 size={16} className="text-red-400" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>

      </TableContainer>

      {
        isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(4px)'
            }}
          >
            <Card className="w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden !p-0">
              <div className="px-10 py-6 border-b flex justify-between items-center" style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.bg }}>
                <h3 className="text-xl font-bold" style={{ color: tokens.colors.text.primary }}>{editingId ? 'Editar Receta' : 'Nueva Receta de Producto'}</h3>
                <Button variant="ghost" onClick={() => setIsModalOpen(false)} icon={<X size={20} />} />
              </div>

              <form onSubmit={handleSubmit} className="p-10 overflow-y-auto flex-1 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Nombre Comercial"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej. Bolso de Mano Primavera"
                    required
                  />
                  <Input
                    label="Referencia / SKU"
                    value={formData.reference}
                    onChange={e => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="REF-001"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: tokens.colors.border }}>
                    <h4
                      className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"
                      style={{ color: tokens.colors.text.primary }}
                    >
                      <Layers size={14} color={tokens.colors.brand} /> Composición del Producto
                    </h4>
                    <Button type="button" variant="secondary" onClick={handleAddMaterial} size="sm">
                      + Añadir Insumo
                    </Button>
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
                        mainBatchInfo = `FIFO → lote ${breakdown[0].date} @ ${formatCurrency(costPerM2)}/m²`;
                      }

                      return (
                        <div key={idx} className="border rounded-2xl overflow-hidden shadow-sm transition-all" style={{ borderColor: hasMissingStock ? tokens.colors.error : tokens.colors.border }}>
                          <div className="p-6 flex flex-wrap items-center gap-6" style={{ backgroundColor: tokens.colors.surface }}>
                            <div className="flex-1 min-w-[200px]">
                              <Select
                                label="Insumo"
                                value={pm.materialId}
                                onChange={e => updateMaterial(idx, 'materialId', e.target.value)}
                              >
                                {rawMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </Select>
                            </div>

                            {isFabric && (
                              <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-500 text-center">Modo</label>
                                <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                                  <button type="button" onClick={() => updateMaterial(idx, 'mode', 'linear')} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-1.5 transition-all ${pm.mode === 'linear' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>
                                    <RotateCcw size={10} /> Lineal
                                  </button>
                                  <button type="button" onClick={() => updateMaterial(idx, 'mode', 'pieces')} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-1.5 transition-all ${pm.mode === 'pieces' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400'}`}>
                                    <Scissors size={10} /> Piezas
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="w-36">
                              {pm.mode === 'linear' ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  label={`Cant. (${pm.consumptionUnit}s)`}
                                  value={pm.quantity}
                                  onChange={e => updateMaterial(idx, 'quantity', parseFloat(e.target.value))}
                                />
                              ) : (
                                <div>
                                  <label className="text-xs font-medium text-gray-500 mb-1 block">Superficie Total</label>
                                  <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm font-bold text-indigo-700 text-right h-[40px] flex items-center justify-end">
                                    {areaM2.toFixed(3)} m²
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-[150px] text-right">
                              <label className="text-xs font-medium text-gray-500 mb-1 block">Costo Aplicado</label>
                              <div className={`text-lg font-bold ${hasMissingStock ? 'text-red-500' : 'text-indigo-600'}`}>
                                {formatCurrency(costRow)}
                              </div>
                              <div className="text-xs text-gray-400">
                                {hasMissingStock ? "Stock insuficiente" : mainBatchInfo}
                              </div>
                            </div>

                            <div className="flex gap-1 self-end mb-1">
                              <Button variant="ghost" size="sm" onClick={() => setExpandedMaterial(isExpanded ? null : idx)} icon={<Info size={18} />} />
                              <Button variant="ghost" size="sm" onClick={() => removeMaterial(idx)} icon={<Trash2 size={18} className="text-red-400" />} />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-8 pb-8 pt-4 border-t space-y-6" style={{ backgroundColor: tokens.colors.bg, borderColor: tokens.colors.border }}>
                              {pm.mode === 'pieces' && (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-xs font-bold text-indigo-500 uppercase flex items-center gap-2"><Scissors size={12} /> Desglose de piezas (cm)</h5>
                                    <Button size="sm" variant="secondary" onClick={() => addPiece(idx)}>+ Añadir Pieza</Button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {(pm.pieces || []).map((piece: any, pIdx: number) => (
                                      <div key={pIdx} className="bg-white p-3 rounded-xl border flex items-center gap-3 shadow-sm">
                                        <div className="flex-1">
                                          <label className="text-[10px] uppercase text-gray-400 font-bold">Largo</label>
                                          <input type="number" className="w-full bg-gray-50 rounded p-1 text-sm font-bold" value={piece.length} onChange={e => updatePiece(idx, pIdx, 'length', parseFloat(e.target.value))} />
                                        </div>
                                        <span className="text-gray-300">×</span>
                                        <div className="flex-1">
                                          <label className="text-[10px] uppercase text-gray-400 font-bold">Ancho</label>
                                          <input type="number" className="w-full bg-gray-50 rounded p-1 text-sm font-bold" value={piece.width} onChange={e => updatePiece(idx, pIdx, 'width', parseFloat(e.target.value))} />
                                        </div>
                                        <button type="button" onClick={() => removePiece(idx, pIdx)} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
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
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Summary Section - simplification for Design System: using Card */}
                  <Card className="space-y-6 bg-indigo-50/30 border-indigo-100">
                    <div>
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">Escandallo de Producción</h4>
                      <div className="flex justify-between items-end border-b border-indigo-100 pb-2">
                        <span className="text-sm text-gray-500 font-bold">Costo FIFO Total</span>
                        <span className="text-3xl font-black text-indigo-900">{formatCurrency(totalCurrentCost)}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-bold text-gray-400 uppercase">Precios Sugeridos ({formData.targetMargin}%)</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={() => setFormData({ ...formData, price: exactSuggestedPrice })} className="bg-white p-4 rounded-xl border border-indigo-100 text-left hover:shadow-md transition-shadow">
                          <div className="text-[10px] font-bold text-gray-400 uppercase">Margen Exacto</div>
                          <div className="text-lg font-black text-indigo-600">{formatCurrency(exactSuggestedPrice)}</div>
                        </button>
                        <button type="button" onClick={() => setFormData({ ...formData, price: commercialSuggestedPrice })} className="bg-white p-4 rounded-xl border border-emerald-200 text-left hover:shadow-md transition-shadow">
                          <div className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><TrendingUp size={10} /> Redondeo</div>
                          <div className="text-lg font-black text-emerald-600">{formatCurrency(commercialSuggestedPrice)}</div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold uppercase text-gray-400 mb-2">
                        <span>Margen Objetivo</span>
                        <span className="text-indigo-600">{formData.targetMargin}%</span>
                      </div>
                      <input type="range" min="10" max="90" className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" value={formData.targetMargin} onChange={e => setFormData({ ...formData, targetMargin: parseFloat(e.target.value) })} />
                    </div>
                  </Card>

                  <Card className="space-y-6 bg-gray-900 text-white border-gray-800">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Precio Final</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 text-2xl font-bold">€</span>
                        <input
                          required
                          type="number"
                          step="0.01"
                          className="w-full pl-10 pr-6 py-6 bg-gray-800 rounded-2xl text-3xl font-black text-emerald-400 outline-none border border-gray-700 focus:border-emerald-500 transition-colors"
                          value={formData.price || ''}
                          onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>

                    {formData.price && formData.price > 0 && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-6 bg-gray-800/50 rounded-2xl border border-gray-700">
                          <div>
                            <div className="text-xs font-bold text-gray-400 uppercase">Margen Real</div>
                            <div className="text-3xl font-black">{calculateMargin(formData.price, totalCurrentCost).toFixed(1)}%</div>
                          </div>
                          <CheckCircle2 size={32} className="text-emerald-500 opacity-30" />
                        </div>
                        <div className={`text-xs font-bold flex items-center gap-2 px-4 py-3 rounded-lg ${diffPrice >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {diffPrice >= 0 ? '+' : ''}{formatCurrency(diffPrice)} vs costo
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              </form>

              <div className="px-10 py-6 border-t flex gap-4" style={{ backgroundColor: tokens.colors.bg, borderColor: tokens.colors.border }}>
                <Button variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>Descartar</Button>
                <Button className="flex-1" onClick={handleSubmit} icon={<CheckCircle2 size={20} />}>Guardar Receta</Button>
              </div>
            </Card>
          </div>
        )
      }
    </div >
  );
};

export default Products;
