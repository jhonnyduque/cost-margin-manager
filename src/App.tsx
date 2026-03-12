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
import Explore from './pages/Explore';
import Clients from '@/pages/Clients';
import Dispatches from './pages/Dispatches';
import NotProvisioned from '@/pages/NotProvisioned';
import Settings from '@/pages/Settings';
import MorePage from '@/pages/MorePage';

// Pages - Legal & Support
import PrivacyPage from '@/pages/legal/PrivacyPage';
import TermsPage from '@/pages/legal/TermsPage';
import CompliancePage from '@/pages/legal/CompliancePage';
import HelpPage from '@/pages/HelpPage';
import StatusPage from '@/pages/StatusPage';
import FinishedGoods from '@/pages/FinishedGoods';
import ProductBuilder from '@/pages/ProductBuilder';
import ProductDetail from '@/pages/ProductDetail';
import Suppliers from '@/pages/Suppliers';
import Purchases from '@/pages/Purchases';

// Pages (New in Src)
import PlatformAdmin from './pages/PlatformAdmin';
import { EnvironmentsPage } from './pages/platform/EnvironmentsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

// Pages - Billing
import Billing from '@/pages/platform/Billing';
import BillingCheckout from '@/pages/platform/BillingCheckout';
import BillingSuccess from '@/pages/platform/BillingSuccess';

// Context & Hooks
import { useStore } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/hooks/AuthProvider';
import { notificationListener } from '@/services/eventListeners/notificationListener';

const AppContent: React.FC = () => {
    const currentCompanyId = useStore(state => state.currentCompanyId);
    const { isLoading: isAuthLoading, user, userRole, mode, isSigningOut } = useAuth();
    const location = useLocation();

    useEffect(() => {
        if (user) {
            const listener = notificationListener.start();
            return () => {
                listener.unsubscribe();
            };
        }
    }, [user]);

    useEffect(() => {
        if (user && currentCompanyId) {
            console.log('[App] Triggering full business data load');
            const {
                loadUomMetadata,
                loadProductsFromSupabase,
                loadRawMaterialsFromSupabase,
                loadBatchesFromSupabase,
                loadMovementsFromSupabase,
                loadProductMovementsFromSupabase,
                loadClientsFromSupabase,
                loadDispatchesFromSupabase,
                loadSuppliersFromSupabase,
                loadSupplierMaterialsFromSupabase,
                loadPurchaseOrdersFromSupabase
            } = useStore.getState();

            loadUomMetadata();
            loadProductsFromSupabase();
            loadRawMaterialsFromSupabase();
            loadBatchesFromSupabase();
            loadMovementsFromSupabase();
            loadProductMovementsFromSupabase();
            loadClientsFromSupabase();
            loadDispatchesFromSupabase();
            loadSuppliersFromSupabase();
            loadSupplierMaterialsFromSupabase();
            loadPurchaseOrdersFromSupabase();
        }
    }, [user, currentCompanyId]);

    if (isAuthLoading) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 text-slate-500">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
                <p className="font-medium">OS Handling Session...</p>
            </div>
        );
    }

    if (isSigningOut) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 text-slate-500">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
                <p className="font-medium">Signing out...</p>
            </div>
        );
    }

    if (location.pathname === '/login') {
        if (user) {
            return <Navigate to={user.is_super_admin ? "/control-center" : "/dashboard"} replace />;
        }
        return <Login />;
    }

    if (location.pathname === '/explore') {
        return <Explore />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const isNotProvisioned = user && !currentCompanyId && !user.is_super_admin;
    if (isNotProvisioned && location.pathname !== '/not-provisioned') {
        return <Navigate to="/not-provisioned" replace />;
    }

    if (location.pathname === '/not-provisioned') {
        return <NotProvisioned />;
    }

    const canAccessBilling = user.is_super_admin || ['owner', 'admin', 'manager'].includes(userRole || '');

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

                {/* Productos */}
                <Route path="/productos" element={<Products />} />
                <Route path="/productos/nuevo" element={<ProductBuilder />} />
                <Route path="/productos/editar/:id" element={<ProductBuilder />} />
                <Route path="/productos/detalle/:id" element={<ProductDetail />} />

                {/* Inventario */}
                <Route path="/stock" element={<FinishedGoods />} />
                <Route path="/materias-primas" element={<RawMaterials />} />

                {/* Comercial */}
                <Route path="/clientes" element={<Clients />} />
                <Route path="/despachos" element={<Dispatches />} />

                {/* ── Módulos Próximamente ── */}
                <Route path="/produccion" element={<PlaceholderPage />} />
                <Route path="/compras" element={<Purchases />} />
                <Route path="/proveedores" element={<Suppliers />} />
                <Route path="/reportes" element={<PlaceholderPage />} />

                {/* Equipo */}
                <Route path="/login" element={<Login />} />
                <Route path="/equipo" element={<Team />} />
                <Route path="/platform/users" element={<Team />} />

                {/* Billing */}
                <Route path="/platform/billing" element={canAccessBilling ? <Billing /> : <Navigate to="/dashboard" replace />} />
                <Route path="/platform/billing/checkout" element={canAccessBilling ? <BillingCheckout /> : <Navigate to="/dashboard" replace />} />
                <Route path="/platform/billing/success" element={canAccessBilling ? <BillingSuccess /> : <Navigate to="/dashboard" replace />} />
                <Route path="/platform/billing/portal" element={canAccessBilling ? <BillingSuccess /> : <Navigate to="/dashboard" replace />} />

                {/* Más */}
                <Route path="/mas" element={<MorePage />} />

                {/* Legal & Cumplimiento */}
                <Route path="/legal/privacy" element={<PrivacyPage />} />
                <Route path="/legal/terms" element={<TermsPage />} />
                <Route path="/legal/compliance" element={<CompliancePage />} />

                {/* Soporte y Sistema */}
                <Route path="/help" element={<HelpPage />} />
                <Route path="/status" element={<StatusPage />} />

                <Route path="/ai" element={<PlaceholderPage />} />
                <Route path="/analytics" element={<PlaceholderPage />} />
                <Route path="/settings" element={<Settings />} />

                {/* Legacy */}
                <Route path="/platform" element={<Navigate to="/control-center" replace />} />
                <Route path="/more" element={<Navigate to="/mas" replace />} />

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