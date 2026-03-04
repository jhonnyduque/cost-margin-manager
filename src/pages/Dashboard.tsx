import React, { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ShieldAlert, ShieldX, Sparkles, RefreshCw, Bot,
  TrendingUp, TrendingDown, Minus, ChevronRight, Clock, AlertTriangle,
  DollarSign, Package, BarChart2
} from 'lucide-react';
import { useStore } from '../store';
import { getPricingInsights } from '../services/geminiService';
import { runProtectionEngine, type ProtectionReport, type ProtectedAction, type ProtectionStatus } from '../services/protectionEngine';
import { useAuth } from '@/hooks/useAuth';
import type { KPI } from '@/services/businessHealthEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const SEV_COLOR: Record<string, string> = {
  critico: 'bg-white border-red-100 hover:border-red-200 shadow-[0_2px_10px_-4px_rgba(239,68,68,0.1)]',
  alto: 'bg-white border-orange-100 hover:border-orange-200 shadow-[0_2px_10px_-4px_rgba(249,115,22,0.1)]',
  medio: 'bg-white border-amber-100 hover:border-amber-200 shadow-[0_2px_10px_-4px_rgba(251,191,36,0.1)]',
  bajo: 'bg-white border-blue-100 hover:border-blue-200 shadow-[0_2px_10px_-4px_rgba(59,130,246,0.1)]',
};
const SEV_DOT: Record<string, string> = {
  critico: 'bg-red-500', alto: 'bg-orange-500', medio: 'bg-amber-400', bajo: 'bg-blue-400',
};

const STATUS_CFG: Record<ProtectionStatus, { Icon: typeof Shield; label: string; bar: string; text: string }> = {
  PROTEGIDO: { Icon: Shield, label: 'PROTEGIDO', bar: 'bg-emerald-500', text: 'text-emerald-700' },
  EN_RIESGO: { Icon: ShieldAlert, label: 'EN RIESGO', bar: 'bg-amber-500', text: 'text-amber-700' },
  CRITICO: { Icon: ShieldX, label: 'CRÍTICO', bar: 'bg-red-600', text: 'text-red-700' },
};

