import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import MaterialRequestsPage from './pages/MaterialRequestsPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import VendorsPage from './pages/VendorsPage';
import GRNsPage from './pages/GRNsPage';
import MaterialIssuesPage from './pages/MaterialIssuesPage';
import MaterialReturnsPage from './pages/MaterialReturnsPage';
import ReportsPage from './pages/ReportsPage';
import AIAssistantPage from './pages/AIAssistantPage';
import UsersPage from './pages/UsersPage';
import ProjectsPage from './pages/ProjectsPage';
import InvoicesPage from './pages/InvoicesPage';
import AuditPage from './pages/AuditPage';
import NotificationsPage from './pages/NotificationsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="material-requests" element={<MaterialRequestsPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="grns" element={<GRNsPage />} />
        <Route path="material-issues" element={<MaterialIssuesPage />} />
        <Route path="material-returns" element={<MaterialReturnsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="ai-assistant" element={<AIAssistantPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route
          path="users"
          element={
            <RequireRole roles={['admin']}>
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="audit"
          element={
            <RequireRole roles={['admin']}>
              <AuditPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
