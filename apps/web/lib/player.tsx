'use client';

// Full-featured audio player: queue, prev/next, seek, play state.
// (First line must stay the directive.)

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';

import { loadSavedAuth } from './store';

export interface QueueItem {
  id: string;
  title: string;
  artist: string;
}

interface PlayerState {
  trackId: string | null;
  title: string;
  artist: string;
  playing: boolean;
  progress: number; // 0..1
  currentTime: number;
  duration: number;
  notice: string | null;
  playQueue: (tracks: QueueItem[], startIndex: number) => Promise<void>;
  playSingle: (track: QueueItem) => Promise<void>;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (fraction: number) => void;
  stop: () => void;
}

const PlayerCtx = createContext<PlayerState | null>(null);

function fmt(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PlayerProvider({ children }: { children: React.ReactNode }): ReactElement {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const indexRef = useRef(0);

  /** Loads and starts one queue entry by index (reads refs, sets state). */
  const startAt = useCallback(async (startIdx: number): Promise<void> => {
    const q = queueRef.current;
    const item = q[startIdx];
    if (!item) return;
    indexRef.current = startIdx;
    setIndex(startIdx);

    const saved = loadSavedAuth();
    const headers: Record<string, string> = {};
    if (saved) headers.Authorization = `Bearer ${saved.token}`;

    try {
      const res = await fetch(`/api/tracks/${item.id}/stream-url`, { headers });
      if (res.status === 403) {
        setNotice('برای پخش این اثر اشتراک ویژه لازم است');
        return;
      }
      if (res.status === 404) {
        setNotice('فایل صوتی این ترک هنوز ثبت نشده است');
        return;
      }
      if (!res.ok) {
        setNotice('دریافت لینک پخش ناموفق بود');
        return;
      }
      const data = (await res.json()) as { url: string };
      setNotice(null);

      audioRef.current?.pause();
      const next = new Audio(data.url);
      next.ontimeupdate = () => {
        if (next.duration > 0) setProgress(next.currentTime / next.duration);
        setCurrentTime(next.currentTime);
      };
      next.onloadedmetadata = () => setDuration(next.duration);
      next.onended = () => {
        void fetch(`/api/tracks/${item.id}/plays`, { method: 'POST' });
        if (indexRef.current + 1 < queueRef.current.length) {
          void startAt(indexRef.current + 1);
        } else {
          setPlaying(false);
        }
      };
      next.onerror = () => setNotice('پخش صدا ناموفق بود');
      void next.play().catch(() => setNotice('مرورگر اجازه‌ی پخش خودکار نداد — دوباره دکمه را بزن'));
      audioRef.current = next;
      setPlaying(true);
      void fetch(`/api/tracks/${item.id}/plays`, { method: 'POST' });
    } catch {
      setNotice('خطای غیرمنتظره در پخش');
    }
  }, []);

  const playQueue = useCallback(
    async (tracks: QueueItem[], startIndex: number): Promise<void> => {
      queueRef.current = tracks;
      setQueue(tracks);
      await startAt(startIndex);
    },
    [startAt],
  );

  const playSingle = useCallback(
    async (track: QueueItem): Promise<void> => {
      const existing = queueRef.current.findIndex((t) => t.id === track.id);
      if (existing >= 0) {
        await startAt(existing);
      } else {
        queueRef.current = [track];
        setQueue([track]);
        await startAt(0);
      }
    },
    [startAt],
  );

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }, []);

  const next = useCallback(() => {
    if (indexRef.current + 1 < queueRef.current.length) void startAt(indexRef.current + 1);
  }, [startAt]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    if (indexRef.current > 0) void startAt(indexRef.current - 1);
  }, [startAt]);

  const seek = useCallback((fraction: number) => {
    const a = audioRef.current;
    if (a && Number.isFinite(a.duration) && a.duration > 0) {
      a.currentTime = Math.min(Math.max(fraction, 0), 0.999) * a.duration;
    }
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    queueRef.current = [];
    setQueue([]);
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const value = useMemo(
    () => ({
      trackId: queue[index]?.id ?? null,
      title: queue[index]?.title ?? '',
      artist: queue[index]?.artist ?? '',
      playing,
      progress,
      currentTime,
      duration,
      notice,
      playQueue,
      playSingle,
      toggle,
      next,
      prev,
      seek,
      stop,
    }),
    [queue, index, playing, progress, currentTime, duration, notice, playQueue, playSingle, toggle, next, prev, seek, stop],
  );

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error('usePlayer outside PlayerProvider');
  return ctx;
}

/** Fixed bottom player bar — visible while a track is loaded. */
export function PlayerBar(): ReactElement | null {
  const player = usePlayer();
  if (!player.trackId) return null;
  return (
    <div className="player-bar on">
      <div className="pb-info">
        <div className="pb-title">{player.title}</div>
        <div className="pb-sub">{player.artist}</div>
      </div>
      <div className="pb-controls">
        <button type="button" className="pb-btn" aria-label="قبلی" onClick={player.prev}>
          ⏮
        </button>
        <button type="button" className="pb-btn pb-play" aria-label="پخش/توقف" onClick={player.toggle}>
          {player.playing ? '⏸' : '▶'}
        </button>
        <button type="button" className="pb-btn" aria-label="بعدی" onClick={player.next}>
          ⏭
        </button>
      </div>
      <div className="pb-seek">
        <span className="pb-time">{fmt(player.currentTime)}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={Number.isFinite(player.progress) ? player.progress : 0}
          aria-label="نوار زمان"
          onChange={(e) => player.seek(Number(e.target.value))}
        />
        <span className="pb-time">{fmt(player.duration)}</span>
      </div>
      <button type="button" className="pb-close" aria-label="بستن پلیر" onClick={player.stop}>
        ✕
      </button>
      {player.notice && <div className="pb-notice">{player.notice}</div>}
    </div>
  );
}

/** Clickable track list that drives the player (client component). */
export function TrackList({
  tracks,
  numbered = true,
}: {
  tracks: QueueItem[];
  numbered?: boolean;
}): ReactElement {
  const player = usePlayer();
  const currentIdx = tracks.findIndex((t) => t.id === player.trackId);
  return (
    <div className="track-list">
      {tracks.map((track, i) => {
        const isCurrent = i === currentIdx;
        return (
          <button
            key={track.id}
            type="button"
            className={`track-row clickable${isCurrent ? ' current' : ''}`}
            onClick={() => {
              if (isCurrent) {
                player.toggle();
              } else {
                void player.playQueue(tracks, i);
              }
            }}
          >
            {numbered && (
              <span className="t-num">{isCurrent && player.playing ? '♪' : i + 1}</span>
            )}
            <span className="t-name">
              {track.title}
              {isCurrent && player.playing && <span className="pill pill-live">در حال پخش</span>}
            </span>
            <span className="t-play-hint">{isCurrent && player.playing ? '⏸' : '▶'}</span>
          </button>
        );
      })}
    </div>
  );
}
