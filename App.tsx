
import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import RawMaterials from './pages/RawMaterials';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/materias-primas" element={<RawMaterials />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
