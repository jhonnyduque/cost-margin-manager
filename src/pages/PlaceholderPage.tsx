import React from 'react';
import { Construction } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const PlaceholderPage: React.FC = () => {
    const location = useLocation();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-48)', textAlign: 'center' }}>
            <div style={{ borderRadius: '50%', background: 'var(--surface-muted)', padding: 'var(--space-16)', color: 'var(--text-muted)', marginBottom: 'var(--space-16)' }}>
                <Construction size={48} />
            </div>
            <h2 style={{ fontSize: 'var(--text-h3-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Module Under Construction</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-8)', fontSize: 'var(--text-body-size)' }}>
                The requested module{' '}
                <span style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-muted)', padding: '2px var(--space-8)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
                    {location.pathname}
                </span>{' '}
                is not yet fully implemented in Phase 11.
            </p>
        </div>
    );
};