import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { queryClient } from '../lib/queryClient';

const AuthContext = createContext(null);
const TOKEN_KEY = 'caregiver_access_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const profile = await api.get('/auth/me', storedToken);
        setUser({
          ...profile,
          role: profile.roles?.name || 'public',
        });
        setToken(storedToken);
      } catch (err) {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function login(email, password) {
    queryClient.clear();
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);

    try {
      const profile = await api.get('/auth/me', data.access_token);
      const fullUser = {
        ...profile,
        role: profile.roles?.name || data.role,
      };
      setUser(fullUser);
      return fullUser;
    } catch {
      const basicUser = {
        id: data.user_id,
        role: data.role,
        state_id: data.state_id,
      };
      setUser(basicUser);
      return basicUser;
    }
  }

  async function register(email, password, role = 'caregiver', state_id = null, profile = {}) {
    return await api.post('/auth/register', {
      email,
      password,
      role,
      state_id,
      ...profile,
    });
  }

  async function logout() {
    try {
      if (token) {
        await api.post('/auth/logout', null, token);
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      queryClient.clear();
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setToken(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
