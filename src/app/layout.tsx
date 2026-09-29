import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'CleanShot — Lossless Bulk Photo Metadata Stripper & EXIF Inspector',
  description:
    'Remove EXIF, GPS coordinates, camera serial numbers, and device fingerprints from photos in bulk losslessly with zero quality loss directly in your browser.',
  keywords: [
    'EXIF stripper',
    'remove metadata from photos',
    'lossless EXIF cleaner',
    'bulk photo privacy',
    'remove GPS from photos',
    'pixel identical metadata remover',
  ],
  authors: [{ name: 'CleanShot Privacy Team' }],
  openGraph: {
    title: 'CleanShot — Lossless Photo Metadata Stripper',
    description:
      'Remove EXIF, GPS, serials, and timestamps from photos in bulk losslessly with zero quality loss.',
    type: 'website',
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="antialiased min-h-dvh bg-[#FAFAFA] dark:bg-[#0C0C10] text-n-900 dark:text-n-100 transition-colors duration-200">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
