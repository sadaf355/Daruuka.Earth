import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentUser, hasToken, loginUser, logoutUser, registerUser, type CurrentUser } from "../services/auth.api";
import { authStore, useAuthStore } from "../store/authStore";

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore();
  const [loading, setLoading] = useState(hasToken());

  useEffect(() => {
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    getCurrentUser()
      .then((nextUser) => authStore.setUser(nextUser))
      .catch(() => { logoutUser(); authStore.setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    loading,
    login: async (email, password) => {
      await loginUser(email, password);
      authStore.setUser(await getCurrentUser());
    },
    register: async (email, password) => {
      await registerUser(email, password);
      await loginUser(email, password);
      authStore.setUser(await getCurrentUser());
    },
    logout: () => {
      logoutUser();
      authStore.setUser(null);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
