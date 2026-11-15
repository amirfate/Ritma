'use client';

// Client-side shared state: auth + player. (First line must stay the directive.)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from 'react';

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string;
}

interface AuthState {
  user: AuthedUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, inviteCode: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

interface PlayerState {
  trackId: string | null;
  title: string;
  artist: string;
  playing: boolean;
  progress: number;
  play: (trackId: string, title: string, artist: string) => Promise<void>;
  toggle: () => void;
}

const PlayerCtx = createContext<PlayerState | null>(null);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'خطای غیرمنتظره');
  }
  return (await res.json()) as T;
}

interface SavedAuth {
  token: string;
  refreshToken: string | null;
  user: AuthedUser;
}

/** Read persisted auth from localStorage (SSR-safe). */
export function loadSavedAuth(): SavedAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('ritma.auth');
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedAuth>;
    if (!saved.token || !saved.user) return null;
    return { token: saved.token, refreshToken: saved.refreshToken ?? null, user: saved.user };
  } catch {
    return null;
  }
}

/**
 * Rotate tokens via POST /auth/refresh. Returns the new pair, or null
 * when there is no refresh token / the session was revoked.
 */
export async function refreshAccessToken(): Promise<{ token: string; refreshToken: string } | null> {
  const saved = loadSavedAuth();
  if (!saved?.refreshToken) return null;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: saved.refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    localStorage.setItem(
      'ritma.auth',
      JSON.stringify({ token: data.accessToken, refreshToken: data.refreshToken, user: saved.user }),
    );
    return { token: data.accessToken, refreshToken: data.refreshToken };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }): ReactElement {
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshTok, setRefreshTok] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadSavedAuth();
    if (saved) {
      setToken(saved.token);
      setUser(saved.user);
      setRefreshTok(saved.refreshToken);
    }
  }, []);

  const persist = useCallback(
    (nextToken: string, nextUser: AuthedUser, nextRefresh?: string | null) => {
      const refreshToken = nextRefresh ?? null;
      localStorage.setItem('ritma.auth', JSON.stringify({ token: nextToken, refreshToken, user: nextUser }));
      setToken(nextToken);
      setUser(nextUser);
      setRefreshTok(refreshToken);
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<{ accessToken: string; refreshToken: string; user: AuthedUser }>('auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      persist(data.accessToken, data.user, data.refreshToken);
    },
    [persist],
  );

  const register = useCallback(
    async (email: string, name: string, password: string, inviteCode: string) => {
      const data = await api<{ accessToken: string; refreshToken: string; user: AuthedUser }>('auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, inviteCode }),
      });
      persist(data.accessToken, data.user, data.refreshToken);
    },
    [persist],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('ritma.auth');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const me = await api<AuthedUser>('auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      persist(token, me, refreshTok);
    } catch {
      /* keep current state */
    }
  }, [persist, token, refreshTok]);

  const authValue = useMemo(
    () => ({ user, token, login, register, logout, refreshUser }),
    [user, token, login, register, logout, refreshUser],
  );

  return <AuthCtx.Provider value={authValue}>{children}</AuthCtx.Provider>;
}

interface TrackMeta {
  id: string;
  title: string;
  artist: string;
}

export function PlayerProvider({ children }: { children: React.ReactNode }): ReactElement {
  const [meta, setMeta] = useState<TrackMeta | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const play = useCallback(
    async (trackId: string, title: string, artist: string) => {
      const raw = localStorage.getItem('ritma.auth');
      const headers: Record<string, string> = {};
      if (raw) {
        try {
          headers.Authorization = `Bearer ${(JSON.parse(raw) as { token: string }).token}`;
        } catch {
          /* anonymous */
        }
      }
      const res = await fetch(`/api/tracks/${trackId}/stream-url`, { headers });
      if (res.status === 403) {
        throw new Error('برای پخش این اثر اشتراک ویژه لازم است');
      }
      if (!res.ok) throw new Error('دریافت لینک پخش ناموفق بود');
      const data = (await res.json()) as { url: string };
      audio?.pause();
      const next = new Audio(data.url);
      next.ontimeupdate = () => {
        if (next.duration > 0) setProgress(next.currentTime / next.duration);
      };
      next.onended = () => setPlaying(false);
      void next.play();
      setAudio(next);
      setMeta({ id: trackId, title, artist });
      setPlaying(true);
      void fetch(`/api/tracks/${trackId}/plays`, { method: 'POST' });
    },
    [audio],
  );

  const toggle = useCallback(() => {
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [audio]);

  const playerValue = useMemo(
    () => ({
      trackId: meta?.id ?? null,
      title: meta?.title ?? '',
      artist: meta?.artist ?? '',
      playing,
      progress,
      play,
      toggle,
    }),
    [meta, playing, progress, play, toggle],
  );

  return <PlayerCtx.Provider value={playerValue}>{children}</PlayerCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error('usePlayer outside PlayerProvider');
  return ctx;
}

export function AuthNav(): ReactElement | null {
  const { user, logout } = useAuth();
  if (!user) {
    return (
      <>
        <a href="/login" className="btn">
          ورود
        </a>
        <a href="/register" className="btn solid">
          ثبت‌نام
        </a>
      </>
    );
  }
  return (
    <>
      <span>{user.name}</span>
      {user.role === 'ADMIN' ? (
        <a href="/admin" className="btn">
          پنل مدیریت
        </a>
        ) : null}
      <button type="button" className="btn" onClick={logout}>
        خروج
      </button>
    </>
  );
}

export function PlayerBar(): ReactElement | null {
  const player = usePlayer();
  if (!player.trackId) return null;
  return (
    <div className={`player-bar${player.trackId ? ' on' : ''}`}>
      <button type="button" className="btn" onClick={player.toggle}>
        {player.playing ? '⏸' : '▶'}
      </button>
      <div>
        <div className="pb-title">{player.title}</div>
        <div className="pb-sub">{player.artist}</div>
      </div>
      <progress value={player.progress} max={1} />
    </div>
  );
}
