import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import Ingest from './pages/Ingest';
import Ask from './pages/Ask';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="ingest" element={<Ingest />} />
        <Route path="ask" element={<Ask />} />
      </Route>
    </Routes>
  );
}
