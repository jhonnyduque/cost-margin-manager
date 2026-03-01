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
  critico: 'text-red-600 bg-red-50 border-red-200',
  alto: 'text-orange-600 bg-orange-50 border-orange-200',
  medio: 'text-amber-700 bg-amber-50 border-amber-200',
  bajo: 'text-blue-600 bg-blue-50 border-blue-200',
};
const SEV_DOT: Record<string, string> = {
  critico: 'bg-red-500', alto: 'bg-orange-500', medio: 'bg-amber-400', bajo: 'bg-blue-400',
};

const STATUS_CFG: Record<ProtectionStatus, { Icon: typeof Shield; label: string; bar: string; text: string }> = {
  PROTEGIDO: { Icon: Shield, label: 'PROTEGIDO', bar: 'bg-emerald-500', text: 'text-emerald-700' },
  EN_RIESGO: { Icon: ShieldAlert, label: 'EN RIESGO', bar: 'bg-amber-500', text: 'text-amber-700' },
  CRITICO: { Icon: ShieldX, label: 'CRÍTICO', bar: 'bg-red-600', text: 'text-red-700' },
};

// ─── Status Bar ───────────────────────────────────────────────────────────────
function StatusBar({ report }: { report: ProtectionReport }) {
  const { Icon, label, bar, text } = STATUS_CFG[report.protectionStatus];
  const scoreW = `${report.healthScore}%`;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      {/* Score mini-bar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: scoreW }} />
        </div>
        <span className="text-xs font-black text-slate-800 tabular-nums">{report.healthScore}</span>
      </div>

      {/* Status badge */}
      <div className={`flex items-center gap-1 text-xs font-black ${text} flex-shrink-0`}>
        <Icon size={13} />
        {label}
      </div>

      {/* Summary */}
      <p className="text-xs text-slate-500 flex-1 min-w-0 truncate">{report.executiveSummary}</p>

      {/* Risk value */}
      {report.totalProtectedValue > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0 text-xs">
          <span className="text-slate-400">Riesgo 7d:</span>
          <span className="font-black text-red-600">{fmt$(report.totalProtectedValue)}</span>
        </div>
      )}

      {/* Timestamp */}
      <span className="text-[10px] text-slate-300 flex-shrink-0 tabular-nums">
        {new Date(report.generatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
      </span>
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
    <div className="flex items-stretch rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden divide-x divide-slate-100">
      {kpis.map((kpi) => {
        const TI = TIcon(kpi.trend);
        const tc = riskText[kpi.riskLevel] ?? 'text-slate-600';
        return (
          <div key={kpi.label} className="flex-1 px-4 py-2.5 flex flex-col gap-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none">{kpi.label}</p>
            <div className="flex items-center gap-1.5">
              <span className={`text-base font-black tabular-nums leading-none ${tc}`}>{kpi.formatted}</span>
              <TI size={11} className={kpi.trend === 'up' ? 'text-emerald-500' : kpi.trend === 'down' ? 'text-red-400' : 'text-slate-300'} />
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

  const urgencyLabel = days === 0 ? 'Ya ocurrió' : days === 1 ? 'Hoy' : `~${days}d`;
  const urgencyColor = days === 0 ? 'text-red-600' : days <= 3 ? 'text-orange-600' : 'text-amber-600';

  return (
    <div
      className={`border rounded-lg overflow-hidden cursor-pointer select-none transition-all ${SEV_COLOR[sev] ?? 'bg-white border-slate-200'}`}
      onClick={() => setExpanded(e => !e)}
    >
      {/* ── Main row ── */}
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Severity dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEV_DOT[sev] ?? 'bg-slate-300'}`} />

        {/* Title */}
        <p className="font-semibold text-sm flex-1 min-w-0 truncate">{action.title}</p>

        {/* Metadata chips */}
        <div className="hidden sm:flex items-center gap-3 text-xs flex-shrink-0">
          <span className={`font-mono font-bold ${urgencyColor}`}>
            <Clock size={10} className="inline mr-0.5" />{urgencyLabel}
          </span>
          {action.signal.estimatedImpact > 0 && (
            <span className="text-slate-500">
              Riesgo: <span className="font-bold text-slate-700">{fmt$(action.signal.estimatedImpact)}</span>
            </span>
          )}
          {action.netBenefit > 0 && (
            <span className="text-emerald-700">
              Protege: <span className="font-black">{fmt$(action.netBenefit)}</span>
            </span>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(action.actionRoute); }}
          className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 ml-2 transition-colors"
        >
          {action.actionLabel}
          <ChevronRight size={12} />
        </button>
      </div>

      {/* ── Expanded scenario comparison ── */}
      {expanded && (
        <div className="grid grid-cols-2 gap-px bg-slate-200 border-t border-current/20">
          <div className="bg-red-50 px-3 py-2">
            <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-0.5">Sin actuar</p>
            <p className="text-xs text-red-600 leading-snug">{action.inactionScenario.narrative}</p>
          </div>
          <div className="bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-0.5">Actuando hoy</p>
            <p className="text-xs text-emerald-600 leading-snug">{action.actionScenario.narrative}</p>
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

      {/* ── 1. Header (ultra-compact) ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-900">
            {greeting}, {userName} 👋
          </h1>
          <p className="text-xs text-slate-400">
            {currentCompany?.name || 'Tu empresa'} · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/productos')} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1">
            <Package size={12} /> Productos
          </button>
          <button onClick={() => navigate('/materias-primas')} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1">
            <BarChart2 size={12} /> M. Primas
          </button>
        </div>
      </div>

      {/* ── 2. Status Bar (single line) ───────────────────────────────── */}
      <StatusBar report={report} />

      {/* ── 3. KPI Strip (single row) ─────────────────────────────────── */}
      <KPIStrip kpis={report.kpis} />

      {/* ── 4. Alert Rows ─────────────────────────────────────────────── */}
      {report.topActions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Acciones Recomendadas
              <span className="ml-1 text-indigo-500">(por beneficio protegido)</span>
            </p>
            <p className="text-[10px] text-slate-400">↕ Clic para expandir</p>
          </div>
          <div className="space-y-1.5">
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

      {/* ── 5. AI Analysis (compact) ──────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => !aiRequested && fetchAi()}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-indigo-500" />
            <span className="text-sm font-bold text-slate-800">Análisis IA</span>
          </div>
          {!aiRequested ? (
            <button
              onClick={(e) => { e.stopPropagation(); fetchAi(); }}
              disabled={products.length === 0}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-40"
            >
              Generar <ChevronRight size={12} />
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); fetchAi(); }}
              disabled={loadingAi}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <RefreshCw size={11} className={loadingAi ? 'animate-spin' : ''} />
              Actualizar
            </button>
          )}
        </div>

        {aiRequested && (
          <div className="px-4 pb-3 border-t border-slate-100">
            {loadingAi ? (
              <div className="space-y-2 pt-2">
                {[90, 75, 55].map(w => (
                  <div key={w} className="h-2.5 animate-pulse rounded-full bg-slate-100" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line pt-2">
                {aiAnalysis || 'No se pudo obtener el análisis.'}
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;