'use client';

// Topbar with mobile drawer + theme switcher (ported from ritma-app app.js v3.4)

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { AuthNav } from './store';

const THEME_KEY = 'ritma.theme';

interface ThemeOpt {
  cls: string;
  sw: string;
  name: string;
  desc: string;
}

const THEMES: ThemeOpt[] = [
  { cls: '', sw: 'sw o', name: 'اصلی', desc: 'آبی یخی و قرمز' },
  { cls: 'tA', sw: 'sw a', name: 'شب طلایی', desc: 'تیره با اکسنت طلایی' },
  { cls: 'tB', sw: 'sw b', name: 'گالری کرم', desc: 'روشن گرم با اکسنت مسی' },
  { cls: 'tC', sw: 'sw c', name: 'سینمایی زغالی', desc: 'تیره سرد با اکسنت قرمز' },
];

function applyTheme(cls: string): void {
  document.body.classList.remove('tA', 'tB', 'tC');
  if (cls) document.body.classList.add(cls);
}

export function Topbar(): ReactElement {
  const [theme, setTheme] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // restore saved theme once
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) ?? '';
    applyTheme(saved);
    setTheme(saved);
  }, []);

  // close theme menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuOpen]);

  const pick = (cls: string): void => {
    applyTheme(cls);
    localStorage.setItem(THEME_KEY, cls);
    setTheme(cls);
    setMenuOpen(false);
    setNavOpen(false);
  };

  return (
    <>
      <header className="topbar">
        <a href="/" className="brand">
          ریتما<span className="brand-dot">.</span>
        </a>
        <nav className={`topnav${navOpen ? ' open' : ''}`}>
          <a href="/albums" onClick={() => setNavOpen(false)}>
            آلبوم‌ها
          </a>
          <a href="/artists" onClick={() => setNavOpen(false)}>
            هنرمندان
          </a>
          <a href="/pricing" onClick={() => setNavOpen(false)}>
            خرید اشتراک
          </a>
          <a href="/wallet" onClick={() => setNavOpen(false)}>
            کیف پول
          </a>
          <a href="/library" onClick={() => setNavOpen(false)}>
            کتابخانه
          </a>
          <a href="/devices" onClick={() => setNavOpen(false)}>
            دستگاه‌ها
          </a>
          <a href="/artist" onClick={() => setNavOpen(false)}>
            پنل هنرمند
          </a>
        </nav>
        <AuthNav />
        <div ref={menuRef} style={{ position: 'relative', flex: 'none' }}>
          <button
            type="button"
            className="nbtn small gearbtn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="تنظیمات ظاهر"
          >
            ⚙
          </button>
          <div className={`setmenu${menuOpen ? ' open' : ''}`}>
            <h4>ظاهر</h4>
            {THEMES.map((t) => (
              <div key={t.name} className={`thopt${theme === t.cls ? ' act' : ''}`} onClick={() => pick(t.cls)}>
                <span className={t.sw} />
                <div>
                  <b>{t.name}</b>
                  <span>{t.desc}</span>
                </div>
                <span className="chk">✓</span>
              </div>
            ))}
            <div className="setnote">انتخاب شما روی همین دستگاه ذخیره می‌شود</div>
          </div>
        </div>
        <button
          type="button"
          className="nbtn small burger"
          onClick={() => setNavOpen((o) => !o)}
          aria-label="منو"
        >
          ☰
        </button>
      </header>
      <div className={`nav-mask${navOpen ? ' on' : ''}`} onClick={() => setNavOpen(false)} />
    </>
  );
}
