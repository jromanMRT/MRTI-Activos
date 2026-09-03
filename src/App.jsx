import { Navigate, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { ListPage } from './pages/ListPage.jsx';
import { AssetFormPage } from './pages/AssetFormPage.jsx';
import { AssetAlertsPage, AssetCatalogPage, AssetSuiteOverviewPage } from './pages/AssetSuitePage.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/terceros" element={<Navigate replace to="/" />} />
        <Route path="/operacion" element={<AssetSuiteOverviewPage />} />
        <Route path="/catalogos/:resource" element={<AssetCatalogPage />} />
        <Route path="/alertas" element={<AssetAlertsPage />} />
        <Route path="/nuevo" element={<><ListPage /><AssetFormPage mode="create" /></>} />
        <Route path="/:id" element={<><ListPage /><AssetFormPage mode="edit" /></>} />
      </Routes>
    </Layout>
  );
}
