import React, { useEffect, useState, useCallback } from 'react';
import { Package, Layers, TrendingUp, AlertTriangle, Sparkles, ArrowRight, RefreshCw } from 'lucide-react';
import { useStore, calculateProductCost, calculateMargin } from '../store';
import { getPricingInsights } from '../services/geminiService';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design/design-tokens';

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
    <div className="animate-in fade-in space-y-8 duration-500">
      <PageHeader
        title="Dashboard de Costos"
        description="Análisis basado en inventario real (FIFO)"
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Productos"
          value={products.length}
          icon={Package}
        />
        <StatCard
          title="Margen Promedio"
          value={`${avgMargin.toFixed(1)}%`}
          icon={TrendingUp}
          trend={{ value: avgMargin, positive: avgMargin > 20 }}
        />
        <StatCard
          title="Items en Stock"
          value={totalStockItems.toFixed(0)}
          icon={Layers}
        />
        <StatCard
          title="Bajo Margen"
          value={lowMarginCount}
          icon={AlertTriangle}
          trend={{ value: lowMarginCount, positive: false }} // Red if > 0 basically, logic handled by component usually or we interpret positive as "good"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <div className="mb-6">
            <h3
              style={{
                fontSize: tokens.typography.titleMd.fontSize,
                fontWeight: tokens.typography.titleMd.fontWeight,
                color: tokens.colors.text.primary
              }}
            >
              Métricas de Inventario
            </h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${tokens.colors.bg}` }}>
              <span style={{ color: tokens.colors.text.secondary }}>Costo Unit. Promedio</span>
              <span style={{ fontWeight: 600, color: tokens.colors.text.primary }}>€{avgCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${tokens.colors.bg}` }}>
              <span style={{ color: tokens.colors.text.secondary }}>Lotes Activos</span>
              <span style={{ fontWeight: 600, color: tokens.colors.text.primary }}>{batches.filter(b => b.remainingQuantity > 0).length}</span>
            </div>
            <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${tokens.colors.bg}` }}>
              <span style={{ color: tokens.colors.text.secondary }}>Productos Rentables</span>
              <span style={{ fontWeight: 600, color: tokens.colors.success }}>{productCalculations.filter(p => p.margin >= 30).length}</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} color={tokens.colors.brand} />
              <h3
                style={{
                  fontSize: tokens.typography.titleMd.fontSize,
                  fontWeight: tokens.typography.titleMd.fontWeight,
                  color: tokens.colors.text.primary
                }}
              >
                Inteligencia de Precios
              </h3>
            </div>
            <Button
              variant="ghost"
              onClick={fetchAi}
              disabled={loadingAi}
              icon={<RefreshCw size={16} className={loadingAi ? "animate-spin" : ""} />}
            >
              Actualizar
            </Button>
          </div>

          <div className="flex-1">
            {loadingAi ? (
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full animate-pulse rounded-full bg-gray-100"></div>
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-gray-100"></div>
              </div>
            ) : (
              <p
                style={{
                  fontSize: tokens.typography.body.fontSize,
                  color: tokens.colors.text.secondary,
                  lineHeight: '1.6',
                  whiteSpace: 'pre-line'
                }}
              >
                {aiAnalysis || "Solicita un análisis para obtener insights sobre tus márgenes."}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
