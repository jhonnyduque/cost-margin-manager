import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import RawMaterials from './pages/RawMaterials';
import Team from './pages/Team';
import Login from './pages/Login';
import NotProvisioned from './pages/NotProvisioned';
import PlatformAdmin from './pages/PlatformAdmin';
import Settings from './pages/Settings';
import { SubscriptionBanner } from './components/SubscriptionBanner';
import { useStore } from './store';
import { useAuth } from './hooks/useAuth';
import { AuthProvider } from './hooks/AuthProvider';

const AppContent: React.FC = () => {
  const currentCompanyId = useStore(state => state.currentCompanyId);
  const productsLength = useStore(state => state.products.length);
  const { isLoading: isAuthLoading, user, mode } = useAuth();
  const location = useLocation();

  const isLoginPage = location.pathname === '/login';
  const isNotProvisionedPage = location.pathname === '/not-provisioned';
  const isPlatformPage = location.pathname.startsWith('/platform') || location.pathname === '/beto';

  console.log('[App] Render:', {
    isAuthLoading,
    userId: user?.id,
    companyId: currentCompanyId,
    mode,
    path: location.pathname,
    isLoginPage,
    isNotProvisionedPage,
    isPlatformPage,
    isSuperAdmin: (user as any)?.is_super_admin
  });

  useEffect(() => {
    // ✅ Cargar todos los datos de negocio al detectar empresa activa
    if (user && currentCompanyId) {
      console.log('[App] Triggering full business data load');
      const store = useStore.getState();
      store.loadProductsFromSupabase();
      store.loadRawMaterialsFromSupabase();
      store.loadBatchesFromSupabase();
      store.loadMovementsFromSupabase();
    }
  }, [user, currentCompanyId]);

  // Loader global mientras se recupera la sesión (excepto en Login para evitar parpadeos)
  if (isAuthLoading && !isLoginPage) {
    console.log('[App] Decision: Showing Global Loader');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  // 🛡️ AUTH GUARD: Si no hay usuario y no estamos en Login, obligar Login
  if (!user && !isLoginPage && !isAuthLoading) {
    console.log('[App] Decision: No user -> Redirect to /login');
    return <Navigate to="/login" replace />;
  }

  // 🛡️ REVERSE GUARD: Si el usuario ya está logueado y va a Login, enviarlo al dashboard
  if (user && isLoginPage) {
    console.log('[App] Decision: Logged in -> Redirect away from /login');
    const isSuperAdmin = (user as any)?.is_super_admin;
    return <Navigate to={isSuperAdmin ? "/platform" : "/dashboard"} replace />;
  }

  const isSuperAdmin = (user as any)?.is_super_admin;

  if (user && !currentCompanyId && !isNotProvisionedPage && !isSuperAdmin) {
    console.log('[App] Decision: No company -> Redirect to NotProvisioned');
    return <Navigate to="/not-provisioned" replace />;
  }

  // 🛡️ PLATFORM GUARD: Si es Super Admin y quiere entrar a rutas tenant sin empresa seleccionada
  if (isSuperAdmin && !currentCompanyId && !isPlatformPage && !isNotProvisionedPage) {
    console.log('[App] Decision: SuperAdmin missing context -> Redirect to /platform');
    return <Navigate to="/platform" replace />;
  }

  // Render para rutas especiales (sin Layout)
  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  if (isNotProvisionedPage) {
    return (
      <Routes>
        <Route path="/not-provisioned" element={<NotProvisioned />} />
      </Routes>
    );
  }

  if (isPlatformPage) {
    if (!isSuperAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
    return (
      <Routes>
        <Route path="/platform" element={<PlatformAdmin />} />
        <Route path="/beto" element={<Navigate to="/platform" replace />} />
      </Routes>
    );
  }

  // Render principal con Layout
  return (
    <Layout>
      <SubscriptionBanner />
      <Routes>
        <Route path="/" element={<Navigate to={isSuperAdmin ? "/platform" : "/dashboard"} replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/productos" element={<Products />} />
        <Route path="/materias-primas" element={<RawMaterials />} />
        <Route path="/equipo" element={<Team />} />
        <Route path="/settings" element={<Settings />} />
        {/* Fallback si la ruta no existe */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
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
