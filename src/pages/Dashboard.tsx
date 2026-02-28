import React, { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ShieldAlert, ShieldX, Sparkles, RefreshCw, Bot, TrendingUp, TrendingDown, Minus, ChevronRight, AlertTriangle, AlertCircle, Info, Clock } from 'lucide-react';
import { useStore } from '../store';
import { getPricingInsights } from '../services/geminiService';
import { runProtectionEngine, type ProtectionReport, type ProtectedAction, type ProtectionStatus } from '../services/protectionEngine';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import type { KPI } from '@/services/businessHealthEngine';

// ─── Helpers de UI ────────────────────────────────────────────────────────────

const currency = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const STATUS_CONFIG: Record<ProtectionStatus, {
  icon: typeof Shield;
  label: string;
  ringColor: string;
  bgColor: string;
  textColor: string;
  iconColor: string;
}> = {
  PROTEGIDO: {
    icon: Shield,
    label: 'PROTEGIDO',
    ringColor: 'ring-emerald-400',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-800',
    iconColor: 'text-emerald-500',
  },
  EN_RIESGO: {
    icon: ShieldAlert,
    label: 'EN RIESGO',
    ringColor: 'ring-amber-400',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
    iconColor: 'text-amber-500',
  },
  CRITICO: {
    icon: ShieldX,
    label: 'CRÍTICO',
    ringColor: 'ring-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-800',
    iconColor: 'text-red-500',
  },
};

function HealthScoreRing({ score, status }: { score: number; status: ProtectionStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} stroke="#e2e8f0" strokeWidth="10" fill="none" />
        <circle
          cx="50" cy="50" r={r}
          stroke={status === 'PROTEGIDO' ? '#10b981' : status === 'EN_RIESGO' ? '#f59e0b' : '#ef4444'}
          strokeWidth="10" fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-2xl font-black text-slate-900">{score}</span>
        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Score</span>
      </div>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critico: 'bg-red-500',
    alto: 'bg-orange-500',
    medio: 'bg-amber-400',
    bajo: 'bg-blue-400',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[severity] ?? 'bg-slate-300'} flex-shrink-0`} />;
}

function KPICard({ kpi }: { kpi: KPI; key?: React.Key }) {
  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;
  const trendColor = kpi.trend === 'up' ? 'text-emerald-500' : kpi.trend === 'down' ? 'text-red-500' : 'text-slate-400';
  const riskBg: Record<string, string> = {
    ok: 'bg-emerald-50 border-emerald-100',
    medio: 'bg-amber-50 border-amber-100',
    alto: 'bg-orange-50 border-orange-100',
    critico: 'bg-red-50 border-red-200',
  };
  return (
    <div className={`rounded-2xl border p-4 lg:p-5 ${riskBg[kpi.riskLevel] ?? 'bg-white border-slate-100'}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{kpi.label}</p>
      <p className="text-xl font-black text-slate-900">{kpi.formatted}</p>
      <div className={`flex items-center gap-1 mt-1 ${trendColor}`}>
        <TrendIcon size={13} />
        <span className="text-xs font-medium capitalize">{kpi.trend === 'up' ? 'Saludable' : kpi.trend === 'down' ? 'Cayendo' : 'Estable'}</span>
      </div>
    </div>
  );
}

