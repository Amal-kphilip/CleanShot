import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'CleanShot — Free & Private Metadata Remover',
  description:
    'Remove targeted metadata from supported images, videos, audio, PDFs, and documents. Free, no account, no file uploads by default.',
  keywords: [
    'EXIF metadata cleaner',
    'remove metadata from photos',
    'remove metadata from pdf',
    'remove metadata from video',
    'remove metadata from audio',
    'photo privacy tool',
    'bulk metadata remover',
    'remove GPS metadata from photos',
    'image metadata inspector',
  ],
  authors: [{ name: 'CleanShot' }],
  openGraph: {
    title: 'CleanShot — Free & Private Metadata Remover',
    description:
      'Remove targeted metadata from photos, videos, audio, PDFs, and documents directly in your browser.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'CleanShot — Free & Private Metadata Remover',
    description: 'Remove targeted metadata from supported files directly in your browser.',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body
        suppressHydrationWarning
        className={`antialiased min-h-dvh flex flex-col bg-background text-foreground ${plusJakarta.variable}`}
      >
        <ThemeProvider>
          <div className="flex flex-col flex-1 items-center w-full">
            <div className="w-full max-w-[1280px] flex flex-col flex-1 px-5 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
