import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import Nav from '@/components/Nav'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Personal OS',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
}

const themeScript = `
  (function() {
    var theme = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  })();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.variable}>
        {children}
        <Suspense fallback={null}>
          <Nav />
        </Suspense>
      </body>
    </html>
  )
}
