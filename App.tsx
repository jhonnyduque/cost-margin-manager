import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import RawMaterials from './pages/RawMaterials';
import Team from './pages/Team';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';
import { SubscriptionBanner } from './components/SubscriptionBanner';
import { useStore } from './store';
import { useAuth } from './hooks/useAuth';
import { AuthProvider } from './hooks/AuthProvider';

const AppContent: React.FC = () => {
  const currentCompanyId = useStore(state => state.currentCompanyId);
  const productsLength = useStore(state => state.products.length);
  const { isLoading: isAuthLoading, user } = useAuth();
  const location = useLocation();

  const isOnboarding = location.pathname.startsWith('/onboarding');
  const isLoginPage = location.pathname === '/login';

  console.log('[App] Render:', {
    isAuthLoading,
    userId: user?.id,
    companyId: currentCompanyId,
    path: location.pathname,
    isOnboarding,
    isLoginPage
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

  // 🛡️ REVERSE GUARD: Si el usuario ya está logueado y va a Login, enviarlo al home
  if (user && isLoginPage) {
    console.log('[App] Decision: Logged in -> Redirect away from /login');
    return <Navigate to="/" replace />;
  }

  // Redirección forzada a Onboarding si está logueado pero no tiene empresa activa
  if (user && !currentCompanyId && !isOnboarding) {
    console.log('[App] Decision: No company -> Redirect to Onboarding');
    return <Navigate to="/onboarding/create-company" replace />;
  }

  // Redirección fuera de Onboarding si ya tiene empresa
  if (currentCompanyId && isOnboarding) {
    console.log('[App] Decision: Has company -> Redirect away from Onboarding');
    return <Navigate to="/" replace />;
  }

  // Render para rutas especiales (sin Layout)
  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  if (isOnboarding) {
    return (
      <Routes>
        <Route path="/onboarding/create-company" element={<Onboarding />} />
      </Routes>
    );
  }

  // Render principal con Layout
  return (
    <Layout>
      <SubscriptionBanner />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/productos" element={<Products />} />
        <Route path="/materias-primas" element={<RawMaterials />} />
        <Route path="/equipo" element={<Team />} />
        {/* Fallback si la ruta no existe */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};


const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
