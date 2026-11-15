'use client';

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

/* ---------- track queue item ---------- */
export interface QueueItem {
  id: string;
  title: string;
  artist: string;
}

/* ---------- context ---------- */
interface PlayerState {
  trackId: string | null;
  title: string;
  artist: string;
  playing: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  notice: string;
  playQueue: (tracks: QueueItem[], startIndex?: number) => void;
  playSingle: (track: QueueItem) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (fraction: number) => void;
  stop: () => void;
}

const PlayerCtx = createContext<PlayerState | null>(null);

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ---------- provider ---------- */
export function PlayerProvider({ children }: { children: React.ReactNode }): ReactElement {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTokenRef = useRef(0);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const stop = useCallback(() => {
    playTokenRef.current += 1;
    stopAudio();
    setNotice('');
  }, [stopAudio]);

  /** fetch a signed streaming url with auth, then start playback */
  const startTrack = useCallback(
    async (item: QueueItem, token: number) => {
      const saved = loadSavedAuth();
      if (!saved?.token) {
        setNotice('برای پخش ابتدا وارد شوید');
        return;
      }
      try {
        const res = await fetch(`/tracks/${item.id}/stream-url`, {
          headers: { Authorization: `Bearer ${saved.token}` },
        });
        if (res.status === 403) {
          setNotice('این قطعه ویژه است — اشتراک یا خرید لازم دارد');
          return;
        }
        if (res.status === 404) {
          setNotice('فایل صوتی این قطعه هنوز ثبت نشده است');
          return;
        }
        if (!res.ok) {
          setNotice('خطا در دریافت نشانی پخش');
          return;
        }
        const data = (await res.json()) as { url: string };
        if (token !== playTokenRef.current) return;

        stopAudio();
        const audio = new Audio(data.url);
        audioRef.current = audio;

        audio.addEventListener('timeupdate', () => {
          setCurrentTime(audio.currentTime);
          if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
        });
        audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
        audio.addEventListener('ended', () => {
          void fetch(`/tracks/${item.id}/plays`, { method: 'POST' });
          // advance the queue
          setQueue((q) => {
            setIndex((i) => {
              const nxt = q[i + 1];
              if (nxt) {
                playTokenRef.current += 1;
                const t = playTokenRef.current;
                void startTrack(nxt, t);
              } else {
                stopAudio();
              }
              return i;
            });
            return q;
          });
        });
        audio.addEventListener('error', () => {
          setNotice('پخش با خطا مواجه شد');
          setPlaying(false);
        });

        await audio.play();
        if (token !== playTokenRef.current) {
          audio.pause();
          return;
        }
        setPlaying(true);
        setNotice('');
        void fetch(`/tracks/${item.id}/plays`, { method: 'POST' });
      } catch {
        // autoplay rejection or network failure
        setNotice('مرورگر اجازه‌ی پخش خودکار نداد — دوباره دکمه‌ی پخش را بزنید');
        setPlaying(false);
      }
    },
    [stopAudio],
  );

  const playQueue = useCallback(
    (tracks: QueueItem[], startIndex = 0) => {
      if (tracks.length === 0) return;
      playTokenRef.current += 1;
      const token = playTokenRef.current;
      setQueue(tracks);
      setIndex(startIndex);
      void startTrack(tracks[startIndex]!, token);
    },
    [startTrack],
  );

  const playSingle = useCallback(
    (track: QueueItem) => {
      playQueue([track], 0);
    },
    [playQueue],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const next = useCallback(() => {
    setQueue((q) => {
      setIndex((i) => {
        const nxt = q[i + 1];
        if (nxt) {
          playTokenRef.current += 1;
          const t = playTokenRef.current;
          void startTrack(nxt, t);
        }
        return i;
      });
      return q;
    });
  }, [startTrack]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setQueue((q) => {
      setIndex((i) => {
        const prv = q[i - 1];
        if (prv) {
          playTokenRef.current += 1;
          const t = playTokenRef.current;
          void startTrack(prv, t);
        }
        return i;
      });
      return q;
    });
  }, [startTrack]);

  const seek = useCallback((fraction: number) => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Math.min(Math.max(fraction, 0), 1) * audio.duration;
    }
  }, []);

  const value = useMemo<PlayerState>(
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

/* ---------- fixed bottom player bar ---------- */
export function PlayerBar(): ReactElement | null {
  const p = usePlayer();
  if (!p.trackId) return null;

  return (
    <div className={`player-bar on${p.playing ? ' playing' : ''}`}>
      {p.notice ? <div className="pb-notice">{p.notice}</div> : null}
      <div className="pb-info">
        <span className="pb-title">{p.title}</span>
        <span className="pb-sub">{p.artist}</span>
      </div>
      <div className="pb-controls">
        <button type="button" className="pb-btn nbtn small" onClick={p.prev} aria-label="قبلی">
          ⏮
        </button>
        <button
          type="button"
          className="pb-btn nbtn pb-play"
          onClick={p.toggle}
          aria-label={p.playing ? 'توقف' : 'پخش'}
        >
          {p.playing ? '⏸' : '▶'}
        </button>
        <button type="button" className="pb-btn nbtn small" onClick={p.next} aria-label="بعدی">
          ⏭
        </button>
      </div>
      <div className="pb-seek">
        <span className="pb-time">{fmt(p.currentTime)}</span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(p.progress * 1000)}
          onChange={(e) => p.seek(Number(e.target.value) / 1000)}
          aria-label="نوار زمان"
        />
        <span className="pb-time">{fmt(p.duration)}</span>
      </div>
      <button type="button" className="pb-close" onClick={p.stop} aria-label="بستن پلیر">
        ✕
      </button>
    </div>
  );
}

/* ---------- clickable track list ---------- */
export function TrackList({ tracks }: { tracks: QueueItem[] }): ReactElement {
  const p = usePlayer();
  return (
    <div className="track-list">
      {tracks.map((t, i) => {
        const current = p.trackId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={`track-row clickable${current ? ' current' : ''}`}
            onClick={() => {
              if (current) {
                p.toggle();
              } else {
                p.playQueue(tracks, i);
              }
            }}
          >
            <span className="t-num">{i + 1}</span>
            <span className="t-name">{t.title}</span>
            {current ? <span className="pill-live">در حال پخش</span> : null}
            <span className="t-play-hint">{current && p.playing ? '⏸' : '▶'}</span>
          </button>
        );
      })}
    </div>
  );
}
