'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { ShieldCheck, Cpu, CheckCircle2, AlertTriangle, ArrowRight, Zap, RefreshCw, FileCode } from 'lucide-react';
import Link from 'next/link';

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-12">
        {/* Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 text-xs font-semibold border border-brand-200 dark:border-brand-800">
            <Cpu className="w-3.5 h-3.5" />
            <span>Under The Hood</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-surface-900 dark:text-white">
            How Lossless Stripping Works
          </h1>
          <p className="text-base sm:text-lg text-surface-600 dark:text-surface-400 max-w-2xl mx-auto">
            Traditional tools re-encode images and degrade visual quality. CleanShot operates directly on the binary byte stream to remove metadata without touching image pixels.
          </p>
        </div>

        {/* Comparison: Lossy vs CleanShot Lossless */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Traditional Way */}
          <div className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-red-200 dark:border-red-900/50 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <span>Standard Tools (Lossy Re-encoding)</span>
            </div>
            <ol className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 space-y-2.5 list-decimal pl-4">
              <li>Decodes compressed JPEG/PNG into raw uncompressed pixels in memory.</li>
              <li>Re-compresses pixels with an encoder (e.g. libjpeg quality 85).</li>
              <li>Introduces DCT generational degradation, color shifts, and blocking artifacts.</li>
              <li>Alters the original binary image data completely.</li>
            </ol>
          </div>

          {/* CleanShot Lossless Way */}
          <div className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-emerald-200 dark:border-emerald-800 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-bold text-base">
              <CheckCircle2 className="w-5 h-5" />
              <span>CleanShot (Byte-Stream Segment Stripping)</span>
            </div>
            <ol className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 space-y-2.5 list-decimal pl-4">
              <li>Reads raw container markers (<code className="text-brand-500 font-mono">0xFFE1</code> EXIF, <code className="text-brand-500 font-mono">0xFFFE</code> COM, <code className="text-brand-500 font-mono">tEXt</code>).</li>
              <li>Slices out auxiliary metadata segments from the byte array.</li>
              <li>Copies entropy-coded DCT scan stream (<code className="text-brand-500 font-mono">0xFFDA</code> &rarr; <code className="text-brand-500 font-mono">0xFFD9</code>) byte-for-byte.</li>
              <li>100% pixel-identical output with 0 visual quality loss.</li>
            </ol>
          </div>
        </div>

        {/* Format Specific Deep Dive */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-surface-900 dark:text-white">
            Format-by-Format Guarantees
          </h2>

          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-2">
              <h3 className="text-base font-bold text-brand-600 dark:text-brand-400">
                1. JPEG / JFIF
              </h3>
              <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                JPEG files are structured as markers. CleanShot parses marker pairs between <code className="font-mono">0xFFD8</code> (SOI) and <code className="font-mono">0xFFDA</code> (SOS). It drops <code className="font-mono">0xFFE1</code> (EXIF/XMP) and <code className="font-mono">0xFFFE</code> (COM), retains <code className="font-mono">0xFFE2</code> ICC profile if enabled, and preserves the exact Huffman tables (DHT), Quantization tables (DQT), and DCT scan payload untouched.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-2">
              <h3 className="text-base font-bold text-brand-600 dark:text-brand-400">
                2. PNG
              </h3>
              <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                PNG files are sequences of 4-byte typed chunks. CleanShot drops ancillary chunks (<code className="font-mono">tEXt</code>, <code className="font-mono">zTXt</code>, <code className="font-mono">iTXt</code>, <code className="font-mono">eXIf</code>, <code className="font-mono">tIME</code>, <code className="font-mono">dSIG</code>) while passing through critical rendering chunks (<code className="font-mono">IHDR</code>, <code className="font-mono">PLTE</code>, <code className="font-mono">IDAT</code>, <code className="font-mono">IEND</code>).
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-2">
              <h3 className="text-base font-bold text-brand-600 dark:text-brand-400">
                3. WebP
              </h3>
              <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                WebP files use a RIFF container. CleanShot drops the <code className="font-mono">EXIF</code> and <code className="font-mono">XMP </code> FourCC chunks, updates the <code className="font-mono">VP8X</code> header feature flags bitmask, and updates the RIFF container length without decoding the VP8/VP8L compressed bitstream.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-2">
              <h3 className="text-base font-bold text-brand-600 dark:text-brand-400">
                4. SVG Vector Graphics
              </h3>
              <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                Vector graphics are sanitized to remove XML comments, <code className="font-mono">&lt;metadata&gt;</code>, RDF tags, and proprietary editor metadata (Inkscape, Adobe Illustrator, Figma) while preserving coordinate paths and styling.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 rounded-3xl bg-brand-600 text-white text-center space-y-4">
          <h3 className="text-2xl font-bold">Ready to strip metadata losslessly?</h3>
          <p className="text-xs sm:text-sm text-brand-100 max-w-md mx-auto">
            Try CleanShot now. 100% private, instant in-browser batch processing.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-brand-600 font-bold text-sm shadow-md hover:bg-brand-50 transition-colors"
          >
            <span>Start Stripping Photos</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
