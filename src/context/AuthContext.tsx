import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getMe,
  getStoredUser,
  login as apiLogin,
  logoutStorage,
  saveSession,
  type User,
} from '../api/client';

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  hasRole: (...roles: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const loadUser = useCallback(async () => {
    const stored = getStoredUser();
    if (!stored) {
      setState((s) => ({ ...s, user: null, loading: false }));
      return;
    }
    try {
      const user = await getMe();
      setState((s) => ({ ...s, user, loading: false, error: null }));
    } catch {
      logoutStorage();
      setState((s) => ({ ...s, user: null, loading: false }));
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, error: null }));
      try {
        const { token, user } = await apiLogin(email, password);
        saveSession(token, user);
        setState((s) => ({ ...s, user, loading: false, error: null }));
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Error al iniciar sesión';
        setState((s) => ({ ...s, error: message }));
        throw e;
      }
    },
    []
  );

  const logout = useCallback(() => {
    logoutStorage();
    setState((s) => ({ ...s, user: null }));
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = getStoredUser();
    if (!stored) return;
    try {
      const user = await getMe();
      setState((s) => ({ ...s, user }));
    } catch {
      logoutStorage();
      setState((s) => ({ ...s, user: null }));
    }
  }, []);

  const isAdmin = state.user?.rol === 'administrador';
  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!state.user) return false;
      if (state.user.rol === 'administrador') return true;
      return roles.includes(state.user.rol);
    },
    [state.user]
  );

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshUser,
    isAdmin,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
