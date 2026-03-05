import React, { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ShieldAlert, ShieldX, Sparkles, RefreshCw,
  ChevronRight, AlertTriangle, Package, BarChart2
} from 'lucide-react';
import { useStore } from '../store';
import { getPricingInsights } from '../services/geminiService';
import { runProtectionEngine, type ProtectionReport, type ProtectedAction, type ProtectionStatus } from '../services/protectionEngine';
import { useAuth } from '@/hooks/useAuth';
import { colors, typography, spacing, shadows } from '@/design/design-tokens';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageContainer, SectionBlock, CardGrid } from '@/components/ui/LayoutPrimitives';
import { MetricCard } from '@/components/platform/MetricCard';
import { UniversalPageHeader } from '@/components/ui/UniversalPageHeader';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const SEV_BADGE: Record<string, "error" | "warning" | "neutral"> = {
  critico: "error",
  alto: "warning",
  medio: "warning",
  bajo: "neutral",
};

const STATUS_CFG: Record<ProtectionStatus, { Icon: typeof Shield; variant: "success" | "warning" | "error"; label: string }> = {
  PROTEGIDO: { Icon: Shield, variant: 'success', label: 'PROTEGIDO' },
  EN_RIESGO: { Icon: ShieldAlert, variant: 'warning', label: 'EN RIESGO' },
  CRITICO: { Icon: ShieldX, variant: 'error', label: 'CRÍTICO' },
};