// ─── Health Hero Component ──────────────────────────────────────────────────
function HealthHero({ report, userName }: { report: ProtectionReport, userName: string }) {
  const { Icon, label, bar, text } = STATUS_CFG[report.protectionStatus];
  const scoreW = `${report.healthScore}%`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Decorative background gradient */}
      <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-indigo-50/50 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-slate-50/50 blur-3xl" />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-tight">
            Buenas tardes, <span className="text-indigo-600">{userName}</span> 👋
          </h1>
          <p className="text-[13px] text-slate-500 max-w-md">
            {report.executiveSummary}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${text} bg-white shadow-sm ring-1 ring-inset ring-slate-100`}>
              <Icon size={14} />
              {label}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Actualizado hoy, {new Date(report.generatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 min-w-[140px]">
          <div className="relative h-16 w-16 mb-2">
            <svg className="h-full w-full" viewBox="0 0 36 36">
              <path
                className="text-slate-200"
                strokeDasharray="100, 100"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={bar.replace('bg-', 'text-')}
                strokeDasharray={`${report.healthScore}, 100`}
                strokeWidth="3"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-slate-900 leading-none">{report.healthScore}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Salud</span>
            </div>
          </div>
          {report.totalProtectedValue > 0 && (
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Riesgo 7d</p>
              <p className="text-sm font-black text-red-600">{fmt$(report.totalProtectedValue)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────
function KPIStrip({ kpis }: { kpis: KPI[] }) {
  const TIcon = (trend: string) =>
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const riskText: Record<string, string> = {
    ok: 'text-emerald-600', medio: 'text-amber-600', alto: 'text-orange-600', critico: 'text-red-600',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi) => {
        const TI = TIcon(kpi.trend);
        const tc = riskText[kpi.riskLevel] ?? 'text-slate-600';
        return (
          <div key={kpi.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-full hover:shadow-md transition-shadow">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">{kpi.label}</p>
            <div className="flex items-center justify-between mt-auto">
              <span className={`text-xl font-black tabular-nums leading-none ${tc}`}>{kpi.formatted}</span>
              <div className={`p-1.5 rounded-lg ${kpi.trend === 'up' ? 'bg-emerald-50 text-emerald-500' : kpi.trend === 'down' ? 'bg-red-50 text-red-400' : 'bg-slate-50 text-slate-300'}`}>
                <TI size={14} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Alert Row ────────────────────────────────────────────────────────────────
function AlertRow({ action, onNavigate }: { action: ProtectedAction; onNavigate: (r: string) => void; key?: React.Key }) {
  const [expanded, setExpanded] = useState(false);
  const sev = action.signal.severity;
  const days = action.signal.timeToImpactDays;

  const urgencyLabel = days === 0 ? 'Crítico' : days === 1 ? 'Hoy' : `~${days}d`;
  const urgencyColor = days === 0 ? 'text-red-600' : days <= 3 ? 'text-orange-600' : 'text-amber-600';

  return (
    <div
      className={`border rounded-xl overflow-hidden cursor-pointer select-none transition-all duration-300 ${SEV_COLOR[sev] ?? 'bg-white border-slate-200'}`}
      onClick={() => setExpanded(e => !e)}
    >
      {/* ── Main row ── */}
      <div className="flex items-center gap-4 px-4 py-3.5">
        {/* Severity Indicator */}
        <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${SEV_DOT[sev]?.replace('bg-', 'bg-').replace('-500', '-50')} ${SEV_DOT[sev]?.replace('bg-', 'text-')}`}>
          <AlertTriangle size={16} />
        </div>

        {/* Title & Description */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm">{action.title}</p>
          <p className="text-[11px] text-slate-400 font-medium truncate">Impacto potencial en el flujo de caja</p>
        </div>

        {/* Metadata chips */}
        <div className="hidden lg:flex items-center gap-6 text-xs flex-shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Ventana</span>
            <span className={`font-mono font-black ${urgencyColor}`}>
              {urgencyLabel}
            </span>
          </div>
          {action.signal.estimatedImpact > 0 && (
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Riesgo</span>
              <span className="font-black text-slate-700">{fmt$(action.signal.estimatedImpact)}</span>
            </div>
          )}
          {action.netBenefit > 0 && (
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Protección</span>
              <span className="font-black text-emerald-600">{fmt$(action.netBenefit)}</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(action.actionRoute); }}
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white ml-2 transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Expanded scenario comparison ── */}
      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-t border-slate-50 bg-slate-50/30">
          <div className="bg-white p-3 rounded-xl border border-red-50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-1 bg-red-50 text-red-500 rounded-bl-lg">
              <ShieldX size={12} />
            </div>
            <p className="text-[9px] font-black text-red-700 uppercase tracking-widest mb-1.5">Escenario: Inacción</p>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">{action.inactionScenario.narrative}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-emerald-50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-1 bg-emerald-50 text-emerald-500 rounded-bl-lg">
              <Shield size={12} />
            </div>
            <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-1.5">Escenario: Acción hoy</p>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">{action.actionScenario.narrative}</p>
          </div>
        </div>
      )}
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

  return (
    <div className="space-y-3 pb-10 animate-in fade-in duration-300">

      {/* ── 1. Header (clean & minimized) ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-slate-500">
          <DollarSign size={14} />
          <span className="text-[11px] font-bold uppercase tracking-wider">{currentCompany?.name || 'Empresa'}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/productos')} className="text-xs border border-slate-200 rounded-xl px-4 py-2 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all font-semibold flex items-center gap-2 shadow-sm">
            <Package size={14} /> Productos
          </button>
          <button onClick={() => navigate('/materias-primas')} className="text-xs border border-slate-200 rounded-xl px-4 py-2 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all font-semibold flex items-center gap-2 shadow-sm">
            <BarChart2 size={14} /> M. Primas
          </button>
        </div>
      </div>

      {/* ── 2. Health Hero & KPI Grid ─────────────────────────────────── */}
      <HealthHero report={report} userName={userName} />

      <KPIStrip kpis={report.kpis} />

      {/* ── 4. Smart Protection Feed ──────────────────────────────────── */}
      {report.topActions.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-1 bg-indigo-500 rounded-full" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
                Oportunidades de Protección
              </h2>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest tracking-tighter">↕ Clic para escenarios</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.topActions.map(action => (
              <AlertRow key={action.id} action={action} onNavigate={navigate} />
            ))}
          </div>
        </div>
      )}

      {/* ── No alerts state ───────────────────────────────────────────── */}
      {report.topActions.length === 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
          <Shield size={16} className="text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700 font-medium">Sin riesgos activos. El negocio opera dentro de parámetros saludables.</p>
        </div>
      )}

      {/* ── 5. AI Analysis (premium card) ────────────────────────────── */}
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/20 shadow-sm overflow-hidden mt-6">
        <div
          className="flex items-center justify-between px-6 py-5 cursor-pointer hover:bg-white/50 transition-colors"
          onClick={() => !aiRequested && fetchAi()}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 leading-none">Análisis Predictivo IA</h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">Insights de Rentabilidad</p>
            </div>
          </div>
          {!aiRequested ? (
            <button
              onClick={(e) => { e.stopPropagation(); fetchAi(); }}
              disabled={products.length === 0}
              className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-40"
            >
              Generar Análisis
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); fetchAi(); }}
              disabled={loadingAi}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            >
              <RefreshCw size={16} className={loadingAi ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        {aiRequested && (
          <div className="px-6 pb-6 border-t border-indigo-100/50">
            {loadingAi ? (
              <div className="space-y-3 pt-6">
                {[85, 95, 70, 40].map(w => (
                  <div key={w} className="h-2 animate-pulse rounded-full bg-indigo-100/50" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : (
              <div className="pt-6 relative">
                <div className="absolute top-2 left-0 w-8 h-1 bg-indigo-200 rounded-full" />
                <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-line font-medium">
                  {aiAnalysis || 'No se pudo obtener el análisis estratégico en este momento.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;