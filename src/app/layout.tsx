import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export const metadata: Metadata = {
  title: 'CleanShot — Photo Metadata Cleaner & EXIF Inspector',
  description:
    'Inspect and remove selected EXIF, GPS, and other metadata from supported images. CleanShot processes in your browser by default and reports unsupported files instead of marking them as cleaned.',
  keywords: [
    'EXIF metadata cleaner',
    'remove metadata from photos',
    'photo privacy tool',
    'bulk photo metadata remover',
    'remove GPS metadata from photos',
    'image metadata inspector',
  ],
  authors: [{ name: 'CleanShot Privacy Team' }],
  openGraph: {
    title: 'CleanShot — Photo Metadata Cleaner',
    description:
      'Inspect and remove selected metadata from supported image formats. Browser processing is the default; server uploads only occur when server mode is explicitly selected.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'CleanShot — Photo Metadata Cleaner',
    description: 'Inspect and remove selected metadata from supported images, with browser processing by default.',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
      { url: '/app-icon-black.png', media: '(prefers-color-scheme: light)' },
      { url: '/app-icon-white.png', media: '(prefers-color-scheme: dark)' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className="antialiased min-h-dvh bg-background text-foreground transition-colors duration-200 relative selection:bg-accent/20 selection:text-accent">
        <ThemeProvider>
          {/* Static decorative glow: avoids a continuously animated filter layer. */}
          <div className="aurora-mesh" aria-hidden="true" />

          {/* Main Content */}
          <div className="relative z-10 flex flex-col min-h-dvh">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
