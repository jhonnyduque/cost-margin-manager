import React, { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ShieldAlert, ShieldX, Sparkles, RefreshCw,
  Package, BarChart2, ShieldCheck, ArrowRight
} from 'lucide-react';
import { useStore } from '../store';
import { getPricingInsights } from '../services/geminiService';
import { runProtectionEngine, type ProtectedAction, type ProtectionStatus } from '../services/protectionEngine';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageContainer, SectionBlock, CardGrid } from '@/components/ui/LayoutPrimitives';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';

const fmt$ = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const SEV_BADGE: Record<string, 'error' | 'warning' | 'neutral'> = {
  critico: 'error',
  alto: 'warning',
  medio: 'warning',
  bajo: 'neutral',
};

const SIGNAL_TYPE_LABEL: Record<string, string> = {
  debt: 'Inventario',
  margin_drift: 'Margen',
  stock_break: 'Stock',
  dead_stock: 'Capital',
  price_below_cost: 'Precio',
};

const STATUS_CFG: Record<ProtectionStatus, { Icon: typeof Shield; tone: string; label: string }> = {
  PROTEGIDO: { Icon: Shield, tone: 'text-emerald-600', label: 'Protegido' },
  EN_RIESGO: { Icon: ShieldAlert, tone: 'text-amber-600', label: 'En riesgo' },
  CRITICO: { Icon: ShieldX, tone: 'text-red-600', label: 'Crítico' },
};

const KpiCard: React.FC<{ title: string; value: string; riskLevel: string; trend: string }> = ({ title, value, riskLevel, trend }) => {
  const trendLabel = trend === 'up' ? 'Sube vs. período anterior' : trend === 'down' ? 'Baja vs. período anterior' : 'Se mantiene estable';
  const trendTone =
    riskLevel === 'ok' ? 'text-emerald-600' :
      riskLevel === 'medio' ? 'text-amber-600' :
        riskLevel === 'alto' || riskLevel === 'critico' ? 'text-red-600' :
          'text-slate-500';

  return (
    <Card className="min-h-[110px]">
      <Card.Content className="pt-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
            {title}
          </p>
          <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1, padding: '4px 0' }}>
            {value}
          </div>
          <span className={`text-small ${trendTone}`} style={{ fontWeight: 600 }}>
            {trendLabel}
          </span>
        </div>
      </Card.Content>
    </Card>
  );
};

