import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, MoreHorizontal, RefreshCw, Activity, AlertTriangle, Moon } from 'lucide-react';
import { adminStatsService, TenantEngagement } from '@/services/adminStatsService';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const ENGAGEMENT_CFG = {
  active:  { label: 'Activo',    color: 'var(--state-success)', bg: 'var(--surface-success-soft)', icon: <Activity size={12} />, badgeVariant: 'success' as const },
  at_risk: { label: 'En riesgo', color: 'var(--state-warning)', bg: 'var(--surface-warning-soft)', icon: <AlertTriangle size={12} />, badgeVariant: 'warning' as const },
  dormant: { label: 'Dormido',   color: 'var(--text-muted)',    bg: 'var(--surface-muted)',         icon: <Moon size={12} />,         badgeVariant: 'neutral' as const },
};

interface Props {
  onAccessTenant: (companyId: string) => void;
  onEditTenant: (company: any) => void;
}

export function TenantEngagementTable({ onAccessTenant, onEditTenant }: Props) {
  const [tenants, setTenants] = useState<TenantEngagement[]>([]);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await adminStatsService.getTenantEngagement();
      setTenants(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // KPI summary
  const summary = {
    active:  tenants.filter(t => t.engagement_status === 'active').length,
    at_risk: tenants.filter(t => t.engagement_status === 'at_risk').length,
    dormant: tenants.filter(t => t.engagement_status === 'dormant').length,
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-48)', color: 'var(--text-muted)', gap: 'var(--space-12)' }}>
      <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '50%', border: '2px solid var(--border-color-default)', borderTopColor: 'var(--state-primary)', animation: 'spin 0.8s linear infinite' }} />
      Cargando engagement...
    </div>
  );

  if (error) return (
    <div style={{ padding: 'var(--space-32)', textAlign: 'center', color: 'var(--state-danger)' }}>
      <p style={{ fontWeight: 700 }}>Error al cargar</p>
      <p className="text-small">{error}</p>
      <Button variant="secondary" size="sm" onClick={load} style={{ marginTop: 'var(--space-16)' }}>Reintentar</Button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>

      {/* KPI bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-16)' }}>
        {(['active', 'at_risk', 'dormant'] as const).map(status => {
          const cfg = ENGAGEMENT_CFG[status];
          return (
            <div key={status} style={{ borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', background: cfg.bg, padding: 'var(--space-16)', display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, boxShadow: 'var(--shadow-sm)' }}>
                {cfg.icon}
              </div>
              <div>
                <p style={{ fontSize: 'var(--text-h2-size)', fontWeight: 900, color: cfg.color, lineHeight: 1 }}>{summary[status]}</p>
                <p style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: cfg.color, opacity: 0.8 }}>{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ borderRadius: 'var(--radius-xl)', border: 'var(--border-default)', background: 'var(--surface-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-16) var(--space-24)', borderBottom: 'var(--border-default)', background: 'var(--surface-page)' }}>
          <div>
            <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-body-size)' }}>Engagement por Tenant</h3>
            <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{tenants.length} empresas registradas</p>
          </div>
          <Button variant="ghost" size="sm" onClick={load} icon={<RefreshCw size={14} />}>Actualizar</Button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: '52rem' }}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plan</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th className="align-right">Última actividad</th>
                <th className="align-right">Productos</th>
                <th className="align-right">Despachos/mes</th>
                <th className="align-right">Seats</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => {
                const cfg = ENGAGEMENT_CFG[t.engagement_status];
                const daysText = t.days_inactive === null
                  ? 'Sin actividad'
                  : t.days_inactive === 0
                    ? 'Hoy'
                    : `Hace ${t.days_inactive}d`;
                const seatPct = t.seat_limit > 0 ? Math.round((t.seat_count / t.seat_limit) * 100) : 0;

                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                        <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-lg)', background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', flexShrink: 0, border: 'var(--border-default)' }}>
                          {t.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</p>
                          <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{t.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge variant={t.subscription_tier === 'growth' ? 'info' : t.subscription_tier === 'scale' ? 'success' : 'neutral'}>
                        {(t.subscription_tier || 'demo').toUpperCase()}
                      </Badge>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-10)', borderRadius: 'var(--radius-lg)', background: cfg.bg, color: cfg.color, fontSize: 'var(--text-caption-size)', fontWeight: 700, border: 'var(--border-default)' }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td className="align-right">
                      <p style={{ fontWeight: 600, color: t.days_inactive === null ? 'var(--text-muted)' : t.days_inactive > 30 ? 'var(--state-danger)' : t.days_inactive > 7 ? 'var(--state-warning)' : 'var(--state-success)' }}>
                        {daysText}
                      </p>
                    </td>
                    <td className="align-right tabular" style={{ fontWeight: 600 }}>{t.total_products}</td>
                    <td className="align-right tabular" style={{ fontWeight: 600, color: t.dispatches_this_month > 0 ? 'var(--state-success)' : 'var(--text-muted)' }}>
                      {t.dispatches_this_month}
                    </td>
                    <td className="align-right">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-8)' }}>
                        <div style={{ width: '3rem', height: '0.375rem', borderRadius: 'var(--radius-full)', background: 'var(--surface-muted)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${seatPct}%`, background: seatPct > 85 ? 'var(--state-danger)' : 'var(--state-primary)', borderRadius: 'var(--radius-full)' }} />
                        </div>
                        <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 700, color: 'var(--text-muted)', minWidth: '2.5rem', textAlign: 'right' }}>{t.seat_count}/{t.seat_limit}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)' }}>
                        <button
                          onClick={() => onAccessTenant(t.id)}
                          style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-md)', border: 'var(--border-default)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-primary-soft)'; e.currentTarget.style.color = 'var(--state-primary)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          title="Acceder como admin"
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() => onEditTenant({ id: t.id, name: t.name, slug: t.slug, subscription_tier: t.subscription_tier, subscription_status: t.subscription_status, seat_count: t.seat_count, seat_limit: t.seat_limit })}
                          style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-md)', border: 'var(--border-default)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-muted)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          title="Editar"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}