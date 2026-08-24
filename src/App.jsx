import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { ListPage } from './pages/ListPage.jsx';
import { AssetFormPage } from './pages/AssetFormPage.jsx';
import { TercerosPage } from './pages/TercerosPage.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/terceros" element={<TercerosPage />} />
        <Route path="/nuevo" element={<AssetFormPage mode="create" />} />
        <Route path="/:id" element={<AssetFormPage mode="edit" />} />
      </Routes>
    </Layout>
  );
}
