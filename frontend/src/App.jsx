import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './store/authStore';
import useUIStore from './store/uiStore';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import GroupDetailPage from './pages/GroupDetailPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ToastContainer from './components/ui/ToastContainer';
import LoadingScreen from './components/ui/LoadingScreen';
import { Analytics } from '@vercel/analytics/react';

export default function App() {
  const { fetchMe, isLoading } = useAuthStore();
  const { initTheme } = useUIStore();

  useEffect(() => {
    initTheme();
    fetchMe();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Global toast notifications */}
      <ToastContainer />
      <Analytics />
    </BrowserRouter>
  );
}
