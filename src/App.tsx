import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Layouts
import { OSLayout } from './layouts/OSLayout';

// Pages
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import RawMaterials from '@/pages/RawMaterials';
import Team from '@/pages/Team';
import Login from '@/pages/Login';
import NotProvisioned from '@/pages/NotProvisioned';
import Settings from '@/pages/Settings';
import MorePage from '@/pages/MorePage'; // ✅ Import agregado
import FinishedGoods from '@/pages/FinishedGoods';

// Pages (New in Src)
import PlatformAdmin from './pages/PlatformAdmin';
import { EnvironmentsPage } from './pages/platform/EnvironmentsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

// Pages - Billing ✅ NUEVOS
import Billing from '@/pages/platform/Billing';
import BillingCheckout from '@/pages/platform/BillingCheckout';
import BillingSuccess from '@/pages/platform/BillingSuccess';

// Context & Hooks
import { useStore } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/hooks/AuthProvider';

const AppContent: React.FC = () => {
    const currentCompanyId = useStore(state => state.currentCompanyId);
    const { isLoading: isAuthLoading, user, mode, isSigningOut } = useAuth();
    const location = useLocation();

    // ✅ PRIMERO: Todos los hooks SIEMPRE se ejecutan
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

    // ✅ SEGUNDO: Checks de estado (DESPUÉS de hooks)

    // 🔥 Loading inicial
    if (isAuthLoading) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 text-slate-500">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
                <p className="font-medium">OS Handling Session...</p>
            </div>
        );
    }

    // 🔥 Signing out - AHORA SÍ (después de hooks)
    if (isSigningOut) {
        console.log('[App] Blocking routing during signout');
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 text-slate-500">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
                <p className="font-medium">Signing out...</p>
            </div>
        );
    }

    // -- ROUTING LOGIC --

    // Public Routes
    if (location.pathname === '/login') {
        if (user) {
            console.log('[App] User detected on /login, redirecting to dashboard');
            return <Navigate to={user.is_super_admin ? "/control-center" : "/dashboard"} replace />;
        }
        return <Login />;
    }

    // Protected Routes (Require User)
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Non-Provisioned State
    const isNotProvisioned = user && !currentCompanyId && !user.is_super_admin;
    if (isNotProvisioned && location.pathname !== '/not-provisioned') {
        return <Navigate to="/not-provisioned" replace />;
    }

    if (location.pathname === '/not-provisioned') {
        return <NotProvisioned />;
    }

    // -- BETO OS SHELL --
    return (
        <OSLayout>
            <Routes>
                {/* Default Redirect */}
                <Route path="/" element={<Navigate to={user.is_super_admin ? "/control-center" : "/dashboard"} replace />} />

                {/* Platform / Super Admin Routes */}
                <Route path="/control-center" element={user.is_super_admin ? <PlatformAdmin /> : <Navigate to="/dashboard" />} />
                <Route path="/platform/environments" element={user.is_super_admin ? <EnvironmentsPage /> : <Navigate to="/dashboard" />} />
                <Route path="/platform/*" element={user.is_super_admin ? <Navigate to="/control-center" /> : <Navigate to="/dashboard" />} />

                {/* Tenant / User Routes */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/control-center" element={user.is_super_admin ? <PlatformAdmin /> : <Dashboard />} />

                {/* Modules */}
                <Route path="/productos" element={<Products />} />
                <Route path="/inventario" element={<FinishedGoods />} />
                <Route path="/materias-primas" element={<RawMaterials />} />
                <Route path="/equipo" element={<Team />} />
                <Route path="/platform/users" element={<Team />} />

                {/* ✅ Billing & Subscription - ACTUALIZADO */}
                <Route path="/platform/billing" element={<Billing />} />
                <Route path="/platform/billing/checkout" element={<BillingCheckout />} />
                <Route path="/platform/billing/success" element={<BillingSuccess />} />
                <Route path="/platform/billing/portal" element={<BillingSuccess />} />

                {/* ✅ Nueva ruta: MorePage */}
                <Route path="/more" element={<MorePage />} />

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