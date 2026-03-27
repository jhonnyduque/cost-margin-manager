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
}

export const DeliveryLogsTable: React.FC = () => {
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('delivery_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filterChannel !== 'all') {
        query = query.eq('channel', filterChannel);
      }
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

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
  }, [page, filterChannel, filterStatus]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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

        <div className="flex items-center gap-2">
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

          <button 
            onClick={fetchLogs}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
            title="Refrescar"
          >
            <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                  No se encontraron registros de entrega
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
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
                        <span className="text-sm font-medium">Entregado</span>
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
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => console.log('Detalle de log:', log)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
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
