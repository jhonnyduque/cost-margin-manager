import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/os/Sidebar';
import { MobileBottomNav } from '../components/os/MobileBottomNav';
import { Topbar } from '../components/os/Topbar';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface OSLayoutProps {
    children: React.ReactNode;
}

export const OSLayout: React.FC<OSLayoutProps> = ({ children }) => {
    const { isLoading: authLoading, user } = useAuth();

    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebarCollapsed');
            return saved !== null ? saved === 'true' : true;
        }
        return true;
    });

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
    }, [sidebarCollapsed]);

    const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

    if (authLoading) {
        return (
            <div style={{ display: 'flex', height: '100vh', width: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)', color: 'var(--text-muted)' }}>
                <Loader2 style={{ width: '2.5rem', height: '2.5rem', color: 'var(--state-info)', marginBottom: 'var(--space-16)', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontWeight: 500, fontSize: 'var(--text-body-size)' }}>Initializing BETO OS...</p>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--surface-page)' }}>
            {/* Sidebar — desktop only */}
            <div className="hidden lg:block">
                <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
            </div>

            <Topbar sidebarCollapsed={sidebarCollapsed} />

            <main
                style={{
                    position: 'relative',
                    zIndex: 0,
                    paddingTop: '4rem',
                    paddingBottom: '6rem',
                    minHeight: '100vh',
                    marginLeft: 0,
                    transition: 'margin-left var(--transition-slow)',
                }}
                className={sidebarCollapsed ? 'lg:!ml-[var(--sidebar-collapsed)]' : 'lg:!ml-[var(--sidebar-expanded)]'}
            >
                {children}
            </main>

            {/* Mobile bottom nav */}
            <div className="lg:hidden">
                <MobileBottomNav />
            </div>
        </div>
    );
};