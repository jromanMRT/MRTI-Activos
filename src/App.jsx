import { Routes, Route } from 'react-router-dom';
import { Shell } from './components/Shell.jsx';
import { ListPage } from './pages/ListPage.jsx';
import { AssetFormPage } from './pages/AssetFormPage.jsx';

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/nuevo" element={<AssetFormPage mode="create" />} />
        <Route path="/:id" element={<AssetFormPage mode="edit" />} />
      </Routes>
    </Shell>
  );
}
