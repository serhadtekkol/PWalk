import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, clearTokens, getTokens, setTokens } from '../lib/api';
import type { User } from '../types/pmam';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    try {
      const me = await apiFetch<User>('/api/v1/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const { accessToken, refreshToken } = getTokens();
    if (!accessToken && !refreshToken) {
      setLoading(false);
      return;
    }
    refreshMe().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ user: User; accessToken: string; refreshToken: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await apiFetch<{ user: User; accessToken: string; refreshToken: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
  };

  const logout = async () => {
    const { refreshToken } = getTokens();
    if (refreshToken) {
      await apiFetch('/api/v1/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