const PriorityRow: React.FC<{ action: ProtectedAction; onNavigate: (route: string) => void }> = ({ action, onNavigate }) => {
  const severity = action.signal.severity;
  const days = action.signal.timeToImpactDays;
  const confidence = (action.signal.rawData as any).salesConfidence as 'high' | 'medium' | 'low' | undefined;
  const urgencyLabel = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `${days} días`;
  const categoryLabel = SIGNAL_TYPE_LABEL[action.signal.type] || action.signal.type;
  const urgencyTone =
    (SEV_BADGE[severity] || 'neutral') === 'error' ? 'text-red-600' :
      (SEV_BADGE[severity] || 'neutral') === 'warning' ? 'text-amber-600' :
        'text-slate-500';

  return (
    <Card noPadding className="transition-all duration-200 hover:border-slate-300">
      <div className="px-5 py-4 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className={`text-small font-semibold uppercase ${urgencyTone}`} style={{ letterSpacing: '0.12em' }}>
              {urgencyLabel}
            </span>
            <span className="text-small font-semibold uppercase text-muted" style={{ letterSpacing: '0.12em' }}>
              {categoryLabel}
            </span>
            {confidence && (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter ${confidence === 'high' ? 'bg-emerald-50 text-emerald-600' :
                  confidence === 'medium' ? 'bg-amber-50 text-amber-600' :
                    'bg-slate-100 text-slate-500'
                }`}>
                {confidence === 'high' ? <ShieldCheck size={10} /> :
                  confidence === 'medium' ? <ShieldAlert size={10} /> :
                    <Shield size={10} />}
                {confidence === 'high' ? 'Confianza alta' :
                  confidence === 'medium' ? 'Confianza media' :
                    'Datos limitados'}
              </div>
            )}
          </div>
          <p className="text-body" style={{ fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {action.title}
          </p>
          <p className="text-small text-muted" style={{ marginTop: 'var(--space-4)', lineHeight: 1.6, maxWidth: '54ch' }}>
            {action.actionScenario.narrative}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex flex-col items-end px-4 border-r border-slate-100">
            <span className="text-small text-muted">Impacto</span>
            <span className="text-body" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {fmt$(action.signal.estimatedImpact)}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate(action.actionRoute)}
            icon={<ArrowRight size={16} />}
          >
            Ver
          </Button>
        </div>
      </div>
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const { currentCompany } = useAuth();
  const { products, rawMaterials, batches, movements, productMovements, unitsOfMeasure } = useStore();
  const navigate = useNavigate();
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiRequested, setAiRequested] = useState(false);

  const report = useMemo(
    () => runProtectionEngine({ products, rawMaterials, batches, movements, productMovements, unitsOfMeasure }),
    [products, rawMaterials, batches, movements, productMovements, unitsOfMeasure]
  );

  const fetchAi = useCallback(async () => {
    if (products.length === 0) return;
    setLoadingAi(true);
    setAiRequested(true);
    try {
      const analysis = await getPricingInsights(products, rawMaterials, batches, unitsOfMeasure);
      setAiAnalysis(analysis);
    } catch (err) {
      console.error('AI Error:', err);
    } finally {
      setLoadingAi(false);
    }
  }, [products, rawMaterials, batches, unitsOfMeasure]);

  return (
    <PageContainer>
      <SectionBlock className="mb-8">
        <UniversalPageHeader
          title="Centro Operativo"
          breadcrumbs={
            <>
              <span>BETO OS</span>
              <span>/</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {currentCompany?.name || 'Empresa'}
              </span>
            </>
          }
          metadata={[
            <span key="1">Resumen diario de margen, inventario y riesgos</span>,
            <span key="2">Actualizado a las {new Date(report.generatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>,
            <span key="3">Impacto identificado: {fmt$(report.totalProtectedValue)}</span>,
          ]}
          status={
            <span className={`flex items-center gap-1.5 font-semibold ${STATUS_CFG[report.protectionStatus].tone}`}>
              {React.createElement(STATUS_CFG[report.protectionStatus].Icon, { size: 14 })}
              Estado del negocio: {STATUS_CFG[report.protectionStatus].label}
            </span>
          }
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => navigate('/productos')} icon={<Package />}>
                PRODUCTOS
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/materias-primas')} icon={<BarChart2 />}>
                INVENTARIO
              </Button>
            </>
          }
        />

        <CardGrid cols={4}>
          {report.kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              title={kpi.label}
              value={kpi.formatted}
              riskLevel={kpi.riskLevel}
              trend={kpi.trend}
            />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_360px] gap-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Qué requiere atención hoy
              </h2>
              <p className="text-small text-muted">
                Prioridades ordenadas por impacto y cercanía.
              </p>
            </div>

            {report.topActions.length > 0 ? (
              <div className="space-y-4">
                {report.topActions.slice(0, 4).map(action => (
                  <PriorityRow key={action.id} action={action} onNavigate={navigate} />
                ))}
              </div>
            ) : (
              <Card className="border-emerald-100 bg-emerald-50">
                <Card.Content className="pt-5">
                  <div className="flex items-start gap-3">
                    <Shield size={18} className="text-emerald-600 mt-0.5" />
                    <div>
                      <p className="text-body" style={{ fontWeight: 600, color: '#065f46' }}>
                        Todo en orden por ahora
                      </p>
                      <p className="text-small" style={{ color: '#059669', marginTop: 'var(--space-4)' }}>
                        No detectamos riesgos inmediatos en margen, stock o inventario.
                      </p>
                    </div>
                  </div>
                </Card.Content>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <Card.Header
                title="Asistente IA"
                description="Lectura rápida de margen y competitividad."
                icon={<Sparkles className="text-slate-500" size={18} />}
              />
              <Card.Content className="pt-4 space-y-4">
                {!aiRequested ? (
                  <p className="text-small text-muted" style={{ lineHeight: 1.6 }}>
                    Genera una lectura compacta para detectar señales de margen y prioridades comerciales.
                  </p>
                ) : loadingAi ? (
                  <div className="space-y-3 py-1">
                    {[85, 72, 94].map(w => (
                      <div key={w} className="h-2 rounded-full bg-slate-100 animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                ) : (
                  <p className="text-small" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                    {aiAnalysis || 'Análisis no disponible en este momento.'}
                  </p>
                )}
              </Card.Content>
              <Card.Footer className="bg-slate-50/60">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={fetchAi}
                  disabled={products.length === 0}
                  isLoading={loadingAi}
                  icon={aiRequested ? <RefreshCw size={16} /> : <Sparkles size={16} />}
                >
                  {aiRequested ? 'ACTUALIZAR INSIGHTS' : 'GENERAR INSIGHTS'}
                </Button>
              </Card.Footer>
            </Card>
          </div>
        </div>
      </SectionBlock>
    </PageContainer>
  );
};

export default Dashboard;
