'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, setAuth, clearAuth, getUser, apiLogin, apiSignup } from '@/lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, totp?: string) => Promise<{ totpRequired?: boolean }>;
  signup: (email: string, password: string, fullName: string, branchId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = getUser();
    if (savedUser) setUser(savedUser);
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, totp?: string) => {
    setIsLoading(true);
    try {
      const response = await apiLogin(email, password, totp);
      if ('totpRequired' in response) {
        return { totpRequired: true };
      }
      setAuth(response.accessToken, response.user);
      setUser(response.user);
      return {};
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    email: string,
    password: string,
    fullName: string,
    branchId: string
  ) => {
    setIsLoading(true);
    try {
      const response = await apiSignup(email, password, fullName, branchId);
      setAuth(response.accessToken, response.user);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
