'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  priceIrR?: number;
  lyrics?: string | null;
  syncedContent?: string | null;
}

/* ---------- context ---------- */
interface PlayerState {
  trackId: string | null;
  title: string;
  artist: string;
  syncedText: string | null;
  plainLyrics: string | null;
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
  /* fullpage stage + v3.4 controls */
  stageOpen: boolean;
  openStage: () => void;
  closeStage: () => void;
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
  rate: number;
  cycleRate: () => void;
  repeat: boolean;
  toggleRepeat: () => void;
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

  const [stageOpen, setStageOpen] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRateState] = useState(1);
  const [repeat, setRepeat] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTokenRef = useRef(0);
  const volumeRef = useRef(1);
  const mutedRef = useRef(false);
  const rateRef = useRef(1);
  const repeatRef = useRef(false);

  /** apply latest volume/mute/rate/repeat to the live audio element */
  const applyAudioSettings = useCallback((): void => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = mutedRef.current ? 0 : volumeRef.current;
    a.playbackRate = rateRef.current;
    a.loop = repeatRef.current;
  }, []);

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
        applyAudioSettings();

        audio.addEventListener('timeupdate', () => {
          setCurrentTime(audio.currentTime);
          if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
        });
        audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
        audio.addEventListener('ended', () => {
          void fetch(`/tracks/${item.id}/plays`, {
            headers: saved ? { Authorization: `Bearer ${saved.token}` } : undefined,
            method: 'POST',
          });
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
        void fetch(`/tracks/${item.id}/plays`, {
            headers: saved ? { Authorization: `Bearer ${saved.token}` } : undefined,
            method: 'POST',
          });
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

  const openStage = useCallback((): void => setStageOpen(true), []);
  const closeStage = useCallback((): void => setStageOpen(false), []);

  const setVolume = useCallback(
    (v: number) => {
      volumeRef.current = Math.min(Math.max(v, 0), 1);
      if (volumeRef.current > 0) mutedRef.current = false;
      setVolumeState(volumeRef.current);
      setMuted(mutedRef.current);
      applyAudioSettings();
    },
    [applyAudioSettings],
  );

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    applyAudioSettings();
  }, [applyAudioSettings]);

  const RATES: number[] = [1, 1.25, 1.5, 2, 0.75];
  const cycleRate = useCallback(() => {
    const cur = RATES.indexOf(rateRef.current);
    const nextRate = RATES[(cur === -1 ? 0 : cur + 1) % RATES.length] ?? 1;
    rateRef.current = nextRate;
    setRateState(nextRate);
    applyAudioSettings();
  }, [applyAudioSettings]);

  const toggleRepeat = useCallback(() => {
    repeatRef.current = !repeatRef.current;
    setRepeat(repeatRef.current);
    applyAudioSettings();
  }, [applyAudioSettings]);

  const value = useMemo<PlayerState>(
    () => ({
      trackId: queue[index]?.id ?? null,
      title: queue[index]?.title ?? '',
      artist: queue[index]?.artist ?? '',
      syncedText: queue[index]?.syncedContent ?? null,
      plainLyrics: queue[index]?.lyrics ?? null,
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
      stageOpen,
      openStage,
      closeStage,
      volume,
      setVolume,
      muted,
      toggleMute,
      rate,
      cycleRate,
      repeat,
      toggleRepeat,
    }),
    [queue, index, playing, progress, currentTime, duration, notice, playQueue, playSingle, toggle, next, prev, seek, stop, stageOpen, openStage, closeStage, volume, setVolume, muted, toggleMute, rate, cycleRate, repeat, toggleRepeat],
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
        <span className="pb-time" dir="ltr">{fmt(p.currentTime)}</span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(p.progress * 1000)}
          onChange={(e) => p.seek(Number(e.target.value) / 1000)}
          aria-label="نوار زمان"
        />
        <span className="pb-time" dir="ltr">{fmt(p.duration)}</span>
      </div>
      <button type="button" className="pb-expand nbtn small" onClick={p.openStage} aria-label="پلیر تمام‌صفحه">
        ⛶
      </button>
      <button type="button" className="pb-close" onClick={p.stop} aria-label="بستن پلیر">
        ✕
      </button>
    </div>
  );
}

