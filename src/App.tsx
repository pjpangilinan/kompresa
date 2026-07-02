import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { JobsProvider } from './context/JobsContext';
import { Layout } from './components/Layout';
import { ProtectedRoute, PublicOnly } from './components/Guards';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { JobStatus } from './pages/JobStatus';
import { Download } from './pages/Download';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <JobsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route element={<Layout />}>
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/jobs/:jobId"
                  element={
                    <ProtectedRoute>
                      <JobStatus />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/download/:jobId"
                  element={
                    <ProtectedRoute>
                      <Download />
                    </ProtectedRoute>
                  }
                />
              </Route>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </JobsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