// ─── Alert Row ────────────────────────────────────────────────────────────────
const AlertRow: React.FC<{ action: ProtectedAction; onNavigate: (r: string) => void }> = ({ action, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);
  const sev = action.signal.severity;
  const days = action.signal.timeToImpactDays;

  const urgencyLabel = days === 0 ? 'CRÍTICO' : days === 1 ? 'HOY' : `INMINENTE (~${days}d)`;
  const badgeVariant = SEV_BADGE[sev] || "neutral";

  return (
    <Card
      className={`group cursor-pointer transition-all duration-300 ${expanded ? shadows.lg : shadows.card} hover:border-slate-300`}
      noPadding
      onClick={() => setExpanded(e => !e)}
    >
      <div className={`${spacing.pxLg} py-4 flex items-center gap-4`}>
        <div className={`hidden sm:flex items-center justify-center w-10 h-10 rounded-xl ${badgeVariant === 'error' ? colors.bgDanger : badgeVariant === 'warning' ? colors.bgWarning : colors.bgInfo} ${badgeVariant === 'error' ? colors.danger : badgeVariant === 'warning' ? colors.warning : colors.info}`}>
          <AlertTriangle size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={badgeVariant}>{urgencyLabel}</Badge>
            <p className={`${typography.text.secondary} ${colors.textMuted} font-bold`}>#{action.id.slice(-4)}</p>
          </div>
          <p className={`${typography.text.body} font-bold ${colors.textPrimary} tracking-tight`}>{action.title}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden lg:flex flex-col items-end px-4 border-r border-slate-100">
            <span className={`${typography.text.caption} ${colors.textMuted}`}>RIESGO</span>
            <span className={`${typography.text.body} font-black ${colors.textPrimary}`}>{fmt$(action.signal.estimatedImpact)}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onNavigate(action.actionRoute); }}
            className="group-hover:bg-indigo-50 group-hover:text-indigo-600"
            icon={<ChevronRight />}
          />
        </div>
      </div>

      {expanded && (
        <div className={`${spacing.pLg} border-t ${colors.borderSubtle} ${colors.surfaceMuted}/50 animate-in slide-in-from-top-2 duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`${colors.surface} ${spacing.pMd} rounded-xl border border-red-100/50 shadow-sm relative`}>
              <p className={`${typography.text.caption} ${colors.danger} font-bold mb-2 flex items-center gap-1.5`}>
                <ShieldX size={12} /> ESCENARIO DE INACCIÓN
              </p>
              <p className={`${typography.text.secondary} ${colors.textPrimary} leading-relaxed`}>{action.inactionScenario.narrative}</p>
            </div>
            <div className={`${colors.surface} ${spacing.pMd} rounded-xl border border-emerald-100/50 shadow-sm relative`}>
              <p className={`${typography.text.caption} ${colors.success} font-bold mb-2 flex items-center gap-1.5`}>
                <Shield size={12} /> ESCENARIO DE PROTECCIÓN
              </p>
              <p className={`${typography.text.secondary} ${colors.textPrimary} leading-relaxed`}>{action.actionScenario.narrative}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { user, currentCompany } = useAuth();
  const { products, rawMaterials, batches, movements, productMovements } = useStore();
  const navigate = useNavigate();
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiRequested, setAiRequested] = useState(false);

  const report = useMemo(
    () => runProtectionEngine({ products, rawMaterials, batches, movements, productMovements }),
    [products, rawMaterials, batches, movements, productMovements]
  );

  const fetchAi = useCallback(async () => {
    if (products.length === 0) return;
    setLoadingAi(true);
    setAiRequested(true);
    try {
      const analysis = await getPricingInsights(products, rawMaterials, batches);
      setAiAnalysis(analysis);
    } catch (err) {
      console.error("AI Error:", err);
    } finally {
      setLoadingAi(false);
    }
  }, [products, rawMaterials, batches]);

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Usuario';

  return (
    <PageContainer>
      <SectionBlock className="mb-8">
        {/* Header Estratégico (BETO OS v3.0) */}
        <UniversalPageHeader
          title="Dashboard de Operaciones"
          breadcrumbs={
            <>
              <span>BETO OS</span>
              <span>/</span>
              <span className={colors.textPrimary}>{currentCompany?.name || 'Empresa'}</span>
            </>
          }
          metadata={[
            <span key="1">Empresa: {currentCompany?.name || 'BETO OS'}</span>,
            <span key="2">Última actualización: {new Date(report.generatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>,
            <span key="3">Riesgo monetario: {fmt$(report.totalProtectedValue)}</span>
          ]}
          status={
            <span className={`flex items-center gap-1.5 font-bold ${STATUS_CFG[report.protectionStatus].variant === 'success' ? colors.statusSuccess : STATUS_CFG[report.protectionStatus].variant === 'warning' ? colors.statusWarning : colors.statusDanger}`}>
              {React.createElement(STATUS_CFG[report.protectionStatus].Icon, { size: 14 })}
              Nivel de Riesgo: {STATUS_CFG[report.protectionStatus].label}
            </span>
          }
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => navigate('/productos')} icon={<Package />}>
                PRODUCTOS
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/materias-primas')} icon={<BarChart2 />}>
                M. PRIMAS
              </Button>
            </>
          }
        />

        <CardGrid cols={4}>
          {report.kpis.map((kpi) => (
            <MetricCard
              key={kpi.label}
              title={kpi.label}
              value={kpi.formatted}
              variant={kpi.riskLevel === 'ok' ? 'success' : kpi.riskLevel === 'medio' ? 'warning' : 'error'}
              trend={{
                value: 0, // Placeholder as KPI object doesn't have numeric trend yet
                label: '',
                isPositive: kpi.trend === 'up'
              }}
            />
          ))}
        </CardGrid>
      </SectionBlock>

      {/* Smart Protection Feed */}
      <SectionBlock>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-5 w-1 ${colors.bgBrand} rounded-full`} />
            <h2 className={`${typography.text.section} ${colors.textPrimary} tracking-tight`}>
              Oportunidades de Protección
            </h2>
          </div>
          {report.topActions.length > 0 && (
            <p className={`${typography.text.caption} ${colors.textMuted} font-bold italic`}>
              ↕ CLIC PARA EVALUAR ESCENARIOS
            </p>
          )}
        </div>

        {report.topActions.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {report.topActions.map(action => (
              <AlertRow key={action.id} action={action} onNavigate={navigate} />
            ))}
          </div>
        ) : (
          <Card className={`${colors.bgSuccess} border-emerald-100`}>
            <div className="flex items-center gap-3">
              <Shield size={20} className={colors.success} />
              <p className={`${typography.text.body} ${colors.success} font-bold`}>
                Misión cumplida: El negocio opera dentro de parámetros saludables sin riesgos inminentes.
              </p>
            </div>
          </Card>
        )}
      </SectionBlock>

      {/* AI Analysis Section */}
      <SectionBlock className="mt-6">
        <Card className={`bg-gradient-to-br from-indigo-600 to-indigo-800 border-none ${shadows.lg}`}>
          <Card.Content className="flex flex-col md:flex-row items-center gap-6">
            <div className={`flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 text-white backdrop-blur-md`}>
              <Sparkles size={32} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className={`${typography.text.title} text-white mb-1`}>Consultor Estratégico IA</h3>
              <p className={`${typography.text.body} text-indigo-100 opacity-80`}>Análisis predictivo de márgenes y competitividad de mercado.</p>
            </div>
            {!aiRequested ? (
              <Button
                variant="primary"
                size="lg"
                className="bg-white text-indigo-600 hover:bg-indigo-50 border-none px-10 shadow-none"
                onClick={fetchAi}
                disabled={products.length === 0}
              >
                GENERAR INSIGHTS
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="base"
                className="bg-white/10 text-white hover:bg-white/20 border-white/20"
                onClick={fetchAi}
                isLoading={loadingAi}
                icon={<RefreshCw />}
              >
                RECALCULAR
              </Button>
            )}
          </Card.Content>

          {aiRequested && (
            <Card.Footer className="bg-white/5 border-white/10 mt-0">
              {loadingAi ? (
                <div className="space-y-4 py-2">
                  {[90, 80, 95].map(w => (
                    <div key={w} className={`h-2.5 animate-pulse rounded-full bg-white/10`} style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <p className={`${typography.text.body} text-white whitespace-pre-line leading-relaxed`}>
                    {aiAnalysis || 'Análisis no disponible en este momento.'}
                  </p>
                </div>
              )}
            </Card.Footer>
          )}
        </Card>
      </SectionBlock>
    </PageContainer>
  );
};

export default Dashboard;