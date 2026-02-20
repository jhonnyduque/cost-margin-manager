import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Search, PlayCircle, Info, Layers, TrendingUp, CheckCircle2, X, ChevronRight, AlertTriangle, Scissors, RotateCcw, Ruler, History, Copy } from 'lucide-react';
import { useStore, calculateProductCost, calculateMargin, calculateFifoCost, getFifoBreakdown } from '../store';
import { Product, ProductMaterial, Status, Unit, RawMaterial, MaterialBatch } from '../types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { tokens } from '@/design/design-tokens';

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
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
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
            <Card className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden !p-0">
              <div className="flex items-center justify-between border-b px-10 py-6" style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.bg }}>
                <h3 className="text-xl font-bold" style={{ color: tokens.colors.text.primary }}>{editingId ? 'Editar Receta' : 'Nueva Receta de Producto'}</h3>
                <Button variant="ghost" onClick={() => setIsModalOpen(false)} icon={<X size={20} />} />
              </div>

              <form onSubmit={handleSubmit} className="flex-1 space-y-10 overflow-y-auto p-10">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                      className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider"
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
                        <div key={idx} className="overflow-hidden rounded-2xl border shadow-sm transition-all" style={{ borderColor: hasMissingStock ? tokens.colors.error : tokens.colors.border }}>
                          <div className="flex flex-wrap items-center gap-6 p-6" style={{ backgroundColor: tokens.colors.surface }}>
                            <div className="min-w-[200px] flex-1">
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
                                <label className="text-center text-xs font-medium text-gray-500">Modo</label>
                                <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                                  <button type="button" onClick={() => updateMaterial(idx, 'mode', 'linear')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase transition-all ${pm.mode === 'linear' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>
                                    <RotateCcw size={10} /> Lineal
                                  </button>
                                  <button type="button" onClick={() => updateMaterial(idx, 'mode', 'pieces')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase transition-all ${pm.mode === 'pieces' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400'}`}>
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
                                  <label className="mb-1 block text-xs font-medium text-gray-500">Superficie Total</label>
                                  <div className="flex h-[40px] items-center justify-end rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2 text-right text-sm font-bold text-indigo-700">
                                    {areaM2.toFixed(3)} m²
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="min-w-[150px] flex-1 text-right">
                              <label className="mb-1 block text-xs font-medium text-gray-500">Costo Aplicado</label>
                              <div className={`text-lg font-bold ${hasMissingStock ? 'text-red-500' : 'text-indigo-600'}`}>
                                {formatCurrency(costRow)}
                              </div>
                              <div className="text-xs text-gray-400">
                                {hasMissingStock ? "Stock insuficiente" : mainBatchInfo}
                              </div>
                            </div>

                            <div className="mb-1 flex gap-1 self-end">
                              <Button variant="ghost" size="sm" onClick={() => setExpandedMaterial(isExpanded ? null : idx)} icon={<Info size={18} />} />
                              <Button variant="ghost" size="sm" onClick={() => removeMaterial(idx)} icon={<Trash2 size={18} className="text-red-400" />} />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="space-y-6 border-t px-8 pb-8 pt-4" style={{ backgroundColor: tokens.colors.bg, borderColor: tokens.colors.border }}>
                              {pm.mode === 'pieces' && (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <h5 className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-500"><Scissors size={12} /> Desglose de piezas (cm)</h5>
                                    <Button size="sm" variant="secondary" onClick={() => addPiece(idx)}>+ Añadir Pieza</Button>
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                    {(pm.pieces || []).map((piece: any, pIdx: number) => (
                                      <div key={pIdx} className="flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm">
                                        <div className="flex-1">
                                          <label className="text-[10px] font-bold uppercase text-gray-400">Largo</label>
                                          <input type="number" className="w-full rounded bg-gray-50 p-1 text-sm font-bold" value={piece.length} onChange={e => updatePiece(idx, pIdx, 'length', parseFloat(e.target.value))} />
                                        </div>
                                        <span className="text-gray-300">×</span>
                                        <div className="flex-1">
                                          <label className="text-[10px] font-bold uppercase text-gray-400">Ancho</label>
                                          <input type="number" className="w-full rounded bg-gray-50 p-1 text-sm font-bold" value={piece.width} onChange={e => updatePiece(idx, pIdx, 'width', parseFloat(e.target.value))} />
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

                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                  {/* Summary Section - simplification for Design System: using Card */}
                  <Card className="space-y-6 border-indigo-100 bg-indigo-50/30">
                    <div>
                      <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-indigo-400">Escandallo de Producción</h4>
                      <div className="flex items-end justify-between border-b border-indigo-100 pb-2">
                        <span className="text-sm font-bold text-gray-500">Costo FIFO Total</span>
                        <span className="text-3xl font-black text-indigo-900">{formatCurrency(totalCurrentCost)}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-bold uppercase text-gray-400">Precios Sugeridos ({formData.targetMargin}%)</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={() => setFormData({ ...formData, price: exactSuggestedPrice })} className="rounded-xl border border-indigo-100 bg-white p-4 text-left transition-shadow hover:shadow-md">
                          <div className="text-[10px] font-bold uppercase text-gray-400">Margen Exacto</div>
                          <div className="text-lg font-black text-indigo-600">{formatCurrency(exactSuggestedPrice)}</div>
                        </button>
                        <button type="button" onClick={() => setFormData({ ...formData, price: commercialSuggestedPrice })} className="rounded-xl border border-emerald-200 bg-white p-4 text-left transition-shadow hover:shadow-md">
                          <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><TrendingUp size={10} /> Redondeo</div>
                          <div className="text-lg font-black text-emerald-600">{formatCurrency(commercialSuggestedPrice)}</div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex justify-between text-xs font-bold uppercase text-gray-400">
                        <span>Margen Objetivo</span>
                        <span className="text-indigo-600">{formData.targetMargin}%</span>
                      </div>
                      <input type="range" min="10" max="90" className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-indigo-100 accent-indigo-600" value={formData.targetMargin} onChange={e => setFormData({ ...formData, targetMargin: parseFloat(e.target.value) })} />
                    </div>
                  </Card>

                  <Card className="space-y-6 border-gray-800 bg-gray-900 text-white">
                    <div className="space-y-3">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Precio Final</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-emerald-500">€</span>
                        <input
                          required
                          type="number"
                          step="0.01"
                          className="w-full rounded-2xl border border-gray-700 bg-gray-800 py-6 pl-10 pr-6 text-3xl font-black text-emerald-400 outline-none transition-colors focus:border-emerald-500"
                          value={formData.price || ''}
                          onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>

                    {formData.price && formData.price > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-2xl border border-gray-700 bg-gray-800/50 p-6">
                          <div>
                            <div className="text-xs font-bold uppercase text-gray-400">Margen Real</div>
                            <div className="text-3xl font-black">{calculateMargin(formData.price, totalCurrentCost).toFixed(1)}%</div>
                          </div>
                          <CheckCircle2 size={32} className="text-emerald-500 opacity-30" />
                        </div>
                        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-xs font-bold ${diffPrice >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {diffPrice >= 0 ? '+' : ''}{formatCurrency(diffPrice)} vs costo
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              </form>

              <div className="flex gap-4 border-t px-10 py-6" style={{ backgroundColor: tokens.colors.bg, borderColor: tokens.colors.border }}>
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
