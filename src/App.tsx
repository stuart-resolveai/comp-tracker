import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { RepDashboard } from './components/dashboard/RepDashboard';

function App() {
  const { isAuthenticated, isLoading, authError } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-resolve-beige flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-resolve-lime mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage error={authError} />;
  }

  // Authenticated routes
  return (
    <div className="min-h-screen bg-resolve-beige">
      <Routes>
        <Route path="/" element={<RepDashboard />} />
        <Route path="/oauth/callback" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
