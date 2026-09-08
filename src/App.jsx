import { Navigate, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { ListPage } from './pages/ListPage.jsx';
import { AssetFormPage } from './pages/AssetFormPage.jsx';
import { AssetAlertsPage, AssetCatalogPage, AssetSuiteOverviewPage } from './pages/AssetSuitePage.jsx';
import { EmployeeOffboardingPage } from './pages/EmployeeOffboardingPage.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<AssetSuiteOverviewPage />} />
        <Route path="/inventario" element={<ListPage />} />
        <Route path="/terceros" element={<Navigate replace to="/inventario" />} />
        <Route path="/operacion" element={<Navigate replace to="/" />} />
        <Route path="/catalogos/:resource" element={<AssetCatalogPage />} />
        <Route path="/alertas" element={<AssetAlertsPage />} />
        <Route path="/bajas-personal" element={<EmployeeOffboardingPage />} />
        <Route path="/nuevo" element={<><ListPage /><AssetFormPage mode="create" /></>} />
        <Route path="/:id" element={<><ListPage /><AssetFormPage mode="edit" /></>} />
      </Routes>
    </Layout>
  );
}
