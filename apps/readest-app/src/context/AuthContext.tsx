'use client';

import {
  createContext,
  useState,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
  useEffect,
} from 'react';
import {
  getSession,
  logout as endSession,
  refreshSession,
  SESSION_CHANGE_EVENT,
  type BookRoomSession,
  type BookRoomUser,
} from '@/services/bookroom/session';

interface AuthContextType {
  token: string | null;
  user: BookRoomUser | null;
  /** Adopt a session just issued by `login()` in `services/bookroom/session`. */
  login: (session: BookRoomSession) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<BookRoomSession | null>(() => getSession());

  // The session store is shared by every window and refreshes itself; follow
  // it rather than keeping a second copy that could drift.
  useEffect(() => {
    const sync = () => setSession(getSession());
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('bookroom:')) sync();
    };
    window.addEventListener(SESSION_CHANGE_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const login = useCallback((next: BookRoomSession) => setSession(next), []);
  const logout = useCallback(() => endSession(), []);
  const refresh = useCallback(() => refreshSession(), []);

  const value = useMemo(
    () => ({
      token: session?.accessToken ?? null,
      user: session?.user ?? null,
      login,
      logout,
      refresh,
    }),
    [session, login, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