function ActionCard({ action, onNavigate }: { action: ProtectedAction; onNavigate: (route: string) => void; key?: React.Key }) {
  const urgencyLabel =
    action.signal.timeToImpactDays === 0
      ? 'Ya ocurrió'
      : action.signal.timeToImpactDays === 1
        ? 'Hoy'
        : `En ${action.signal.timeToImpactDays} días`;

  const severityBorder: Record<string, string> = {
    critico: 'border-l-red-500',
    alto: 'border-l-orange-500',
    medio: 'border-l-amber-400',
    bajo: 'border-l-blue-400',
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-100 border-l-4 ${severityBorder[action.signal.severity] ?? 'border-l-slate-300'} p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <SeverityDot severity={action.signal.severity} />
          <div className="min-w-0">
            <p className="font-bold text-sm text-slate-900 leading-snug">{action.title}</p>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{action.description}</p>
          </div>
        </div>
        {action.netBenefit > 0 && (
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Protege</p>
            <p className="text-sm font-black text-emerald-700">{currency(action.netBenefit)}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
        <div className="flex items-center gap-1 text-slate-400">
          <Clock size={12} />
          <span className="text-xs">{urgencyLabel}</span>
        </div>
        <button
          onClick={() => onNavigate(action.actionRoute)}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {action.actionLabel}
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Scenario comparison */}
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-red-50 rounded-lg p-2">
          <p className="font-bold text-red-700 mb-0.5">Sin actuar:</p>
          <p className="text-red-600 line-clamp-2">{action.inactionScenario.narrative}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-2">
          <p className="font-bold text-emerald-700 mb-0.5">Actuando hoy:</p>
          <p className="text-emerald-600 line-clamp-2">{action.actionScenario.narrative}</p>
        </div>
      </div>
    </div>
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

  // ── Único cómputo de negocio ──────────────────────────────────────────────
  const report: ProtectionReport = useMemo(
    () => runProtectionEngine({ products, rawMaterials, batches, movements, productMovements }),
    [products, rawMaterials, batches, movements, productMovements]
  );

  const fetchAi = useCallback(async () => {
    if (products.length === 0) return;
    setLoadingAi(true);
    setAiRequested(true);
    const analysis = await getPricingInsights(products, rawMaterials, batches);
    setAiAnalysis(analysis);
    setLoadingAi(false);
  }, [products, rawMaterials, batches]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Usuario';

  const statusCfg = STATUS_CONFIG[report.protectionStatus];
  const StatusIcon = statusCfg.icon;

  return (
    <div className="animate-in fade-in space-y-6 lg:space-y-8 duration-500 pb-20">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
            {greeting}, {userName} 👋
          </h1>
          <p className="mt-1 text-sm lg:text-base text-slate-500">
            {currentCompany?.name || 'Tu negocio'} · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Actualizado</p>
          <p className="text-xs text-slate-500">{new Date(report.generatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      {/* ── PROTECTION STATUS ───────────────────────────────────────────── */}
      <div className={`rounded-3xl border-2 ${statusCfg.ringColor} ${statusCfg.bgColor} p-6 flex flex-col sm:flex-row items-center gap-6`}>
        {/* Score Ring */}
        <div className="flex-shrink-0">
          <HealthScoreRing score={report.healthScore} status={report.protectionStatus} />
        </div>
        {/* Status Text */}
        <div className="flex-1 text-center sm:text-left">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${statusCfg.bgColor} ${statusCfg.textColor} ring-1 ${statusCfg.ringColor} mb-2`}>
            <StatusIcon size={13} />
            {statusCfg.label}
          </div>
          <p className={`text-sm font-medium ${statusCfg.textColor} leading-relaxed max-w-lg`}>
            {report.executiveSummary}
          </p>
          {report.totalProtectedValue > 0 && (
            <p className="mt-2 text-2xl font-black text-slate-900">
              {currency(report.totalProtectedValue)}
              <span className="text-sm font-normal text-slate-500 ml-2">en riesgo en 7 días</span>
            </p>
          )}
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Salud Financiera</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {report.kpis.map((kpi) => (
            <KPICard key={kpi.label} kpi={kpi} />
          ))}
        </div>
      </div>

      {/* ── ACCIONES PRIORITARIAS ────────────────────────────────────────── */}
      {report.topActions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Acciones Recomendadas
              <span className="ml-2 text-indigo-600">(por beneficio protegido)</span>
            </h2>
            {report.allActions.length > 5 && (
              <p className="text-xs text-slate-400">+{report.allActions.length - 5} más</p>
            )}
          </div>
          <div className="space-y-3">
            {report.topActions.map((action) => (
              <ActionCard key={action.id} action={action} onNavigate={navigate} />
            ))}
          </div>
        </div>
      )}

      {/* ── ESTADO SALUDABLE (sin alertas) ──────────────────────────────── */}
      {report.topActions.length === 0 && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-center">
          <Shield size={36} className="mx-auto text-emerald-400 mb-3" />
          <p className="font-bold text-emerald-800">Todo en orden</p>
          <p className="text-sm text-emerald-600 mt-1">BETO OS no detecta riesgos activos. El negocio opera dentro de parámetros saludables.</p>
        </div>
      )}

      {/* ── IA INSIGHTS ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Análisis IA</h3>
          </div>
          {aiRequested && (
            <Button variant="ghost" onClick={fetchAi} disabled={loadingAi} icon={<RefreshCw size={14} className={loadingAi ? 'animate-spin' : ''} />}>
              Actualizar
            </Button>
          )}
        </div>

        {!aiRequested ? (
          <div className="text-center py-4">
            <Bot size={28} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 mb-4">Obtén un análisis estratégico de márgenes y precios basado en tu inventario actual.</p>
            <button
              onClick={fetchAi}
              disabled={loadingAi || products.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
            >
              <Sparkles size={15} />
              Generar Análisis con IA
            </button>
          </div>
        ) : loadingAi ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map(i => <div key={i} className="h-3 animate-pulse rounded-full bg-slate-100" style={{ width: `${90 - i * 10}%` }} />)}
          </div>
        ) : (
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
            {aiAnalysis || 'No se pudo obtener el análisis. Intenta de nuevo.'}
          </p>
        )}
      </div>

      {/* ── ACCESO RÁPIDO ────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Acceso Rápido</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Productos', route: '/productos' },
            { label: 'Materias Primas', route: '/materias-primas' },
            { label: 'Producción', route: '/productos' },
          ].map(({ label, route }) => (
            <button
              key={route + label}
              onClick={() => navigate(route)}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
            >
              {label}
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;