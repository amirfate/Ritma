import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import localFont from 'next/font/local';

import { AuthProvider, AuthNav } from '../lib/store';
import { PlayerBar, PlayerProvider } from '../lib/player';
import './globals.css';

const vazir = localFont({
  src: [
    { path: '../fonts/Vazirmatn-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/Vazirmatn-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-vazir',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ریتما — احترام به موسیقی',
  description: 'پلتفرم پخش و فروش موسیقی ایرانی',
};

export default function RootLayout({ children }: { children: React.ReactNode }): ReactElement {
  return (
    <html lang="fa" dir="rtl">
      <body className={`${vazir.variable} ritma-body`}>
        <AuthProvider>
          <PlayerProvider>
            <header className="topbar">
              <a href="/" className="brand">
                ریتما<span className="brand-dot">.</span>
              </a>
              <nav className="topnav">
                <a href="/albums">آلبوم‌ها</a>
                <a href="/artists">هنرمندان</a>
              </nav>
              <AuthNav />
            </header>
            <main className="page">{children}</main>
            <PlayerBar />
            <footer className="foot">ریتما — احترام به موسیقی</footer>
          </PlayerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
