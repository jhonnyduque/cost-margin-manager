import React from 'react';
import { Sidebar } from '../components/os/Sidebar';
import { Topbar } from '../components/os/Topbar';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '../platform/useSubscription';
import { Loader2 } from 'lucide-react';

interface OSLayoutProps {
    children: React.ReactNode;
}

export const OSLayout: React.FC<OSLayoutProps> = ({ children }) => {
    const { isLoading: authLoading, user } = useAuth();
    // useSubscription hook handles its own logic, but we might want to know if it's "ready" if it was doing async work. 
    // Currently it's sync derived state from auth context data.
    // So authLoading is the main gate.

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
        // Should be handled by protected route wrapper, but safe fallback
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <Sidebar />
            <Topbar />

            {/* Main Content Area */}
            {/* 
                Sidebar width is w-64 (16rem) when expanded, w-16 (4rem) collapsed.
                The Topbar has padding-left to compensate.
                The Main Content also needs margin-left.
                For simplicity we assume expanded layout for margin or use layout shift logic.
                Sidebar component has fixed position.
                To handle dynamic margin, we might need shared state for sidebar collapse.
                For now, let's use md:ml-64 as default assumption for Desktop OS.
            */}
            <main className="pt-20 px-6 pb-12 transition-all duration-300 lg:ml-64 min-h-[calc(100vh-4rem)]">
                {children}
            </main>
        </div>
    );
};
