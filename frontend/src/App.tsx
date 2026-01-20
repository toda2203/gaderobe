import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, App as AntApp } from 'antd';
import { useAuthStore } from '@store/authStore';

// Pages
import Login from '@pages/Login';
import Dashboard from '@pages/Dashboard';
import Employees from '@pages/Employees';
import ClothingTypes from '@pages/ClothingTypes';
import ClothingItems from '@pages/ClothingItems';
import Transactions from '@pages/Transactions';
import Reports from '@pages/Reports';
import Settings from '@pages/Settings';
import ConfirmationPage from '@pages/ConfirmationPage';
import AuditLog from '@pages/AuditLog';

// Components
import AppLayout from '@components/Layout/AppLayout';
import ProtectedRoute from '@components/Auth/ProtectedRoute';
import ErrorBoundary from '@components/ErrorBoundary';

function App() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div>Laden...</div>
      </Layout>
    );
  }

  return (
    <ErrorBoundary>
      <AntApp>
        <BrowserRouter future={{ v7_relativeSplatPath: true }}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<Login />} />
            <Route path="/confirm/:token" element={<ConfirmationPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/clothing-types" element={<ClothingTypes />} />
            <Route path="/clothing" element={<ClothingItems />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/audit-log" element={<AuditLog />} />
          </Route>
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ErrorBoundary>
  );
}

export default App;
