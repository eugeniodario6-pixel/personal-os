import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import SWRegister from './sw-register';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastContainer } from '@/components/Toast';

const inter = Inter({
  subsets: ['latin'],
  // Full weight range — Inter variable covers 100–900
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
  // Enable Linear's OpenType features via CSS; font-feature-settings in globals.css
});

export const metadata: Metadata = {
  title: 'Personal OS',
  description: 'Your personal health and habit operating system',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Personal OS',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#08090a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var saved = localStorage.getItem('theme');
            var preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', saved || preferred);
          })();
        `}} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <SWRegister />
          <main className="page">{children}</main>
          <Nav />
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
