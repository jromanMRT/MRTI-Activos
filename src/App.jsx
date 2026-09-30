import { Navigate, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { ListPage } from './pages/ListPage.jsx';
import { UnitInventoryPage } from './pages/UnitInventoryPage.jsx';
import { AssetFormPage } from './pages/AssetFormPage.jsx';
import { AssetAlertsPage, AssetCatalogPage, AssetSuiteOverviewPage } from './pages/AssetSuitePage.jsx';
import { EmployeeOffboardingPage } from './pages/EmployeeOffboardingPage.jsx';
import { TechnicalNotesPage } from './pages/TechnicalNotesPage.jsx';
import { SecurityAccessPage } from './pages/SecurityAccessPage.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<AssetSuiteOverviewPage />} />
        <Route path="/inventario" element={<ListPage />} />
        <Route path="/referencias-tecnicas" element={<TechnicalNotesPage />} />
        <Route path="/notas-tecnicas" element={<TechnicalNotesPage />} />
        <Route path="/inventario/unidades" element={<UnitInventoryPage />} />
        <Route path="/terceros" element={<Navigate replace to="/inventario" />} />
        <Route path="/operacion" element={<Navigate replace to="/" />} />
        <Route path="/catalogos/:resource" element={<AssetCatalogPage />} />
        <Route path="/alertas" element={<AssetAlertsPage />} />
        <Route path="/seguridad-acceso" element={<SecurityAccessPage />} />
        <Route path="/licencias-antivirus" element={<Navigate replace to="/seguridad-acceso?tab=antivirus" />} />
        <Route path="/teamviewer" element={<Navigate replace to="/seguridad-acceso?tab=teamviewer" />} />
        <Route path="/bajas-personal" element={<EmployeeOffboardingPage />} />
        <Route path="/nuevo" element={<><ListPage /><AssetFormPage mode="create" /></>} />
        <Route path="/:id" element={<><ListPage /><AssetFormPage mode="edit" /></>} />
      </Routes>
    </Layout>
  );
}
