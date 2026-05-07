import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/app-shell";
import { DashboardPage } from "./pages/dashboard-page";
import { QueuePage } from "./pages/queue-page";
import { ClientsPage } from "./pages/clients-page";
import { InventoryPage } from "./pages/inventory-page";
import { ClientFormPage } from "./pages/client-form-page";
import { AppointmentsPage } from "./pages/appointments-page";
import { LoginPage } from "./pages/login-page";
import { useAuthStore } from "./store/auth-store";
import { useEffect } from "react";
import { ToastViewport } from "./components/ui/toast-viewport";

function PrivateRoutes() {
  const { isAuthenticated, loading, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted">Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/agendamentos" element={<QueuePage />} />
        <Route path="/agenda-servicos" element={<AppointmentsPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/clientes/novo" element={<ClientFormPage />} />
        <Route path="/estoque" element={<InventoryPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <>
      <ToastViewport />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<PrivateRoutes />} />
      </Routes>
    </>
  );
}