/* ---------- clickable track list with optional buy buttons ---------- */
export function TrackList({ tracks }: { tracks: QueueItem[] }): ReactElement {
  const p = usePlayer();
  const [owned, setOwned] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);

  async function buy(t: QueueItem): Promise<void> {
    const saved = loadSavedAuth();
    if (!saved) {
      setNotice('برای خرید ابتدا وارد شوید.');
      return;
    }
    try {
      const res = await fetch(`/api/tracks/${t.id}/purchase`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${saved.token}` },
      });
      const body = (await res.json()) as { ok?: boolean; paidFrom?: string; needGateway?: boolean; ref?: string; message?: string; already?: boolean; free?: boolean };
      if (!res.ok) throw new Error(body.message ?? 'خطا در خرید');
      if (body.needGateway && body.ref) {
        window.location.href = `/pay/${body.ref}`;
        return;
      }
      setOwned((o) => ({ ...o, [t.id]: true }));
      setNotice(body.already ? 'این قطعه قبلاً در کتابخانه شماست.' : 'خرید انجام شد — قطعه به کتابخانه‌تان اضافه شد.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'خطای غیرمنتظره');
    }
  }

  return (
    <div className="track-list">
      {notice && <p className="msg">{notice}</p>}
      {tracks.map((t, i) => {
        const current = p.trackId === t.id;
        const sellable = (t.priceIrR ?? 0) > 0 && !owned[t.id];
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
            {sellable ? (
              <span
                className="nbtn small primary"
                style={{ marginLeft: 8 }}
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  void buy(t);
                }}
              >
                خرید {(t.priceIrR ?? 0) / 10 > 0 ? `${((t.priceIrR ?? 0) / 10).toLocaleString('fa-IR')} ت` : ''}
              </span>
            ) : null}
            <span className="t-play-hint">{current && p.playing ? '⏸' : '▶'}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- lyrics parsing (ported from legacy parseLyrics — LRC + plain) ---------- */
interface ParsedLyrics {
  lines: string[];
  times: number[] | null;
}

function parseLyrics(text: string | null | undefined): ParsedLyrics {
  const out: ParsedLyrics = { lines: [], times: null };
  const all = (text ?? '').split('\n');
  const re = /^\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*/;
  const stamped = all.some((l) => re.test(l.trim()));
  if (stamped) {
    out.times = [];
    for (const raw of all) {
      let line = raw.trim();
      if (!line || /^\[[a-zA-Z#]+:/.test(line)) continue;
      let m: RegExpMatchArray | null;
      let first = true;
      while ((m = re.exec(line))) {
        const frac = m[3] ? +(m[3].length === 1 ? '0.' + m[3] : '0.' + m[3]) : 0;
        const t = Number(m[1]) * 60 + Number(m[2]) + frac;
        if (first) {
          out.times.push(t);
          out.lines.push('');
          first = false;
        }
        line = line.slice(m[0].length);
      }
      if (out.lines.length && out.lines[out.lines.length - 1] === '') {
        out.lines[out.lines.length - 1] = line || '♪';
      } else if (line) {
        out.lines.push(line);
        out.times.push(out.times[out.times.length - 1] ?? 0);
      }
    }
  } else {
    out.lines = all.map((l) => l.trim()).filter(Boolean);
  }
  return out;
}

/* ---------- fullpage player stage (vinyl + karaoke lyrics) ---------- */
export function PlayerStage(): ReactElement | null {
  const p = usePlayer();
  const [activeLine, setActiveLine] = useState(-1);
  const lyricsBoxRef = useRef<HTMLDivElement | null>(null);
  const parsed = useMemo(
    () => parseLyrics(p.syncedText ?? p.plainLyrics ?? ''),
    [p.syncedText, p.plainLyrics],
  );

  /* karaoke: highlight current line (LRC timing, or even split fallback) */
  useEffect(() => {
    if (!parsed.lines.length) {
      setActiveLine(-1);
      return;
    }
    const t = p.currentTime;
    if (parsed.times) {
      let idx = -1;
      for (let i = 0; i < parsed.times.length; i++) {
        const stamp = parsed.times[i];
        if (stamp !== undefined && stamp <= t + 0.15) idx = i;
        else break;
      }
      setActiveLine(idx);
    } else if (p.duration > 0) {
      setActiveLine(Math.min(parsed.lines.length - 1, Math.floor((t / p.duration) * parsed.lines.length)));
    }
    const box = lyricsBoxRef.current;
    const el = box?.querySelector<HTMLElement>('.l-line.on');
    if (box && el) {
      const target = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
      box.scrollTo({ top: Math.max(target, 0), behavior: 'smooth' });
    }
  }, [p.currentTime, p.duration, parsed]);

  if (!p.trackId || !p.stageOpen) return null;

  const volPct = Math.round((p.muted ? 0 : p.volume) * 100);

  return (
    <div className={`pstage${p.playing ? ' playing' : ''}`} role="dialog" aria-label="پلیر تمام‌صفحه">
      <button type="button" className="nbtn pclose" onClick={p.closeStage} aria-label="بستن">
        ✕
      </button>
      <div className="wrap">
        <div className="vside">
          <h1 id="stageSong">{p.title || '—'}</h1>
          <div className="artist">{p.artist || '—'}</div>
          <div className="neu-in lyrics" ref={lyricsBoxRef}>
            {parsed.lines.length === 0
              ? 'این ترک متن شعر ندارد.'
              : parsed.lines.map((line, i) => (
                  <div key={`${i}-${line.slice(0, 8)}`} className={`l-line${i === activeLine ? ' on' : ''}`}>
                    {line}
                  </div>
                ))}
          </div>
          <div className="neu vcontrols">
            <div className="vrow">
              <button
                type="button"
                className={`nbtn${p.repeat ? ' active' : ''}`}
                onClick={p.toggleRepeat}
                aria-label="تکرار"
                title="تکرار"
              >
                🔁
              </button>
              <button type="button" className="nbtn small" onClick={p.prev} aria-label="قبلی">
                ⏮
              </button>
              <button type="button" className="nbtn big" onClick={p.toggle} aria-label={p.playing ? 'توقف' : 'پخش'}>
                {p.playing ? '⏸' : '▶'}
              </button>
              <button type="button" className="nbtn small" onClick={p.next} aria-label="بعدی">
                ⏭
              </button>
              <button
                type="button"
                className="nbtn"
                onClick={p.cycleRate}
                aria-label="سرعت پخش"
                title="سرعت پخش"
              >
                {p.rate}x
              </button>
            </div>
            <div className="vrow">
              <button type="button" className="nbtn small" onClick={p.toggleMute} aria-label="بی‌صدا">
                {p.muted || p.volume === 0 ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={volPct}
                onChange={(e) => p.setVolume(Number(e.target.value) / 100)}
                className="vol-slider"
                style={{ ['--vp' as string]: `${volPct}%` }}
                aria-label="بلندی صدا"
              />
            </div>
            <div
              className="pbar spbar"
              role="slider"
              aria-label="نوار زمان"
              aria-valuenow={Math.round(p.progress * 100)}
              tabIndex={0}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                p.seek(1 - (e.clientX - r.left) / r.width);
              }}
            >
              <div style={{ width: `${p.progress * 100}%` }} />
            </div>
            <span className="time num" dir="ltr">
              {fmt(p.currentTime)} / {fmt(p.duration)}
            </span>
          </div>
        </div>
        <div className="vinyl">
          <div className="vring" style={{ ['--p' as string]: `${p.progress * 100}%` }} />
          <div className="label">♪</div>
        </div>
      </div>
    </div>
  );
}
