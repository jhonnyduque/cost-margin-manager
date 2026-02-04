
import React, { useEffect, useState, useCallback } from 'react';
import { Package, Layers, TrendingUp, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import { useStore, calculateProductCost, calculateMargin } from '../store';
import { getPricingInsights } from '../services/geminiService';

const StatsCard = ({ title, value, icon: Icon, color, subValue }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${color}`}><Icon size={24} /></div>
    </div>
    {subValue && <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">{subValue}</div>}
  </div>
);

const Dashboard: React.FC = () => {
  const { products, rawMaterials, batches } = useStore();
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const productCalculations = products.map(p => {
    const cost = calculateProductCost(p, batches, rawMaterials);
    const margin = calculateMargin(p.price, cost);
    return { cost, margin };
  });

  const avgMargin = productCalculations.length > 0 
    ? productCalculations.reduce((acc, curr) => acc + curr.margin, 0) / productCalculations.length : 0;
  const lowMarginCount = productCalculations.filter(p => p.margin < 20).length;
  const avgCost = productCalculations.length > 0
    ? productCalculations.reduce((acc, curr) => acc + curr.cost, 0) / productCalculations.length : 0;
  const totalStockItems = batches.reduce((acc, b) => acc + b.remainingQuantity, 0);

  // Fix: Extracted fetchAi to be accessible both on mount and via button click
  const fetchAi = useCallback(async () => {
    if (products.length === 0) return;
    setLoadingAi(true);
    const analysis = await getPricingInsights(products, rawMaterials, batches); 
    setAiAnalysis(analysis);
    setLoadingAi(false);
  }, [products, rawMaterials, batches]);

  useEffect(() => {
    fetchAi();
  }, [fetchAi]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard de Costos</h1>
        <p className="text-gray-500 mt-1">Análisis basado en inventario real (FIFO)</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Productos" value={products.length} icon={Package} color="bg-blue-50 text-blue-600" />
        <StatsCard title="Margen Promedio" value={`${avgMargin.toFixed(1)}%`} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" subValue={avgMargin > 20 ? "Rendimiento Bueno" : "Revisar Precios"} />
        <StatsCard title="Items en Stock" value={totalStockItems.toFixed(0)} icon={Layers} color="bg-purple-50 text-purple-600" />
        <StatsCard title="Bajo Margen" value={lowMarginCount} icon={AlertTriangle} color="bg-amber-50 text-amber-600" subValue="Crítico (<20%)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Métricas de Inventario</h3>
          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Costo Unit. Promedio</span>
              <span className="font-semibold text-gray-900">€{avgCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Lotes Activos</span>
              <span className="font-semibold text-indigo-600">{batches.filter(b => b.remainingQuantity > 0).length}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Productos Rentables</span>
              <span className="font-semibold text-emerald-600">{productCalculations.filter(p => p.margin >= 30).length}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#4f46e5] to-[#4338ca] rounded-[2rem] shadow-xl p-8 text-white relative overflow-hidden">
          <Sparkles size={120} className="absolute top-0 right-0 opacity-10" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-white/20 p-2 rounded-lg"><Sparkles size={18} /></div>
              <h3 className="text-xl font-bold">Inteligencia de Precios</h3>
            </div>
            <div className="flex-1">
              {loadingAi ? <div className="space-y-3 mt-4"><div className="h-4 bg-white/20 rounded-full w-full animate-pulse"></div><div className="h-4 bg-white/20 rounded-full w-4/5 animate-pulse"></div></div>
                : <p className="text-indigo-50 text-sm leading-relaxed mt-2 whitespace-pre-line">{aiAnalysis}</p>}
            </div>
            <div className="mt-8">
              {/* Fix: Hooking up the refresh button to call fetchAi */}
              <button 
                onClick={fetchAi}
                className="flex items-center gap-2 bg-white text-indigo-700 px-6 py-3 rounded-2xl font-bold text-sm shadow-lg hover:bg-gray-50 transition-colors"
              >
                Actualizar Análisis <ArrowRight size={16}/>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
