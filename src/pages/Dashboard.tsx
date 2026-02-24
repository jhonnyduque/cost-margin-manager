import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, TrendingUp, AlertTriangle, Sparkles, RefreshCw, Plus, Layers, ChevronRight, Bot } from 'lucide-react';
import { useStore, calculateProductCost, calculateMargin } from '../store';
import { getPricingInsights } from '../services/geminiService';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const Dashboard: React.FC = () => {
  const { user, currentCompany } = useAuth();
  const { products, rawMaterials, batches } = useStore();
  const navigate = useNavigate();
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiRequested, setAiRequested] = useState(false);

  const productCalculations = products.map(p => {
    const cost = calculateProductCost(p, batches, rawMaterials);
    const margin = calculateMargin(p.price, cost);
    return { ...p, cost, margin };
  });

  const avgMargin = productCalculations.length > 0
    ? productCalculations.reduce((acc, curr) => acc + curr.margin, 0) / productCalculations.length : 0;
  const lowMarginProducts = productCalculations.filter(p => p.margin < 20);
  const totalStockItems = batches.reduce((acc, b) => acc + b.remaining_quantity, 0);
  const emptyBatches = batches.filter(b => b.remaining_quantity === 0);

  const fetchAi = useCallback(async () => {
    if (products.length === 0) return;
    setLoadingAi(true);
    setAiRequested(true);
    const analysis = await getPricingInsights(products, rawMaterials, batches);
    setAiAnalysis(analysis);
    setLoadingAi(false);
  }, [products, rawMaterials, batches]);

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Usuario';

  return (
    <div className="animate-in fade-in space-y-6 lg:space-y-8 duration-500">
      {/* Greeting Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
          {greeting}, {userName} 👋
        </h1>
        <p className="mt-1 text-sm lg:text-base text-slate-500">
          Resumen de {currentCompany?.name || 'tu negocio'} · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* KPI Cards - 2 cols on mobile, 3 on desktop */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-6">
        <button
          onClick={() => navigate('/productos')}
          className="rounded-xl border border-slate-200 bg-white p-4 lg:p-6 shadow-sm text-left transition-all hover:border-indigo-200 hover:shadow-md active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs lg:text-sm font-medium text-slate-500">Margen Promedio</span>
            <div className={`rounded-full p-2 ${avgMargin >= 20 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="mt-2 text-2xl lg:text-3xl font-bold text-slate-900">{avgMargin.toFixed(1)}%</p>
          <p className={`text-xs font-medium mt-1 ${avgMargin >= 20 ? 'text-emerald-600' : 'text-red-500'}`}>
            {avgMargin >= 30 ? '✓ Saludable' : avgMargin >= 20 ? 'Aceptable' : '⚠ Revisar precios'}
          </p>
        </button>

        <button
          onClick={() => navigate('/productos')}
          className="rounded-xl border border-slate-200 bg-white p-4 lg:p-6 shadow-sm text-left transition-all hover:border-indigo-200 hover:shadow-md active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs lg:text-sm font-medium text-slate-500">Bajo Margen</span>
            <div className={`rounded-full p-2 ${lowMarginProducts.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <p className="mt-2 text-2xl lg:text-3xl font-bold text-slate-900">{lowMarginProducts.length}</p>
          <p className="text-xs text-indigo-500 font-medium mt-1">
            {lowMarginProducts.length > 0 ? 'Ver productos →' : '✓ Todos bien'}
          </p>
        </button>

        <button
          onClick={() => navigate('/materias-primas')}
          className="col-span-2 lg:col-span-1 rounded-xl border border-slate-200 bg-white p-4 lg:p-6 shadow-sm text-left transition-all hover:border-indigo-200 hover:shadow-md active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs lg:text-sm font-medium text-slate-500">Items en Stock</span>
            <div className="rounded-full p-2 bg-blue-50 text-blue-600">
              <Package size={16} />
            </div>
          </div>
          <p className="mt-2 text-2xl lg:text-3xl font-bold text-slate-900">{totalStockItems.toFixed(0)}</p>
          <p className="text-xs text-indigo-500 font-medium mt-1">Ver inventario →</p>
        </button>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Acciones Rápidas</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/productos')}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
          >
            <Plus size={16} />
            Nuevo Producto
          </button>
          <button
            onClick={() => navigate('/materias-primas')}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
          >
            <Layers size={16} />
            Materias Primas
          </button>
          <button
            onClick={fetchAi}
            disabled={loadingAi}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
          >
            <Bot size={16} />
            Consultar IA
          </button>
        </div>
      </div>

      {/* Needs Attention */}
      {(lowMarginProducts.length > 0 || emptyBatches.length > 0) && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Requiere Atención</h2>
          <div className="space-y-2">
            {lowMarginProducts.slice(0, 5).map(product => (
              <button
                key={product.id}
                onClick={() => navigate('/productos')}
                className="w-full flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 lg:p-4 text-left hover:bg-slate-50 active:scale-[0.99] transition-all"
              >
                <div className="rounded-full p-2 bg-amber-50 text-amber-500 flex-shrink-0">
                  <AlertTriangle size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-900 truncate">{product.name}</p>
                  <p className="text-xs text-slate-500">
                    Margen: {product.margin.toFixed(1)}% — debajo del 20% recomendado
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
              </button>
            ))}
            {lowMarginProducts.length > 5 && (
              <p className="text-xs text-slate-400 text-center py-1">
                y {lowMarginProducts.length - 5} productos más...
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI Insights - On Demand */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600" />
            <h3 className="text-base lg:text-lg font-bold text-slate-900">
              Inteligencia de Precios
            </h3>
          </div>
          {aiRequested && (
            <Button
              variant="ghost"
              onClick={fetchAi}
              disabled={loadingAi}
              icon={<RefreshCw size={16} className={loadingAi ? "animate-spin" : ""} />}
            >
              Actualizar
            </Button>
          )}
        </div>

        {!aiRequested ? (
          <div className="text-center py-6">
            <Bot size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 mb-4">
              Obtén un análisis inteligente de tus márgenes y precios basado en tu inventario actual.
            </p>
            <button
              onClick={fetchAi}
              disabled={loadingAi || products.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
            >
              <Sparkles size={16} />
              Generar Análisis con IA
            </button>
            {products.length === 0 && (
              <p className="text-xs text-slate-400 mt-2">Agrega productos primero para usar esta función.</p>
            )}
          </div>
        ) : loadingAi ? (
          <div className="space-y-3 py-4">
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-3/5 animate-pulse rounded-full bg-slate-100" />
          </div>
        ) : (
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
            {aiAnalysis || "No se pudo obtener el análisis. Intenta de nuevo."}
          </p>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;