
import { useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import createRouter from '@/app/router';
import { AuthProvider } from '@/context/AuthContext';
import { DarkModeProvider } from '@/context/DarkModeProvider';
import { AppDataProvider } from '@/context/AppDataContext';
import ErrorBoundary from '@/components/layout/ErrorBoundary';

/**
 * Router wrapper component that creates the router within the provider context
 * This ensures all route components have access to context providers
 */
const RouterWrapper = () => {
 const router = useMemo(() => createRouter(), []);
  return <RouterProvider router={router} />;
};

const App = () => {
  return (
    <ErrorBoundary>
      <DarkModeProvider>
        <AuthProvider>
          <AppDataProvider>
            <RouterWrapper />
            <ToastContainer 
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              className="toast-container"
              style={{ zIndex: 9999 }}
            />
          </AppDataProvider>
        </AuthProvider>
      </DarkModeProvider>
    </ErrorBoundary>
  );
};

export default App;
