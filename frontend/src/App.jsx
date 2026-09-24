import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { StateProvider } from './contexts/StateContext';
import { queryClient } from './lib/queryClient';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <StateProvider>
            <AppRoutes />
          </StateProvider>
        </QueryClientProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
