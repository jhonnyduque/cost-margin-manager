import React, { useState } from 'react';
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
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // BOOT SAFETY GUARD
    if (authLoading) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 text-slate-500">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
                <p className="font-medium">Initializing BETO OS...</p>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Desktop Sidebar - hidden on mobile */}
            <div className="hidden lg:block">
                <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
            </div>

            {/* Topbar - full width on mobile, offset on desktop */}
            <Topbar sidebarCollapsed={sidebarCollapsed} />

            {/* Main Content Area */}
            <main
                className={`
                    pt-16 px-4 pb-24
                    sm:px-6
                    lg:pt-20 lg:px-6 lg:pb-12
                    transition-all duration-300
                    ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}
                    min-h-[calc(100vh-4rem)]
                `}
            >
                {children}
            </main>

            {/* Mobile Bottom Navigation - visible only on mobile */}
            <div className="lg:hidden">
                <MobileBottomNav />
            </div>
        </div>
    );
};