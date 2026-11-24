// The BookRoom account this client is signed in to: the server origin and the
// token pair issued by `POST /api/v1/auth/login`. Every request to the server
// (the Readest cloud contract under /api, the native /api/v1 API and the
// cross-origin proxies) authenticates with `getValidAccessToken()`.
//
// Both live in localStorage so they survive restarts on every platform and are
// readable synchronously by the many modules that build URLs from the server.

export interface BookRoomUser {
  id: string;
  username: string;
  email?: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface BookRoomSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  user: BookRoomUser;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: BookRoomUser;
}

const SERVER_KEY = 'bookroom:server';
const SESSION_KEY = 'bookroom:session';
export const SESSION_CHANGE_EVENT = 'bookroom-session-change';
// Refresh this long before expiry so a request in flight never carries a token
// that lapses on the way.
const REFRESH_MARGIN_MS = 60_000;

export class BookRoomAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const storage = (): Storage | null => (typeof window === 'undefined' ? null : localStorage);

/**
 * `books.example.com`, `https://books.example.com/`, `…/api` all mean the
 * same server: the origin (plus any path prefix) without a trailing slash or
 * the `/api` suffix the client appends itself.
 */
export const normalizeServerUrl = (input: string): string => {
  let url = input.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
  return `${parsed.origin}${path}`;
};

/** The configured server, or null before the first sign-in on a native build. */
export const getServerUrl = (): string | null => storage()?.getItem(SERVER_KEY) || null;

export const setServerUrl = (url: string) => {
  storage()?.setItem(SERVER_KEY, normalizeServerUrl(url));
};

export const getSession = (): BookRoomSession | null => {
  const raw = storage()?.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BookRoomSession;
  } catch {
    return null;
  }
};

const notify = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
};

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

// Keep the stored access token current while the app runs: proxied URLs (OPDS
// covers in <img>, catalog fetches) embed it synchronously via
// `getCurrentAccessToken()`, so nothing else would refresh it in time.
const scheduleRefresh = (session: BookRoomSession | null) => {
  clearTimeout(refreshTimer);
  if (!session || typeof window === 'undefined') return;
  const delay = Math.max(0, session.expiresAt - Date.now() - REFRESH_MARGIN_MS);
  refreshTimer = setTimeout(() => void refresh(session), delay);
};

const saveSession = (session: BookRoomSession | null) => {
  if (session) storage()?.setItem(SESSION_KEY, JSON.stringify(session));
  else storage()?.removeItem(SESSION_KEY);
  scheduleRefresh(session);
  notify();
};

const toSession = (pair: TokenPair): BookRoomSession => ({
  accessToken: pair.accessToken,
  refreshToken: pair.refreshToken,
  expiresAt: Date.parse(pair.expiresAt),
  user: pair.user,
});

const authRequest = async (server: string, path: string, body: unknown): Promise<Response> => {
  const response = await fetch(`${server}/api/v1/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new BookRoomAuthError(problem?.detail || response.statusText, response.status);
  }
  return response;
};

export const login = async (
  serverInput: string,
  username: string,
  password: string,
): Promise<BookRoomSession> => {
  const server = normalizeServerUrl(serverInput);
  const response = await authRequest(server, 'login', { username, password });
  const session = toSession((await response.json()) as TokenPair);
  storage()?.setItem(SERVER_KEY, server);
  saveSession(session);
  return session;
};

let refreshing: Promise<BookRoomSession | null> | null = null;

const refresh = (current: BookRoomSession): Promise<BookRoomSession | null> => {
  const server = getServerUrl();
  if (!server) return Promise.resolve(null);
  refreshing ??= authRequest(server, 'refresh', { refreshToken: current.refreshToken })
    .then(async (response) => {
      const session = toSession((await response.json()) as TokenPair);
      saveSession(session);
      return session;
    })
    .catch((error: unknown) => {
      const stored = getSession();
      // Refresh tokens are single-use: a 401 after another tab already rotated
      // this one just means that tab's pair is the current one.
      if (stored && stored.refreshToken !== current.refreshToken) return stored;
      // A rejected refresh token is final: the session was revoked or expired.
      // A network failure keeps the session so the next call can try again.
      if (error instanceof BookRoomAuthError && error.status === 401) {
        saveSession(null);
        return null;
      }
      return stored;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

/** A non-expired access token, refreshing it first when it is about to lapse. */
export const getValidAccessToken = async (): Promise<string | null> => {
  const session = getSession();
  if (!session) return null;
  if (session.expiresAt - Date.now() > REFRESH_MARGIN_MS) return session.accessToken;
  return (await refresh(session))?.accessToken ?? null;
};

/**
 * The stored access token without refreshing, for URLs that must be built
 * synchronously; `scheduleRefresh` keeps it from lapsing while the app runs.
 */
export const getCurrentAccessToken = (): string | null => getSession()?.accessToken ?? null;

/** Forces a refresh, e.g. after a 401 from a token the clock still trusted. */
export const refreshSession = async (): Promise<boolean> => {
  const session = getSession();
  return !!session && !!(await refresh(session));
};

export const logout = async () => {
  const session = getSession();
  const server = getServerUrl();
  saveSession(null);
  if (session && server) {
    await authRequest(server, 'logout', { refreshToken: session.refreshToken }).catch(() => {});
  }
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const server = getServerUrl();
  const token = await getValidAccessToken();
  if (!server || !token) throw new BookRoomAuthError('Not authenticated', 401);
  const response = await fetch(`${server}/api/v1/me/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new BookRoomAuthError(problem?.detail || response.statusText, response.status);
  }
};

scheduleRefresh(getSession());
