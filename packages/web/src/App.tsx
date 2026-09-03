import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import CatalogStats from "./pages/CatalogStats";
import Ingest from "./pages/Ingest";
import Ask from "./pages/Ask";
import Guide from "./pages/Guide";
import Judge from "./pages/Judge";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="guia" element={<Guide />} />
        <Route path="about" element={<Navigate to="/guia" replace />} />
        <Route path="judge" element={<Judge />} />
        <Route path="greenlight" element={<Navigate to="/#greenlight" replace />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="catalog/stats" element={<CatalogStats />} />
        <Route path="ingest" element={<Ingest />} />
        <Route path="ask" element={<Ask />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
