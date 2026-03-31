import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { 
  History, 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCcw
} from 'lucide-react';

interface DeliveryLog {
  id: string;
  created_at: string;
  channel: 'email' | 'whatsapp';
  event_type: string; // renombrado
  destination: string; // renombrado
  status: 'success' | 'error' | 'omitted'; // añadido
  error_message?: string; // nuevo
  provider_response: any;
  metadata: any; // renombrado
  // extra metadata
  metadata_error_type?: string;
  metadata_is_mock?: boolean;
}

export const DeliveryLogsTable: React.FC = () => {
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [filterMock, setFilterMock] = useState<string>('all');
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [searchText, setSearchText] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [aggTotals, setAggTotals] = useState<{ total: number; success: number; error: number; omitted: number }>({ total: 0, success: 0, error: 0, omitted: 0 });
  const [aggChannel, setAggChannel] = useState<{ [k: string]: number }>({});
  const [aggMock, setAggMock] = useState<{ mock: number; real: number }>({ mock: 0, real: 0 });
  const [topEvents, setTopEvents] = useState<{ event: string; total: number; errors: number }[]>([]);
  const [topReasonsError, setTopReasonsError] = useState<{ reason: string; count: number; channel?: string }[]>([]);
  const [topReasonsOmitted, setTopReasonsOmitted] = useState<{ reason: string; count: number; channel?: string }[]>([]);
  const [alertCounts, setAlertCounts] = useState<{ error_rate: number; config: number; consecutive: number }>({ error_rate: 0, config: 0, consecutive: 0 });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('delivery_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      const now = new Date();
      const from =
        range === '24h'
          ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
          : range === '7d'
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', from.toISOString());

      if (filterChannel !== 'all') query = query.eq('channel', filterChannel);
      if (filterStatus !== 'all') query = query.eq('status', filterStatus);
      if (filterEvent !== 'all') query = query.eq('event_type', filterEvent);
      if (filterCompany.trim()) query = query.eq('company_id', filterCompany.trim());

      const { data, count, error } = await query;

      if (error) throw error;
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching delivery logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchAggregates();
    fetchAlerts();
  }, [page, filterChannel, filterStatus, filterEvent, filterCompany, range]);

  // Auto-refresh cada 5 segundos para evitar F5 manual
  useEffect(() => {
    // Pausar auto-refresh cuando hay filtros/búsqueda activos para no interrumpir la lectura
    const hasActiveFilters =
      filterChannel !== 'all' ||
      filterStatus !== 'all' ||
      filterEvent !== 'all' ||
      filterMock !== 'all' ||
      filterCompany.trim().length > 0 ||
      searchText.trim().length > 0 ||
      expandedRow !== null;

    if (hasActiveFilters) return;

    const id = setInterval(() => {
      fetchLogs();
    }, 5000);
    return () => clearInterval(id);
  }, [filterChannel, filterStatus, filterEvent, filterMock, filterCompany, searchText, expandedRow, fetchLogs, range]);

  const fetchAggregates = async () => {
    try {
      const now = new Date();
      const from =
        range === '24h'
          ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
          : range === '7d'
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      let query = supabase
        .from('delivery_logs')
        .select('status, channel, event_type, metadata')
        .gte('created_at', from.toISOString())
        .lte('created_at', now.toISOString());

      const { data, error } = await query;
      if (error || !data) return;

      const total = data.length;
      const success = data.filter(d => d.status === 'success').length;
      const errorCount = data.filter(d => d.status === 'error').length;
      const omitted = data.filter(d => d.status === 'omitted').length;
      setAggTotals({ total, success, error: errorCount, omitted });

      const channelCounts: Record<string, number> = {};
      data.forEach(d => { channelCounts[d.channel] = (channelCounts[d.channel] || 0) + 1; });
      setAggChannel(channelCounts);

      const mock = data.filter(d => d.metadata?._meta?.is_mock === true).length;
      const real = data.filter(d => d.metadata?._meta?.is_mock === false).length;
      setAggMock({ mock, real });

      const eventMap: Record<string, { total: number; errors: number }> = {};
      data.forEach(d => {
        const ev = d.event_type || 'N/A';
        if (!eventMap[ev]) eventMap[ev] = { total: 0, errors: 0 };
        eventMap[ev].total += 1;
        if (d.status === 'error') eventMap[ev].errors += 1;
      });
      const eventsArr = Object.entries(eventMap)
        .map(([event, v]) => ({ event, total: v.total, errors: v.errors }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      setTopEvents(eventsArr);

      const reasonAgg = (status: 'error' | 'omitted') => {
        const acc: Record<string, { count: number; channel?: string }> = {};
        data.filter(d => d.status === status).forEach(d => {
          const r = d.metadata?._meta?.reason;
          if (!r) return;
          const key = `${r}::${d.channel}`;
          if (!acc[key]) acc[key] = { count: 0, channel: d.channel };
          acc[key].count += 1;
        });
        return Object.entries(acc)
          .map(([key, v]) => {
            const [reason] = key.split('::');
            return { reason, count: v.count, channel: v.channel };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      };
      setTopReasonsError(reasonAgg('error'));
      setTopReasonsOmitted(reasonAgg('omitted'));
    } catch (err) {
      console.error('Error fetching aggregates:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const now = new Date();
      const from =
        range === '24h'
          ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
          : range === '7d'
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('notifications')
        .select('data')
        .eq('event_key', 'SYSTEM_ERROR')
        .gte('created_at', from.toISOString())
        .lte('created_at', now.toISOString());
      if (error || !data) return;
      const counts = { error_rate: 0, config: 0, consecutive: 0 };
      data.forEach((n: any) => {
        const t = n.data?.alert_type;
        if (t && counts.hasOwnProperty(t)) counts[t as keyof typeof counts] += 1;
      });
      setAlertCounts(counts);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const isMock = log.metadata?._meta?.is_mock;
    if (filterMock === 'mock' && !isMock) return false;
    if (filterMock === 'real' && isMock) return false;
    if (searchText.trim()) {
      const haystack = `${log.destination || ''} ${log.event_type || ''} ${log.error_message || ''} ${log.metadata?._meta?.reason || ''} ${JSON.stringify(log.provider_response || {})}`.toLowerCase();
      if (!haystack.includes(searchText.toLowerCase())) return false;
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const kpiBase = filteredLogs;
  const kpiTotal = kpiBase.length;
  const kpiSuccess = kpiBase.filter(l => l.status === 'success').length;
  const kpiOmitted = kpiBase.filter(l => l.status === 'omitted').length;
  const kpiError = kpiBase.filter(l => l.status === 'error').length;
  const kpiReal = kpiBase.filter(l => l.metadata?._meta?.is_mock === false).length;
  const kpiMock = kpiBase.filter(l => l.metadata?._meta?.is_mock === true).length;
  const reasonCounts = kpiBase.reduce<Record<string, number>>((acc, log) => {
    const r = log.metadata?._meta?.reason;
    if (!r) return acc;
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});
  const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const renderErrorType = (meta: any) => {
    const et = meta?._meta?.error_type;
    if (!et) return null;
    const color = et === 'transient' ? 'text-amber-600' : 'text-rose-600';
    return <span className={`text-[10px] font-semibold ${color}`}>{et}</span>;
  };

  const renderMock = (meta: any) => {
    const isMock = meta?._meta?.is_mock;
    if (isMock === undefined || isMock === null) return null;
    return <span className="text-[10px] text-slate-400 font-semibold">{isMock ? 'mock' : 'real'}</span>;
  };

  const renderProviderResponse = (pr: any) => {
    if (!pr) return <span className="text-xs text-slate-400">—</span>;
    return (
      <pre className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
        {JSON.stringify(pr, null, 2)}
      </pre>
    );
  };

  const renderReason = (log: DeliveryLog) => {
    const reason = log.metadata?._meta?.reason;
    const errorType = log.metadata?._meta?.error_type;
    const hint = log.metadata?.runbook_hint || log.metadata?._meta?.runbook_hint;
    if (!reason && !errorType && !hint) return null;

    const map: Record<string, string> = {
      token_invalid: 'Token inválido o expirado',
      token: 'Token inválido o expirado',
      unauthorized: 'Token inválido o expirado',
      no_opt_in: 'Sin opt-in del destinatario',
      no_phone: 'Número de teléfono faltante',
      invalid_phone: 'Número de teléfono inválido',
      cap_exceeded: 'Límite diario/cooldown activo',
      cooldown_active: 'Límite diario/cooldown activo',
      provider_disabled: 'Canal deshabilitado',
      test_mode: 'Canal en modo test',
      manual_only: 'Canal en modo manual',
      event_not_whitelisted: 'Evento no elegible para canal',
      permission_denied: 'Permiso denegado para envío productivo'
    };

    const prettyReason = reason ? (map[reason] || reason) : null;
    const prettyErr = errorType ? `(${errorType})` : '';
    const prettyHint = hint ? `Sugerencia: ${hint.replace(/_/g, ' ')}` : '';

    return (
      <div className="flex flex-col text-[11px] text-slate-600 mt-1">
        {prettyReason && <span>{prettyReason} {prettyErr}</span>}
        {!prettyReason && errorType && <span>{errorType}</span>}
        {hint && <span className="text-indigo-600 font-semibold">{prettyHint}</span>}
      </div>
    );
  };
  const buildWhatsAppLink = (log: DeliveryLog) => {
    const phone = log.destination;
    if (!phone || log.channel !== 'whatsapp') return null;
    // Derivar mensaje corto desde metadata/compiled si existe; fallback al event_type
    const compiled = log.metadata?.compiledWhatsapp || log.metadata?.compiledEmail || log.metadata;
    const text = compiled?.waText || compiled?.text || compiled?.message || log.event_type;
    const encoded = encodeURIComponent(text || log.event_type || 'Aviso BETO OS');
    return `https://wa.me/${phone.replace('+','') }?text=${encoded}`;
  };

  const canRetry = (log: DeliveryLog) => {
    const et = log.metadata?._meta?.error_type;
    const meta = log.metadata?.compiledEmail || log.metadata?.compiled || log.metadata;
    return log.channel === 'email' && log.status === 'error' && et === 'transient' && !!meta;
  };

  const handleRetry = async (log: DeliveryLog) => {
    if (!canRetry(log)) return;
    setRetryingId(log.id);
    try {
      const compiled = log.metadata?.compiledEmail || log.metadata?.compiled;
      const original = log.metadata || {};
      const destination = log.destination;

      const payload = {
        to: destination,
        template: 'INVENTORY', // se ignora si compiled viene
        data: original,
        compiled,
        useProvider: true
      };

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: payload.to,
          subject: compiled?.subject,
          html: compiled?.html,
          text: compiled?.text
        }
      });

      const success = !error && data?.success;

      // Actualizar status local para feedback rápido
      setLogs((prev) =>
        prev.map((l) =>
          l.id === log.id
            ? {
                ...l,
                status: success ? 'success' : 'error',
                error_message: success ? null : (data?.error || error?.message || 'Retry error'),
                provider_response: success ? data : error || data
              }
            : l
        )
      );
    } catch (err) {
      console.error('Retry error:', err);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header & Filters */}
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <History className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Auditoría de Notificaciones</h3>
            <p className="text-sm text-slate-500">Historial de entrega multi-canal</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select 
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
          >
            <option value="all">Todos los canales</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>

          <select 
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="success">Éxito</option>
            <option value="error">Error</option>
          </select>

          <input
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            placeholder="Evento (ej. SYSTEM_CRITICAL)"
            value={filterEvent === 'all' ? '' : filterEvent}
            onChange={(e) => setFilterEvent(e.target.value || 'all')}
          />

          <input
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            placeholder="Company / Tenant (id)"
            value={filterCompany}
            onChange={(e) => { setFilterCompany(e.target.value); setPage(0); }}
          />

          <select 
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            value={filterMock}
            onChange={(e) => { setFilterMock(e.target.value); setPage(0); }}
          >
            <option value="all">Mock y real</option>
            <option value="mock">Solo mock</option>
            <option value="real">Solo real</option>
          </select>

          <select
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            value={range}
            onChange={(e) => { setRange(e.target.value as any); setPage(0); }}
          >
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
          </select>

          <input
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            placeholder="Buscar destino/error/motivo"
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
          />

          <button 
            onClick={fetchLogs}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
            title="Refrescar"
          >
            <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIs ligeros */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-6 gap-3 border-b border-slate-100 bg-slate-50/40">
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 uppercase font-semibold">Total</p>
          <p className="text-lg font-bold text-slate-800">{aggTotals.total}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 uppercase font-semibold">Success</p>
          <p className="text-lg font-bold text-emerald-700">{aggTotals.success}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 uppercase font-semibold">Omitted</p>
          <p className="text-lg font-bold text-slate-700">{aggTotals.omitted}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 uppercase font-semibold">Error</p>
          <p className="text-lg font-bold text-rose-700">{aggTotals.error}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 uppercase font-semibold">Real</p>
          <p className="text-lg font-bold text-slate-800">{aggMock.real}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 uppercase font-semibold">Mock</p>
          <p className="text-lg font-bold text-slate-800">{aggMock.mock}</p>
        </div>
      </div>

      {/* Alertas y breakdowns */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-100">
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 uppercase font-semibold">Alertas recientes</p>
          <p className="text-sm text-slate-700">error_rate: {alertCounts.error_rate} · config: {alertCounts.config} · consecutive: {alertCounts.consecutive}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 uppercase font-semibold">Por canal</p>
          <p className="text-sm text-slate-700">{Object.entries(aggChannel).map(([c,v]) => `${c}: ${v}`).join(' · ') || '—'}</p>
        </div>
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 uppercase font-semibold">Top razones error/omitted</p>
          <p className="text-xs text-rose-700">Error: {topReasonsError.map(r => `${r.reason}(${r.count}${r.channel ? ' ' + r.channel : ''})`).join(' · ') || '—'}</p>
          <p className="text-xs text-slate-700 mt-1">Omitted: {topReasonsOmitted.map(r => `${r.reason}(${r.count}${r.channel ? ' ' + r.channel : ''})`).join(' · ') || '—'}</p>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-slate-100">
        <p className="text-[11px] text-slate-500 uppercase font-semibold mb-2">Top eventos</p>
        <div className="space-y-1 text-sm text-slate-700">
          {topEvents.length === 0 ? (
            <p className="text-slate-400 text-xs">Sin datos en el rango seleccionado</p>
          ) : topEvents.map(ev => (
            <div key={ev.event} className="flex justify-between">
              <span>{ev.event}</span>
              <span>{ev.total} total · {ev.errors} errores</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <th className="px-6 py-4">Fecha / Hora</th>
              <th className="px-6 py-4">Canal</th>
              <th className="px-6 py-4">Destinatario</th>
              <th className="px-6 py-4">Evento</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4">Mock</th>
              <th className="px-6 py-4">Error Type</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">
                  No se encontraron registros de entrega
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <React.Fragment key={log.id}>
                <tr className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(log.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {log.channel === 'email' ? (
                        <Mail className="w-4 h-4 text-sky-500" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                      )}
                      <span className="text-sm font-medium text-slate-700 capitalize">
                        {log.channel}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600 font-mono">
                      {log.destination}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                      {log.event_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {log.status === 'success' ? (
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {log.channel === 'whatsapp' ? 'Aceptado por provider' : 'Entregado'}
                        </span>
                      </div>
                    ) : log.status === 'omitted' ? (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">Omitido</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <XCircle className="w-4 h-4" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Fallido</span>
                          {log.error_message && (
                            <span className="text-[10px] opacity-70 truncate max-w-[120px]">
                              {log.error_message}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {renderMock(log.metadata)}
                    {renderReason(log)}
                  </td>
                  <td className="px-6 py-4">
                    {renderErrorType(log.metadata)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {log.channel === 'whatsapp' && buildWhatsAppLink(log) && (
                        <a
                          href={buildWhatsAppLink(log)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Abrir en WhatsApp
                        </a>
                      )}
                      {canRetry(log) && (
                        <button
                          disabled={retryingId === log.id}
                          onClick={() => handleRetry(log)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                        >
                          {retryingId === log.id ? 'Reintentando...' : 'Reintentar'}
                        </button>
                      )}
                      <button 
                        onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {expandedRow === log.id ? 'Ocultar' : 'Ver Detalle'}
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedRow === log.id && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="flex flex-col gap-2 text-sm text-slate-700">
                        <div className="flex gap-2">
                          <span className="font-semibold">Error message:</span>
                          <span className="text-slate-600">{log.error_message || '—'}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-semibold">Provider response:</span>
                        </div>
                        {renderProviderResponse(log.provider_response)}
                        <div className="flex gap-2">
                          <span className="font-semibold">Metadata:</span>
                        </div>
                        {renderProviderResponse(log.metadata)}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Mostrando <span className="font-medium">{logs.length}</span> de <span className="font-medium">{totalCount}</span> registros
        </div>
        <div className="flex items-center gap-2">
          <button 
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-slate-600 px-2">
            Pág. {page + 1}
          </span>
          <button 
            disabled={(page + 1) * pageSize >= totalCount}
            onClick={() => setPage(p => p + 1)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
