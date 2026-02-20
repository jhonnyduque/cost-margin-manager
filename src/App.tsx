import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Layouts
import { OSLayout } from './layouts/OSLayout';

// Pages
// Pages (Legacy in Root)
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import RawMaterials from '@/pages/RawMaterials';
import Team from '@/pages/Team';
import Login from '@/pages/Login';
import NotProvisioned from '@/pages/NotProvisioned';
import Settings from '@/pages/Settings';

// Pages (New in Src)
import PlatformAdmin from './pages/PlatformAdmin'; // Now Control Center
import { EnvironmentsPage } from './pages/platform/EnvironmentsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

// Context & Hooks
import { useStore } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/hooks/AuthProvider';

const AppContent: React.FC = () => {
    const currentCompanyId = useStore(state => state.currentCompanyId);
    const { isLoading: isAuthLoading, user, mode } = useAuth();
    const location = useLocation();

    // -- BOOT & LOADING --

    // Global Data Sync
    useEffect(() => {
        if (user && currentCompanyId) {
            console.log('[App] Triggering full business data load');
            const store = useStore.getState();
            store.loadProductsFromSupabase();
            store.loadRawMaterialsFromSupabase();
            store.loadBatchesFromSupabase();
            store.loadMovementsFromSupabase();
        }
    }, [user, currentCompanyId]);

    // -- ROUTING LOGIC --

    if (isAuthLoading) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 text-slate-500">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
                <p className="font-medium">OS Handling Session...</p>
            </div>
        );
    }

    // Public Routes
    if (location.pathname === '/login') {
        if (user) {
            return <Navigate to={user.is_super_admin ? "/control-center" : "/dashboard"} replace />;
        }
        return <Login />;
    }

    // Protected Routes (Require User)
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Non-Provisioned State: Usuario autenticado pero sin empresa y no es Super Admin
    // Añadimos una comprobación extra para evitar la carrera durante el logout
    const isNotProvisioned = user && !currentCompanyId && !user.is_super_admin;
    if (isNotProvisioned && location.pathname !== '/not-provisioned') {
        return <Navigate to="/not-provisioned" replace />;
    }

    if (location.pathname === '/not-provisioned') {
        return <NotProvisioned />;
    }

    // -- BETO OS SHELL --
    // All authenticated routes live inside OSLayout
    return (
        <OSLayout>
            <Routes>
                {/* Default Redirect */}
                <Route path="/" element={<Navigate to={user.is_super_admin ? "/control-center" : "/dashboard"} replace />} />

                {/* Platform / Super Admin Routes */}
                <Route path="/control-center" element={user.is_super_admin ? <PlatformAdmin /> : <Navigate to="/dashboard" />} />
                <Route path="/platform/environments" element={user.is_super_admin ? <EnvironmentsPage /> : <Navigate to="/dashboard" />} />
                <Route path="/platform/*" element={user.is_super_admin ? <Navigate to="/control-center" /> : <Navigate to="/dashboard" />} />

                {/* Tenant / User Routes (Mapped to Sidebar/Registry) */}
                <Route path="/dashboard" element={<Dashboard />} /> {/* Cost Manager */}
                <Route path="/control-center" element={user.is_super_admin ? <PlatformAdmin /> : <Dashboard />} /> {/* Fallback/Alias */}

                {/* Modules */}
                <Route path="/productos" element={<Products />} />
                <Route path="/materias-primas" element={<RawMaterials />} />
                <Route path="/equipo" element={<Team />} /> {/* Users Module */}
                <Route path="/platform/users" element={<Team />} /> {/* Alias for Team */}
                <Route path="/platform/billing" element={<PlaceholderPage />} />
                <Route path="/ai" element={<PlaceholderPage />} />
                <Route path="/analytics" element={<PlaceholderPage />} />
                <Route path="/settings" element={<Settings />} />

                {/* Legacy / Direct Aliases */}
                <Route path="/platform" element={<Navigate to="/control-center" replace />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </OSLayout>
    );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </AuthProvider>
    );
};

export default App;
