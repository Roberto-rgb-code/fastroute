import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, AuthUser, clearToken, getToken } from './api';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          setUser(await api.me());
        } catch {
          await clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setUser(res.user);
  };

  const signOut = async () => {
    await clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
