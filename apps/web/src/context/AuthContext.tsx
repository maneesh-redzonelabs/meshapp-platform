import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { UserType } from '@meshapp/shared';
import { clearTokens, getAccessToken, setTokens as persistTokens } from '@/lib/apiClient';

export interface SessionUser {
  user_id: string;
  user_type: UserType;
  display_name: string;
  photo_url?: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (user: SessionUser, tokens: { access_token: string; refresh_token: string }) => void;
  logout: () => void;
}

const SESSION_KEY = 'meshapp.session_user';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    const token = getAccessToken();
    if (raw && token) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        // ignore malformed cache
      }
    }
    setIsBootstrapping(false);

    const onUnauthenticated = () => {
      setUser(null);
      localStorage.removeItem(SESSION_KEY);
    };
    window.addEventListener('meshapp:unauthenticated', onUnauthenticated);
    return () => window.removeEventListener('meshapp:unauthenticated', onUnauthenticated);
  }, []);

  const login: AuthContextValue['login'] = (nextUser, tokens) => {
    persistTokens(tokens.access_token, tokens.refresh_token);
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const logout = () => {
    clearTokens();
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: !!user, isBootstrapping, login, logout }),
    [user, isBootstrapping],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
