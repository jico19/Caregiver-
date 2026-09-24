import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { StateProvider } from './contexts/StateContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StateProvider>
          <AppRoutes />
        </StateProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
