import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { secureStorage } from "@/lib/secure-storage";
import {
  type AuthUser,
  type FuelType,
  getMe,
  logoutSession,
  refreshSession,
  requestMagicLink as apiRequestMagicLink,
  updateDefaultFuelTab as apiUpdateDefaultFuelTab,
  verifyMagicLink,
} from "@/lib/api";

const REFRESH_TOKEN_KEY = "abasteceae_refresh_token";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  requestMagicLink: (email: string) => Promise<void>;
  completeLogin: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  setDefaultFuelTab: (fuel: FuelType) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const refreshToken = await secureStorage.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) return;
      const session = await refreshSession(refreshToken);
      await secureStorage.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
      const me = await getMe(session.accessToken);
      setAccessToken(session.accessToken);
      setUser(me);
    } catch {
      await secureStorage.deleteItemAsync(REFRESH_TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }

  async function requestMagicLink(email: string) {
    await apiRequestMagicLink(email);
  }

  async function completeLogin(token: string) {
    const result = await verifyMagicLink(token);
    await secureStorage.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken);
    setAccessToken(result.accessToken);
    setUser(result.user);
  }

  async function logout() {
    const refreshToken = await secureStorage.getItemAsync(REFRESH_TOKEN_KEY);
    await secureStorage.deleteItemAsync(REFRESH_TOKEN_KEY);
    setAccessToken(null);
    setUser(null);
    if (refreshToken) {
      await logoutSession(refreshToken).catch(() => {});
    }
  }

  async function setDefaultFuelTab(fuel: FuelType) {
    if (!accessToken) return;
    await apiUpdateDefaultFuelTab(accessToken, fuel);
    setUser((prev) => (prev ? { ...prev, defaultFuelTab: fuel } : prev));
  }

  return (
    <AuthContext.Provider
      value={{ user, accessToken, loading, requestMagicLink, completeLogin, logout, setDefaultFuelTab }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
