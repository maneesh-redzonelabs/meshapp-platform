import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { clearTokens, getAccessToken, getUserType, saveTokens, saveUserType } from '../lib/secureStore';

type Role = 'doctor' | 'patient' | null;

interface AuthContextValue {
  booting: boolean;
  role: Role;
  isAuthed: boolean;
  signIn: (role: Exclude<Role, null>, accessToken: string, refreshToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [role, setRole] = useState<Role>(null);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const [token, storedRole] = await Promise.all([getAccessToken(), getUserType()]);
      if (token && (storedRole === 'doctor' || storedRole === 'patient')) {
        setIsAuthed(true);
        setRole(storedRole);
      }
      setBooting(false);
    })();
  }, []);

  const signIn = useCallback(async (newRole: Exclude<Role, null>, accessToken: string, refreshToken: string) => {
    await saveTokens(accessToken, refreshToken);
    await saveUserType(newRole);
    setRole(newRole);
    setIsAuthed(true);
  }, []);

  const signOut = useCallback(async () => {
    await clearTokens();
    setRole(null);
    setIsAuthed(false);
  }, []);

  const value = useMemo(
    () => ({ booting, role, isAuthed, signIn, signOut }),
    [booting, role, isAuthed, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
