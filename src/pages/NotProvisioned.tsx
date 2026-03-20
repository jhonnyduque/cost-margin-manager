import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const NotProvisioned: React.FC = () => {
    const { resetState } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => { resetState(); navigate('/login'); };

    return (
        <div style={{ position: 'relative', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'var(--surface-page)', padding: 'var(--space-24)' }}>
            <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '40%', height: '40%', borderRadius: '50%', background: 'var(--surface-danger-soft)', opacity: 0.6, filter: 'blur(120px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '40%', height: '40%', borderRadius: '50%', background: 'var(--surface-warning-soft)', opacity: 0.6, filter: 'blur(120px)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '28rem' }}>
                <div style={{ borderRadius: 'var(--radius-2xl)', border: 'var(--border-default)', background: 'var(--surface-card)', padding: 'var(--space-40)', textAlign: 'center', boxShadow: 'var(--shadow-xl)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-32)' }}>
                        <div style={{ width: '4rem', height: '4rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface-danger-soft)', color: 'var(--state-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(220,38,38,0.15)' }}>
                            <ShieldAlert size={32} />
                        </div>
                    </div>

                    <h1 style={{ fontSize: 'var(--text-h1-size)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-16)' }}>
                        Cuenta no provisionada
                    </h1>

                    <p style={{ fontWeight: 500, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 'var(--space-32)', fontSize: 'var(--text-body-size)' }}>
                        Tu usuario aún no ha sido asignado a ninguna empresa en la plataforma.
                        Por favor, contacta al administrador de <strong style={{ color: 'var(--text-primary)' }}>BETO</strong> para completar tu acceso.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
                        <a href="mailto:soporte@beto.com"
                            style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-12)', borderRadius: 'var(--radius-xl)', background: 'var(--state-primary)', padding: 'var(--space-16)', fontSize: 'var(--text-body-size)', fontWeight: 700, color: 'var(--text-inverse)', textDecoration: 'none', transition: 'background var(--transition-fast)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--state-primary-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'var(--state-primary)')}>
                            Contactar Soporte <MessageSquare size={18} />
                        </a>

                        <button onClick={handleLogout}
                            style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-12)', borderRadius: 'var(--radius-xl)', background: 'var(--surface-muted)', padding: 'var(--space-16)', fontSize: 'var(--text-body-size)', fontWeight: 700, color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', transition: 'background var(--transition-fast)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--border-color-default)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-muted)')}>
                            Cerrar Sesión <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotProvisioned;